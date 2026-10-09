/** Logique pure du mode solfège (aucun accès au DOM : testable seule).
 *  Une note est repérée par sa POSITION SUR LA PORTÉE : 0 = ligne du bas, 1 = premier interligne,
 *  2 = 2e ligne… (négatif = sous la portée, > 8 = au-dessus). Une clé donne la note de la ligne du bas. */

import { readJson, writeJson } from "./storage";
export type Clef = "G" | "F";
export type ClefMode = "G" | "F" | "GF";
export interface SNote { clef: Clef; pos: number; alter: -1 | 0 | 1; }

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"] as const;
const SEMI = [0, 2, 4, 5, 7, 9, 11];
export const FR = ["Do", "Ré", "Mi", "Fa", "Sol", "La", "Si"];
/** Diatonique absolu (octave*7 + lettre) de la ligne du bas : Mi4 en clé de Sol, Sol2 en clé de Fa. */
const BASE: Record<Clef, number> = { G: 4 * 7 + 2, F: 2 * 7 + 4 };

export function spell(clef: Clef, pos: number) {
  const abs = BASE[clef] + pos;
  const li = ((abs % 7) + 7) % 7;
  return { li, letter: LETTERS[li], octave: Math.floor(abs / 7) };
}
export const midiOf = (n: SNote) => { const s = spell(n.clef, n.pos); return SEMI[s.li] + 12 * (s.octave + 1) + n.alter; };
export type NameStyle = "fr" | "en";
export function nameOf(n: SNote, style: NameStyle = "fr", withOctave = false): string {
  const s = spell(n.clef, n.pos);
  const base = style === "fr" ? FR[s.li] : s.letter;
  return base + (n.alter === 1 ? "♯" : n.alter === -1 ? "♭" : "") + (withOctave ? s.octave : "");
}
/** Indice en mots : « 2e ligne », « 3e interligne », « 1re ligne supplémentaire au-dessus »… */
export function describePos(pos: number): string {
  const ord = (k: number) => (k === 1 ? "1re" : k + "e");
  if (pos >= 0 && pos <= 8) return pos % 2 === 0 ? `sur la ${ord(pos / 2 + 1)} ligne (en comptant depuis le bas)` : `dans le ${(pos + 1) / 2 === 1 ? "1er" : (pos + 1) / 2 + "e"} interligne (en comptant depuis le bas)`;
  const below = pos < 0, k = below ? Math.ceil(-pos / 2) : Math.ceil((pos - 8) / 2);   // numéro de ligne supplémentaire
  const side = below ? "sous" : "au-dessus de";
  if (pos % 2 === 0) return `sur la ${ord(k)} ligne supplémentaire ${side} la portée`;
  return k === 1 && (pos === -1 || pos === 9) ? `dans l'espace juste ${side} la portée` : `dans l'espace entre la ${ord(k - 1)} et la ${ord(k)} ligne supplémentaire ${side} la portée`;
}

// ───────────── notes tirées au hasard ─────────────
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
/** Toute la portée + une ou deux lignes supplémentaires de chaque côté : 13 notes naturelles différentes par clé. */
export const POOL_POS = range(-2, 10);
export function itemsFor(mode: ClefMode): SNote[] {
  const clefs: Clef[] = mode === "GF" ? ["G", "F"] : [mode];
  return clefs.flatMap((clef) => POOL_POS.map((pos) => ({ clef, pos, alter: 0 as const })));
}
export const keyOf = (n: SNote) => `${n.clef}${n.pos}${n.alter}`;

// ───────────── MusicXML (rendu par Verovio) ─────────────
const ACC = { "-1": "flat", "1": "sharp" } as Record<string, string>;
export type NoteKind = "whole" | "quarter";
export interface BuildOpts { kind?: NoteKind; clefTop?: Clef; clefBottom?: Clef; fifths?: number; }
const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6], FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3]; // lettres F C G D A E B / B E A D G C F
/** Altération imposée par l'armure à la lettre `li` (0 = Do … 6 = Si). */
export function keySigAlter(fifths: number, li: number): number {
  if (fifths > 0) return SHARP_ORDER.slice(0, fifths).includes(li) ? 1 : 0;
  if (fifths < 0) return FLAT_ORDER.slice(0, -fifths).includes(li) ? -1 : 0;
  return 0;
}
function noteXml(n: SNote | null, staff: 1 | 2, single: boolean, kind: NoteKind, measureRest: boolean, fifths = 0): string {
  const st = single ? "" : `<staff>${staff}</staff>`;
  const dur = kind === "whole" ? 4 : 1;
  if (!n) return measureRest ? `<note><rest measure="yes"/><duration>4</duration>${st}</note>` : `<note print-object="no"><rest/><duration>${dur}</duration><type>${kind}</type>${st}</note>`;
  const s = spell(n.clef, n.pos);
  return `<note><pitch><step>${s.letter}</step>${n.alter ? `<alter>${n.alter}</alter>` : ""}<octave>${s.octave}</octave></pitch><duration>${dur}</duration><type>${kind}</type>${n.alter !== keySigAlter(fifths, s.li) ? `<accidental>${n.alter === 0 ? "natural" : ACC[String(n.alter)]}</accidental>` : ""}${st}</note>`;
}
const CLEF_XML = { G: "<sign>G</sign><line>2</line>", F: "<sign>F</sign><line>4</line>" };

