/** Sauvegarde exportable : toute la progression (clés « pianoflow-… ») et la bibliothèque de partitions, dans un fichier.
 *  À l'import, chaque clé est FUSIONNÉE avec l'existant (meilleur des deux, ou le plus récent pour les réglages) : on ne perd jamais rien. */
import { listLibrary, addToLibrary } from "./library";
import { mergeKey } from "./progressMerge";

const toB64 = (buf: ArrayBuffer) => { let s = ""; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = (s: string) => { const bin = atob(s), out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out.buffer; };

/** Clés de l'ancienne synchro (adresse du PC, file d'attente, code secret) : ni exportées, ni importées, effacées au démarrage. */
export const LEGACY_KEYS = ["pianoflow-pc-url", "pianoflow-pc-pending", "pianoflow-sync-code"];
const SKIP = new Set(LEGACY_KEYS);
/** Nom de fichier sûr pour une partition importée : pas de chemin, pas de caractère de contrôle, longueur bornée. */
const safeName = (n: unknown) => typeof n === "string" ? n.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 200) : "";
export async function exportBackup(): Promise<Blob> {
  const state: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    if (k.startsWith("pianoflow-") && !SKIP.has(k)) try { state[k] = JSON.parse(localStorage.getItem(k)!); } catch { state[k] = localStorage.getItem(k); }
  }
  const library = (await listLibrary()).map((e) => ({ name: e.name, addedAt: e.addedAt, favorite: e.favorite, difficulty: e.difficulty, data: toB64(e.fileData) }));
  return new Blob([JSON.stringify({ app: "pianoflow", v: 1, at: new Date().toISOString(), state, library })], { type: "application/json" });
}

export async function importBackup(text: string): Promise<{ keys: number; pieces: number }> {
  const b = JSON.parse(text);
  if (b?.app !== "pianoflow") throw new Error("ce fichier n'est pas une sauvegarde PianoFlow");
  let keys = 0;
  const state = b.state && typeof b.state === "object" && !Array.isArray(b.state) ? b.state : {};
  for (const [k, v] of Object.entries(state)) {
    if (!k.startsWith("pianoflow-") || SKIP.has(k)) continue;
    let cur: unknown; try { cur = JSON.parse(localStorage.getItem(k) ?? "null") ?? undefined; } catch { cur = undefined; }
    const merged = typeof v === "object" && v !== null ? mergeKey(k, cur, v) : v;
    localStorage.setItem(k, typeof merged === "string" ? merged : JSON.stringify(merged)); keys++;
  }
  const have = new Set((await listLibrary()).map((e) => e.name));
  let pieces = 0;
  for (const e of Array.isArray(b.library) ? b.library : []) {
    const name = safeName(e?.name);
    if (!name || have.has(name) || typeof e.data !== "string") continue;
    const difficulty = Number.isInteger(e.difficulty) && e.difficulty >= 1 && e.difficulty <= 5 ? e.difficulty : 3;
    await addToLibrary(name, fromB64(e.data), difficulty, { addedAt: Number.isFinite(e.addedAt) ? e.addedAt : Date.now(), favorite: e.favorite === true });
    have.add(name); pieces++;
  }
  return { keys, pieces };
}
