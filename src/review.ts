/** Révision espacée et bilan de la semaine.
 *  - Ce qu'on rate revient : une mesure ratée en rythme, un exercice réussi à moins de 80 % sont mis « en boîte » ;
 *    ils reviennent dans la séance du jour le lendemain, puis à 3, 7 et 14 jours tant qu'ils sont réussis (≥ 90 %),
 *    et repartent au début s'ils sont ratés (système de Leitner).
 *  - La semaine : tendances du jeu en rythme (avance, retard, manquées) cumulées par semaine, pour le bilan.
 *  Tout est en nombres (jours, compteurs) : fusionnable entre appareils par « le meilleur des deux ». */

export interface ReviewItem { label: string; action: string; /** boîte 0-3 */ box: number; /** jour (n° depuis 1970) où il revient */ due: number; /** fois ratées */ miss: number; /** jour de sortie (réussi 4 fois) : 0 = en cours */ out?: number }
const KEY = "pianoflow-review", WEEK_KEY = "pianoflow-week";
const GAPS = [1, 3, 7, 14];
export const dayNum = (d = new Date()) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);

function load(): Record<string, ReviewItem> { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } }
function save(all: Record<string, ReviewItem>) { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* ignore */ } }

/** Raté : (re)met l'élément en boîte 0, à revoir demain. */
export function reviewFail(key: string, label: string, action: string, today = dayNum()) {
  const all = load(), it = all[key];
  all[key] = { label, action, box: 0, due: today + GAPS[0], miss: (it?.miss ?? 0) + 1, out: 0 };
  save(all);
}
/** Réussi : boîte suivante (ou sorti après la dernière). Sans effet si l'élément n'est pas en révision. */
export function reviewPass(key: string, today = dayNum()) {
  const all = load(), it = all[key]; if (!it || it.out) return;
  if (it.due > today) return;   // pas encore à revoir : une réussite « en avance » ne compte pas
  const box = it.box + 1;
  all[key] = box >= GAPS.length ? { ...it, box, out: today } : { ...it, box, due: today + GAPS[box] };
  save(all);
}
/** Les éléments à revoir aujourd'hui (les plus ratés d'abord). */
export function dueReviews(today = dayNum()): (ReviewItem & { key: string })[] {
  return Object.entries(load()).filter(([, it]) => !it.out && it.due <= today).map(([key, it]) => ({ key, ...it })).sort((a, b) => b.miss - a.miss || a.due - b.due);
}
export const reviewCount = () => Object.values(load()).filter((it) => !it.out).length;
export const measureKey = (song: string, m: number) => `m|${song}|${m}`;

// ── semaine ──
export interface WeekRec { early: number; late: number; miss: number; good: number; wrong: number; runs: number }
const weekOf = (d = new Date()) => { const day = dayNum(d), dow = (new Date(d).getDay() + 6) % 7; return day - dow; };   // lundi
function loadWeeks(): Record<string, WeekRec> { try { return JSON.parse(localStorage.getItem(WEEK_KEY) || "{}"); } catch { return {}; } }
export function recordRhythmRun(s: { early: number; late: number; miss: number; perfect: number; good: number; wrong: number }) {
  const all = loadWeeks(), k = String(weekOf()), w = all[k] ?? { early: 0, late: 0, miss: 0, good: 0, wrong: 0, runs: 0 };
  all[k] = { early: w.early + s.early, late: w.late + s.late, miss: w.miss + s.miss, good: w.good + s.perfect + s.good, wrong: w.wrong + s.wrong, runs: w.runs + 1 };
  try { localStorage.setItem(WEEK_KEY, JSON.stringify(all)); } catch { /* ignore */ }
}
export function weekRhythm(offset = 0): WeekRec | null { return loadWeeks()[String(weekOf() - 7 * offset)] ?? null; }
export const mondayNum = weekOf;
