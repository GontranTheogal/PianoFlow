/** Calibrage d'un piano : chaque touche est jouée plusieurs fois, et on mesure sur chaque frappe la fréquence réelle de la note
 *  (un piano désaccordé peut être loin du La 440), l'inharmonicité de ses cordes et le poids de chacun de ses partiels.
 *  Pur : testable sans navigateur. */
import { Spectrum, nextPow2 } from "./fft";
import { centsFrom, genericB, nominalHz, partialHz } from "./model";

export interface TakeResult {
  ok: boolean;
  /** frappe refusée : trop faible, son confus, ou une autre touche que celle demandée */
  reason?: "faint" | "unclear" | "off";
  /** touche entendue (MIDI, sur l'accord de ce piano : la voisine, même s'il est désaccordé) quand ce n'est pas la bonne */
  heard?: number;
  /** son entendu, en cents par rapport à la touche demandée sur un piano bien accordé (pour « cette touche sonne ainsi ») */
  heardCents?: number;
  f0: number; cents: number; B: number;
  /** amplitude de chaque partiel au début du son (la plus forte vaut 1) */
  amps: number[];
  level: number;
}
export interface TakeOptions {
  /** écart attendu (cents) par rapport à un piano bien accordé, d'après les touches voisines déjà calibrées */
  expect: number;
  /** jusqu'où chercher autour (cents) */
  search: number;
  /** fenêtre d'analyse du détecteur (s) : le timbre est mesuré sur la même durée, au même endroit */
  window: number;
  /** bruit de fond de la pièce (dBFS) */
  noiseDb?: number;
}

const FMAX = 9000;
/** `quality` : force des partiels trouvés, pondérée par la part des premiers partiels attendus qui sont là (une note une octave
 *  trop bas « explique » les mêmes pics comme ses partiels pairs, mais il lui manque tous les impairs). */
interface Fit { f0: number; B: number; pts: { j: number; f: number }[]; need: number; quality: number; }

