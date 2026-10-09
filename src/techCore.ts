/** Gammes et arpèges : logique pure (aucun accès au DOM, entièrement testable).
 *  Les notes sont ORTHOGRAPHIÉES correctement (Fa♯ majeur contient Mi♯, pas Fa), les doigtés viennent des tables
 *  usuelles d'enseignement, et la pièce générée est un MusicXML avec armure, accidents et doigtés écrits,
 *  que le moteur d'entraînement de l'appli lit comme n'importe quel morceau. */
import { keySigAlter } from "./solfegeCore";

const SEMI = [0, 2, 4, 5, 7, 9, 11];
export const FR = ["Do", "Ré", "Mi", "Fa", "Sol", "La", "Si"];
const STEP = ["C", "D", "E", "F", "G", "A", "B"];

export interface Pitch { li: number; alter: number; oct: number; }
export const midiOf = (p: Pitch) => SEMI[p.li] + p.alter + 12 * (p.oct + 1);
export const nameOf = (p: { li: number; alter: number }) => FR[p.li] + (p.alter > 0 ? "♯".repeat(p.alter) : p.alter < 0 ? "♭".repeat(-p.alter) : "");

export type Mode = "major" | "minor";
export type Form = "major" | "natural" | "harmonic" | "melodic";
export interface KeyDef { id: string; mode: Mode; li: number; alter: number; fifths: number; rh: number[]; lh: number[]; arp: boolean; }

// ── Doigtés d'une octave en montant (8 notes), tables d'enseignement courantes ──
const RH_STD = [1, 2, 3, 1, 2, 3, 4, 5];            // pouce sur la 1re et la 4e note
const LH_STD = [5, 4, 3, 2, 1, 3, 2, 1];
const k = (id: string, mode: Mode, li: number, alter: number, fifths: number, rh: number[], lh: number[], arp = false): KeyDef => ({ id, mode, li, alter, fifths, rh, lh, arp });
export const MAJOR_KEYS: KeyDef[] = [
  k("C", "major", 0, 0, 0, RH_STD, LH_STD, true),
  k("G", "major", 4, 0, 1, RH_STD, LH_STD, true),
  k("D", "major", 1, 0, 2, RH_STD, LH_STD, true),
  k("A", "major", 5, 0, 3, RH_STD, LH_STD, true),
  k("E", "major", 2, 0, 4, RH_STD, LH_STD, true),
  k("B", "major", 6, 0, 5, RH_STD, [4, 3, 2, 1, 4, 3, 2, 1]),
  k("F♯", "major", 3, 1, 6, [2, 3, 4, 1, 2, 3, 1, 2], [4, 3, 2, 1, 3, 2, 1, 4]),
  k("D♭", "major", 1, -1, -5, [2, 3, 1, 2, 3, 4, 1, 2], [3, 2, 1, 4, 3, 2, 1, 3]),
  k("A♭", "major", 5, -1, -4, [3, 4, 1, 2, 3, 1, 2, 3], [3, 2, 1, 4, 3, 2, 1, 3]),
  k("E♭", "major", 2, -1, -3, [3, 1, 2, 3, 4, 1, 2, 3], [3, 2, 1, 4, 3, 2, 1, 3]),
  k("B♭", "major", 6, -1, -2, [4, 1, 2, 3, 1, 2, 3, 4], [3, 2, 1, 4, 3, 2, 1, 3]),
  k("F", "major", 3, 0, -1, [1, 2, 3, 4, 1, 2, 3, 4], LH_STD, true),
];
export const MINOR_KEYS: KeyDef[] = [
  k("A", "minor", 5, 0, 0, RH_STD, LH_STD, true),
  k("E", "minor", 2, 0, 1, RH_STD, LH_STD, true),
  k("D", "minor", 1, 0, -1, RH_STD, LH_STD, true),
  k("G", "minor", 4, 0, -2, RH_STD, LH_STD, true),
  k("C", "minor", 0, 0, -3, RH_STD, LH_STD, true),
  k("F", "minor", 3, 0, -4, [1, 2, 3, 4, 1, 2, 3, 4], LH_STD, true),
];
// Arpèges (accord parfait à l'état fondamental) : doigtés usuels pour ces fondamentales
const ARP_RH = [1, 2, 3, 5], ARP_LH = [5, 3, 2, 1];

