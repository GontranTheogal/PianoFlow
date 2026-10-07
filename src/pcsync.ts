import { gzipSync, gunzipSync } from "fflate";
import { mergeKey } from "./syncMerge";
import { listLibrary, addToLibrary, removeFromLibrary, setFavoriteLocal, libraryHooks } from "./library";
import { canonCode } from "./syncCode";

/** Synchronisation de la bibliothèque + de la progression, de deux façons (même API) :
 *  - **Netlify (recommandé)** : l'appli et la fonction /api/* sont servies par le même site. Un « code de synchro » identique
 *    sur chaque appareil (PC, iPad…) relie leurs bibliothèques ; aucun PC allumé, aucun Wi-Fi commun.
 *  - **PC local** (server/pianoflow-server.mjs) : même origine si l'appli est servie par le PC, sinon son adresse est saisie une fois. */
const URL_KEY = "pianoflow-pc-url", PENDING_KEY = "pianoflow-pc-pending", CODE_KEY = "pianoflow-sync-code";
const STATE_KEYS = ["pianoflow-stats", "pianoflow-practice", "pianoflow-achievements", "pianoflow-solfege", "pianoflow-course", "pianoflow-hand", "pianoflow-coach", "pianoflow-fingerings", "pianoflow-daily", "pianoflow-drills", "pianoflow-review", "pianoflow-week", "pianoflow-skills", "pianoflow-recall"];
const MAX_UPLOAD = 5 * 1024 * 1024;

export type PcState = { connected: boolean; text: string };
let base: string | null = null;
/** Adresse du site Netlify qui héberge la synchro, quand l'appli est servie ailleurs (variable VITE_SYNC_URL à la construction). */
const SYNC_URL: string = (import.meta as any).env?.VITE_SYNC_URL ?? "";
let onChange: (s: PcState) => void = () => {};
let onSynced: () => void = () => {};
let busy = false;
let timer: number | undefined;

export function setHandlers(h: { onState?: (s: PcState) => void; onSynced?: () => void }) {
  if (h.onState) onChange = h.onState;
  if (h.onSynced) onSynced = h.onSynced;
}
export const getSavedUrl = () => localStorage.getItem(URL_KEY) || "";
export function saveUrl(u: string) {
  const v = u.trim().replace(/\/+$/, "");
  if (v) localStorage.setItem(URL_KEY, /^https?:\/\//i.test(v) ? v : "http://" + v);
  else localStorage.removeItem(URL_KEY);
}
export const servedByPc = () => base === "";
export const isCloud = () => cloud;
let cloud = false;
export const getSyncCode = () => { try { return (localStorage.getItem(CODE_KEY) || "").trim(); } catch { return ""; } };
export function saveSyncCode(c: string) { try { const v = c.trim(); if (v) localStorage.setItem(CODE_KEY, v); else localStorage.removeItem(CODE_KEY); } catch { /* ignore */ } }
/** Code aléatoire de 20 caractères (≈ 100 bits), groupé par 5 pour être recopié sans erreur. */
export function generateSyncCode(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789", r = new Uint8Array(20);
  crypto.getRandomValues(r);
  return Array.from(r, (b) => alphabet[b % alphabet.length]).join("").replace(/(.{5})(?=.)/g, "$1-");
}
/** Le code part normalisé (un « – » ou un « é » dans un en-tête HTTP fait échouer la requête), et tel que saisi pour les anciens codes. */
const api = (path: string, init: RequestInit = {}) => {
  const code = getSyncCode();
  return fetch(base + path, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), ...(code ? { "x-sync-code": canonCode(code), "x-sync-code-raw": encodeURIComponent(code) } : {}) } });
};
/** Le nom sous lequel le serveur range un fichier (mêmes règles que lui) : un « : » ou un « ? » dans le titre ne doit pas
 *  faire croire à deux morceaux différents (doublon à chaque synchro). */
export const syncName = (n: string) => n.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f<>:"|?*]/g, "_").trim().slice(0, 200);
const isXml = (name: string) => /\.(xml|musicxml)$/i.test(name);
const maybeGunzip = (buf: ArrayBuffer): ArrayBuffer => {
  const u = new Uint8Array(buf);
  if (u[0] === 0x1f && u[1] === 0x8b) { const o = gunzipSync(u); return o.buffer.slice(o.byteOffset, o.byteOffset + o.byteLength) as ArrayBuffer; }
  return buf;
};

