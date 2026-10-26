/** Reconnaissance des notes jouées sur un piano acoustique, à partir du son du micro (flux d'échantillons). Pur : testable sans navigateur.
 *
 *  1. Attaques : flux spectral sur des fenêtres courtes (~43 ms, toutes les ~11 ms), seuil adaptatif, position affinée à ~1 ms.
 *  2. À chaque attaque, on compare le spectre juste après (fenêtre de ~128 ms) à celui juste avant : le « son nouveau » (ce qui a monté)
 *     est décomposé en touches (NMF sur les gabarits du piano). Une note tenue ne monte pas : elle n'est pas comptée deux fois.
 *  3. On garde les touches assez fortes, en écartant les fantômes : partiels d'une note plus forte (octave, douzième…), voisines
 *     confuses dans le grave, battements d'une note qui sonne encore, sons joués par l'appli elle-même (écho des haut-parleurs).
 *     Un son qui enfle comme une voix, ou qui s'éparpille sur trop de touches, ne donne que les notes attendues par la partition.
 *     Ces notes attendues (indice) passent aussi plus facilement : jouées doucement, en octave, mains décalées.
 *  4. Une analyse régulière (~40 ms) suit les notes qui sonnent encore, pour savoir quand elles s'arrêtent. */
import { Spectrum, nextPow2 } from "./fft";
import { LogBins } from "./spectrum";
import { Dictionary, nmf, nmfStart } from "./nmf";
import { A0, KEYS, type KeyModel } from "./model";

export interface NoteEvent { pitch: number; velocity: number; on: boolean; /** ms écoulées entre la frappe et l'annonce */ lag: number; }
/** Une frappe brute pour le calibrage : le son depuis l'attaque, et son niveau. */
export interface Take { samples: Float32Array; sr: number; level: number; /** force de l'attaque (flux spectral) : une vraie frappe est bien plus forte qu'un battement */ flux: number; }

/** Fenêtre d'analyse des notes (s) : assez longue pour séparer deux demi-tons voisins par leurs partiels, assez courte pour répondre vite. */
export const WINDOW_S = 0.128;
const PRE_S = 0.008;          // l'analyse commence un peu avant l'attaque estimée
const GAP_S = 0.03;           // deux attaques à moins de 30 ms : un seul accord (mains pas tout à fait ensemble)
const REPEAT_S = 0.12;        // une même touche ne peut pas être refrappée plus vite
const TAKE_S = 0.6;           // durée d'une frappe enregistrée pour le calibrage
const GHOST = 1.2;            // fantôme : moins de 1,2 × l'énergie qu'une note plus forte dépose sur ses partiels

/** Réglages de sensibilité : 0 = pièce bruyante, 1 = normal, 2 = piano doux ou micro éloigné. */
const SENS = [
  { flux: 0.045, snr: 4.5, rel: 0.22, share: 0.45, peak: 48, gain: 1.4, conc: 0.78 },
  { flux: 0.025, snr: 3, rel: 0.16, share: 0.35, peak: 64, gain: 1.7, conc: 0.74 },
  { flux: 0.015, snr: 2, rel: 0.11, share: 0.28, peak: 80, gain: 2.2, conc: 0.65 },
];

export interface DetectorOptions { /** durée de la fenêtre d'analyse, en secondes */ window?: number; }
/** Attaque en attente d'analyse : instant, spectre juste avant, force du flux. */
interface Pending { s: number; due: number; pre: Float32Array | null; flux: number; }
export interface DebugInfo { s: number; share: number; flux: number; rise: number; gain: number; conc: number; top: [number, number][]; }

export class NoteDetector {
  readonly sr: number;
  /** écrites et lues par l'appli */
  sensitivity = 1;
  detect = true;
  capture: ((t: Take) => void) | null = null;
  /** latence d'entrée (ms : micro, carte son, navigateur), ajoutée au retard annoncé de chaque note */
  inputLag = 15;
  /** niveau du micro (dBFS, lissé) pour le vumètre */
  level = -100;
  /** pour les réglages : ce que l'analyse a vu à chaque attaque */
  debug: ((d: DebugInfo) => void) | null = null;

