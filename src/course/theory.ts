/** Théorie musicale du parcours : hauteurs ORTHOGRAPHIÉES (Fa♯ ≠ Sol♭), accords, renversements, accords diatoniques d'une tonalité.
 *  Logique pure (aucun accès au DOM). S'appuie sur les gammes de techCore. */
import { MAJOR_KEYS, MINOR_KEYS, FR, midiOf, nameOf, type KeyDef, type Pitch } from "../techCore";
export { midiOf, nameOf, FR, MAJOR_KEYS, MINOR_KEYS, type Pitch, type KeyDef };

const SEMI = [0, 2, 4, 5, 7, 9, 11];
export const accSym = (a: number) => (a > 0 ? "♯".repeat(a) : a < 0 ? "♭".repeat(-a) : "");
export const pitchLabel = (p: Pitch) => FR[p.li] + accSym(p.alter);                        // « Sol♯ »

/** Pitch d'un degré (0 = tonique) d'une gamme, au-dessus de la tonique située en octave `oct`. `semis` = écarts en demi-tons de chaque degré. */
export function degreePitch(root: { li: number; alter: number }, oct: number, degree: number, semis: number[]): Pitch {
  const n = semis.length, i = ((degree % n) + n) % n, o = Math.floor(degree / n);
  const abs = root.li + degree, li = ((abs % 7) + 7) % 7, octave = oct + Math.floor(abs / 7);
  const rootMidi = midiOf({ li: root.li, alter: root.alter, oct });
  return { li, oct: octave, alter: rootMidi + semis[i] + 12 * o - (SEMI[li] + 12 * (octave + 1)) };
}

// ── accords ──
export type Quality = "maj" | "min" | "dim" | "aug" | "dom7" | "maj7" | "min7";
const CHORD_SEMIS: Record<Quality, number[]> = { maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], dom7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10] };
const CHORD_STEPS: Record<Quality, number[]> = { maj: [0, 2, 4], min: [0, 2, 4], dim: [0, 2, 4], aug: [0, 2, 4], dom7: [0, 2, 4, 6], maj7: [0, 2, 4, 6], min7: [0, 2, 4, 6] };

/** Notes d'un accord à l'état fondamental, de la grave à l'aiguë, chacune écrite avec la bonne lettre (tierces empilées). */
export function chordPitches(root: { li: number; alter: number }, oct: number, q: Quality): Pitch[] {
  const rootMidi = midiOf({ li: root.li, alter: root.alter, oct });
  return CHORD_STEPS[q].map((step, k) => {
    const abs = root.li + step, li = abs % 7, octave = oct + Math.floor(abs / 7);
    return { li, oct: octave, alter: rootMidi + CHORD_SEMIS[q][k] - (SEMI[li] + 12 * (octave + 1)) };
  });
}
/** Renversement : la note la plus grave passe une octave plus haut, n fois (1 = 1er renversement, 2 = 2e). */
export function invert(ps: Pitch[], n: number): Pitch[] {
  let out = [...ps];
  for (let i = 0; i < n; i++) { const [low, ...rest] = out; out = [...rest, { ...low, oct: low.oct + 1 }]; }
  return out;
}
export function chordName(root: { li: number; alter: number }, q: Quality, short = false): string {
  const r = nameOf(root);
  if (short) return r + ({ maj: "", min: "m", dim: "°", aug: "+", dom7: "7", maj7: "maj7", min7: "m7" } as const)[q];
  return { maj: `${r} majeur`, min: `${r} mineur`, dim: `${r} diminué`, aug: `${r} augmenté`, dom7: `${r}7 (septième de dominante)`, maj7: `${r} septième majeure`, min7: `${r} mineur septième` }[q];
}
export const INVERSION_NAME = ["position fondamentale", "1er renversement", "2e renversement", "3e renversement"];

// ── tonalités ──
export const ALL_KEYS: KeyDef[] = [...MAJOR_KEYS, ...MINOR_KEYS];
export const keyLabel = (k: KeyDef) => `${nameOf(k)} ${k.mode === "major" ? "majeur" : "mineur"}`;
export const keyTonic = (k: KeyDef) => ({ li: k.li, alter: k.alter });
const MAJ_SCALE = [0, 2, 4, 5, 7, 9, 11], MIN_NAT = [0, 2, 3, 5, 7, 8, 10], MIN_HARM = [0, 2, 3, 5, 7, 8, 11];

/** Accord diatonique sur le degré d (1 à 7) : en mineur, le V (et le VII) utilisent la gamme harmonique (sensible). */
export function degreeChord(k: KeyDef, d: number, seventh = false, oct = 4): { root: Pitch; q: Quality; pitches: Pitch[] } {
  const semis = k.mode === "major" ? MAJ_SCALE : d === 5 || d === 7 ? MIN_HARM : MIN_NAT;
  const root = degreePitch(keyTonic(k), oct, d - 1, semis);
  // la qualité vient des écarts diatoniques : on empile les degrés d, d+2, d+4 (d+6)
  const note = (j: number) => degreePitch(keyTonic(k), oct, d - 1 + j, semis);
  const base = midiOf(root), third = midiOf(note(2)) - base, fifth = midiOf(note(4)) - base, sev = midiOf(note(6)) - base;
  let q: Quality;
  if (seventh) q = third === 4 && fifth === 7 ? (sev === 11 ? "maj7" : "dom7") : third === 3 && fifth === 7 ? "min7" : "dom7";
  else q = third === 4 && fifth === 7 ? "maj" : third === 3 && fifth === 7 ? "min" : third === 3 && fifth === 6 ? "dim" : "aug";
  return { root, q, pitches: chordPitches({ li: root.li, alter: root.alter }, oct, q) };
}
/** Voicing main droite d'une suite d'accords : on choisit le renversement qui bouge le moins (accords « sans bouger »). */
export function voiceLead(chords: Pitch[][], lo = 60, hi = 76): Pitch[][] {
  const out: Pitch[][] = []; let prev: Pitch[] | null = null;
  for (const ch of chords) {
    const cands: Pitch[][] = [];
    for (let inv = 0; inv < ch.length; inv++) for (let shift = -2; shift <= 2; shift++) {
      const v = invert(ch, inv).map((p) => ({ ...p, oct: p.oct + shift }));
      const ms = v.map(midiOf);
      if (ms[0] >= lo && ms[ms.length - 1] <= hi) cands.push(v);
    }
    if (!cands.length) throw new Error("accord hors de la tessiture");
    const cost = (v: Pitch[]) => (prev ? v.reduce((s, p, i) => s + Math.abs(midiOf(p) - midiOf(prev![i % prev!.length])), 0) : Math.abs(midiOf(v[0]) - 60));
    cands.sort((a, b) => cost(a) - cost(b));
    prev = cands[0]; out.push(prev);
  }
  return out;
}
