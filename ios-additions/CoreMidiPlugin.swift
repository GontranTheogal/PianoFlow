// Copié automatiquement dans ios/App/App/ par ios-additions/setup-ios.sh (Capacitor 6).
import Foundation
import Capacitor
import CoreMIDI

@objc(CoreMidiPlugin)
public class CoreMidiPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CoreMidiPlugin"
    public let jsName = "CoreMidi"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise)
    ]

    private var client = MIDIClientRef()
    private var inputPort = MIDIPortRef()
    private var connected = Set<MIDIEndpointRef>()

    public override func load() {
        // Le bloc de notification est appelé au branchement / débranchement du câble.
        MIDIClientCreateWithBlock("PianoFlow" as CFString, &client) { [weak self] _ in
            DispatchQueue.main.async { self?.rescan() }
        }
        MIDIInputPortCreateWithBlock(client, "PianoFlowInput" as CFString, &inputPort) { [weak self] list, _ in
            self?.handle(list)
        }
        rescan()
    }

    @objc func getStatus(_ call: CAPPluginCall) {
        call.resolve(status())
    }

    /// Les sources qui sont vraiment des claviers : ni hors ligne, ni la session réseau qu'iOS crée toujours
    /// (« Network Session 1 »), sinon l'appli se croit branchée sans aucun clavier.
    private func keyboardNames() -> [String] {
        var names: [String] = []
        for i in 0..<MIDIGetNumberOfSources() {
            let src = MIDIGetSource(i)
            var offline: Int32 = 0
            _ = MIDIObjectGetIntegerProperty(src, kMIDIPropertyOffline, &offline)
            if offline != 0 { continue }
            var entity = MIDIEntityRef(), device = MIDIDeviceRef()
            var driver: Unmanaged<CFString>?
            if MIDIEndpointGetEntity(src, &entity) == noErr, MIDIEntityGetDevice(entity, &device) == noErr,
               MIDIObjectGetStringProperty(device, kMIDIPropertyDriverOwner, &driver) == noErr,
               let owner = driver?.takeRetainedValue(), (owner as String).contains("AppleMIDIRTPDriver") { continue }
            var cfName: Unmanaged<CFString>?
            var name = "MIDI"
            if MIDIObjectGetStringProperty(src, kMIDIPropertyDisplayName, &cfName) == noErr, let n = cfName?.takeRetainedValue() { name = n as String }
            names.append(name)
        }
        return names
    }

    private func status() -> [String: Any] {
        let names = keyboardNames()
        return ["connected": !names.isEmpty, "count": names.count, "names": names]
    }

    private func rescan() {
        let count = MIDIGetNumberOfSources()
        var present = Set<MIDIEndpointRef>()
        for i in 0..<count {
            let src = MIDIGetSource(i)
            present.insert(src)
            if !connected.contains(src) { MIDIPortConnectSource(inputPort, src, nil) }
        }
        connected = present
        notifyListeners("statusEvent", data: status())
    }

    private func handle(_ list: UnsafePointer<MIDIPacketList>) {
        var packet = list.pointee.packet
        for _ in 0..<list.pointee.numPackets {
            let bytes = withUnsafeBytes(of: packet.data) { Array($0.prefix(Int(packet.length))) }
            var i = 0
            while i < bytes.count {
                let b = bytes[i]
                if b >= 0xF0 { i += 1; continue }              // messages système : ignorés
                if b & 0x80 == 0 { i += 1; continue }          // octet de données orphelin
                let kind = b & 0xF0
                let size = (kind == 0xC0 || kind == 0xD0) ? 2 : 3
                if (kind == 0x80 || kind == 0x90) && i + 2 < bytes.count {
                    let pitch = Int(bytes[i + 1]), velocity = Int(bytes[i + 2])
                    let on = kind == 0x90 && velocity > 0
                    notifyListeners("noteEvent", data: ["pitch": pitch, "velocity": velocity, "on": on])
                } else if kind == 0xB0 && i + 2 < bytes.count {
                    // contrôleurs (64 = pédale de sustain) : utilisés par les leçons de pédale
                    notifyListeners("controlEvent", data: ["controller": Int(bytes[i + 1]), "value": Int(bytes[i + 2])])
                }
                i += size
            }
            packet = MIDIPacketNext(&packet).pointee
        }
    }
}
