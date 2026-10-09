/** Corrections de doigtés faites à la main sur un morceau (par toi ou ton professeur).
 *  Elles servent de contraintes : l'algorithme recalcule le reste du passage autour d'elles.
 *  Stockées par morceau avec la date de modification (fusion entre appareils : la version la plus récente gagne, morceau par morceau). */
import { readJson, writeJson } from "./storage";
export interface SongEdits { at: number; f: Record<string, number>; }
const KEY = "pianoflow-fingerings";
function all(): Record<string, SongEdits> { return readJson<Record<string, SongEdits>>(KEY, {}); }
function save(a: Record<string, SongEdits>) { writeJson(KEY, a); }

export function editsFor(song: string): Map<string, number> { return new Map(Object.entries(all()[song]?.f ?? {})); }
/** `finger` null : on rend la note à l'algorithme. */
export function setEdit(song: string, key: string, finger: number | null) {
  const a = all(), e = a[song] ?? { at: 0, f: {} };
  if (finger === null) delete e.f[key]; else e.f[key] = finger;
  e.at = Date.now(); a[song] = e; save(a);
}
export function clearEdits(song: string) { const a = all(); a[song] = { at: Date.now(), f: {} }; save(a); }
