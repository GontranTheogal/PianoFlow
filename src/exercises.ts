/** Générateurs d'exercices (logique pure, testable) : oreille, rythme, déchiffrage, cinq doigts.
 *  Chaque partie est différente, mais le niveau est contrôlé : on progresse sans jamais tomber sur l'injouable. */
import { shuffle, pick, drawN, kb, mulberry32, type Rng } from "./course/build";
import { buildXml, type Ev, type Dur, type PieceSpec } from "./course/xml";
import { MAJOR_KEYS, MINOR_KEYS, midiOf, nameOf, keyLabel, degreePitch, chordPitches, type KeyDef, type Pitch } from "./course/theory";
import type { Q } from "./course/types";

const NOTE = ["Do", "Do♯", "Ré", "Ré♯", "Mi", "Fa", "Fa♯", "Sol", "Sol♯", "La", "La♯", "Si"];
export const rngNow = () => mulberry32((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);

// ═════════════ Oreille ═════════════
interface IV { name: string; semi: number; song?: string; }
const IVS: IV[] = [
  { name: "seconde majeure", semi: 2, song: "« Frère Jacques » (Frè-re)" },
  { name: "tierce mineure", semi: 3, song: "« Greensleeves » (début)" },
  { name: "tierce majeure", semi: 4, song: "« Oh When the Saints » (Oh when)" },
  { name: "quarte juste", semi: 5, song: "« La Marseillaise » (Al-lons)" },
  { name: "triton", semi: 6, song: "« Maria » de West Side Story" },
  { name: "quinte juste", semi: 7, song: "« Ah ! vous dirai-je, maman » (Ah vous)" },
  { name: "sixte majeure", semi: 9, song: "« My Bonnie » (My Bon-)" },
  { name: "septième mineure", semi: 10, song: "thème de « Star Trek » (série d'origine)" },
  { name: "octave", semi: 12, song: "« Over the Rainbow » (Some-where)" },
];
export const INTERVAL_LEVELS: number[][] = [[4, 7, 12], [2, 3, 4, 5, 7, 12], [2, 3, 4, 5, 6, 7, 9, 10, 12]];
export function intervalDrill(level: number, rng: Rng = rngNow(), n = 10): Q[] {
  const set = IVS.filter((x) => INTERVAL_LEVELS[Math.max(0, Math.min(2, level - 1))].includes(x.semi));
  return drawN(rng, set, n).map((iv) => {
    const root = 55 + Math.floor(rng() * 10), top = root + iv.semi;
    const wrong = shuffle(rng, set.filter((x) => x !== iv)).slice(0, 3);
    const options = shuffle(rng, [iv, ...wrong]).map((x) => x.name);
    return {
      k: "choice", prompt: "Quel intervalle entends-tu ?", options, answer: options.indexOf(iv.name),
      audio: { steps: [[root], [top], [root, top]], ms: 750 },
      explain: `${NOTE[root % 12]} → ${NOTE[top % 12]} : ${iv.semi} demi-tons, ${iv.name}.${iv.song ? ` Repère : ${iv.song}.` : ""}`,
    } as Q;
  });
}

const CH: { q: "maj" | "min" | "dim" | "aug"; name: string; semis: number[]; tip: string }[] = [
  { q: "maj", name: "majeur", semis: [0, 4, 7], tip: "lumineux, stable" },
  { q: "min", name: "mineur", semis: [0, 3, 7], tip: "sombre, mélancolique" },
  { q: "dim", name: "diminué", semis: [0, 3, 6], tip: "tendu, inquiet" },
  { q: "aug", name: "augmenté", semis: [0, 4, 8], tip: "flottant, étrange" },
];
/** Nom de la fondamentale (lettre + altération) : bémols par défaut (Mi♭, Si♭…), dièses pour les accords mineurs ou diminués
 *  sur Do♯, Fa♯, Sol♯ (Ré♭ mineur s'écrirait avec un Fa♭). Les autres notes de l'accord en découlent, tierce par tierce. */
const ROOT_FLAT = [[0, 0], [1, -1], [1, 0], [2, -1], [2, 0], [3, 0], [3, 1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0]];
const ROOT_SHARP: Record<number, number[]> = { 1: [0, 1], 6: [3, 1], 8: [4, 1] };
function spellChord(rootMidi: number, q: "maj" | "min" | "dim" | "aug"): string {
  const pc = rootMidi % 12, [li, alter] = (q === "min" || q === "dim") && ROOT_SHARP[pc] ? ROOT_SHARP[pc] : q === "aug" && pc === 6 ? [4, -1] : ROOT_FLAT[pc];
  return chordPitches({ li, alter }, 4, q).map((p) => nameOf(p)).join(" – ");
}
export function chordEarDrill(level: number, rng: Rng = rngNow(), n = 10): Q[] {
  const set = CH.slice(0, level <= 1 ? 2 : level === 2 ? 3 : 4);
  return drawN(rng, set, n).map((c) => {
    const root = 53 + Math.floor(rng() * 10), notes = c.semis.map((x) => root + x);
    const options = shuffle(rng, set.map((x) => x.name));
    return {
      k: "choice", prompt: "Cet accord est…", options, answer: options.indexOf(c.name),
      audio: { steps: [[notes[0]], [notes[1]], [notes[2]], notes], ms: 520 },
      explain: `Accord ${c.name} (${c.tip}) : ${spellChord(root, c.q)}.`,
    } as Q;
  });
}

/** Écho : l'appli joue une courte mélodie, on la rejoue d'oreille. Toujours en Do majeur, en partant de Do (repère). */
export const ECHO_LEVELS = [
  { len: 3, pool: [60, 62, 64], label: "3 notes · Do Ré Mi" },
  { len: 4, pool: [60, 62, 64, 65, 67], label: "4 notes · Do à Sol" },
  { len: 5, pool: [60, 62, 64, 65, 67, 69, 71, 72], label: "5 notes · la gamme" },
  { len: 6, pool: [55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72], label: "6 notes · sauts" },
];
export function echoDrill(level: number, rng: Rng = rngNow(), n = 6): Q[] {
  const L = ECHO_LEVELS[Math.max(0, Math.min(ECHO_LEVELS.length - 1, level - 1))];
  const out: Q[] = [];
  for (let k = 0; k < n; k++) {
    const notes = [60];
    while (notes.length < L.len) {
      const i = L.pool.indexOf(notes[notes.length - 1]);
      const step = level <= 2 ? pick(rng, [-1, 1, 1, -1, 2, -2, 0]) : pick(rng, [-1, 1, -2, 2, 3, -3, 1, -1]);
      const j = Math.max(0, Math.min(L.pool.length - 1, i + step));
      notes.push(L.pool[j]);
    }
    out.push({ k: "seq", prompt: "Rejoue la mélodie (elle commence sur Do)", notes, hidden: true, audio: { steps: notes.map((m) => [m]), ms: 600 }, kbd: kb(55, 76), hint: `Les notes : ${notes.map((m) => NOTE[m % 12]).join(" – ")}` } as Q);
  }
  return out;
}

// ═════════════ Rythme ═════════════
/** Cellules d'un temps ou plus, en croches (négatif = silence). */
export const RHYTHM_LEVELS: { label: string; beats: number; beatType?: 4 | 8; cells: number[][]; bpm: number }[] = [
  { label: "Noires et blanches", beats: 4, cells: [[2], [2], [4], [8]], bpm: 72 },
  { label: "+ silences", beats: 4, cells: [[2], [4], [-2], [2], [-4]], bpm: 72 },
  { label: "+ croches", beats: 4, cells: [[2], [1, 1], [1, 1], [4], [-2]], bpm: 66 },
  { label: "+ noire pointée", beats: 4, cells: [[2], [1, 1], [3, 1], [4], [-2]], bpm: 66 },
  { label: "Mesure à 3 temps", beats: 3, cells: [[2], [4], [6], [1, 1], [3, 1], [-2]], bpm: 80 },
  { label: "Contretemps", beats: 4, cells: [[-1, 1], [1, 1], [2], [1, 2, 1], [3, 1]], bpm: 60 },
  { label: "Doubles croches, rythme pointé", beats: 4, cells: [[2], [0.5, 0.5, 0.5, 0.5], [1, 0.5, 0.5], [0.5, 0.5, 1], [1.5, 0.5], [1, 1]], bpm: 56 },
  { label: "Triolets", beats: 4, cells: [[2], [2 / 3, 2 / 3, 2 / 3], [1, 1], [4]], bpm: 60 },
  { label: "Mesure à 6/8", beats: 6, beatType: 8, cells: [[3], [1, 1, 1], [2, 1], [6]], bpm: 100 },
];
export function rhythmPattern(level: number, rng: Rng, bars = 2): number[] {
  const L = RHYTHM_LEVELS[Math.max(0, Math.min(RHYTHM_LEVELS.length - 1, level - 1))];
  const out: number[] = [];
  for (let b = 0; b < bars; b++) {
    let left = L.beatType === 8 ? L.beats : L.beats * 2;
    while (left > 0) {
      const fits = L.cells.filter((c) => c.reduce((s, x) => s + Math.abs(x), 0) <= left + 1e-9);
      const c = pick(rng, fits.length ? fits : [[1]]);
      out.push(...c); left -= c.reduce((s, x) => s + Math.abs(x), 0); if (Math.abs(left) < 1e-9) left = 0;
    }
  }
  if (out.every((x) => x < 0)) out[0] = -out[0];
  if (out[out.length - 1] < 0 && out.filter((x) => x > 0).length < 2) out[out.length - 1] = -out[out.length - 1];
  return out;
}
export function rhythmDrill(level: number, rng: Rng = rngNow(), n = 6): Q[] {
  const L = RHYTHM_LEVELS[Math.max(0, Math.min(RHYTHM_LEVELS.length - 1, level - 1))];
  return Array.from({ length: n }, () => ({ k: "rhythm", prompt: "Lis et tape ce rythme", pattern: rhythmPattern(level, rng), bpm: L.bpm, beats: L.beats, beatType: L.beatType } as Q));
}

// ═════════════ Déchiffrage ═════════════
export const SIGHT_LEVELS = [
  { label: "Main droite · Do", hands: "R", keys: ["C"], beats: 4, cells: [[2], [2], [4]], bars: 4 },
  { label: "Deux mains · Do", hands: "both", keys: ["C"], beats: 4, cells: [[2], [2], [4]], bars: 4 },
  { label: "Deux mains · croches", hands: "both", keys: ["C", "G"], beats: 4, cells: [[2], [1, 1], [4], [2]], bars: 8 },
  { label: "Sol, Fa, Ré · 3 ou 4 temps", hands: "both", keys: ["G", "F", "D"], beats: 0, cells: [[2], [1, 1], [4], [3, 1]], bars: 8 },
  { label: "Toutes tonalités simples", hands: "both", keys: ["C", "G", "F", "D", "B♭", "A"], beats: 0, cells: [[2], [1, 1], [3, 1], [4], [6]], bars: 8 },
] as const;

/** Une pièce de déchiffrage : mélodie en position de cinq doigts (MD), basse simple (MG), doigtés écrits, cadence finale sur la tonique. */
export function sightReading(level: number, rng: Rng = rngNow()): { spec: PieceSpec; title: string } {
  const L = SIGHT_LEVELS[Math.max(0, Math.min(SIGHT_LEVELS.length - 1, level - 1))];
  const kid = pick(rng, [...L.keys]), key = MAJOR_KEYS.find((k) => k.id === kid)!;
  const beats = L.beats || pick(rng, [3, 4]);
  const len = beats * 2;
  const tonicR = octFor(key, 60, 67), tonicL = octFor(key, 48, 55);
  const pos = (oct: number, deg: number): Pitch => degreePitch({ li: key.li, alter: key.alter }, oct, deg, [0, 2, 4, 5, 7, 9, 11]);
  const rh: Ev[] = [], lh: Ev[] = [];
  let deg = pick(rng, [0, 2, 4]);
  for (let b = 0; b < L.bars; b++) {
    const last = b === L.bars - 1;
    let left = len;
    const rhythm: number[] = [];
    if (last) rhythm.push(len);
    else while (left > 0) {
      const fits: number[][] = L.cells.filter((c) => c.reduce((s: number, x: number) => s + x, 0) <= left).map((c) => [...c]);
      const c = pick(rng, fits.length ? fits : [[1]]);
      rhythm.push(...c); left -= c.reduce((s: number, x: number) => s + x, 0);
    }
    rhythm.forEach((d, i) => {
      if (last) deg = 0;
      else if (b === L.bars - 2 && i === rhythm.length - 1) deg = pick(rng, [1, 4]);           // avant-dernière note : sensible ou dominante
      else { const step = pick(rng, [-1, 1, -1, 1, 2, -2, 0]); deg = Math.max(0, Math.min(4, deg + step)); }
      rh.push({ notes: [{ p: pos(tonicR, deg), finger: deg + 1 }], dur: d as Dur });
    });
    // main gauche : tonique ou dominante (dans la position de cinq doigts grave : degré 0 = doigt 5, degré 4 = doigt 1)
    const harm = last ? 0 : b % 2 === 0 ? 0 : pick(rng, [4, 0, 4]);
    if (L.hands === "both") {
      if (level <= 2) lh.push({ notes: [{ p: pos(tonicL, harm), finger: 5 - harm }], dur: len as Dur });
      else { const half = (len / 2) as Dur; if (beats === 4 && !last) { lh.push({ notes: [{ p: pos(tonicL, harm), finger: 5 - harm }], dur: half }, { notes: [{ p: pos(tonicL, harm === 0 ? 2 : 4), finger: harm === 0 ? 3 : 1 }], dur: half }); } else lh.push({ notes: [{ p: pos(tonicL, harm), finger: 5 - harm }], dur: len as Dur }); }
    }
  }
  const title = `Déchiffrage n°${Math.floor(rng() * 900) + 100} · ${keyLabel(key)}`;
  return { title, spec: { title, bpm: 72, fifths: key.fifths, beats, beatType: 4, rh, lh: L.hands === "both" ? lh : null } };
}
function octFor(k: KeyDef, lo: number, hi: number): number {
  for (let o = 2; o <= 5; o++) { const m = midiOf({ li: k.li, alter: k.alter, oct: o }); if (m >= lo && m <= hi) return o; }
  return 4;
}

// ═════════════ Cinq doigts dans toutes les tonalités ═════════════
/** 1-2-3-4-5-4-3-2-1 aux deux mains (la gauche une octave plus bas), en majeur puis en mineur : la base de toutes les positions. */
export function fiveFinger(key: KeyDef): { spec: PieceSpec; title: string } {
  const tonicR = octFor(key, 59, 66), tonicL = tonicR - 1;
  const maj = [0, 2, 4, 5, 7, 9, 11], min = [0, 2, 3, 5, 7, 8, 10];
  const seq = [0, 1, 2, 3, 4, 3, 2, 1];
  const rh: Ev[] = [], lh: Ev[] = [];
  for (const semis of [maj, min]) {
    for (const d of seq) {
      rh.push({ notes: [{ p: degreePitch({ li: key.li, alter: key.alter }, tonicR, d, semis), finger: d + 1 }], dur: 1 });
      lh.push({ notes: [{ p: degreePitch({ li: key.li, alter: key.alter }, tonicL, d, semis), finger: 5 - d }], dur: 1 });
    }
  }
  rh.push({ notes: [{ p: degreePitch({ li: key.li, alter: key.alter }, tonicR, 0, maj), finger: 1 }], dur: 8 });
  lh.push({ notes: [{ p: degreePitch({ li: key.li, alter: key.alter }, tonicL, 0, maj), finger: 5 }], dur: 8 });
  const title = `Cinq doigts en ${nameOf(key)} (majeur puis mineur)`;
  return { title, spec: { title, bpm: 80, fifths: key.fifths, rh, lh } };
}
export const xmlOf = (s: PieceSpec) => buildXml(s);
void MINOR_KEYS;
