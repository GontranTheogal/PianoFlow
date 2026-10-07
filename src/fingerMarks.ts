import type { Step, Note } from "./score";

/** Position de la main = touche où se poserait le pouce. Écart (en demi-tons) du doigt n par rapport au pouce
 *  dans une position « 5 doigts » détendue (Do Ré Mi Fa Sol à la main droite). */
const OFFSET = [0, 0, 2, 4, 5, 7];

/** Marque (note.showFinger) uniquement les doigtés « repères », comme sur une partition éditée :
 *  début de phrase (après un silence) et chaque changement de position de la main.
 *  Entre deux repères, la main reste en place : on joue les touches voisines avec les doigts voisins. */
export function markKeyFingerings(steps: Step[]) {
  for (const hand of ["R", "L"] as const) {
    const seq: Note[] = [];
    for (const s of steps) for (const n of s.notes) if (n.hand === hand) seq.push(n);
    let anchor: number | null = null, lastEnd = -Infinity, i = 0;
    while (i < seq.length) {
      let j = i; while (j < seq.length && seq[j].onTime === seq[i].onTime) j++;   // notes simultanées (accord)
      const group = seq.slice(i, j);
      let show = anchor === null || seq[i].onTime - lastEnd > 700;
      let a: number = anchor ?? 0;
      for (const n of group) {
        if (!n.finger) continue;
        const thumb = hand === "R" ? n.pitch - OFFSET[n.finger] : n.pitch + OFFSET[n.finger];
        if (anchor !== null && Math.abs(thumb - anchor) > 2) show = true;
        a = thumb;
      }
      for (const n of group) n.showFinger = show;
      anchor = a;
      lastEnd = Math.max(lastEnd, ...group.map((n) => n.offTime));
      i = j;
    }
  }
}
