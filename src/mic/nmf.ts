/** Décomposition d'un spectre en touches (NMF à dictionnaire fixe, divergence de Kullback-Leibler pondérée) :
 *  X ≈ Σ h_k · T_k, avec T_k le gabarit de la touche k. Les partiels d'une note sont « expliqués » par son propre gabarit,
 *  ce qui évite de prendre l'octave ou la quinte au-dessus pour une note jouée. */
import { A0, KEYS, partialsOf, type KeyModel } from "./model";
import type { LogBins } from "./spectrum";

export class Dictionary {
  /** gabarits creux, un par touche (index A0 → 0), plus une composante « bruit » plate (la dernière) */
  readonly idx: Int32Array[] = [];
  readonly val: Float32Array[] = [];
  readonly K: number;
  readonly nb: number;
  readonly w: Float32Array;
  /** gabarits pleins (pour les tests de présence et le bruit propre à chaque touche) */
  readonly dense: Float32Array[] = [];

  constructor(readonly grid: LogBins, models: KeyModel[]) {
    const nb = (this.nb = grid.nb), w = (this.w = grid.weight), scratch = new Float32Array(grid.nfft / 2 + 1);
    const fmax = grid.freqs[nb - 1];
    for (let k = 0; k < KEYS; k++) {
      const t = new Float32Array(nb);
      grid.render(partialsOf(models[k], fmax, A0 + k), t, scratch);
      this.add(t);
    }
    this.add(new Float32Array(nb).fill(1));
    this.K = this.idx.length;
    // recouvrement : part de l'énergie du gabarit o qui tombe sur les partiels de c (octave : ses partiels pairs ; Mi4 sur Do2 : 5, 10, 15…).
    // Une note c bien plus faible que ce qu'une note forte o dépose sur ses partiels n'en est sans doute qu'un fantôme.
    this.over = Array.from({ length: KEYS }, () => new Float32Array(KEYS));
    for (let c = 0; c < KEYS; c++) {
      const tc = this.dense[c], cut = Math.max(...tc) * 0.05;
      for (let o = 0; o < KEYS; o++) {
        if (o === c) continue;
        const to = this.dense[o]; let s = 0;
        for (let b = 0; b < nb; b++) if (tc[b] >= cut) s += w[b] * to[b];
        this.over[o][c] = s;
      }
    }
  }
  /** over[o][c] ∈ [0, 1] */
  readonly over: Float32Array[];
  /** Normalise un gabarit (Σ w·T = 1) et le range en creux (on ignore ce qui est sous 1/1000 du maximum). */
  private add(t: Float32Array) {
    let s = 0, top = 0;
    for (let b = 0; b < this.nb; b++) { s += this.w[b] * t[b]; if (t[b] > top) top = t[b]; }
    const ids: number[] = [], vs: number[] = [];
    for (let b = 0; b < this.nb; b++) { t[b] /= s || 1; if (t[b] * (s || 1) > top * 1e-3) { ids.push(b); vs.push(t[b]); } }
    this.idx.push(Int32Array.from(ids)); this.val.push(Float32Array.from(vs)); this.dense.push(t);
  }
}

/** Mises à jour multiplicatives : h ≥ 0 (en entrée : point de départ, en sortie : activations). `lambda` pousse vers peu de notes.
 *  `mask[k] = false` exclut une composante. */
export function nmf(D: Dictionary, X: Float32Array, h: Float64Array, iters: number, lambda = 0.05, mask?: boolean[]): void {
  const nb = D.nb, K = D.K, w = D.w, V = new Float64Array(nb), R = new Float64Array(nb);
  for (let it = 0; it < iters; it++) {
    V.fill(1e-12);
    for (let k = 0; k < K; k++) {
      const a = h[k]; if (a <= 0) continue;
      const ids = D.idx[k], vs = D.val[k];
      for (let i = 0; i < ids.length; i++) V[ids[i]] += vs[i] * a;
    }
    for (let b = 0; b < nb; b++) R[b] = (w[b] * X[b]) / V[b];
    for (let k = 0; k < K; k++) {
      if (h[k] <= 0 || (mask && !mask[k])) { h[k] = 0; continue; }
      const ids = D.idx[k], vs = D.val[k];
      let g = 0;
      for (let i = 0; i < ids.length; i++) g += vs[i] * R[ids[i]];
      h[k] *= g / (1 + (k === K - 1 ? 0 : lambda));
    }
  }
}

/** Point de départ : chaque composante reçoit une part égale de l'énergie du spectre. */
export function nmfStart(D: Dictionary, X: Float32Array, h: Float64Array): void {
  let s = 0;
  for (let b = 0; b < D.nb; b++) s += D.w[b] * X[b];
  h.fill(s / D.K);
}