  private buf: Float32Array; private mask: number;
  private n = 0;
  // attaques
  private NO: number; private HO: number; private specO: Spectrum; private magO: Float32Array;
  private oLo: number; private oHi: number;
  private floorO: Float32Array; private prevL: Float32Array; private curL: Float32Array;
  private fluxHist: number[] = []; private frameEnd = 0; private cand: { f: number; e: number } | null = null; private prevFlux = 0;
  private lastOnset = -1e12; private lastFlux = 0;
  // analyse
  private WA: number; private specA: Spectrum; private magA: Float32Array;
  readonly grid: LogBins;
  private dict!: Dictionary; private tq!: Float64Array;   // Σ w·T² par touche (rapport signal / bruit)
  private calibrated = false;
  private floorA: Float32Array; private floorReady = false;
  private pending: Pending[] = [];
  private takes: { s: number; due: number; flux: number }[] = [];
  private HP: number; private nextPeriodic = 0; private hCur: Float64Array;
  // état des notes
  private active = new Map<number, { at: number; e: number; low: number }>();
  private hint = new Set<number>();
  private echoes: { p: number; from: number; to: number }[] = [];
  private out: NoteEvent[] = [];

  constructor(sr: number, models: KeyModel[], opts: DetectorOptions = {}) {
    this.sr = sr;
    const size = nextPow2(sr * 1.6);
    this.buf = new Float32Array(size); this.mask = size - 1;
    this.NO = nextPow2(sr * 0.04); this.HO = this.NO / 4;
    this.specO = new Spectrum(this.NO); this.magO = new Float32Array(this.NO / 2 + 1);
    const dfO = sr / this.NO;
    this.oLo = Math.max(1, Math.round(40 / dfO)); this.oHi = Math.min(this.NO / 2 - 1, Math.round(6000 / dfO));
    this.floorO = new Float32Array(this.NO / 2 + 1).fill(1e9);
    this.prevL = new Float32Array(this.NO / 2 + 1); this.curL = new Float32Array(this.NO / 2 + 1);
    this.WA = Math.round(sr * (opts.window ?? WINDOW_S));
    const NA = nextPow2(this.WA * 2);
    this.specA = new Spectrum(NA); this.magA = new Float32Array(NA / 2 + 1);
    this.grid = new LogBins(sr, NA, this.WA);
    this.floorA = new Float32Array(this.grid.nb).fill(1e9);
    this.HP = Math.round(sr * 0.04);
    this.hCur = new Float64Array(KEYS + 1);
    this.setModels(models);
  }

  /** Gabarits des 88 touches ; `calibrated` : ils viennent d'un piano calibré (timbre mesuré), les fantômes sont alors plus rares. */
  setModels(models: KeyModel[], calibrated = false) {
    this.calibrated = calibrated;
    this.dict = new Dictionary(this.grid, models);
    this.tq = new Float64Array(KEYS);
    for (let k = 0; k < KEYS; k++) { const t = this.dict.dense[k]; let s = 0; for (let b = 0; b < this.grid.nb; b++) s += this.grid.weight[b] * t[b] * t[b]; this.tq[k] = s; }
  }
  /** Notes attendues par la partition à cet instant : elles passent même jouées doucement, et ne sont jamais prises pour un fantôme. */
  setHint(pitches: Iterable<number>) { this.hint = new Set(pitches); }
  /** L'appli joue elle-même `pitch` (haut-parleurs) : on ne l'annonce pas comme une note du pianiste. Temps en secondes du flux. */
  addEcho(pitch: number, from: number, to: number) {
    const now = this.n / this.sr;
    this.echoes = this.echoes.filter((e) => e.to > now);
    this.echoes.push({ p: pitch, from: Math.round(from * this.sr), to: Math.round(to * this.sr) });
  }
  /** Temps du flux (secondes depuis le premier échantillon reçu). */
  get time() { return this.n / this.sr; }
  /** Notes qui sonnent (d'après la dernière annonce). */
  get sounding(): number[] { return [...this.active.keys()].sort((a, b) => a - b); }
  /** Oublie les notes en cours (changement de piano, retour d'arrière-plan…). */
  reset() {
    for (const p of this.active.keys()) this.out.push({ pitch: p, velocity: 0, on: false, lag: 0 });
    this.active.clear(); this.pending = []; this.takes = []; this.cand = null; this.fluxHist = [];
  }

