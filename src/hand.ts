/** Profil de main : les mesures de l'utilisateur, qui règlent les écarts jugés confortables par l'algorithme de doigté.
 *  Géométrie d'un vrai clavier (largeur d'une touche blanche 2,35 cm), distances en cm. */

import { writeJson } from "./storage";

export interface HandProfile {
  /** Envergure : distance pouce → auriculaire, main à plat et bien ouverte, bout des doigts (cm). Adulte : 17 à 24. */
  span: number;
  /** Écart confortable pouce → index, main ouverte (cm). Facultatif : déduit de l'envergure sinon. */
  thumbIndex?: number;
  /** Date de la dernière modification (pour la fusion entre appareils : le plus récent gagne). */
  updatedAt?: number;
}

export const DEFAULT_SPAN = 20.5;
export const SPAN_MIN = 14, SPAN_MAX = 28;
export const HAND_PRESETS: { id: string; label: string; span: number }[] = [
  { id: "small", label: "Petite main", span: 17.5 },
  { id: "medium", label: "Moyenne", span: 20.5 },
  { id: "large", label: "Grande main", span: 23.5 },
];

export const WHITE_CM = 2.35;
const WHITE_IDX = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const BLACK_PC = new Set([1, 3, 6, 8, 10]);
const BLACK_SHIFT: Record<number, number> = { 1: -0.35, 3: 0.35, 6: -0.4, 8: 0, 10: 0.4 };
export const isBlackKey = (midi: number) => BLACK_PC.has(((midi % 12) + 12) % 12);

/** Position horizontale (cm) du centre de la touche. */
export function keyX(midi: number): number {
  const pc = ((midi % 12) + 12) % 12, oct = Math.floor(midi / 12), w = oct * 7 + WHITE_IDX[pc];
  return BLACK_PC.has(pc) ? (w + 1) * WHITE_CM + BLACK_SHIFT[pc] : w * WHITE_CM + WHITE_CM / 2;
}

/** Limites (en fraction de l'envergure) entre deux doigts qui restent en place :
 *  [détendu min, détendu max, confortable max, maximum absolu]. */
const RATIO: Record<string, [number, number, number, number]> = {
  "1-2": [0.10, 0.25, 0.42, 0.57],
  "1-3": [0.17, 0.35, 0.55, 0.75],
  "1-4": [0.25, 0.45, 0.70, 0.88],
  "1-5": [0.32, 0.55, 0.85, 1.00],
  "2-3": [0.06, 0.17, 0.28, 0.40],
  "2-4": [0.15, 0.28, 0.43, 0.55],
  "2-5": [0.22, 0.42, 0.60, 0.73],
  "3-4": [0.06, 0.16, 0.23, 0.33],
  "3-5": [0.12, 0.27, 0.40, 0.50],
  "4-5": [0.06, 0.16, 0.23, 0.33],
};
export interface PairLimits { relMin: number; relMax: number; comfMax: number; absMax: number; }
const cache = new Map<string, PairLimits>();
export function pairLimits(a: number, b: number, h: HandProfile): PairLimits {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  if (lo === hi) return { relMin: 0, relMax: 0, comfMax: 0, absMax: 0 };     // un doigt ne joue pas deux touches à la fois (doigtés écrits incohérents) : écart nul toléré, tout le reste est pénalisé
  const key = `${lo}-${hi}|${h.span}|${h.thumbIndex ?? ""}`;
  let v = cache.get(key);
  if (!v) {
    const r = RATIO[`${lo}-${hi}`];
    let [rmin, rmax, cmax, amax] = r.map((x) => x * h.span) as [number, number, number, number];
    if (lo === 1 && hi === 2 && h.thumbIndex) {                // mesure directe pouce–index : on cale les limites dessus
      const k = h.thumbIndex / (0.42 * h.span); rmin *= k; rmax *= k; cmax = h.thumbIndex; amax *= k;
    }
    v = { relMin: rmin, relMax: rmax, comfMax: cmax, absMax: amax };
    cache.set(key, v);
  }
  return v;
}

const STORE = "pianoflow-hand";
export function defaultHand(): HandProfile { return { span: DEFAULT_SPAN }; }
export function sanitizeHand(h: Partial<HandProfile> | null | undefined): HandProfile {
  const raw = Number(h?.span), span = Math.min(SPAN_MAX, Math.max(SPAN_MIN, raw > 0 ? raw : DEFAULT_SPAN));
  const ti = Number(h?.thumbIndex);
  return { span, ...(ti > 3 && ti < 20 ? { thumbIndex: ti } : {}), ...(h?.updatedAt ? { updatedAt: h.updatedAt } : {}) };
}
export function loadHand(): HandProfile {
  try { return sanitizeHand(JSON.parse(localStorage.getItem(STORE) || "null")); } catch { return defaultHand(); }
}
export function saveHand(h: HandProfile): HandProfile {
  const v = sanitizeHand({ ...h, updatedAt: Date.now() });
  writeJson(STORE, v);
  return v;
}
