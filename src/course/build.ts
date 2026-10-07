/** Briques communes de fabrication des leçons (pures, sans DOM). */
import { midiOf, FR, type Pitch, pitchLabel } from "./theory";
import { note, chord as chordEv, rest, buildXml, type Ev, type Dur } from "./xml";
import { spell, midiOf as snoteMidi, type SNote } from "../solfegeCore";
import { pieceNotes, midiOf as tMidi, buildPieceXml, type Piece, type KeyDef } from "../techCore";
import type { Q, KbdRange, Show, Hand } from "./types";

export type Rng = () => number;
/** Générateur pseudo-aléatoire reproductible (tests) — l'appli lui donne une graine d'horloge. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const pick = <T,>(rng: Rng, a: T[]): T => a[Math.floor(rng() * a.length)];
export function shuffle<T>(rng: Rng, a: T[]): T[] { const o = [...a]; for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; }
/** Tire n éléments en évitant de répéter deux fois de suite le même. */
export function drawN<T,>(rng: Rng, pool: T[], n: number, prev?: T): T[] {
  const out: T[] = [], distinct = new Set(pool).size > 1;
  while (out.length < n) { const c = pick(rng, pool), last = out.length ? out[out.length - 1] : prev; if (distinct && last !== undefined && last === c) continue; out.push(c); }
  return out;
}

