/** Lecture d'un corpus de partitions doigtées pour l'entraînement (aucun accès au DOM de l'appli ; MusicXML via DOMParser global).
 *  Formats : MusicXML / MXL avec <fingering>, et fichiers texte PIG (corpus de référence de Nakamura et al.). */
import { parseExplicitFingering } from "./fingering";
import { fingerHand, type CoreNote, type LearnedTable, type Weights, type FeatureWeights } from "./fingerCore";
import type { Sample } from "./fingerTune";
import type { HandProfile } from "./hand";

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** « C4 », « C#4 », « Bb3 »… → numéro MIDI */
export function pitchNameToMidi(s: string): number | null {
  const m = /^([A-Ga-g])([#b♯♭]{0,2})(-?\d)$/.exec(s.trim());
  if (!m) return null;
  const alt = [...m[2]].reduce((a, c) => a + (c === "#" || c === "♯" ? 1 : -1), 0);
  return 12 * (parseInt(m[3], 10) + 1) + PC[m[1].toUpperCase()] + alt;
}

/** Fichier texte PIG : « id onset offset pitch onVel offVel canal doigt » (canal 0 = main droite, 1 = gauche ; doigt négatif = main gauche ; « 3_1 » = substitution). */
export function samplesFromPig(text: string, minCoverage = 0.1): Sample[] {
  const per: Record<"R" | "L", { n: CoreNote; f: number | null }[]> = { R: [], L: [] };
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("//")) continue;
    const c = line.trim().split(/\s+/);
    if (c.length < 8 || !/^\d+$/.test(c[0])) continue;
    const pitch = pitchNameToMidi(c[3]); if (pitch === null) continue;
    const on = parseFloat(c[1]) * 1000, off = parseFloat(c[2]) * 1000, ch = parseInt(c[6], 10);
    const fm = /\d/.exec(c[7]);
    per[ch === 1 ? "L" : "R"].push({ n: { pitch, onTime: on, offTime: off }, f: fm ? parseInt(fm[0], 10) : null });
  }
  return toSamples(per, minCoverage);
}

export function samplesFromMusicXml(xml: string, minCoverage = 0.1): Sample[] {
  const ex = parseExplicitFingering(xml);
  const per: Record<"R" | "L", { n: CoreNote; f: number | null }[]> = { R: [], L: [] };
  for (const n of ex.notes) per[n.hand].push({ n: { pitch: n.pitch, onTime: n.q * 500, offTime: (n.q + Math.max(0.05, n.dur)) * 500 }, f: n.finger });
  return toSamples(per, minCoverage);
}

/** Coupe en segments (rapidité). Les partitions partiellement doigtées (cas fréquent sur MuseScore) comptent : seules les notes doigtées servent à juger. */
function toSamples(per: Record<"R" | "L", { n: CoreNote; f: number | null }[]>, minCoverage: number, seg = 400): Sample[] {
  const out: Sample[] = [];
  for (const hand of ["R", "L"] as const) {
    const arr = per[hand].sort((a, b) => a.n.onTime - b.n.onTime || a.n.pitch - b.n.pitch);
    if (arr.length < 8) continue;
    if (arr.filter((x) => x.f).length / arr.length < minCoverage) continue;
    for (let i = 0; i < arr.length; i += seg) {
      const part = arr.slice(i, i + seg); if (part.length < 8) continue;
      out.push({ hand, notes: part.map((x) => x.n), truth: part.map((x) => x.f ?? 0) });
    }
  }
  return out;
}

/** Table de coûts apprise : −log P(doigt d'arrivée | écart en demi-tons, doigt de départ), lissage de Laplace, ≥ 3 exemples. */
export function learnTable(samples: Sample[], clamp = 14, minCount = 3): LearnedTable {
  const counts: Record<string, Record<string, Record<string, Record<string, number>>>> = { R: {}, L: {} };
  for (const s of samples) {
    const sorted = s.notes.map((n, i) => ({ n, f: s.truth[i] })).sort((a, b) => a.n.onTime - b.n.onTime || a.n.pitch - b.n.pitch);
    // notes isolées seulement (pas d'accords) et sans silence entre les deux
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1], b = sorted[i];
      if (!a.f || !b.f || Math.abs(a.n.onTime - b.n.onTime) < 6 || (sorted[i + 1] && Math.abs(sorted[i + 1].n.onTime - b.n.onTime) < 6) || (i > 1 && Math.abs(sorted[i - 2].n.onTime - a.n.onTime) < 6)) continue;
      if (b.n.onTime - a.n.offTime >= 250) continue;
      const iv = String(Math.max(-clamp, Math.min(clamp, b.n.pitch - a.n.pitch)));
      const r = ((counts[s.hand][iv] ??= {})[String(a.f)] ??= {});
      r[String(b.f)] = (r[String(b.f)] ?? 0) + 1;
    }
  }
  const table: LearnedTable = { R: {}, L: {} };
  for (const hand of ["R", "L"]) for (const [iv, byF] of Object.entries(counts[hand])) for (const [f0, row] of Object.entries(byF)) {
    const total = Object.values(row).reduce((a, b) => a + b, 0);
    if (total < minCount) continue;
    const out: Record<string, number> = {};
    for (let f = 1; f <= 5; f++) out[String(f)] = +(-Math.log(((row[String(f)] ?? 0) + 1) / (total + 5))).toFixed(3);
    ((table[hand][iv] ??= {})[f0] = out);
  }
  return table;
}

/** Taux de concordance note à note (« general match rate » de la littérature) + détail par main. */
export function evaluate(samples: Sample[], profile: HandProfile, w: Weights, learned?: LearnedTable, feat?: FeatureWeights) {
  const r = { all: [0, 0], R: [0, 0], L: [0, 0] } as Record<string, number[]>;
  for (const s of samples) {
    const got = fingerHand(s.notes, s.hand, s.profile ?? profile, w, learned, feat);
    for (let i = 0; i < got.length; i++) { if (!s.truth[i]) continue; const hit = got[i] === s.truth[i] ? 1 : 0; r.all[0] += hit; r.all[1]++; r[s.hand][0] += hit; r[s.hand][1]++; }
  }
  const pct = (a: number[]) => (a[1] ? a[0] / a[1] : 0);
  return { rate: pct(r.all), R: pct(r.R), L: pct(r.L), notes: r.all[1] };
}
