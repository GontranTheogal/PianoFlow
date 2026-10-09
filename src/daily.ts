/** Suivi quotidien : temps de pratique RÉEL (minutes où tu joues / réponds) et tâches de la séance du jour accomplies.
 *  Stocké par jour, uniquement des nombres et des listes : fusionnable entre appareils. */
import { dayKey } from "./course/engine";
import { readJson, writeJson } from "./storage";

export interface DayRec { s: number; done: string[]; }
const KEY = "pianoflow-daily";
function readAll(): Record<string, DayRec> { return readJson<Record<string, DayRec>>(KEY, {}); }
function writeAll(a: Record<string, DayRec>) {
  const keys = Object.keys(a).sort(); while (keys.length > 120) delete a[keys.shift()!];   // 4 mois d'historique
  writeJson(KEY, a);
}
export function day(d = dayKey()): DayRec { const r = readAll()[d]; return { s: r?.s ?? 0, done: r?.done ?? [] }; }
export function markDone(tag: string) {
  const a = readAll(), k = dayKey(), r = a[k] ?? { s: 0, done: [] };
  if (!r.done.includes(tag)) r.done.push(tag);
  a[k] = r; writeAll(a);
}
export const isDone = (tag: string) => day().done.includes(tag);
function addSeconds(n: number) { const a = readAll(), k = dayKey(), r = a[k] ?? { s: 0, done: [] }; r.s += n; a[k] = r; writeAll(a); }
/** Minutes jouées sur les n derniers jours (du plus ancien au plus récent). */
export function history(n = 14): { day: string; min: number }[] {
  const a = readAll(), out: { day: string; min: number }[] = [];
  for (let i = n - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = dayKey(d); out.push({ day: k, min: Math.round((a[k]?.s ?? 0) / 60) }); }
  return out;
}
/** Jours où l'on a vraiment pratiqué (au moins une minute, ou une tâche accomplie). */
export const practiceDays = (): string[] => Object.entries(readAll()).filter(([, r]) => (r.s ?? 0) >= 60 || (r.done?.length ?? 0) > 0).map(([d]) => d);
export const totalMinutes = () => Math.round(Object.values(readAll()).reduce((s, r) => s + (r.s ?? 0), 0) / 60);

let lastActivity = 0;
/** À appeler à chaque note jouée / réponse : le temps ne compte que si tu es réellement en train de pratiquer. */
export function activity() { lastActivity = Date.now(); }
let started = false;
export function startTracking(onTick?: () => void) {
  if (started) return; started = true;
  const TICK = 15000;
  setInterval(() => {
    if (typeof document !== "undefined" && document.hidden) return;
    if (Date.now() - lastActivity < 60000) { addSeconds(TICK / 1000); onTick?.(); }
  }, TICK);
  if (typeof window !== "undefined") { window.addEventListener("pointerdown", activity); window.addEventListener("keydown", activity); }
}