// ── hauteurs ──
const LI: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
/** « C4 », « F#3 », « Bb3 » → Pitch orthographié. */
export function P(name: string): Pitch {
  const m = /^([A-G])(##|bb|#|b)?(-?\d)$/.exec(name); if (!m) throw new Error("hauteur invalide : " + name);
  return { li: LI[m[1]], alter: { "##": 2, "#": 1, b: -1, bb: -2 }[m[2] ?? ""] ?? 0, oct: parseInt(m[3], 10) };
}
export const M = (name: string) => midiOf(P(name));
export const fr = (m: number) => ["Do", "Do♯", "Ré", "Ré♯", "Mi", "Fa", "Fa♯", "Sol", "Sol♯", "La", "La♯", "Si"][m % 12];
export const frWhite = (m: number) => FR[[0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][m % 12]];
export { pitchLabel };

/** Plage de clavier affichée : bornes ramenées sur des touches blanches. */
export function kb(lo: number, hi: number): KbdRange {
  const black = new Set([1, 3, 6, 8, 10]);
  while (black.has(lo % 12)) lo--; while (black.has(hi % 12)) hi++;
  return [lo, hi];
}
/** Clavier qui couvre ces notes avec une marge, sur au moins 17 touches blanches (2 octaves + 1) pour rester lisible. */
export function kbFor(ms: number[], pad = 4): KbdRange {
  let lo = Math.min(...ms) - pad, hi = Math.max(...ms) + pad;
  while (hi - lo < 24) { lo--; if (hi - lo < 24) hi++; }
  return kb(lo, hi);
}
export const KB_RH = kb(60, 79), KB_LH = kb(43, 62), KB_BOTH = kb(48, 76), KB_ALL = kb(48, 84);

// ── événements musicaux ──
export { note, chordEv, rest, buildXml };
export type { Ev, Dur };
const W = 8 as Dur, H = 4 as Dur, Q = 2 as Dur;
export const dur = { w: W, h: H, q: Q, e: 1 as Dur, dq: 3 as Dur, dh: 6 as Dur };

/** Suite de notes « nom + durée (+ doigt) (+ marques) » → événements.
 *  « R » = silence ; « H » = silence invisible (voix secondaire) ; « C4+E4+G4 » = accord (doigts « 135 ») ; « E4~ » = lié à la note suivante.
 *  Marques (4e élément, séparées par des espaces) : nuances pp p mp mf f ff cresc dim · « P » pédale, « P^ » changer, « P* » relever ·
 *  « ( » « ) » liaison · « . » staccato · « clef:G » / « clef:F » changement de clé. */
export type Tok = [string, Dur, (number | string)?, string?];
export function evs(toks: Tok[]): Ev[] {
  const out: Ev[] = toks.map(([n, d, f, mk]) => {
    const e: Ev = n === "R" || n === "H" ? { ...rest(d), hidden: n === "H" || undefined } : (() => {
      // « E4~ » : tout l'événement est lié ; « C#4~+A4 » : seule la note marquée est liée
      const whole = n.endsWith("~") && !n.includes("+"), names = n.split("+");
      const fingers = typeof f === "string" ? f.split("").map(Number) : f !== undefined ? [f] : [];
      const ev: Ev = { notes: names.map((nm, i) => ({ p: P(nm.replace(/~$/, "")), finger: fingers[i] || undefined, tie: !whole && nm.endsWith("~") ? "start" as const : undefined })), dur: d };
      if (whole) ev.tie = "start";
      return ev;
    })();
    for (const m of (mk ?? "").split(/\s+/).filter(Boolean)) {
      if (["pp", "p", "mp", "mf", "f", "ff", "cresc", "dim"].includes(m)) e.dyn = m as Ev["dyn"];
      else if (m === "P") e.ped = "start"; else if (m === "P^") e.ped = "change"; else if (m === "P*") e.ped = "stop";
      else if (m === "(") e.slur = "start"; else if (m === ")") e.slur = "stop"; else if (m === ".") e.staccato = true;
      else if (m === "clef:G" || m === "clef:F") e.clef = m.slice(5) as "G" | "F";
      else if (m.startsWith("chord:")) e.harm = m.slice(6);
      else throw new Error("marque inconnue : " + m);
    }
    return e;
  });
  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1], cur = out[i];
    if (prev.tie === "start" || prev.tie === "both") {
      // une note liée vers un accord : seule la note de même hauteur continue la liaison
      if (cur.notes.length > 1 && prev.notes.length === 1) { const pn = prev.notes[0]; pn.tie = prev.tie; prev.tie = undefined; }
      else cur.tie = cur.tie === "start" ? "both" : "stop";
    }
    // liaisons note par note : la note de même hauteur dans l'événement suivant termine la liaison
    for (const pn of out[i - 1].notes) if (pn.tie === "start" || pn.tie === "both") {
      const nx = out[i].notes.find((x) => x.p.li === pn.p.li && x.p.oct === pn.p.oct && x.p.alter === pn.p.alter);
      if (!nx) throw new Error("liaison sans note d'arrivée");
      nx.tie = nx.tie === "start" ? "both" : "stop";
    }
  }
  return out;
}
/** Même suite, une octave plus bas, doigtés d'une main gauche en position de Do (5 = Do … 1 = Sol). */
export const octaveDown = (toks: Tok[]): Tok[] => toks.map(([n, d, f]) => (n === "R" ? [n, d, f] : [n.split("+").map((x) => x.replace(/(-?\d)(~?)$/, (_, o, t) => `${parseInt(o, 10) - 1}${t}`)).join("+"), d, typeof f === "number" ? 6 - f : f]));

// ── affichage ──
export function staffShow(clef: "G" | "F", pitches: Pitch[], d: Dur = 2, fifths = 0, labels?: string[]): Show {
  return { staff: { clef, fifths, evs: pitches.map((p) => note(p, d)), labels } };
}
export function chordShow(clef: "G" | "F", ps: Pitch[], fifths = 0): Show { return { staff: { clef, fifths, evs: [chordEv(ps, 8)] } }; }
export const markKeys = (ms: number[], c: "sel" | "target" = "target") => ms.map((m) => ({ m, c }));

// ── lecture de notes sur la portée ──
/** Note à lire : `pos` = position sur la portée (0 = ligne du bas). */
export function readQ(clef: "G" | "F", pos: number, withFingerHint = ""): Q {
  const sn: SNote = { clef, pos, alter: 0 }, s = spell(clef, pos), m = snoteMidi(sn);
  const pitch: Pitch = { li: s.li, alter: 0, oct: s.octave };
  const lo = clef === "G" ? 57 : 38;
  return { k: "press", prompt: "Joue cette note", target: { midi: m }, show: { staff: { clef, evs: [note(pitch, 8)] } }, kbd: kb(lo, lo + 26), hint: withFingerHint, ok: `${FR[s.li]}` };
}
export const readSet = (rng: Rng, clef: "G" | "F", poss: number[], n: number): Q[] => drawN(rng, poss, n).map((pos) => readQ(clef, pos));

