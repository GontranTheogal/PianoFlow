/** Sauvegarde exportable : toute la progression (clés « pianoflow-… ») et la bibliothèque de partitions, dans un fichier.
 *  À l'import, chaque clé est FUSIONNÉE avec l'existant (mêmes règles que la synchro) : on ne perd jamais rien. */
import { listLibrary, addToLibrary } from "./library";
import { mergeKey } from "./syncMerge";

const toB64 = (buf: ArrayBuffer) => { let s = ""; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = (s: string) => { const bin = atob(s), out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out.buffer; };

/** propres à l'appareil : pas dans la sauvegarde */
const SKIP = new Set(["pianoflow-pc-url", "pianoflow-pc-pending"]);
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
  for (const [k, v] of Object.entries(b.state ?? {})) {
    if (!k.startsWith("pianoflow-") || SKIP.has(k)) continue;
    let cur: unknown; try { cur = JSON.parse(localStorage.getItem(k) ?? "null") ?? undefined; } catch { cur = undefined; }
    const merged = typeof v === "object" && v !== null ? mergeKey(k, cur, v) : v;
    localStorage.setItem(k, typeof merged === "string" ? merged : JSON.stringify(merged)); keys++;
  }
  const have = new Set((await listLibrary()).map((e) => e.name));
  let pieces = 0;
  for (const e of b.library ?? []) if (!have.has(e.name)) { await addToLibrary(e.name, fromB64(e.data), e.difficulty ?? 3, { addedAt: e.addedAt, favorite: e.favorite }); pieces++; }
  return { keys, pieces };
}
