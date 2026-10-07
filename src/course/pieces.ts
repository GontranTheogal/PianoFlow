/** Morceaux et exercices de base (domaine public) et générateurs d'enchaînements d'accords. */
import { P, M, kbFor, evs, octaveDown, type Tok, type Ev, dur, chordEv, note, buildXml } from "./build";
import { degreeChord, voiceLead, invert, midiOf, nameOf, keyLabel, chordName, chordPitches, type KeyDef, type Pitch, type Quality } from "./theory";
import type { Q } from "./types";

const { w, h, q, dq, e } = dur;

// ── exercices en position de Do (doigtés écrits : 1 = Do … 5 = Sol à la main droite) ──
export const POS_UP_DOWN: Tok[] = [["C4", q, 1], ["D4", q, 2], ["E4", q, 3], ["F4", q, 4], ["G4", q, 5], ["F4", q, 4], ["E4", q, 3], ["D4", q, 2], ["C4", w, 1]];
export const AU_CLAIR: Tok[] = [["C4", q, 1], ["C4", q, 1], ["C4", q, 1], ["D4", q, 2], ["E4", h, 3], ["D4", h, 2], ["C4", q, 1], ["E4", q, 3], ["D4", q, 2], ["D4", q, 2], ["C4", w, 1]];
export const MARY: Tok[] = [
  ["E4", q, 3], ["D4", q, 2], ["C4", q, 1], ["D4", q, 2], ["E4", q, 3], ["E4", q, 3], ["E4", h, 3],
  ["D4", q, 2], ["D4", q, 2], ["D4", h, 2], ["E4", q, 3], ["G4", q, 5], ["G4", h, 5],
  ["E4", q, 3], ["D4", q, 2], ["C4", q, 1], ["D4", q, 2], ["E4", q, 3], ["E4", q, 3], ["E4", q, 3], ["E4", q, 3],
  ["D4", q, 2], ["D4", q, 2], ["E4", q, 3], ["D4", q, 2], ["C4", w, 1],
];
export const ODE: Tok[] = [
  ["E4", q, 3], ["E4", q, 3], ["F4", q, 4], ["G4", q, 5], ["G4", q, 5], ["F4", q, 4], ["E4", q, 3], ["D4", q, 2],
  ["C4", q, 1], ["C4", q, 1], ["D4", q, 2], ["E4", q, 3], ["E4", dq, 3], ["D4", e, 2], ["D4", h, 2],
  ["E4", q, 3], ["E4", q, 3], ["F4", q, 4], ["G4", q, 5], ["G4", q, 5], ["F4", q, 4], ["E4", q, 3], ["D4", q, 2],
  ["C4", q, 1], ["C4", q, 1], ["D4", q, 2], ["E4", q, 3], ["D4", dq, 2], ["C4", e, 1], ["C4", h, 1],
];
/** Accompagnement de la main gauche (une basse par mesure ou par demi-mesure), dans la position de Do grave (Do3 = 5 … Sol3 = 1). */
const lhBass = (bars: string[][]): Tok[] => bars.flatMap((b) => b.length === 1 ? [[b[0], w, b[0] === "C3" ? 5 : 1] as Tok] : b.map((n) => [n, h, n === "C3" ? 5 : 1] as Tok));
export const ODE_LH: Tok[] = lhBass([["C3"], ["G3"], ["C3"], ["G3"], ["C3"], ["G3"], ["C3"], ["G3", "C3"]]);
export const AU_CLAIR_LH: Tok[] = lhBass([["C3"], ["C3", "G3"], ["C3", "G3"], ["C3"]]);
export const MARY_LH: Tok[] = lhBass([["C3"], ["C3"], ["G3"], ["C3"], ["C3"], ["C3"], ["G3"], ["C3"]]);

export const rh = (t: Tok[]) => evs(t);
export const lh = (t: Tok[]) => evs(octaveDown(t));