/** Une mesure de notes (rondes ou noires). `top` = portée du haut, `bottom` = portée du bas (même longueur,
 *  `null` = silence invisible). Une seule portée si `bottom` est omis. */
export function buildXml(top: (SNote | null)[], bottom?: (SNote | null)[], o: BuildOpts = {}): string {
  const kind = o.kind ?? "whole", clefTop = o.clefTop ?? "G", clefBottom = o.clefBottom ?? "F";
  const n = top.length, grand = !!bottom, dur = kind === "whole" ? 4 : 1;
  const attrs = grand
    ? `<attributes><divisions>1</divisions><key><fifths>${o.fifths ?? 0}</fifths></key><staves>2</staves><clef number="1">${CLEF_XML[clefTop]}</clef><clef number="2">${CLEF_XML[clefBottom]}</clef></attributes>`
    : `<attributes><divisions>1</divisions><key><fifths>${o.fifths ?? 0}</fifths></key><clef>${CLEF_XML[clefTop]}</clef></attributes>`;
  const only = (arr: (SNote | null)[]) => arr.length === 1 && arr[0] === null && kind === "whole";
  const t = top.map((x) => noteXml(x, 1, !grand, kind, only(top), o.fifths ?? 0)).join("");
  const b = grand ? `<backup><duration>${dur * n}</duration></backup>` + bottom!.map((x) => noteXml(x, 2, false, kind, only(bottom!), o.fifths ?? 0)).join("") : "";
  return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="3.1"><part-list><score-part id="P1"><part-name print-object="no"/></score-part></part-list><part id="P1"><measure number="1">${attrs}${t}${b}</measure></part></score-partwise>`;
}

// ───────────── tirage adaptatif ─────────────
/** Tire des notes en insistant sur celles qu'on rate ; une note ratée revient 3 questions plus tard (sans compter dans le score). */
export class Deck {
  private w = new Map<string, number>();
  private recent: string[] = [];
  constructor(private items: SNote[], private rnd: () => number = Math.random, weights?: Record<string, number>) {
    for (const it of items) this.w.set(keyOf(it), weights?.[keyOf(it)] ?? 1);
  }
  next(): { item: SNote } {
    const hard = new Set(this.recent.slice(-Math.min(3, this.items.length - 1)));        // jamais les 3 dernières
    const soft = new Set(this.recent.slice(-Math.min(9, this.items.length - 1)));        // nettement moins les 9 dernières
    const pool = this.items.filter((i) => !hard.has(keyOf(i)));
    const wt = (i: SNote) => this.w.get(keyOf(i))! * (soft.has(keyOf(i)) ? 0.12 : 1);
    const total = pool.reduce((s, i) => s + wt(i), 0);
    let r = this.rnd() * total, pick = pool[pool.length - 1];
    for (const i of pool) { r -= wt(i); if (r <= 0) { pick = i; break; } }
    this.recent.push(keyOf(pick)); if (this.recent.length > 12) this.recent.shift();
    return { item: pick };
  }
  /** Une note ratée est tirée plus souvent, une note réussie un peu moins (jamais en dessous d'un plancher). */
  record(item: SNote, ok: boolean) {
    const k = keyOf(item), w = this.w.get(k) ?? 1;
    this.w.set(k, ok ? Math.max(0.35, w * 0.7) : Math.min(6, w * 2.2));
  }
}

// ───────────── progression (localStorage, uniquement des nombres : fusionnable avec le PC) ─────────────
export interface Progress { levels: Record<string, { best: number; rounds: number }>; items: Record<string, { ok: number; ko: number }>; }
const KEY = "pianoflow-solfege";
export const levelKey = (mode: ClefMode, run: string) => `${mode}:${run}`;
export function loadProgress(): Progress {
  const p = readJson<any>(KEY, null); if (p == null) return { levels: {}, items: {} };
  return { levels: p.levels ?? {}, items: p.items ?? {} };
}
export function saveProgress(p: Progress) { writeJson(KEY, p); }
/** Poids de départ d'un tirage d'après l'historique : les notes souvent ratées reviennent plus. */
export function weightsFrom(p: Progress): Record<string, number> {
  const w: Record<string, number> = {};
  for (const [k, v] of Object.entries(p.items)) { const tot = v.ok + v.ko; if (tot >= 3) w[k] = Math.min(3, Math.max(0.6, 0.7 + (2 * v.ko) / tot)); }
  return w;
}