  /** Reçoit un bloc d'échantillons (mono, -1..1) et renvoie les notes commencées ou finies. */
  push(chunk: Float32Array): NoteEvent[] {
    let sq = 0;
    for (let i = 0; i < chunk.length; i++) { const v = chunk[i]; this.buf[(this.n + i) & this.mask] = v; sq += v * v; }
    this.n += chunk.length;
    if (chunk.length) { const db = 10 * Math.log10(sq / chunk.length + 1e-12); this.level = db > this.level ? db : this.level * 0.85 + db * 0.15; }
    while (this.frameEnd + this.HO <= this.n) { this.frameEnd += this.HO; if (this.frameEnd >= this.NO) this.onsetFrame(this.frameEnd); }
    if (this.n >= this.nextPeriodic + this.HP && this.n >= this.WA) { this.nextPeriodic = this.n; this.periodic(); }
    while (this.pending.length && this.pending[0].due <= this.n) this.analyze(this.pending.shift()!);
    while (this.takes.length && (this.takes[0].due <= this.n || (this.takes[1] && this.takes[1].s <= this.n))) this.emitTake(this.takes.shift()!, this.takes[0]?.s);
    const out = this.out; this.out = [];
    return out;
  }

  private at = (i: number) => this.buf[i & this.mask];

  // ───────────── attaques ─────────────
  private onsetFrame(e: number) {
    const start = e - this.NO, mag = this.magO, floor = this.floorO, cur = this.curL, prev = this.prevL;
    this.specO.magnitudes((i) => this.at(start + i), this.NO, mag);
    // seules les vraies montées comptent (au-delà de ~+4 dB par raie) : une note aiguë, qui n'a qu'un ou deux partiels,
    // n'est pas noyée par les petites fluctuations du bruit sur toutes les autres raies
    let flux = 0;
    for (let k = this.oLo; k <= this.oHi; k++) {
      const m = mag[k], f = (floor[k] = Math.min(floor[k] * 1.003, Math.max(m, 1e-9)));
      const L = (cur[k] = Math.log(1 + m / (2 * f)));
      const d = L - Math.max(prev[k - 1], prev[k], prev[k + 1]) - 0.5;
      if (d > 0) flux += d;
    }
    flux /= this.oHi - this.oLo + 1;
    this.prevL = cur; this.curL = prev;
    // pic local, au-dessus de la moyenne récente : on décide une trame plus tard (il faut savoir que le flux redescend)
    const c = this.cand;
    if (c && flux < c.f) this.onset(c.e, c.f);
    const hist = this.fluxHist, mean = hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length : 0;
    const th = SENS[this.sensitivity].flux;
    this.cand = flux >= this.prevFlux && flux > th && flux > mean * 1.6 + th * 0.5 ? { f: flux, e } : null;
    this.prevFlux = flux;
    hist.push(flux); if (hist.length > 12) hist.shift();
  }

