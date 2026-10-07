import type { Note, Step } from "./score";
import { FINGERING_MODEL, FINGERING_WEIGHTS, FINGERING_FEATURES } from "./fingeringModel";
import { fingerHand, DEFAULT_WEIGHTS, type CoreNote, type LearnedTable, type Weights } from "./fingerCore";
import { type HandProfile, defaultHand } from "./hand";

const WEIGHTS: Weights = { ...DEFAULT_WEIGHTS, ...(FINGERING_WEIGHTS as Partial<Weights>) };

/** Doigtés écrits dans un MusicXML. `byKey` : clé « main|hauteur|position en noires » → doigt (appariement exact, robuste aux voix multiples) ;
 *  `R` / `L` : suites dans l'ordre du fichier (repli quand la position ne permet pas d'apparier). */
export interface ExplicitNote { hand: "R" | "L"; pitch: number; q: number; dur: number; finger: number | null; }
export interface ExplicitFingering { R: (number | null)[]; L: (number | null)[]; byKey: Map<string, number>; keyed: { R: number; L: number }; /** toutes les notes lues (corpus d'entraînement) */ notes: ExplicitNote[]; }
export const fingerKey = (hand: "R" | "L", pitch: number, q: number) => `${hand}|${pitch}|${Math.round(q * 16)}`;

const STEP_SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const num = (el: Element | null | undefined, d = 0) => { const v = parseFloat(el?.textContent ?? ""); return isNaN(v) ? d : v; };
const kid = (el: Element, name: string) => Array.from(el.children).find((c) => c.tagName === name) ?? null;

export function parseExplicitFingering(xml: string): ExplicitFingering {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const out: ExplicitFingering = { R: [], L: [], byKey: new Map(), keyed: { R: 0, L: 0 }, notes: [] };
  let staffOffset = 0;
  for (const part of Array.from(doc.getElementsByTagName("part"))) {
    const measures = Array.from(part.children).filter((c) => c.tagName === "measure");
    const nStaves = Math.max(1, num(measures[0]?.getElementsByTagName("staves")[0], 1));
    let divisions = 1, base = 0;                                // base : début de la mesure, en noires
    for (const m of measures) {
      let cursor = 0, maxCursor = 0, lastOn = 0;
      for (const el of Array.from(m.children)) {
        if (el.tagName === "attributes") { const d = num(kid(el, "divisions"), 0); if (d > 0) divisions = d; }
        else if (el.tagName === "backup") cursor -= num(kid(el, "duration"));
        else if (el.tagName === "forward") cursor += num(kid(el, "duration"));
        else if (el.tagName === "note") {
          const isChord = !!kid(el, "chord"), isGrace = !!kid(el, "grace");
          const onset = isChord ? lastOn : cursor;
          if (!isChord) lastOn = cursor;
          if (!isChord && !isGrace) cursor += num(kid(el, "duration"));
          maxCursor = Math.max(maxCursor, cursor);
          const pitch = kid(el, "pitch");
          if (!pitch || kid(el, "rest")) continue;
          if (Array.from(el.children).some((c) => c.tagName === "tie" && c.getAttribute("type") === "stop")) continue;   // note liée : pas de nouvelle attaque
          const midi = 12 * (num(kid(pitch, "octave"), 4) + 1) + (STEP_SEMI[kid(pitch, "step")?.textContent ?? "C"] ?? 0) + Math.round(num(kid(pitch, "alter")));
          const staffN = num(kid(el, "staff"), 1);
          const hand: "R" | "L" = staffOffset + staffN - 1 === 0 ? "R" : "L";
          const fing = el.querySelector("notations > technical > fingering:not([substitution])");
          const val = fing?.textContent?.match(/[1-5]/)?.[0];
          const dur = num(kid(el, "duration")) / divisions, finger = val ? parseInt(val, 10) : null;
          out.notes.push({ hand, pitch: midi, q: base + onset / divisions, dur, finger });
          out[hand].push(finger);
          if (val) { out.byKey.set(fingerKey(hand, midi, base + onset / divisions), parseInt(val, 10)); out.keyed[hand]++; }
        }
      }
      base += maxCursor / divisions;
    }
    staffOffset += nStaves;
  }
  return out;
}

const toCore = (seq: Note[], fixed?: (n: Note) => number | undefined): CoreNote[] => seq.map((n) => ({ pitch: n.pitch, onTime: n.onTime, offTime: n.offTime, fixed: fixed?.(n) }));

/** Calcule les doigtés des deux mains. Les doigtés écrits dans la partition sont des contraintes ; le reste est calculé
 *  autour (profil de main de l'utilisateur + règles + modèle appris).
 *  Renvoie true si la partition apporte l'essentiel de ses doigtés (donc fiables à afficher en entier). */
/** `overrides` : corrections faites à la main (clé = fingerKey), prioritaires sur tout le reste. */
export function assignFingering(steps: Step[], explicit: ExplicitFingering | Record<"R" | "L", (number | null)[]>, profile: HandProfile = defaultHand(), overrides?: Map<string, number>): boolean {
  const ex: ExplicitFingering = "byKey" in explicit ? explicit : { R: explicit.R, L: explicit.L, byKey: new Map(), keyed: { R: 0, L: 0 }, notes: [] };
  let usedExplicit = false;
  for (const hand of ["R", "L"] as const) {
    const seq: Note[] = [];
    for (const s of steps) for (const n of s.notes) if (n.hand === hand) seq.push(n);
    if (!seq.length) continue;

    // 1. appariement exact par position + hauteur
    let fixed = new Map<Note, number>();
    if (ex.keyed[hand] > 0) for (const n of seq) { const f = n.q === undefined ? undefined : ex.byKey.get(fingerKey(hand, n.pitch, n.q)); if (f) fixed.set(n, f); }
    // 2. repli : suite dans l'ordre du fichier (partition sans position exploitable, ou reprises dépliées)
    const queue = ex[hand], given = queue.filter((v) => v !== null).length;
    if (fixed.size < Math.min(given, seq.length) * 0.5 && given > 0 && queue.length >= seq.length * 0.6 && queue.length <= seq.length * 1.4) {
      fixed = new Map(); seq.forEach((n, i) => { const f = queue[i]; if (f) fixed.set(n, f); });
    }
    if (overrides?.size) for (const n of seq) { const f = n.q === undefined ? undefined : overrides.get(fingerKey(hand, n.pitch, n.q)); if (f) fixed.set(n, f); }
    const coverage = fixed.size / seq.length;
    if (coverage >= 0.5) usedExplicit = true;

    const fingers = fingerHand(toCore(seq, (n) => fixed.get(n)), hand, profile, WEIGHTS, FINGERING_MODEL as LearnedTable, FINGERING_FEATURES);
    seq.forEach((n, i) => { n.finger = fingers[i]; });
  }
  return usedExplicit;
}
