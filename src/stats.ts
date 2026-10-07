/** Records par morceau de la bibliothèque (synchronisés : uniquement des nombres, fusionnés par « le meilleur des deux »). */
export interface SongStats { plays: number; bestAccuracy: number; /** meilleur score « en rythme », mains ensemble, à 100 % */ bestRhythm?: number; lastPlayed: number; }

const KEY = "pianoflow-stats";
function readAll(): Record<string, SongStats> { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } }

export function getStats(song: string): SongStats | null { return readAll()[song] ?? null; }
export function getAll(): Record<string, SongStats> { return readAll(); }

export function recordPlay(song: string, score: number, rhythm = false) {
  const all = readAll();
  const prev = all[song];
  all[song] = {
    plays: (prev?.plays ?? 0) + 1, bestAccuracy: Math.max(prev?.bestAccuracy ?? 0, rhythm ? 0 : score),
    bestRhythm: Math.max(prev?.bestRhythm ?? 0, rhythm ? score : 0), lastPlayed: Date.now(),
  };
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* ignore */ }
  return all[song];
}
