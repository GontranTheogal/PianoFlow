/** Accès à localStorage sans exception : stockage indisponible (navigation privée), plein, ou contenu illisible
 *  → valeur par défaut à la lecture, écriture ignorée. `localStorage` est lu à chaque appel (les tests le remplacent). */

/** Valeur JSON d'une clé ; `fallback` si elle est absente ou illisible. */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch { return fallback; }
}
export function writeJson(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}
/** Texte brut d'une clé ; `fallback` si elle est absente. */
export function readStr(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
export function writeStr(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}
export function removeKey(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}