export function analyzeTake(samples: Float32Array, sr: number, m: number, o: TakeOptions): TakeResult {
  const fmax = Math.min(FMAX, sr * 0.45);
  const WA = Math.min(samples.length, Math.round(sr * o.window));
  let sq = 0; for (let i = 0; i < WA; i++) sq += samples[i] * samples[i];
  const level = 10 * Math.log10(sq / Math.max(1, WA) + 1e-12);
  const fail = (reason: TakeResult["reason"], heard?: number, heardCents?: number): TakeResult => ({ ok: false, reason, heard, heardCents, f0: 0, cents: 0, B: 0, amps: [], level });
  if (level < Math.max(-66, (o.noiseDb ?? -100) + 12)) return fail("faint");

  // spectre fin sur la demi-seconde qui suit l'attaque : fréquences des partiels
  const L = Math.min(samples.length, Math.round(sr * 0.5)), N = nextPow2(2 * L), mag = new Float32Array(N / 2 + 1);
  new Spectrum(N).magnitudes((i) => samples[i], L, mag);
  const df = sr / N, hiBin = Math.floor(fmax / df);
  const sample: number[] = [];
  for (let i = Math.floor(30 / df); i < hiBin; i += 4) sample.push(mag[i]);
  sample.sort((a, b) => a - b);
  const med = Math.max(sample[sample.length >> 1] ?? 1e-9, 1e-9);
  const peakNear = (f: number, cents: number) => {
    const t = Math.max(df, f * (2 ** (cents / 1200) - 1)), a = Math.max(1, Math.floor((f - t) / df)), b = Math.min(hiBin, Math.ceil((f + t) / df));
    let best = a; for (let i = a; i <= b; i++) if (mag[i] > mag[best]) best = i;
    return best;
  };

  /** La touche k, accordée à `center` cents près (± `search`), explique-t-elle ce son ? Ses partiels nets, f0, B, et la force de l'ensemble. */
  const fitKey = (k: number, center: number, search: number): Fit | null => {
    // recherche de la fondamentale : somme des partiels attendus, sur une grille (écart en cents × inharmonicité)
    const B0 = genericB(k), Bs = [0.3, 0.6, 1, 1.7, 3].map((x) => x * B0);
    const score = (f0: number, B: number) => {
      let s = 0;
      for (let j = 1; j <= 12; j++) { const f = partialHz(f0, B, j); if (f > Math.min(fmax, 6000)) break; s += Math.log(1 + mag[peakNear(f, 3 + 0.05 * j * j)] / med); }
      return s;
    };
    let g = { c: center, B: B0, s: -1 };
    for (let c = Math.round(center - search); c <= center + search; c++) for (const B of Bs) { const s = score(nominalHz(k, c), B); if (s > g.s) g = { c, B, s }; }
    // affinage : chaque partiel net est pointé (interpolation parabolique), puis f0 et B sont ajustés par moindres carrés.
    // On part des 6 premiers partiels et on élargit (12, 24, 40) : chaque étape prédit mieux la suivante. La tolérance reste sous
    // le quart de l'écart entre deux partiels, sinon on prendrait le voisin dans l'aigu du spectre (B surestimé, f0 trop bas).
    let f0 = nominalHz(k, g.c), B = g.B, pts: { j: number; f: number }[] = [];
    const pick = (J: number) => {
      const out: { j: number; f: number }[] = [];
      for (let j = 1; j <= J; j++) {
        const fp = partialHz(f0, B, j); if (fp > fmax) break;
        // tolérance : précision du modèle, plus l'incertitude sur B (±50 %), qui compte dans l'aigu
        const i = peakNear(fp, Math.min(4 + 0.03 * j * j + 433 * B * j * j, 430 / j));
        if (i <= 0 || i >= hiBin || mag[i] < 4 * med || mag[i] < mag[i - 1] || mag[i] < mag[i + 1]) continue;
        const a = Math.log(mag[i - 1] + 1e-12), b = Math.log(mag[i] + 1e-12), c = Math.log(mag[i + 1] + 1e-12), den = a - 2 * b + c;
        const off = den < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / den)) : 0;
        out.push({ j, f: (i + off) * df });
      }
      return out;
    };
    const adjust = () => {
      const fit = fitStiffString(pts);
      if (fit) { f0 = fit.f0; B = fit.B; } else f0 = median(pts.map((p) => p.f / (p.j * Math.sqrt(1 + B * p.j * p.j))));
    };
    // tout en haut du clavier, le fondamental est presque seul (le 2e partiel, très aigu, est faible) : on ne mesure que lui,
    // B reste celui d'un piano moyen (f0 et B ne se distinguent pas sur un seul partiel ; c'est sa position qui compte)
    const need = partialHz(f0, B, 2) > Math.min(fmax, 5000) ? 1 : 2;
    if (need === 1) {
      f0 = (f0 * Math.sqrt(1 + B)) / Math.sqrt(1 + B0); B = B0;     // même fondamental que la grille, avec le B moyen
      pts = pick(2);                                                // le 2e partiel compte s'il est là, sans être exigé
      const fund = pts.find((p) => p.j === 1);
      if (fund) f0 = fund.f / Math.sqrt(1 + B); else pts = [];
    }
    else for (const J of [6, 12, 24, 40]) {
      pts = pick(J);
      if (pts.length < need) { if (J === 6) continue; break; }
      adjust();
      // un partiel loin du modèle ajusté (pic voisin, bruit) est écarté, et on réajuste sans lui
      const kept = pts.filter((p) => Math.abs(1200 * Math.log2(p.f / partialHz(f0, B, p.j))) < 5);
      if (kept.length >= need && kept.length < pts.length) { pts = kept; adjust(); }
    }
    if (pts.length < need) return null;
    let jc = 0; while (need === 2 && jc < 8 && partialHz(f0, B, jc + 1) < Math.min(fmax, 6000)) jc++;
    const cover = jc ? pts.filter((p) => p.j <= jc).length / jc : 1;
    const quality = pts.reduce((s, p) => s + Math.log(1 + mag[Math.round(p.f / df)] / med), 0) * Math.sqrt(cover);
    return { f0, B, pts, need, quality };
  };

  const own = fitKey(m, o.expect, o.search);
  // une touche voisine (jusqu'à une quinte de part et d'autre), sur le même accord que celle-ci, explique bien mieux ce son :
  // on s'est trompé de touche. On nomme la touche, pas la note du diapason (sur un piano désaccordé, elles diffèrent).
  // (un ajustement qui a glissé hors de la plage de sa touche a trouvé la voisine : il ne compte pas pour celle-ci)
  let alt: { k: number; fit: Fit } | null = null;
  for (const d of [-12, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 12]) {
    const k = m + d; if (k < 21 || k > 108) continue;
    const f = fitKey(k, o.expect, 45);
    if (!f || Math.abs(centsFrom(k, f.f0) - o.expect) > 55) continue;
    if (f.quality > 1.25 * (own?.quality ?? 0) && (!alt || f.quality > alt.fit.quality)) alt = { k, fit: f };
  }
  if (alt) return fail("off", alt.k, centsFrom(m, alt.fit.f0));
  if (!own) return fail("unclear");
  const { f0, B, pts, need } = own, B0 = genericB(m);
  // cohérence : un vrai son de piano montre la plupart de ses premiers partiels, avec une inharmonicité plausible.
  // Un ajustement passé par quelques pics épars (autre note, octave au-dessus) n'est pas une mesure.
  if (need === 2) {
    let jc = 0; while (jc < 8 && partialHz(f0, B, jc + 1) < Math.min(fmax, 6000)) jc++;
    const low = pts.filter((p) => p.j <= jc), even = low.filter((p) => p.j % 2 === 0).length;
    // seuls les partiels pairs (ou, dans l'aigu, pas de fondamental) : c'est l'octave du dessus qu'on entend
    if (m + 12 <= 108 && even >= 1 && (jc >= 4 ? low.length - even <= 1 && even >= 2 : !pts.some((p) => p.j === 1))) return fail("off", m + 12, centsFrom(m, 2 * f0));
    if ((jc >= 4 && low.length < Math.ceil(0.6 * jc)) || B < 0.2 * B0 || B > 5 * B0) return fail("unclear");
  }
  // octave du dessous : ses partiels impairs tombent entre ceux de la note demandée, qui n'en a jamais là (même pédale enfoncée).
  // Vu depuis la note demandée, son inharmonicité vaut B/4 : on place ses partiels en conséquence.
  if (m - 12 >= 21) {
    const n = need === 2 ? 6 : 2, sub: number[] = [];
    for (let i = 1; i <= n; i++) { const q = 2 * i - 1, f = ((q * f0) / 2) * Math.sqrt(1 + (B / 4) * q * q); if (f < fmax) sub.push(mag[peakNear(f, 12)]); }
    const mine = pts.filter((p) => p.j <= 6).map((p) => mag[Math.round(p.f / df)]), avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
    if (sub.filter((v) => v >= 4 * med).length >= Math.min(3, sub.length) && avg(sub) >= 0.15 * avg(mine)) return fail("off", m - 12, centsFrom(m, f0 / 2));
  }
  const cents = centsFrom(m, f0);
  if (Math.abs(cents - o.expect) > o.search) return fail("off", m + Math.round((cents - o.expect) / 100), cents);

  // timbre au début du son, mesuré exactement comme le détecteur le verra
  const NA = nextPow2(2 * WA), magA = new Float32Array(NA / 2 + 1);
  new Spectrum(NA).magnitudes((i) => samples[i], WA, magA);
  const dfa = sr / NA, sa: number[] = [];
  for (let i = Math.floor(30 / dfa); i < Math.floor(fmax / dfa); i += 4) sa.push(magA[i]);
  sa.sort((a, b) => a - b);
  const medA = sa[sa.length >> 1] ?? 0, amps: number[] = [];
  for (let j = 1; j <= 40; j++) {
    const f = partialHz(f0, B, j); if (f > fmax) break;
    const c = f / dfa, i0 = Math.floor(c);
    let v = magA[i0] * (1 - (c - i0)) + magA[i0 + 1] * (c - i0);
    for (let i = i0 - 1; i <= i0 + 2; i++) if (magA[i] > v) v = magA[i];
    amps.push(Math.max(0, v - 1.5 * medA));
  }
  const top = Math.max(...amps);
  if (!(top > 0)) return fail("unclear");
  return { ok: true, f0, cents: centsFrom(m, f0), B, amps: amps.map((a) => a / top), level };
}

