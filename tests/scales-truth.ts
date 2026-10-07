import { MAJOR_KEYS, MINOR_KEYS, pieceNotes, midiOf, type Piece } from "../src/techCore";
import { fingerHand, DEFAULT_WEIGHTS, type CoreNote, type Weights } from "../src/fingerCore";
import { defaultHand, type HandProfile } from "../src/hand";
import { FINGERING_MODEL, FINGERING_WEIGHTS, FINGERING_FEATURES } from "../src/fingeringModel";

/** Le modèle tel que l'appli l'utilise (règles ajustées + table + coûts par situation). */
const APP_WEIGHTS: Weights = { ...DEFAULT_WEIGHTS, ...(FINGERING_WEIGHTS as Partial<Weights>) };

export interface Case { name: string; hand: "R" | "L"; notes: CoreNote[]; truth: number[]; }
export function scaleCases(): Case[] {
  const out: Case[] = [];
  const keys = [...MAJOR_KEYS, ...MINOR_KEYS];
  for (const key of keys) for (const hand of ["R", "L"] as const) for (const octaves of [1, 2] as const) for (const type of ["scale", "arpeggio"] as const) {
    if (type === "arpeggio" && !key.arp) continue;
    const form = key.mode === "major" ? "major" : "natural";
    const p: Piece = { type, key, form, octaves, direction: "updown" };
    const { pitches, fingers } = pieceNotes(p, hand);
    // la tradition varie sur les fingers en descente d'arpège/gamme ; on garde les doigtés du manuel
    const notes = pitches.map((pt, i) => ({ pitch: midiOf(pt), onTime: i * 400, offTime: i * 400 + 380 }));
    out.push({ name: `${type} ${key.id}${key.mode === "minor" ? "m" : ""} ${hand} ${octaves}oct`, hand, notes, truth: fingers });
  }
  return out;
}
export function matchRate(cases: Case[], profile: HandProfile, w: Weights = APP_WEIGHTS, useLearned = true) {
  let ok = 0, tot = 0; const bad: { c: Case; got: number[] }[] = [];
  for (const c of cases) {
    const got = fingerHand(c.notes, c.hand, profile, w, useLearned ? (FINGERING_MODEL as any) : undefined, useLearned ? FINGERING_FEATURES : undefined);
    const m = got.filter((f, i) => f === c.truth[i]).length;
    ok += m; tot += got.length;
    if (m < got.length) bad.push({ c, got });
  }
  return { rate: ok / tot, bad };
}
if (process.argv[1].endsWith("scales-truth.ts")) {
  const cases = scaleCases();
  for (const useL of [false, true]) {
    const r = matchRate(cases, defaultHand(), useL ? APP_WEIGHTS : DEFAULT_WEIGHTS, useL);
    console.log(`learned=${useL}: ${(r.rate * 100).toFixed(1)}% sur ${cases.length} cas, ${r.bad.length} cas imparfaits`);
    if (useL) for (const b of r.bad.slice(0, 40)) console.log(b.c.name, "\n  vérité", b.c.truth.join(""), "\n  obtenu", b.got.join(""));
  }
}