  /** Instant exact d'une attaque repérée dans la trame qui finit en `e` : le bloc de ~1,3 ms où l'énergie bondit le plus.
   *  On regarde l'énergie brute (note sur fond de bruit) et celle des aigus (note sur fond de notes graves qui sonnent encore). */
  private refine(e: number): number {
    const B = Math.max(32, Math.round(this.sr / 750)), from = Math.max(1, e - this.NO - 2 * this.HO), nbk = Math.floor((e - from) / B);
    const plain: number[] = [], diff: number[] = [];
    for (let j = 0; j < nbk; j++) {
      let s = 0, d = 0;
      for (let i = from + j * B, end = i + B; i < end; i++) { const v = this.at(i), dv = v - this.at(i - 1); s += v * v; d += dv * dv; }
      plain.push(s); diff.push(d);
    }
    // le bloc qui ajoute le plus d'énergie (une fluctuation de la note qui sonne déjà en ajoute peu), en remontant au début de la montée
    const jump = (en: number[]) => {
      const top = Math.max(...en, 1e-12), inc = en.map((v, j) => (j ? (v - Math.max(...en.slice(Math.max(0, j - 4), j))) / top : 0));
      let best = -1;
      for (let j = 1; j < en.length; j++) if (inc[j] > 0 && en[j] >= 2.5 * Math.max(...en.slice(Math.max(0, j - 4), j), top * 1e-4) && (best < 0 || inc[j] > inc[best])) best = j;
      if (best < 0) return { best, score: 0 };
      const score = inc[best];
      for (let k = 0; k < 3 && best > 1 && inc[best - 1] > score * 0.3; k++) best--;
      return { best, score };
    };
    const a = jump(plain), b = jump(diff), w = a.score >= b.score ? a : b;
    return w.best >= 0 ? from + w.best * B : e - Math.round(this.NO * 0.6);
  }

  private onset(e: number, flux: number) {
    const s = this.refine(e), a0 = s - Math.round(PRE_S * this.sr);
    if (s - this.lastOnset < GAP_S * this.sr) {
      // même accord (mains pas tout à fait ensemble)… sauf si cette attaque est bien plus forte : la première n'était qu'un frémissement,
      // on se cale sur celle-ci (en gardant le spectre d'avant la première)
      if (flux < 2 * this.lastFlux) return;
      this.lastOnset = s; this.lastFlux = flux;
      const p = this.pending[this.pending.length - 1];
      if (p && p.due > this.n) Object.assign(p, { s, due: a0 + this.WA, flux });
      const t = this.takes[this.takes.length - 1];
      if (t && t.due > this.n) Object.assign(t, { s, due: s + Math.round(TAKE_S * this.sr), flux });
      return;
    }
    // une attaque faible (bruit, frôlement) juste avant une vraie frappe bien plus forte : on se cale sur la frappe,
    // sans quoi l'analyse de la première verrait la frappe à moitié, au mauvais instant
    const q = this.pending[this.pending.length - 1];
    if (q && q.due > this.n && s - q.s < this.WA && flux >= 3 * q.flux) {
      this.lastOnset = s; this.lastFlux = flux;
      Object.assign(q, { s, due: a0 + this.WA, flux });
      return;
    }
    this.lastOnset = s; this.lastFlux = flux;
    // calibrage : un battement ou une résonance pendant qu'une frappe sonne encore ne la coupe pas (seule une vraie frappe le fait)
    const last = this.takes[this.takes.length - 1];
    if (this.capture && (!last || flux >= 0.5 * last.flux)) this.takes.push({ s, due: s + Math.round(TAKE_S * this.sr), flux });
    if (!this.detect || !this.floorReady) return;
    const pre = a0 - this.WA >= 0 ? this.spectrumAt(a0 - this.WA) : null;
    this.pending.push({ s, due: a0 + this.WA, pre, flux });
  }

  /** Spectre log-fréquence de la fenêtre d'analyse qui commence à l'échantillon `a0`. */
  private spectrumAt(a0: number): Float32Array {
    this.specA.magnitudes((i) => this.at(a0 + i), this.WA, this.magA);
    const X = new Float32Array(this.grid.nb);
    this.grid.pool(this.magA, X);
    return X;
  }

  /** Part de l'énergie de o en dessous de laquelle c n'en est qu'un fantôme. Seulement au-dessus de o (un Do3 sous un Do4 se prouve
   *  par ses partiels impairs) ou juste à côté (grave confus). Octave, douzième et double octave : au moins la moitié de o, tant que
   *  le timbre du piano n'est pas exactement connu. */
  private ghostOf(o: number, c: number): number {
    if (c < o - 2) return 0;
    const iv = c - o, strong = iv === 12 || iv === 19 || iv === 24 ? (this.calibrated ? 0.3 : 0.5) : 0;
    return Math.max(strong, GHOST * this.dict.over[o][c]);
  }

