import { registerPlugin } from "@capacitor/core";
import { isIpadApp } from "./sync";

export type NoteHandler = (pitch: number, velocity: number, on: boolean) => void;
/** Contrôleur MIDI (64 = pédale de sustain, valeur ≥ 64 = enfoncée). */
export type ControlHandler = (controller: number, value: number) => void;
/** État du clavier. « unsure » : un port MIDI existe, mais rien ne prouve que c'est un clavier (ancienne appli iPad) : une note jouée le confirme. */
export interface MidiStatus { state: "ok" | "unsure" | "none" | "error"; names: string[]; detail: string; }

const CoreMidi = registerPlugin<any>("CoreMidi");

/** Ports toujours présents qui ne sont pas des claviers : session réseau d'iOS, ports virtuels du système ou d'autres logiciels. */
const VIRTUAL = /network|session|réseau|midi through|through port|\biac\b|loopmidi|loopback|diagnostic|virtual/i;
export const realPorts = (names: string[]) => names.filter((n) => !VIRTUAL.test(n));

function fromPorts(names: string[], what = "ports MIDI"): MidiStatus {
  const real = realPorts(names);
  if (real.length) return { state: "ok", names: real, detail: "Clavier : " + real.join(", ") };
  return { state: "none", names: [], detail: names.length ? `Aucun clavier : seulement des ${what} virtuels (${names.join(", ")})` : "Aucun clavier détecté" };
}
/** Statut envoyé par le plugin natif : les noms des sources depuis la version qui les filtre, seulement leur nombre avant. */
export function nativeStatus(s: { connected?: boolean; count?: number; names?: string[] }): MidiStatus {
  if (Array.isArray(s.names)) return fromPorts(s.names, "sources");
  return (s.count ?? 0) > 0
    ? { state: "unsure", names: [], detail: "Un périphérique MIDI est vu, mais ce n'est peut-être pas ton clavier (iOS compte sa session réseau) : joue une note pour vérifier." }
    : { state: "none", names: [], detail: "Aucun clavier détecté" };
}

export async function initMidi(onNote: NoteHandler, onStatus: (s: MidiStatus) => void, onControl: ControlHandler = () => {}) {
  // une note reçue prouve qu'un clavier est branché, quoi qu'en dise la liste des ports
  let last: MidiStatus = { state: "none", names: [], detail: "" };
  const status = (s: MidiStatus) => { last = s; onStatus(s); };
  const note: NoteHandler = (p, v, on) => {
    if (on && last.state !== "ok") status({ state: "ok", names: last.names.length ? last.names : ["Clavier MIDI"], detail: "Clavier : des notes arrivent" });
    onNote(p, v, on);
  };

  // 1. Appli native iPad : CoreMIDI via le plugin Swift (Safari / WKWebView n'ont pas Web MIDI)
  if (isIpadApp()) {
    try {
      await CoreMidi.addListener("noteEvent", (e: any) => note(e.pitch, e.velocity, e.on));
      await CoreMidi.addListener("controlEvent", (e: any) => onControl(e.controller, e.value));
      await CoreMidi.addListener("statusEvent", (s: any) => status(nativeStatus(s)));
      status(nativeStatus(await CoreMidi.getStatus())); // état initial (l'événement natif part avant l'abonnement)
      return;
    } catch (err) {
      console.warn("Plugin CoreMidi introuvable (non enregistré côté Swift ?)", err);
      status({ state: "error", names: [], detail: "Plugin MIDI natif introuvable : vérifie MainViewController / CoreMidiPlugin dans Xcode" });
      return;
    }
  }

  // 2. Web MIDI classique (PC, Mac : Chrome / Edge)
  if (!navigator.requestMIDIAccess) {
    status({ state: "error", names: [], detail: "Web MIDI non supporté (utilise Chrome ou Edge)" });
    return;
  }

  try {
    const access = await navigator.requestMIDIAccess({ sysex: false });
    const bind = () => {
      const names: string[] = [];
      access.inputs.forEach((input) => {
        if (input.state === "disconnected") return;
        names.push(input.name ?? "MIDI");
        input.onmidimessage = (e) => {
          if (!e.data) return;
          const [st, pitch, vel] = e.data;
          const cmd = st & 0xf0;
          if (cmd === 0x90 && vel > 0) note(pitch, vel, true);
          else if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) note(pitch, vel, false);
          else if (cmd === 0xb0) onControl(pitch, vel);                 // ici « pitch » = n° de contrôleur, « vel » = valeur
        };
      });
      status(fromPorts(names));
    };
    access.onstatechange = bind;
    bind();
  } catch (err) {
    status({ state: "error", names: [], detail: "Accès MIDI refusé. Autorise le navigateur à lire tes périphériques." });
  }
}
