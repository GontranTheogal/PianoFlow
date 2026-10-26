/** Spectre en fréquence logarithmique (3 cases par demi-ton) tiré d'une FFT, et rendu d'un gabarit de touche dans ce même espace.
 *  Le gabarit est « dessiné » comme l'analyse le verrait (lobe de la fenêtre de Hann, puis même regroupement) :
 *  un piano calibré et le son capté au micro se comparent donc à l'identique. */

export class LogBins {
  readonly nb: number;
  readonly freqs: Float64Array;
  /** Poids de chaque case dans la décomposition : les cases plus fines que la résolution réelle de la fenêtre comptent moins
   *  (sinon les graves, où 3 cases par demi-ton se partagent la même raie, pèseraient trop). */
  readonly weight: Float32Array;
  readonly df: number;
  private lo: Int32Array; private hi: Int32Array; private pos: Float64Array;

  constructor(readonly sr: number, readonly nfft: number, readonly winLen: number, readonly fmin = 40, fmax = 9000, perSemitone = 3) {
    const df = (this.df = sr / nfft), step = 2 ** (1 / (12 * perSemitone)), half = Math.sqrt(step);
    const top = Math.min(fmax, sr * 0.45), nb = (this.nb = Math.floor(Math.log(top / fmin) / Math.log(step)) + 1);
    this.freqs = new Float64Array(nb); this.weight = new Float32Array(nb);
    this.lo = new Int32Array(nb); this.hi = new Int32Array(nb); this.pos = new Float64Array(nb);
    const res = (2 * sr) / winLen;                       // demi-largeur du lobe principal de la fenêtre de Hann, en Hz
    for (let b = 0; b < nb; b++) {
      const f = fmin * step ** b;
      this.freqs[b] = f; this.pos[b] = f / df;
      this.lo[b] = Math.ceil(f / half / df); this.hi[b] = Math.floor((f * half) / df);
      this.weight[b] = Math.min(1, (f * (half - 1 / half)) / res);
    }
  }

  /** Regroupe un spectre d'amplitude FFT : chaque case garde le maximum des raies de sa bande, ou l'interpolation à son centre. */
  pool(mag: Float32Array, out: Float32Array): void {
    for (let b = 0; b < this.nb; b++) {
      const p = this.pos[b], i = Math.floor(p), fr = p - i;
      let v = mag[i] * (1 - fr) + mag[i + 1] * fr;
      for (let k = this.lo[b]; k <= this.hi[b]; k++) if (mag[k] > v) v = mag[k];
      out[b] = v;
    }
  }

  /** Spectre regroupé d'une somme de partiels (fréquence, amplitude) : chaque partiel donne le lobe principal de la fenêtre. */
  render(partials: ArrayLike<number>, out: Float32Array, scratch: Float32Array): void {
    scratch.fill(0);
    const span = (2 * this.nfft) / this.winLen;          // demi-largeur du lobe, en raies FFT
    for (let p = 0; p + 1 < partials.length; p += 2) {
      const c = partials[p] / this.df, a = partials[p + 1];
      for (let i = Math.max(0, Math.ceil(c - span)); i <= c + span && i < scratch.length; i++) scratch[i] += a * hannLobe(((i - c) * this.winLen) / this.nfft);
    }
    this.pool(scratch, out);
  }
}

/** |transformée de la fenêtre de Hann| à x « cases de résolution » du centre (1 au centre, 0,5 à ±1, 0 à ±2). */
export function hannLobe(x: number): number {
  const ax = Math.abs(x);
  if (ax >= 2) return 0;
  if (ax < 1e-6) return 1;
  if (Math.abs(ax - 1) < 1e-6) return 0.5;
  return Math.abs(Math.sin(Math.PI * ax) / (Math.PI * ax * (1 - ax * ax)));
}