  // ───────────── décision à chaque attaque ─────────────
  /** Un son de piano culmine dès l'attaque (ou dès la dernière note d'un accord un peu décalé) puis décroît ; une voix (on compte
   *  à voix haute, on parle) monte nettement pendant 60 à 100 ms. Énergie glissante sur 32 ms, tous les 16 ms : instant du maximum (ms)
   *  et gain par rapport au début. (Les battements entre partiels voisins d'un accord font fluctuer l'énergie, mais peu.) */
  private envelope(s: number): { at: number; gain: number } {
    const L = Math.round(0.032 * this.sr), st = L >> 1, en: number[] = [];
    for (let j = 0; j < 7 && s + j * st + L <= this.n; j++) { let e = 0; for (let i = s + j * st, end = i + L; i < end; i++) { const v = this.at(i); e += v * v; } en.push(e); }
    if (en.length < 3) return { at: 0, gain: 1 };
    const top = Math.max(...en);
    return { at: en.indexOf(top) * 16, gain: top / Math.max(en[0], 1e-12) };
  }

  private analyze(p: Pending) {
    const nb = this.grid.nb, post = this.spectrumAt(p.s - Math.round(PRE_S * this.sr)), floor = this.floorA;
    const dX = new Float32Array(nb);
    for (let b = 0; b < nb; b++) dX[b] = Math.max(0, post[b] - (p.pre ? p.pre[b] : 0) - floor[b]);
    const D = this.dict, h = new Float64Array(D.K);
    nmfStart(D, dX, h); nmf(D, dX, h, 60, 0.08);
    const S = SENS[this.sensitivity];
    let sum = 0, top = 0;
    for (let k = 0; k < KEYS; k++) { sum += h[k]; if (h[k] > top) top = h[k]; }
    // son douteux : il enfle comme une voix (on parle, on compte à voix haute), ou son énergie s'éparpille sur beaucoup de touches
    // au lieu de quelques notes. On n'en garde alors que les notes attendues par la partition : un accord aux mains décalées
    // enfle aussi, mais ses notes sont celles de la partition, alors qu'une voix tombe rarement juste.
    const env = this.envelope(p.s), order = [...h.slice(0, KEYS).keys()].sort((a, b) => h[b] - h[a]).slice(0, 6);
    const conc = order.reduce((a, k) => a + h[k], 0) / (sum || 1);
    const doubt = (env.at > S.peak && env.gain > S.gain) || env.gain > S.gain * 3 || conc < S.conc;
    this.debug?.({ s: p.s, share: sum / (sum + h[KEYS]), flux: p.flux, rise: env.at, gain: env.gain, conc, top: order.map((k) => [A0 + k, +(h[k] / (top || 1)).toFixed(3)]) });
    if (!(top > 0) || sum / (sum + h[KEYS]) < S.share || (doubt && !this.hint.size)) return;
    // touches assez fortes et nettement au-dessus du bruit de fond (dans l'extrême grave, où les partiels se mêlent, un peu plus)
    const cands: { k: number; e: number }[] = [];
    for (let k = 0; k < KEYS; k++) {
      const e = h[k]; if (e <= 0) continue;
      const hinted = this.hint.has(A0 + k), low = 1 + Math.max(0, 36 - A0 - k) / 12;
      if (e < top * (hinted ? S.rel * 0.5 : S.rel * low)) continue;
      const ids = D.idx[k], vs = D.val[k]; let fl = 0;
      for (let i = 0; i < ids.length; i++) fl += D.w[ids[i]] * vs[i] * floor[ids[i]];
      if ((e * this.tq[k]) / (fl + 1e-12) < (hinted ? S.snr * 0.7 : S.snr)) continue;
      cands.push({ k, e });
    }
    cands.sort((a, b) => b.e - a.e);
    const kept: { k: number; e: number }[] = [];
    const echo = (k: number) => this.echoes.some((x) => x.p === A0 + k && x.from <= p.s + 0.05 * this.sr && x.to >= p.s);
    for (const c of cands) {
      const m = A0 + c.k, hinted = this.hint.has(m);
      if (doubt && !hinted) continue;
      // fantôme d'une note plus forte jouée en même temps : à peine plus que ce qu'elle dépose sur ses partiels
      if (!hinted && cands.some((o) => o.e > c.e && c.e < this.ghostOf(o.k, c.k) * o.e)) continue;
      // partiel d'une note qui sonne encore (battement des cordes, résonance) : il faut une vraie frappe à côté d'elle
      // (en dessous d'elle aussi, mais avec un seuil bien plus bas : une vraie basse jouée sous une mélodie doit passer)
      let masked = false;
      for (const q of this.active.keys()) {
        const o = q - A0; if (o === c.k) continue;
        const g = c.k < o - 2 ? 0.3 * D.over[o][c.k] : this.ghostOf(o, c.k);
        if (c.e < (hinted ? 0.4 : 0.8) * g * this.hCur[o]) { masked = true; break; }
      }
      if (masked || echo(c.k)) continue;
      const a = this.active.get(m);
      if (a && p.s - a.at < REPEAT_S * this.sr) continue;
      kept.push(c);
      if (kept.length >= 10) break;
    }
    if (!kept.length) return;
    // force de frappe : niveau de l'attaque (≈ 80 pour une note jouée normalement à ~30 cm du micro)
    let sq = 0; const a0 = p.s - Math.round(PRE_S * this.sr), len = Math.round(this.sr * 0.05);
    for (let i = a0; i < a0 + len; i++) { const v = this.at(i); sq += v * v; }
    const db = 10 * Math.log10(sq / len + 1e-12), vel = Math.max(15, Math.min(127, Math.round(80 + (db + 28) * 2.2)));
    const lag = ((this.n - p.s) / this.sr) * 1000 + this.inputLag;
    for (const c of kept.sort((a, b) => a.k - b.k)) {
      const m = A0 + c.k;
      this.active.set(m, { at: p.s, e: c.e, low: 0 });
      this.out.push({ pitch: m, velocity: vel, on: true, lag });
    }
  }

