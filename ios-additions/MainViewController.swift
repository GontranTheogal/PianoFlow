// Capacitor 6 ne découvre pas tout seul un plugin local : il faut l'enregistrer ici.
import UIKit
import Capacitor

class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(CoreMidiPlugin())
    }
}