async function ping(b: string): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2500);
    const r = await fetch(b + "/api/ping", { signal: ctl.signal, cache: "no-store" });
    clearTimeout(t);
    if (!r.ok) return false;
    const j = await r.json();
    if (j.app !== "pianoflow") return false;
    cloud = !!j.cloud;
    return true;
  } catch { return false; }
}
async function resolveBase(): Promise<string | null> {
  cloud = false;
  if (/^https?:$/.test(location.protocol) && (await ping(""))) return "";
  const saved = getSavedUrl();
  if (saved && (await ping(saved))) return saved;
  // appli publiée ailleurs que la synchro (GitHub Pages) : l'adresse du serveur de synchro est fixée à la construction
  const built = SYNC_URL.replace(/\/+$/, "");
  if (built && built !== saved && (await ping(built))) return built;
  return null;
}

// ---- suppressions / renommages faits hors connexion : envoyés à la prochaine synchro
type Pending = { del: string[]; ren: { from: string; to: string }[] };
const readPending = (): Pending => {
  try { return { del: [], ren: [], ...JSON.parse(localStorage.getItem(PENDING_KEY) || "{}") }; } catch { return { del: [], ren: [] }; }
};
const writePending = (p: Pending) => localStorage.setItem(PENDING_KEY, JSON.stringify(p));

const enc = encodeURIComponent;
/** « big » : refusé car trop gros ; « error » : à retenter. Le MusicXML brut est compressé avant l'envoi (limite de 6 Mo des fonctions). */
async function pushFile(name: string, data: ArrayBuffer, meta: { addedAt: number; favorite: boolean; difficulty: number }): Promise<"ok" | "big" | "error"> {
  const body: ArrayBuffer | Uint8Array = cloud && isXml(name) ? gzipSync(new Uint8Array(data), { level: 6 }) : data;
  if (cloud && body.byteLength > MAX_UPLOAD) return "big";
  try {
    const r = await api(`/api/library/file?name=${enc(name)}`, {
      method: "PUT", body: body as BodyInit,
      headers: { "x-added-at": String(meta.addedAt), "x-favorite": meta.favorite ? "1" : "0", "x-difficulty": String(meta.difficulty) },
    });
    if (!r.ok) console.warn("pcsync: envoi refusé", name, r.status);
    return r.ok ? "ok" : r.status === 413 ? "big" : "error";
  } catch (err) { console.warn("pcsync: envoi impossible", name, err); return "error"; }
}

async function syncState(): Promise<boolean> {
  let changedLocal = false;
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await api(`/api/state`, { cache: "no-store" });
    const j = await r.json();
    const remote: Record<string, string> = j.data ?? {}, etag: string | null = j.etag ?? null;
    const merged: Record<string, string> = { ...remote };
    let changedRemote = false;
    for (const k of STATE_KEYS) {
      const l = localStorage.getItem(k), rv = remote[k];
      if (l == null && rv == null) continue;
      let m: any;
      try { m = mergeKey(k, l ? JSON.parse(l) : undefined, rv ? JSON.parse(rv) : undefined); } catch { continue; }
      const str = JSON.stringify(m);
      merged[k] = str;
      if (str !== l) { localStorage.setItem(k, str); changedLocal = true; }
      if (str !== rv) changedRemote = true;
    }
    if (!changedRemote) break;
    const put = await api(`/api/state`, { method: "PUT", body: JSON.stringify({ data: merged, etag }) });
    if (put.status !== 409) break;          // 409 : un autre appareil a écrit entre-temps → on relit, on fusionne, on réessaie
  }
  return changedLocal;
}

