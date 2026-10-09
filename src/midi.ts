export type NoteHandler = (pitch: number, velocity: number, on: boolean) => void;
/** Contrôleur MIDI (64 = pédale de sustain, valeur ≥ 64 = enfoncée). */
export type ControlHandler = (controller: number, value: number) => void;
/** État du clavier (une note jouée suffit à passer à « ok »). */
export interface MidiStatus { state: "ok" | "none" | "error"; names: string[]; detail: string; }

/** Ports toujours présents qui ne sont pas des claviers : sessions réseau, ports virtuels du système ou d'autres logiciels. */
const VIRTUAL = /network|session|réseau|midi through|through port|\biac\b|loopmidi|loopback|diagnostic|virtual/i;
export const realPorts = (names: string[]) => names.filter((n) => !VIRTUAL.test(n));

function fromPorts(names: string[]): MidiStatus {
  const real = realPorts(names);
  if (real.length) return { state: "ok", names: real, detail: "Clavier : " + real.join(", ") };
  return { state: "none", names: [], detail: names.length ? `Aucun clavier : seulement des ports MIDI virtuels (${names.join(", ")})` : "Aucun clavier détecté" };
}
export async function initMidi(onNote: NoteHandler, onStatus: (s: MidiStatus) => void, onControl: ControlHandler = () => {}) {
  // une note reçue prouve qu'un clavier est branché, quoi qu'en dise la liste des ports
  let last: MidiStatus = { state: "none", names: [], detail: "" };
  const status = (s: MidiStatus) => { last = s; onStatus(s); };
  const note: NoteHandler = (p, v, on) => {
    if (on && last.state !== "ok") status({ state: "ok", names: last.names.length ? last.names : ["Clavier MIDI"], detail: "Clavier : des notes arrivent" });
    onNote(p, v, on);
  };

  // Web MIDI : Chrome, Edge, Firefox (Safari, donc l'iPad, ne l'a pas)
  if (!navigator.requestMIDIAccess) {
    status({ state: "error", names: [], detail: "Web MIDI non supporté (utilise Chrome, Edge ou Firefox)" });
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
