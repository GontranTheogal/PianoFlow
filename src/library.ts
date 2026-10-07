import localforage from 'localforage';

/** Crochets utilisés par la synchro PC : appelés seulement pour les changements faits par l'utilisateur. */
export const libraryHooks: {
  onAdd?: (e: LibraryEntry) => void; onFavorite?: (name: string, fav: boolean) => void;
  onRemove?: (name: string) => void; onRename?: (from: string, to: string) => void;
} = {};
export interface LibraryEntry { name: string; fileData: ArrayBuffer; addedAt: number; favorite: boolean; difficulty: number; /** ce qui rend le morceau difficile (calculé sur cet appareil) */ why?: string[]; }
const KEY = "pianoflow-library";

export async function listLibrary(): Promise<LibraryEntry[]> {
  try {
    const raw: any[] = await localforage.getItem(KEY) || [];
    return raw.map((e) => ({ difficulty: 1, ...e })).sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || b.addedAt - a.addedAt);
  } catch { return []; }
}

export async function addToLibrary(name: string, fileData: ArrayBuffer, difficulty: number, meta?: { addedAt?: number; favorite?: boolean; fromSync?: boolean; why?: string[] }) {
  try {
    const library: any[] = await localforage.getItem(KEY) || [];
    let entry = library.find((e) => e.name === name);
    if (!entry) {
      entry = { name, fileData, addedAt: meta?.addedAt ?? Date.now(), favorite: meta?.favorite ?? false, difficulty, why: meta?.why };
      library.push(entry);
      await localforage.setItem(KEY, library);
    } else if (!meta?.fromSync && (entry.difficulty !== difficulty || String(entry.why) !== String(meta?.why))) {
      // le morceau rouvert est noté à nouveau (barème à jour, tempo et armure réels)
      entry.difficulty = difficulty; entry.why = meta?.why;
      await localforage.setItem(KEY, library);
    }
    if (!meta?.fromSync) libraryHooks.onAdd?.(entry as LibraryEntry);
  } catch (err) { console.error(err); }
}

export async function toggleFavorite(name: string) {
  const library: any[] = await localforage.getItem(KEY) || [];
  const e = library.find((x) => x.name === name);
  if (e) { e.favorite = !e.favorite; await localforage.setItem(KEY, library); libraryHooks.onFavorite?.(name, e.favorite); }
}

export async function removeFromLibrary(name: string, fromSync = false) {
  const library: any[] = await localforage.getItem(KEY) || [];
  await localforage.setItem(KEY, library.filter((e) => e.name !== name));
  if (!fromSync) libraryHooks.onRemove?.(name);
}
/** Applique localement un état venu du PC, sans le renvoyer au PC. */
export async function setFavoriteLocal(name: string, fav: boolean) {
  const library: any[] = await localforage.getItem(KEY) || [];
  const e = library.find((x) => x.name === name);
  if (e && e.favorite !== fav) { e.favorite = fav; await localforage.setItem(KEY, library); }
}
export async function renameSong(oldName: string, newName: string) {
  try {
    const library: any[] = await localforage.getItem(KEY) || [];
    const e = library.find((x) => x.name === oldName);
    if (e) {
      e.name = newName;
      await localforage.setItem(KEY, library);
      libraryHooks.onRename?.(oldName, newName);
    }
    // Transfert des statistiques (scores) pour ne pas les perdre
    const statsKey = "pianoflow-stats";
    const stats: any = JSON.parse(localStorage.getItem(statsKey) || "{}");
    if (stats[oldName]) {
      stats[newName] = stats[oldName];
      delete stats[oldName];
      localStorage.setItem(statsKey, JSON.stringify(stats));
    }
  } catch (err) { console.error(err); }
}