  // ───────────── suivi des notes qui sonnent, bruit de fond ─────────────
  private periodic() {
    const X = this.spectrumAt(this.n - this.WA), floor = this.floorA, nb = this.grid.nb;
    for (let b = 0; b < nb; b++) floor[b] = Math.min(floor[b] * 1.01, Math.max(X[b], 1e-9));
    this.floorReady = true;
    if (!this.active.size) return;
    const D = this.dict, h = this.hCur;
    let s = 0; for (let b = 0; b < nb; b++) s += D.w[b] * X[b];
    for (let k = 0; k < D.K; k++) h[k] = Math.max(h[k], (s / D.K) * 0.05);
    nmf(D, X, h, 15, 0.05);
    for (const [m, a] of this.active) {
      const k = m - A0, e = h[k];
      const ids = D.idx[k], vs = D.val[k]; let fl = 0;
      for (let i = 0; i < ids.length; i++) fl += D.w[ids[i]] * vs[i] * floor[ids[i]];
      const quiet = e < a.e * 0.1 || (e * this.tq[k]) / (fl + 1e-12) < 1.5;
      a.low = quiet ? a.low + 1 : 0;
      if ((a.low >= 2 && this.n - a.at > REPEAT_S * this.sr) || this.n - a.at > 12 * this.sr) {
        this.active.delete(m);
        this.out.push({ pitch: m, velocity: 0, on: false, lag: this.inputLag });
      }
    }
  }

  private emitTake(t: { s: number; due: number; flux: number }, next?: number) {
    const a0 = t.s - Math.round(PRE_S * this.sr), end = Math.min(t.due, next ?? Infinity, this.n);
    if (end - a0 < this.sr * 0.15 || !this.capture) return;
    const samples = new Float32Array(end - a0);
    for (let i = 0; i < samples.length; i++) samples[i] = this.at(a0 + i);
    let sq = 0; const len = Math.min(samples.length, this.WA);
    for (let i = 0; i < len; i++) sq += samples[i] * samples[i];
    this.capture({ samples, sr: this.sr, level: 10 * Math.log10(sq / len + 1e-12), flux: t.flux });
  }
}