export async function syncNow(): Promise<PcState> {
  if (busy) return { connected: base !== null, text: "Synchronisation en cours…" };
  busy = true;
  try {
    base = await resolveBase();
    if (base === null) {
      const configured = !!getSavedUrl() || location.protocol === "http:";
      const s = { connected: false, text: configured ? "PC injoignable" : "Autonome · bibliothèque sur cet appareil seulement" };
      onChange(s);
      return s;
    }
    if (cloud && getSyncCode().length < 8) {
      const s = { connected: false, text: "Entre un code de synchro pour relier tes appareils" };
      onChange(s);
      return s;
    }
    onChange({ connected: true, text: "Synchronisation…" });

    // 1. d'abord ce qui a été supprimé / renommé hors connexion
    const pend = readPending();
    for (const f of pend.del) await api(`/api/library/file?name=${enc(f)}`, { method: "DELETE" }).catch(() => {});
    for (const r of pend.ren) await api(`/api/library/rename`, { method: "POST", body: JSON.stringify(r) }).catch(() => {});
    writePending({ del: [], ren: [] });

    // 2. bibliothèque : le PC garde la liste des suppressions (« tombes »), rien ne ressuscite
    const libRes = await api(`/api/library`, { cache: "no-store" });
    if (libRes.status === 401) { const s = { connected: false, text: "Code de synchro refusé (8 caractères minimum)" }; onChange(s); return s; }
    if (!libRes.ok) throw new Error(`bibliothèque : ${libRes.status}`);
    const remote = (await libRes.json()) as { entries: any[]; deleted: Record<string, number> };
    const local = await listLibrary();
    const localNames = new Set(local.map((e) => syncName(e.name)));
    const remoteNames = new Set(remote.entries.map((e) => e.name));
    let pulled = 0, pushed = 0, removed = 0, refused = 0, failed = 0;
    const todo = remote.entries.filter((e) => !localNames.has(e.name)).length;
    for (const e of remote.entries) {
      if (!localNames.has(e.name)) {
        onChange({ connected: true, text: `Synchronisation… ↓ ${pulled + 1}/${todo}` });
        const r = await api(`/api/library/file?name=${enc(e.name)}`, { cache: "no-store" });
        if (!r.ok) continue;
        await addToLibrary(e.name, maybeGunzip(await r.arrayBuffer()), e.difficulty ?? 3, { addedAt: e.addedAt, favorite: !!e.favorite, fromSync: true });
        pulled++;
      } else {
        const l = local.find((x) => syncName(x.name) === e.name)!;
        if (!!e.favorite !== !!l.favorite) await setFavoriteLocal(l.name, !!e.favorite); // le PC fait foi pour les favoris
      }
    }
    for (const l of local) {
      const n = syncName(l.name);
      if (remote.deleted[n] && !remoteNames.has(n)) { await removeFromLibrary(l.name, true); removed++; continue; }
      if (!remoteNames.has(n)) { const r = await pushFile(l.name, l.fileData, l); if (r === "ok") pushed++; else if (r === "big") refused++; else failed++; }
    }

    // 3. progression (records, étoiles, succès)
    const stateChanged = await syncState();
    const total = (await listLibrary()).length;
    // la fin du code, pour vérifier d'un coup d'œil que deux appareils ont bien le même
    const where = cloud ? `Synchronisé (code …${canonCode(getSyncCode()).slice(-5)})` : "Connecté au PC";
    const s = { connected: !failed, text: `${where} · ${total} morceau${total > 1 ? "x" : ""}` + (pulled || pushed ? ` (↓${pulled} ↑${pushed})` : "")
      + (refused ? ` · ${refused} trop gros pour le cloud` : "") + (failed ? ` · ${failed} pas encore envoyé${failed > 1 ? "s" : ""}, nouvel essai dans une minute` : "") };
    onChange(s);
    if (pulled || removed || stateChanged) onSynced();
    return s;
  } catch (err) {
    console.warn("pcsync", err);
    const s = { connected: false, text: "Erreur de synchronisation" };
    onChange(s);
    return s;
  } finally { busy = false; }
}

/** À appeler une fois au démarrage : branche les crochets de la bibliothèque et lance la synchro périodique. */
export function startPcSync() {
  libraryHooks.onAdd = async (e) => { if (base === null || (cloud && getSyncCode().length < 8)) return; try { await pushFile(e.name, e.fileData, e); } catch { /* repris à la prochaine synchro */ } };
  libraryHooks.onFavorite = async (name, favorite) => {
    if (base === null) return;
    try { await api(`/api/library/meta`, { method: "PATCH", body: JSON.stringify({ name, favorite }) }); } catch { /* ignore */ }
  };
  libraryHooks.onRemove = async (name) => {
    try { if (base === null) throw 0; await api(`/api/library/file?name=${enc(name)}`, { method: "DELETE" }); }
    catch { const p = readPending(); p.del.push(name); writePending(p); }
  };
  libraryHooks.onRename = async (from, to) => {
    try { if (base === null) throw 0; await api(`/api/library/rename`, { method: "POST", body: JSON.stringify({ from, to }) }); }
    catch { const p = readPending(); p.ren.push({ from, to }); writePending(p); }
  };
  syncNow();
  clearInterval(timer);
  timer = window.setInterval(() => { if (!document.hidden) syncNow(); }, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) syncNow(); });
  window.addEventListener("online", () => syncNow());
}