const INTERVALS: Record<Form, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11], natural: [0, 2, 3, 5, 7, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11], melodic: [0, 2, 3, 5, 7, 9, 11],
};
const DESC: Record<Form, number[]> = { ...INTERVALS, melodic: INTERVALS.natural };
export const FORM_LABEL: Record<Form, string> = { major: "majeure", natural: "mineure naturelle", harmonic: "mineure harmonique", melodic: "mineure mélodique" };

/** Hauteur du k-ième degré d'un motif (gamme : 7 degrés ; arpège : 3 notes), orthographiée par lettres consécutives. */
function pitchAt(key: KeyDef, idx: number, steps: number[], semis: number[], tonicOct: number): Pitch {
  const n = steps.length, i = idx % n, o = Math.floor(idx / n);
  const abs = key.li + steps[i] + 7 * o, li = abs % 7, oct = tonicOct + Math.floor(abs / 7);
  const root = midiOf({ li: key.li, alter: key.alter, oct: tonicOct });
  return { li, oct, alter: root + semis[i] + 12 * o - (SEMI[li] + 12 * (oct + 1)) };
}
const SCALE_STEPS = [0, 1, 2, 3, 4, 5, 6];

export interface Piece {
  type: "scale" | "arpeggio"; key: KeyDef; form: Form; octaves: 1 | 2; direction: "up" | "updown";
}
export function pieceTitle(p: Piece): string {
  const root = nameOf({ li: p.key.li, alter: p.key.alter });
  return p.type === "arpeggio" ? `Arpège de ${root} ${p.key.mode === "major" ? "majeur" : "mineur"}` : `Gamme de ${root} ${FORM_LABEL[p.form]}`;
}

/** Notes montantes puis (si demandé) descendantes pour une main donnée. */
export function pieceNotes(p: Piece, hand: "R" | "L"): { pitches: Pitch[]; fingers: number[] } {
  const tonicOct = hand === "R" ? 4 : 3, n = p.octaves;
  const arp = p.type === "arpeggio";
  const steps = arp ? [0, 2, 4] : SCALE_STEPS;
  const asc = arp ? (p.key.mode === "major" ? [0, 4, 7] : [0, 3, 7]) : INTERVALS[p.form];
  const desc = arp ? asc : DESC[p.form];
  const len = steps.length, total = len * n;
  const up: Pitch[] = [], down: Pitch[] = [];
  for (let i = 0; i <= total; i++) up.push(pitchAt(p.key, i, steps, asc, tonicOct));
  for (let i = total - 1; i >= 0; i--) down.push(pitchAt(p.key, i, steps, desc, tonicOct));

  // doigtés en montant : RH = cycle répété + doigt final ; LH = doigt de départ + cycle répété
  const one = arp ? (hand === "R" ? ARP_RH : ARP_LH) : hand === "R" ? p.key.rh : p.key.lh;
  const fa: number[] = [];
  if (hand === "R") { const cyc = one.slice(0, len); for (let i = 0; i < total; i++) fa.push(cyc[i % len]); fa.push(one[len]); }
  else { const cyc = one.slice(1, len + 1); fa.push(one[0]); for (let i = 1; i <= total; i++) fa.push(cyc[(i - 1) % len]); }
  const fingers = p.direction === "up" ? fa : fa.concat(fa.slice(0, -1).reverse());
  return { pitches: p.direction === "up" ? up : up.concat(down), fingers };
}

