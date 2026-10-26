/** Modèle acoustique d'une touche de piano : fréquence fondamentale réelle, inharmonicité des cordes et amplitude de chaque partiel.
 *  Sans calibrage, on prend un piano « moyen » bien accordé ; un piano calibré remplace ces valeurs par celles mesurées touche par touche. */

export const A0 = 21, C8 = 108;
export const KEYS = C8 - A0 + 1;

/** Fréquence au tempérament égal (La 440). */
export const etHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
/** Accord « étiré » d'un piano bien accordé (courbe de Railsback, approchée) : les graves un peu bas, les aigus un peu hauts, en cents. */
export const stretchCents = (m: number) => 0.00025 * (m - 60) ** 3;
/** Fréquence attendue d'une touche sur un piano bien accordé, décalée de `cents`. */
export const nominalHz = (m: number, cents = 0) => etHz(m) * 2 ** ((stretchCents(m) + cents) / 1200);
/** Écart en cents entre une fréquence mesurée et celle d'un piano bien accordé. */
export const centsFrom = (m: number, hz: number) => 1200 * Math.log2(hz / nominalHz(m));
/** Inharmonicité typique (coefficient B) : minimale vers Do3, elle croît vers l'aigu (cordes courtes et raides) et un peu vers le grave. */
export const genericB = (m: number) => 10 ** (m <= 48 ? -4 + (48 - m) * 0.018 : -4 + (m - 48) * 0.033);
/** Fréquence du partiel j (1 = fondamental) d'une corde raide. */
export const partialHz = (f0: number, B: number, j: number) => j * f0 * Math.sqrt(1 + B * j * j);

export interface KeyModel {
  f0: number;
  B: number;
  /** amplitude du partiel j en amps[j - 1], la plus forte vaut 1 */
  amps: number[];
}

export const MAX_PARTIALS = 30;
/** Timbre moyen : partiels qui décroissent, plus vite dans l'aigu ; micro et table d'harmonie rendent peu les très graves. */
export function genericAmps(m: number, f0: number, B: number, fmax: number): number[] {
  const p = 0.8 + 0.7 * Math.min(1, Math.max(0, (m - 36) / 60)), out: number[] = [];
  for (let j = 1; j <= MAX_PARTIALS; j++) {
    const f = partialHz(f0, B, j);
    if (f > fmax) break;
    out.push(j ** -p / (1 + (70 / f) ** 2) / (1 + (f / 5000) ** 2));
  }
  const top = Math.max(...out, 1e-9);
  return out.map((a) => a / top);
}
export function genericModel(m: number, cents = 0, fmax = 9000): KeyModel {
  const f0 = nominalHz(m, cents), B = genericB(m);
  return { f0, B, amps: genericAmps(m, f0, B, fmax) };
}

/** Liste plate (fréquence, amplitude, fréquence, amplitude…) des partiels sous fmax. Au-delà des amplitudes connues, ils décroissent comme le modèle moyen. */
export function partialsOf(k: KeyModel, fmax: number, m: number): number[] {
  const out: number[] = [];
  const last = k.amps.length ? k.amps[k.amps.length - 1] : 1, n = k.amps.length;
  for (let j = 1; j <= MAX_PARTIALS; j++) {
    const f = partialHz(k.f0, k.B, j);
    if (f > fmax) break;
    const a = j <= n ? k.amps[j - 1] : last * ((n || 1) / j) ** (0.8 + 0.7 * Math.min(1, Math.max(0, (m - 36) / 60)));
    if (a > 1e-4) out.push(f, a);
  }
  return out;
}
