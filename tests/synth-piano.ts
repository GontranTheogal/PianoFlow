/** Piano de synthèse pour tester la reconnaissance au micro sans vrai piano : cordes raides (partiels inharmoniques), deux cordes
 *  par note légèrement désaccordées (battements), décroissance plus rapide des partiels aigus, bruit de marteau, bruit de la pièce.
 *  Son timbre est volontairement différent du modèle « moyen » de l'appli (comme un vrai piano). */
import { genericB, nominalHz, partialHz } from "../src/mic/model";

export function mulberry32(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export interface SynthKey { f0: number; B: number; gains: number[]; beat: number; }
/** Un piano : chaque touche a sa fréquence (écart `cents(m)` au piano bien accordé), son inharmonicité et son timbre. */
export class SynthPiano {
  keys = new Map<number, SynthKey>();
  constructor(seed = 1, cents: (m: number) => number = () => 0, readonly sr = 48000) {
    const r = mulberry32(seed);
    for (let m = 21; m <= 108; m++) {
      const f0 = nominalHz(m, cents(m)), B = genericB(m) * (0.6 + 0.8 * r()), p = 0.7 + 0.9 * Math.min(1, Math.max(0, (m - 30) / 60));
      const beta = 1 / (7 + 2 * r()), gains: number[] = [];
      for (let j = 1; j <= 40; j++) {
        const f = partialHz(f0, B, j);
        gains.push(j ** -p * (0.15 + 0.85 * Math.abs(Math.sin(Math.PI * j * beta))) * (0.7 + 0.6 * r()) / (1 + (60 / f) ** 2) / (1 + (f / 4000) ** 2));
      }
      const top = Math.max(...gains);
      this.keys.set(m, { f0, B, gains: gains.map((g) => g / top), beat: (r() - 0.5) * 3 });
    }
  }
  /** Ajoute dans `out` la touche m frappée à `t0` (s), relâchée à `t1`, au niveau `db` (dBFS du début du son, à peu près). */
  strike(out: Float32Array, m: number, t0: number, t1: number, db = -24, seed = m) {
    const k = this.keys.get(m)!, sr = this.sr, r = mulberry32(seed * 7919 + Math.round(t0 * 1000));
    const s0 = Math.round(t0 * sr), s1 = Math.min(out.length, Math.round((t1 + 0.25) * sr)), rel = Math.round(t1 * sr);
    const amp = 10 ** (db / 20) * 0.9, tau = 2.6 * 2 ** (-(m - 40) / 16);
    for (let j = 1; j <= 40; j++) {
      const f = partialHz(k.f0, k.B, j);
      if (f > sr * 0.45) break;
      const g = k.gains[j - 1] * amp; if (g < 1e-6) continue;
      const ph = r() * 2 * Math.PI;         // le marteau frappe les cordes d'une même note ensemble : elles partent en phase
      for (const [df, w] of [[1, 0.6], [2 ** (k.beat / 1200), 0.4]] as const) {
        const w0 = (2 * Math.PI * f * df) / sr;
        let re = Math.cos(ph), im = Math.sin(ph);
        const c = Math.cos(w0), s = Math.sin(w0), t1j = tau / (1 + 0.15 * (j - 1));
        const d1 = Math.exp(-1 / (t1j * sr)), d2 = Math.exp(-1 / (4 * t1j * sr)), dr = Math.exp(-1 / (0.06 * sr));
        let e1 = 0.75 * g * w, e2 = 0.25 * g * w, damp = 1;
        for (let n = s0; n < s1; n++) {
          const i = n - s0, att = i < 96 ? i / 96 : 1;
          out[n] += im * (e1 + e2) * att * damp;
          const nr = re * c - im * s; im = re * s + im * c; re = nr;
          e1 *= d1; e2 *= d2; if (n >= rel) damp *= dr;
        }
      }
    }
    // bruit du marteau : quelques millisecondes de bruit large bande
    for (let n = s0, end = Math.min(out.length, s0 + Math.round(0.02 * sr)); n < end; n++) out[n] += (r() * 2 - 1) * amp * 0.08 * Math.exp(-(n - s0) / (0.004 * sr));
  }
}

/** Bruit de pièce (blanc) au niveau `db` dBFS. */
export function roomNoise(out: Float32Array, db = -66, seed = 99) {
  const r = mulberry32(seed), a = 10 ** (db / 20) * Math.sqrt(3);
  for (let i = 0; i < out.length; i++) out[i] += (r() * 2 - 1) * a;
}