/** Corde raide : f_j = j·f0·√(1 + B·j²), soit (f_j / j)² = f0² + f0²·B·j² — une droite en j². */
export function fitStiffString(pts: { j: number; f: number }[]): { f0: number; B: number } | null {
  if (pts.length < 3) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const p of pts) { const x = p.j * p.j, y = (p.f / p.j) ** 2; sx += x; sy += y; sxx += x * x; sxy += x * y; }
  const n = pts.length, den = n * sxx - sx * sx;
  if (Math.abs(den) < 1e-9) return null;
  const slope = (n * sxy - sx * sy) / den, icpt = (sy - slope * sx) / n;
  if (!(icpt > 0)) return null;
  const B = slope / icpt;
  if (!(B > 1e-6 && B < 0.05)) return null;
  return { f0: Math.sqrt(icpt), B };
}

export const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };

/** Frappes d'une touche qui concordent (même fréquence à quelques cents près) : la touche est réglée.
 *  Sinon `null`, avec les frappes à garder (les plus cohérentes) pour en redemander. */
export function combineTakes(takes: TakeResult[], need: number): { done: { f0: number; B: number; amps: number[]; level: number } | null; keep: TakeResult[] } {
  const ok = takes.filter((t) => t.ok);
  if (!ok.length) return { done: null, keep: [] };
  const mc = median(ok.map((t) => t.cents)), keep = ok.filter((t) => Math.abs(t.cents - mc) <= 7);
  if (keep.length < need) return { done: null, keep };
  const n = Math.max(...keep.map((t) => t.amps.length)), amps: number[] = [];
  for (let j = 0; j < n; j++) amps.push(keep.reduce((s, t) => s + (t.amps[j] ?? 0), 0) / keep.length);
  const top = Math.max(...amps, 1e-9);
  return {
    done: {
      f0: median(keep.map((t) => t.f0)), B: median(keep.map((t) => t.B)),
      amps: amps.map((a) => a / top), level: keep.reduce((s, t) => s + t.level, 0) / keep.length,
    },
    keep,
  };
}

/** Écart attendu (cents) d'une touche d'après ses voisines déjà calibrées, et la largeur de recherche qui va avec. */
export function expectFor(m: number, cents: Map<number, number>): { expect: number; search: number } {
  let lo: number | null = null, hi: number | null = null;
  for (const k of cents.keys()) { if (k < m && (lo === null || k > lo)) lo = k; if (k > m && (hi === null || k < hi)) hi = k; }
  if (lo === null && hi === null) return { expect: 0, search: 150 };
  const near = Math.min(lo === null ? 99 : m - lo, hi === null ? 99 : hi - m);
  let expect: number;
  if (lo !== null && hi !== null) expect = cents.get(lo)! + ((cents.get(hi)! - cents.get(lo)!) * (m - lo)) / (hi - lo);
  else expect = cents.get((lo ?? hi)!)!;
  return { expect, search: near <= 4 ? 60 : 150 };
}
