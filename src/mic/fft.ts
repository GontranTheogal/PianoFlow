/** FFT réelle (radix 2) et spectre d'amplitude d'une fenêtre de signal. Pur : testable sans navigateur. */

interface Tables { cos: Float64Array; sin: Float64Array; rev: Uint32Array; }
const tables = new Map<number, Tables>();
function tablesFor(n: number): Tables {
  let t = tables.get(n);
  if (!t) {
    const cos = new Float64Array(n / 2), sin = new Float64Array(n / 2), rev = new Uint32Array(n);
    for (let k = 0; k < n / 2; k++) { cos[k] = Math.cos((2 * Math.PI * k) / n); sin[k] = Math.sin((2 * Math.PI * k) / n); }
    const bits = Math.log2(n);
    for (let i = 0; i < n; i++) { let r = 0; for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); rev[i] = r; }
    t = { cos, sin, rev };
    tables.set(n, t);
  }
  return t;
}

/** FFT complexe en place (n = puissance de 2), sens direct. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length, { cos, sin, rev } = tablesFor(n);
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) { let x = re[i]; re[i] = re[j]; re[j] = x; x = im[i]; im[i] = im[j]; im[j] = x; }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1, step = n / size;
    for (let i = 0; i < n; i += size) {
      for (let j = 0, k = 0; j < half; j++, k += step) {
        const a = i + j, b = a + half;
        const tr = re[b] * cos[k] + im[b] * sin[k], ti = im[b] * cos[k] - re[b] * sin[k];
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
      }
    }
  }
}

export const nextPow2 = (x: number) => 2 ** Math.ceil(Math.log2(Math.max(2, x)));

const hanns = new Map<number, Float64Array>();
/** Fenêtre de Hann (mise en cache par longueur). */
export function hann(len: number): Float64Array {
  let w = hanns.get(len);
  if (!w) { w = new Float64Array(len); for (let i = 0; i < len; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i + 0.5)) / len); hanns.set(len, w); }
  return w;
}

/** Calcule des spectres d'amplitude de taille fixe `n` (fenêtre de Hann de `len` échantillons, complétée par des zéros).
 *  FFT réelle de taille n par une FFT complexe de taille n/2 : deux fois moins de calcul. */
export class Spectrum {
  readonly bins: number;
  private re: Float64Array; private im: Float64Array;
  private wr: Float64Array; private wi: Float64Array;
  constructor(readonly n: number) {
    const m = n / 2;
    this.bins = m + 1;
    this.re = new Float64Array(m); this.im = new Float64Array(m);
    this.wr = new Float64Array(m + 1); this.wi = new Float64Array(m + 1);
    for (let k = 0; k <= m; k++) { this.wr[k] = Math.cos((2 * Math.PI * k) / n); this.wi[k] = -Math.sin((2 * Math.PI * k) / n); }
  }
  /** `get(i)` donne l'échantillon i de la fenêtre (0 ≤ i < len) ; `out` reçoit |X[k]| pour k = 0..n/2. */
  magnitudes(get: (i: number) => number, len: number, out: Float32Array): void {
    const m = this.n / 2, re = this.re, im = this.im, w = hann(len);
    re.fill(0); im.fill(0);
    for (let i = 0; i < len && i < this.n; i++) { const v = get(i) * w[i]; if (i & 1) im[i >> 1] = v; else re[i >> 1] = v; }
    fft(re, im);
    for (let k = 0; k <= m; k++) {
      const a = k % m, b = (m - k) % m;
      const zr = re[a], zi = im[a], cr = re[b], ci = -im[b];
      const er = (zr + cr) / 2, ei = (zi + ci) / 2, or = (zi - ci) / 2, oi = -(zr - cr) / 2;
      const xr = er + or * this.wr[k] - oi * this.wi[k], xi = ei + or * this.wi[k] + oi * this.wr[k];
      out[k] = Math.sqrt(xr * xr + xi * xi);
    }
  }
}
