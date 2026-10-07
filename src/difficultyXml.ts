/** Difficulté d'une partition MusicXML (répertoire intégré, exercices du parcours) : lue avec le même analyseur que les doigtés. */
import { parseExplicitFingering } from "./fingering";
import { rateDifficulty, type DPiece, type Difficulty } from "./difficulty";

export function pieceFromXml(xml: string, bpmOverride?: number): DPiece {
  const ex = parseExplicitFingering(xml);
  const bpm = bpmOverride ?? Number(/<sound[^>]*\btempo="([\d.]+)"/.exec(xml)?.[1] ?? /<per-minute>([\d.]+)<\/per-minute>/.exec(xml)?.[1] ?? 100);
  const fifths = Number(/<fifths>(-?\d+)<\/fifths>/.exec(xml)?.[1] ?? 0);
  const ts = /<beats>(\d+)<\/beats>\s*<beat-type>(\d+)<\/beat-type>/.exec(xml);
  return { bpm, fifths, beats: ts ? Number(ts[1]) : 4, beatType: ts ? Number(ts[2]) : 4, notes: ex.notes.map((n) => ({ hand: n.hand, pitch: n.pitch, t: n.q, d: n.dur })) };
}
const cache = new Map<string, Difficulty>();
export function xmlDifficulty(xml: string, key?: string): Difficulty {
  const k = key ?? xml;
  let d = cache.get(k); if (!d) { d = rateDifficulty(pieceFromXml(xml)); cache.set(k, d); }
  return d;
}
