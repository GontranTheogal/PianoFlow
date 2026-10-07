/** Géométrie du clavier, partagée par le piano et les notes qui tombent.
 *  La plage est dynamique : on n'affiche que les touches utiles au morceau (touches plus grandes, plus lisibles). */
export const WW = 24, BW = 14, WH = 130, BH = 82; // proportions d'un vrai clavier (touche blanche 23,5 mm, noire ~13,7 mm)
export const BLACK_RATIO = BH / WH;
const BLACK = new Set([1, 3, 6, 8, 10]);

export let FIRST = 21, LAST = 108;      // A0 .. C8
export let WHITE_COUNT = 52;
export let TOTAL_WIDTH = WHITE_COUNT * WW;
const whiteIndex = new Map<number, number>();

export function isBlack(pitch: number) { return BLACK.has(pitch % 12); }

export function setKeyboardRange(lo: number, hi: number) {
  lo = Math.max(21, lo); hi = Math.min(108, hi);
  while (isBlack(lo)) lo--;   // les extrémités doivent être des touches blanches
  while (isBlack(hi)) hi++;
  FIRST = lo; LAST = hi;
  whiteIndex.clear();
  let i = 0;
  for (let p = FIRST; p <= LAST; p++) if (!isBlack(p)) whiteIndex.set(p, i++);
  WHITE_COUNT = i;
  TOTAL_WIDTH = WHITE_COUNT * WW;
}
setKeyboardRange(21, 108);

/** Plage adaptée aux notes : de Do en Si, au moins 4 octaves (sinon les touches seraient énormes et le geste peu naturel). */
export function rangeForNotes(minPitch: number, maxPitch: number, minKeys = 48): [number, number] {
  let lo = Math.floor((minPitch - 1) / 12) * 12;          // Do juste en dessous (avec 1 demi-ton de marge)
  let hi = Math.floor((maxPitch + 1) / 12) * 12 + 11;     // Si juste au-dessus
  let flip = false;
  while (hi - lo + 1 < minKeys) { if (flip && lo - 12 >= 21) lo -= 12; else if (hi + 12 <= 108) hi += 12; else lo -= 12; flip = !flip; }
  return [Math.max(21, lo), Math.min(108, hi)];
}

/** Position/largeur d'une touche, alignées entre le clavier et les notes qui tombent. */
export function keyGeometry(pitch: number) {
  const black = isBlack(pitch);
  if (!black) { const x = (whiteIndex.get(pitch) ?? 0) * WW; return { x, width: WW, black }; }
  const left = whiteIndex.get(pitch - 1) ?? 0;
  const x = left * WW + WW - BW / 2;
  return { x, width: BW, black };
}
