import localforage from 'localforage';

export interface LibraryEntry { name: string; fileData: ArrayBuffer; addedAt: number; favorite: boolean; difficulty: number; /** ce qui rend le morceau difficile (calculé sur cet appareil) */ why?: string[]; }
const KEY = "pianoflow-library";

export async function listLibrary(): Promise<LibraryEntry[]> {
  try {
    const raw: any[] = await localforage.getItem(KEY) || [];
    return raw.map((e) => ({ difficulty: 1, ...e })).sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || b.addedAt - a.addedAt);
  } catch { return []; }
}

export async function addToLibrary(name: string, fileData: ArrayBuffer, difficulty: number, meta?: { addedAt?: number; favorite?: boolean; why?: string[] }) {
  try {
    const library: any[] = await localforage.getItem(KEY) || [];
    let entry = library.find((e) => e.name === name);
    if (!entry) {
      entry = { name, fileData, addedAt: meta?.addedAt ?? Date.now(), favorite: meta?.favorite ?? false, difficulty, why: meta?.why };
      library.push(entry);
      await localforage.setItem(KEY, library);
    } else if (entry.difficulty !== difficulty || String(entry.why) !== String(meta?.why)) {
      // le morceau rouvert est noté à nouveau (barème à jour, tempo et armure réels)
      entry.difficulty = difficulty; entry.why = meta?.why;
      await localforage.setItem(KEY, library);
    }
  } catch (err) { console.error(err); }
}

export async function toggleFavorite(name: string) {
  const library: any[] = await localforage.getItem(KEY) || [];
  const e = library.find((x) => x.name === name);
  if (e) { e.favorite = !e.favorite; await localforage.setItem(KEY, library); }
}

export async function removeFromLibrary(name: string) {
  const library: any[] = await localforage.getItem(KEY) || [];
  await localforage.setItem(KEY, library.filter((e) => e.name !== name));
}
export async function renameSong(oldName: string, newName: string) {
  try {
    const library: any[] = await localforage.getItem(KEY) || [];
    const e = library.find((x) => x.name === oldName);
    if (e) {
      e.name = newName;
      await localforage.setItem(KEY, library);
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