// ── pièces (partitions pour le moteur d'entraînement) ──
export interface PieceOpts { title: string; goal: string; bpm: number; fifths?: number; rh?: Ev[] | null; lh?: Ev[] | null; pass?: number; hands?: "R" | "L" | "both"; /** MusicXML déjà fabriqué (gammes, arpèges) */ xml?: string; }
export function pieceQ(o: PieceOpts): Q {
  const xml = o.xml ?? buildXml({ title: o.title, bpm: o.bpm, fifths: o.fifths ?? 0, rh: o.rh ?? null, lh: o.lh ?? null });
  return { k: "piece", title: o.title, goal: o.goal, xml, pass: o.pass ?? 70, hands: o.hands ?? (o.rh && o.lh ? "both" : o.lh ? "L" : o.rh ? "R" : "both") };
}

/** Une suite de touches à jouer dans l'ordre, avec la portée et des pastilles de doigts. */
export function seqQ(prompt: string, hand: Hand, names: string[], fingers: number[] | undefined, kbd: KbdRange, hint?: string): Q {
  const ps = names.map(P);
  return {
    k: "seq", prompt, hand, notes: ps.map(midiOf), fingers, kbd, hint,
    show: { staff: { clef: hand === "R" ? "G" : "F", evs: ps.map((p) => note(p, 2)) }, badges: fingers ? ps.map((p, i) => ({ m: midiOf(p), t: String(fingers[i]), hand })) : undefined },
  };
}

export const info = (title: string, body: string, show?: Show, kbd?: KbdRange): Q => ({ k: "info", title, body, show, kbd });
export const choice = (prompt: string, options: string[], answer: number, explain: string, show?: Show): Q => ({ k: "choice", prompt, options, answer, explain, show });
export const pressPc = (prompt: string, pcs: number[], kbd: KbdRange, hint?: string): Q => ({ k: "press", prompt, target: { pcs }, kbd, hint });
export const pressMidi = (prompt: string, midi: number, kbd: KbdRange, hint?: string): Q => ({ k: "press", prompt, target: { midi }, kbd, hint });

// ── gammes et arpèges de techCore (doigtés d'étude écrits) ──
export const piece = (key: KeyDef, type: "scale" | "arpeggio", form: Piece["form"], octaves: 1 | 2, direction: "up" | "updown"): Piece => ({ type, key, form, octaves, direction });
export function seqFromPiece(prompt: string, p: Piece, hand: "R" | "L", hint?: string): Q {
  const { pitches, fingers } = pieceNotes({ ...p, octaves: 1, direction: "up" }, hand);
  const s = seqQ(prompt, hand, ["C4"], fingers, kbFor(pitches.map(tMidi)), hint);
  if (s.k !== "seq") throw new Error();
  s.notes = pitches.map(tMidi);
  s.show = { staff: { clef: hand === "R" ? "G" : "F", fifths: p.key.fifths, evs: pitches.map((x) => note(x, 2)) }, badges: pitches.map((x, i) => ({ m: tMidi(x), t: String(fingers[i]), hand })) };
  return s;
}
const FORM_NAME: Record<string, string> = { natural: "naturelle", harmonic: "harmonique", melodic: "mélodique" };
export function pieceFrom(p: Piece, goal: string, bpm: number, hands: "R" | "L" | "both" = "both"): Q {
  const xml = buildPieceXml(p, bpm);
  const title = `${p.type === "scale" ? "Gamme" : "Arpège"} de ${keyName(p.key)}${p.type === "scale" && p.key.mode === "minor" ? ` (${FORM_NAME[p.form]})` : ""} · ${p.octaves} octave${p.octaves > 1 ? "s" : ""}`;
  return pieceQ({ title, goal, bpm, xml, hands });
}
const keyName = (k: KeyDef) => `${pitchLabel({ li: k.li, alter: k.alter, oct: 4 })} ${k.mode === "major" ? "majeur" : "mineur"}`;