// ── textes pédagogiques ──
const SHARPS = ["Fa♯", "Do♯", "Sol♯", "Ré♯", "La♯", "Mi♯", "Si♯"], FLATS = ["Si♭", "Mi♭", "La♭", "Ré♭", "Sol♭", "Do♭", "Fa♭"];
export function armureText(fifths: number): string {
  if (fifths === 0) return "Aucune altération à l'armure";
  const n = Math.abs(fifths);
  return fifths > 0 ? `${n} dièse${n > 1 ? "s" : ""} à l'armure : ${SHARPS.slice(0, n).join(" ")}` : `${n} bémol${n > 1 ? "s" : ""} à l'armure : ${FLATS.slice(0, n).join(" ")}`;
}
/** Suite des écarts entre degrés consécutifs, en demi-tons (montée). */
export function stepSizes(p: Piece): number[] {
  const arp = p.type === "arpeggio";
  const semis = arp ? (p.key.mode === "major" ? [0, 4, 7, 12] : [0, 3, 7, 12]) : [...INTERVALS[p.form], 12];
  return semis.slice(1).map((v, i) => v - semis[i]);
}
export const sizeLabel = (n: number) => (n === 1 ? "½" : n === 2 ? "T" : n === 3 ? "1½" : n === 4 ? "2T" : n === 5 ? "2T½" : String(n));
export const sizeWords = (n: number) => (n === 1 ? "un demi-ton" : n === 2 ? "un ton" : n === 3 ? "un ton et demi" : n === 4 ? "deux tons (une tierce majeure)" : n === 5 ? "deux tons et demi" : `${n} demi-tons`);
/** Ton relatif : même armure (La mineur ↔ Do majeur). */
export function relativeText(key: KeyDef): string {
  const rel = [...MAJOR_KEYS, ...MINOR_KEYS].find((x) => x.fifths === key.fifths && x.mode !== key.mode);
  return rel ? `${nameOf(rel)} ${rel.mode === "major" ? "majeur" : "mineur"} a exactement la même armure : on l'appelle le ton relatif.` : "";
}
/** Notes sur lesquelles tombe le pouce (montée, main droite) : le secret du doigté d'une gamme. */
export function thumbNotes(p: Piece): string[] {
  const { pitches, fingers } = pieceNotes({ ...p, octaves: 1, direction: "up" }, "R");
  return pitches.filter((_, i) => fingers[i] === 1).map((x) => nameOf(x));
}

// ── MusicXML ──
const ACC: Record<string, string> = { "-1": "flat", "0": "natural", "1": "sharp", "2": "double-sharp", "-2": "flat-flat" };
function noteXml(pt: Pitch, beats: number, staff: 1 | 2, finger: number, fifths: number, st: Map<string, number>, courtesy: Set<number>): string {
  const key = `${pt.li}:${pt.oct}`;
  const cur = st.has(key) ? st.get(key)! : keySigAlter(fifths, pt.li);
  const acc = pt.alter !== cur || courtesy.has(pt.li) ? `<accidental>${ACC[String(pt.alter)]}</accidental>` : "";
  st.set(key, pt.alter);
  const type = beats === 1 ? "quarter" : beats === 2 ? "half" : beats === 3 ? "half" : "whole";
  return `<note><pitch><step>${STEP[pt.li]}</step>${pt.alter ? `<alter>${pt.alter}</alter>` : ""}<octave>${pt.oct}</octave></pitch><duration>${beats}</duration><voice>${staff === 1 ? 1 : 5}</voice><type>${type}</type>${beats === 3 ? "<dot/>" : ""}${acc}<staff>${staff}</staff><notations><technical><fingering>${finger}</fingering></technical></notations></note>`;
}
export function buildPieceXml(p: Piece, bpm: number): string {
  const R = pieceNotes(p, "R"), L = pieceNotes(p, "L"), N = R.pitches.length;
  const q = N - 1, lastBeats = ((4 - (q % 4)) % 4) || 4;           // la dernière note complète la dernière mesure
  const beats = (i: number) => (i === N - 1 ? lastBeats : 1);
  const measures: number[][] = []; let cur: number[] = [], acc = 0;
  for (let i = 0; i < N; i++) { cur.push(i); acc += beats(i); if (acc === 4) { measures.push(cur); cur = []; acc = 0; } }
  if (cur.length) measures.push(cur);                              // (ne se produit pas : total multiple de 4)
  // mineure mélodique : on rappelle l'altération des 6e et 7e degrés en montée comme en descente (usage pédagogique)
  const courtesy = new Set<number>(p.type === "scale" && p.form === "melodic" ? [(p.key.li + 5) % 7, (p.key.li + 6) % 7] : []);
  let body = "";
  measures.forEach((idx, mi) => {
    const stR = new Map<string, number>(), stL = new Map<string, number>();
    let top = "", bot = "";
    for (const i of idx) {
      top += noteXml(R.pitches[i], beats(i), 1, R.fingers[i], p.key.fifths, stR, courtesy);
      bot += noteXml(L.pitches[i], beats(i), 2, L.fingers[i], p.key.fifths, stL, courtesy);
    }
    const attrs = mi === 0 ? `<attributes><divisions>1</divisions><key><fifths>${p.key.fifths}</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes><direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${bpm}</per-minute></metronome></direction-type><sound tempo="${bpm}"/></direction>` : "";
    body += `<measure number="${mi + 1}">${attrs}${top}<backup><duration>4</duration></backup>${bot}</measure>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="3.1"><work><work-title>${pieceTitle(p)}</work-title></work><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">${body}</part></score-partwise>`;
}