// ── enchaînements d'accords ──
export interface Step { d: number; seventh?: boolean; }
export interface ProgOpts { title?: string; bpm?: number; lead?: boolean; rounds?: number; }
/** Octave de la fondamentale pour que l'accord de la main droite reste autour du Do central, et celle de la basse pour la main gauche. */
function fit(key: KeyDef, lo: number, hi: number): number {
  for (let oct = 2; oct <= 5; oct++) { const m = midiOf({ li: key.li, alter: key.alter, oct }); if (m >= lo && m <= hi) return oct; }
  throw new Error("tonique hors tessiture");
}
export function progression(key: KeyDef, steps: Step[], o: ProgOpts = {}): { xml: string; title: string; chords: { name: string; pitches: Pitch[]; bass: Pitch }[] } {
  const octR = fit(key, 58, 69), octL = fit(key, 36, 47);
  const seq = Array.from({ length: o.rounds ?? 1 }, () => steps).flat();
  const raw = seq.map((s) => degreeChord(key, s.d, !!s.seventh, octR));
  // accords de la main droite au-dessus de la tonique (sinon le IV ou le V de certaines tonalités descend jusque dans la basse)
  const tonR = midiOf({ li: key.li, alter: key.alter, oct: octR });
  const up = (ps: Pitch[]) => (midiOf(ps[0]) < tonR ? ps.map((p) => ({ ...p, oct: p.oct + 1 })) : ps);
  const rhChords = o.lead ? voiceLead(raw.map((c) => c.pitches), 57, 79) : raw.map((c) => up(c.pitches));
  // basse toujours plus grave que l'accord
  const basses = seq.map((s, i) => { let b = degreeChord(key, s.d, false, octL).root; const lo = Math.min(...rhChords[i].map(midiOf)); while (midiOf(b) >= lo) b = { ...b, oct: b.oct - 1 }; return b; });
  // doigtés de la basse : main posée sur la plus grave (5), un doigt par degré au-dessus
  const pos = (p: Pitch) => p.oct * 7 + p.li, low = Math.min(...basses.map(pos));
  const title = o.title ?? `Enchaînement ${steps.map((s) => ROMAN(key, s)).join(" – ")} en ${keyLabel(key)}`;
  const xml = buildXml({
    title, bpm: o.bpm ?? 60, fifths: key.fifths,
    rh: rhChords.map((c) => chordEv(c, w, rhChordFingers(c))), lh: basses.map((b) => ({ notes: [{ p: b, finger: Math.max(1, 5 - (pos(b) - low)) }], dur: w })),
  });
  return { xml, title, chords: raw.map((c, i) => ({ name: chordName(c.root, c.q, true), pitches: rhChords[i], bass: basses[i] })) };
}
/** Doigtés écrits des accords de la main droite : 1-3-5 (fondamental, 2e renversement), 1-2-5 (1er renversement : quarte en haut), 1-2-3-5 (septièmes). */
export function rhChordFingers(c: Pitch[]): number[] {
  const order = c.map((p, i) => [midiOf(p), i]).sort((a, b) => a[0] - b[0]);
  const ms = order.map(([m]) => m);
  const f = ms.length >= 4 ? [1, 2, 3, 5] : ms.length === 3 ? (ms[2] - ms[1] >= 5 ? [1, 2, 5] : [1, 3, 5]) : [1, 5];
  const out: number[] = []; order.forEach(([, i], k) => (out[i] = f[k])); return out;
}
const ROMANS = ["", "I", "II", "III", "IV", "V", "VI", "VII"];
/** Chiffrage romain : majuscule = accord majeur, minuscule = mineur (selon la tonalité). */
export function ROMAN(key: KeyDef, s: Step): string {
  const c = degreeChord(key, s.d, !!s.seventh), r = ROMANS[s.d];
  const lower = c.q === "min" || c.q === "dim" || c.q === "min7";
  return (lower ? r.toLowerCase() : r) + (c.q === "dim" ? "°" : c.q === "maj7" ? "maj7" : c.q === "dom7" || c.q === "min7" ? "7" : "");
}

export function chordQ(root: { li: number; alter: number }, quality: Quality, hand: "R" | "L", prompt?: string, bassPc?: number, inv = 0): Q {
  const oct = hand === "R" ? 4 : 3, ps = invert(chordPitches(root, oct, quality), inv);
  const pcs = [...new Set(ps.map((p) => midiOf(p) % 12))];
  const name = chordName(root, quality);
  return {
    k: "chord", prompt: prompt ?? `Joue l'accord de ${name} (les touches ensemble)`, pcs, bass: bassPc, name,
    show: { staff: { clef: hand === "R" ? "G" : "F", fifths: 0, evs: [chordEv(ps, 8)] }, },
    kbd: kbFor(ps.map(midiOf)), hint: `${ps.map((p) => nameOf(p)).join(" – ")}`,
  };
}
void P; void M;
