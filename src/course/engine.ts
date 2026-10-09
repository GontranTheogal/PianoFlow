/** Moteur du parcours : progression, déblocage linéaire, étoiles, série quotidienne, déroulé d'une leçon (file de questions façon Duolingo),
 *  validation des réponses et notation du rythme. Pur : aucun accès au DOM (la progression utilise localStorage si présent). */
import type { Q } from "./types";

// ───────────── progression (uniquement des nombres et des listes : fusionnable entre appareils par « le meilleur des deux ») ─────────────
export interface Progress {
  v: 1; done: Record<string, { stars: number; best: number; runs: number; /** date de la dernière réussite (ms) */ at?: number }>; xp: number; days: string[];
  /** remise à zéro du parcours (ms) : les leçons réussies avant ne comptent plus, sur tous les appareils */ resetAt?: number;
}
export const PROGRESS_KEY = "pianoflow-course";
/** Remise à zéro générale du parcours (nouvelle version du parcours) : tout ce qui a été réussi avant est effacé. */
export const COURSE_RESET_BASE = 1791100000000;
export const emptyProgress = (): Progress => ({ v: 1, done: {}, xp: 0, days: [] });
/** Retire les leçons réussies avant la dernière remise à zéro (et l'XP qui va avec). */
export function applyReset<T extends Partial<Progress>>(p: T, reset = Math.max(p?.resetAt ?? 0, COURSE_RESET_BASE)): T {
  if (!p) return p;
  const stale = Object.values(p.done ?? {}).some((d) => (d.at ?? 0) < reset) || (p.resetAt ?? 0) < reset;
  if (!stale) return p;
  const done = Object.fromEntries(Object.entries(p.done ?? {}).filter(([, d]) => (d.at ?? 0) >= reset));
  const xp = Object.values(done).reduce((s, d) => s + 10 + 5 * d.stars, 0);
  return { ...p, done, xp: (p.resetAt ?? 0) >= reset ? p.xp ?? 0 : xp, resetAt: reset };
}
export function loadProgress(): Progress {
  try { const p = applyReset(JSON.parse(localStorage.getItem(PROGRESS_KEY) || "")); return { ...emptyProgress(), ...p, done: p.done ?? {}, days: p.days ?? [] }; } catch { return emptyProgress(); }
}
/** Recommencer le parcours depuis le début (les jours de pratique et la série sont gardés). */
export function resetCourse(now = Date.now()) { const p = loadProgress(); saveProgress({ ...emptyProgress(), days: p.days, resetAt: now }); }
export function saveProgress(p: Progress) { try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch { /* ignore */ } }

export const starsFor = (accuracy: number) => (accuracy >= 90 ? 3 : accuracy >= 70 ? 2 : 1);
export const dayKey = (d: Date = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Enregistre une leçon terminée : on garde toujours le meilleur résultat ; les XP ne sont gagnés en entier qu'une fois, puis un peu à chaque révision. */
export function completeLesson(p: Progress, id: string, accuracy: number, today = dayKey()): { progress: Progress; xp: number; stars: number; first: boolean; improved: boolean } {
  const prev = p.done[id], st = starsFor(accuracy), first = !prev;
  const xp = first ? 10 + 5 * st : 5;
  const done = { ...p.done, [id]: { stars: Math.max(prev?.stars ?? 0, st), best: Math.max(prev?.best ?? 0, Math.round(accuracy)), runs: (prev?.runs ?? 0) + 1, at: Math.max(Date.now(), COURSE_RESET_BASE) } };
  const days = p.days.includes(today) ? p.days : [...p.days, today].sort().slice(-400);
  return { progress: { ...p, done, xp: p.xp + xp, days }, xp, stars: st, first, improved: !!prev && st > prev.stars };
}
/** Test « Je connais déjà » réussi : les leçons pas encore faites sont validées (1 étoile, refaisables pour en gagner plus). */
export function validateLessons(p: Progress, ids: string[], accuracy: number, today = dayKey()): { progress: Progress; added: number } {
  const done = { ...p.done }, at = Math.max(Date.now(), COURSE_RESET_BASE); let added = 0;
  for (const id of ids) if (!done[id]) { done[id] = { stars: 1, best: Math.round(accuracy), runs: 0, at }; added++; }
  const days = p.days.includes(today) ? p.days : [...p.days, today].sort().slice(-400);
  return { progress: { ...p, done, xp: p.xp + 5 * added, days }, added };
}
/** Jours consécutifs jusqu'à aujourd'hui (ou hier : la série n'est pas perdue tant que la journée n'est pas finie). */
export function streak(days: string[], today = dayKey()): number {
  const set = new Set(days), step = (k: string, n: number) => { const [y, m, d] = k.split("-").map(Number); return dayKey(new Date(y, m - 1, d + n)); };
  let cur = set.has(today) ? today : step(today, -1), n = 0;
  while (set.has(cur)) { n++; cur = step(cur, -1); }
  return n;
}

// ───────────── déblocage linéaire ─────────────
export const isDone = (p: Progress, id: string) => !!p.done[id];
/** Une leçon est ouverte si la précédente (dans tout le parcours) est terminée — ou si l'on a choisi de tout débloquer. */
export function isUnlocked(p: Progress, ids: string[], i: number, unlockAll = false): boolean {
  return unlockAll || i === 0 || isDone(p, ids[i - 1]) || isDone(p, ids[i]);
}
/** Prochaine leçon à faire : la première non terminée APRÈS la plus avancée déjà faite (une leçon ajoutée plus tôt
 *  dans le parcours par une mise à jour ne fait pas reculer l'élève) ; sinon la première non terminée. */
export function currentIndex(p: Progress, ids: string[]): number {
  let last = -1;
  ids.forEach((id, i) => { if (isDone(p, id)) last = i; });
  const after = ids.findIndex((id, i) => i > last && !isDone(p, id));
  if (after >= 0) return after;
  const i = ids.findIndex((id) => !isDone(p, id));
  return i < 0 ? ids.length : i;
}

// ───────────── déroulé d'une leçon ─────────────
const GRADED = new Set(["press", "seq", "chord", "choice", "rhythm", "piece", "touch", "pedal", "improv"]);
/** Improvisation : assez de notes, presque toutes dans la gamme proposée. */
export function judgeImprov(played: number[], scale: number[], bars: number): { ok: boolean; detail: string; inScale: number } {
  const n = played.length, inS = played.filter((m) => scale.includes(((m % 12) + 12) % 12)).length, ratio = n ? inS / n : 0;
  const need = bars * 2;
  if (n < need) return { ok: false, inScale: ratio, detail: `${n} notes seulement : ose jouer davantage (au moins ${need}, deux par mesure). Il n'y a pas de fausse note dans la gamme !` };
  if (ratio < 0.85) return { ok: false, inScale: ratio, detail: `${Math.round(ratio * 100)} % de tes notes sont dans la gamme : reste sur les touches allumées.` };
  return { ok: true, inScale: ratio, detail: `${n} notes, ${Math.round(ratio * 100)} % dans la gamme : c'est de la musique !` };
}
export const isGraded = (q: Q) => GRADED.has(q.k);

/** File de questions : une réponse fausse remet la question en fin de file (une seule fois) ; seule la 1re tentative compte pour le score. */
export class LessonSession {
  private queue: { q: Q; retry: boolean }[];
  readonly total: number;
  firstTryOk = 0;
  graded = 0;
  answered = 0;
  /** Résultat du premier essai de chaque question notée (les questions passées n'y sont pas). */
  readonly firstTry = new Map<Q, boolean>();
  constructor(qs: Q[]) {
    this.queue = qs.map((q) => ({ q, retry: false }));
    this.total = qs.length;
    this.graded = qs.filter(isGraded).length;
  }
  get current(): Q | null { return this.queue[0]?.q ?? null; }
  get isRetry(): boolean { return !!this.queue[0]?.retry; }
  get done(): boolean { return this.queue.length === 0; }
  /** Part de la leçon accomplie, pour la barre de progression. */
  get progress(): number { return this.done ? 1 : Math.min(0.999, this.answered / (this.answered + this.queue.length)); }
  get accuracy(): number { return this.graded ? Math.round((this.firstTryOk / this.graded) * 100) : 100; }
  /** Question passée sans pouvoir y répondre (ex. : il faut un clavier MIDI) : elle ne compte pas. */
  skip(): Q | null {
    const cur = this.queue.shift(); if (!cur) return null;
    if (isGraded(cur.q) && !cur.retry) this.graded--;
    this.answered++;
    return this.current;
  }
  /** `correct` = la question est réussie ; renvoie la question suivante (ou null à la fin). */
  answer(correct: boolean): Q | null {
    const cur = this.queue.shift(); if (!cur) return null;
    if (isGraded(cur.q) && !cur.retry) { this.firstTry.set(cur.q, correct); if (correct) this.firstTryOk++; }
    if (!correct && !cur.retry && isGraded(cur.q)) this.queue.push({ q: cur.q, retry: true });
    else this.answered++;
    return this.current;
  }
}

// ───────────── validation ─────────────
export const pressOk = (t: { midi: number } | { pcs: number[] }, midi: number): boolean => ("midi" in t ? t.midi === midi : t.pcs.includes(((midi % 12) + 12) % 12));
/** Accord : touches enfoncées « ensemble » = dans une fenêtre de temps ; réussi quand toutes les classes de hauteur sont là, sans intruse. */
export class ChordCollector {
  private t0 = 0; private keys: number[] = [];
  private uniq: number[];
  /** `pcs` : classes de hauteur attendues, avec doublons possibles (une octave = [Do, Do] : deux touches différentes de même nom). */
  constructor(private pcs: number[], private bass?: number, private windowMs = 1500) { this.uniq = [...new Set(pcs)]; }
  reset() { this.keys = []; this.t0 = 0; }
  /** Renvoie « ok », « bad » (note étrangère ou mauvaise basse) ou « wait » (accord incomplet). */
  add(midi: number, now: number): "ok" | "bad" | "wait" {
    if (!this.keys.length || now - this.t0 > this.windowMs) { this.keys = []; this.t0 = now; }
    if (!this.keys.includes(midi)) this.keys.push(midi);
    const pcs = this.keys.map((k) => ((k % 12) + 12) % 12);
    if (pcs.some((p) => !this.uniq.includes(p))) return "bad";
    const have = new Set(pcs);
    if (have.size < this.uniq.length || this.keys.length < this.pcs.length) return "wait";
    if (this.bass !== undefined && ((Math.min(...this.keys) % 12) + 12) % 12 !== this.bass) return "bad";
    return "ok";
  }
  get pressed() { return [...this.keys]; }
  get timedOut() { return false; }
}

// ───────────── rythme ─────────────
export interface RhythmResult { hits: number; total: number; extra: number; pass: boolean; perNote: ("ok" | "late" | "early" | "miss")[]; }
/** `taps` : instants des frappes (ms) ; `t0` : instant du 1er temps (ms). Durées en croches : 2 = noire ; négatif = silence. */
export function scoreRhythm(pattern: number[], bpm: number, taps: number[], t0: number, ties: number[] = []): RhythmResult {
  const eighth = 30000 / bpm, tol = 0.3 * 2 * eighth;               // ± 0,3 temps
  const expected: number[] = []; let t = 0;
  const tied = new Set(ties.map((i) => i + 1));                        // une note liée à la précédente ne se rejoue pas
  pattern.forEach((d, i) => { if (d > 0 && !tied.has(i)) expected.push(t0 + t * eighth); t += Math.abs(d); });
  const used = new Set<number>(), perNote: RhythmResult["perNote"] = [];
  for (const e of expected) {
    let best = -1, bd = Infinity;
    taps.forEach((x, i) => { if (!used.has(i) && Math.abs(x - e) < bd) { bd = Math.abs(x - e); best = i; } });
    if (best >= 0 && bd <= tol) { used.add(best); perNote.push("ok"); }
    else if (best >= 0 && bd <= tol * 2) { used.add(best); perNote.push(taps[best] > e ? "late" : "early"); }
    else perNote.push("miss");
  }
  const hits = perNote.filter((x) => x === "ok").length, extra = taps.length - used.size;
  return { hits, total: expected.length, extra, pass: hits / Math.max(1, expected.length) >= 0.75 && extra <= Math.max(1, Math.floor(expected.length * 0.25)), perNote };
}
export const patternBeats = (pattern: number[]) => pattern.reduce((s, d) => s + Math.abs(d), 0) / 2;

// ───────────── toucher : nuances et articulation (vélocité et durées MIDI) ─────────────
export interface KeyEvent { m: number; on: number; off?: number; vel: number; }
export interface TouchResult { ok: boolean; detail: string; }
export function judgeTouch(want: "p" | "f" | "cresc" | "dim" | "legato" | "staccato", ev: KeyEvent[]): TouchResult {
  const v = ev.map((e) => e.vel), mean = Math.round(v.reduce((a, b) => a + b, 0) / Math.max(1, v.length));
  const vs = `force ${v.join(" · ")} (sur 127)`;
  if (want === "p") return { ok: mean <= 64 && Math.max(...v) <= 80, detail: `Force moyenne ${mean}/127 : ${mean <= 64 ? "bien doux" : "encore trop fort, enfonce la touche plus lentement"}. ${vs}` };
  if (want === "f") return { ok: mean >= 60 && Math.min(...v) >= 45, detail: `Force moyenne ${mean}/127 : ${mean < 60 ? "pas assez fort, laisse tomber le poids du bras" : Math.min(...v) < 45 ? "une note est restée trop faible, garde le doigt ferme" : "bien sonore"}. ${vs}` };
  if (want === "cresc" || want === "dim") {
    const dir = want === "cresc" ? 1 : -1;
    const span = (v[v.length - 1] - v[0]) * dir;
    let back = 0; for (let i = 1; i < v.length; i++) if ((v[i] - v[i - 1]) * dir < -6) back++;
    return { ok: span >= 25 && back <= 1, detail: `${want === "cresc" ? "Crescendo" : "Decrescendo"} : de ${v[0]} à ${v[v.length - 1]}${back > 1 ? `, avec ${back} retours en arrière` : ""}. ${span >= 25 ? "" : "Exagère la différence entre la première et la dernière note."}` };
  }
  const gaps: number[] = [];
  for (let i = 1; i < ev.length; i++) gaps.push(ev[i].on - (ev[i - 1].off ?? ev[i].on));
  if (want === "legato") {
    const holes = gaps.filter((g) => g > 40).length;
    return { ok: holes === 0, detail: holes ? `${holes} trou${holes > 1 ? "s" : ""} entre les notes : ne relâche une touche qu'au moment où la suivante s'enfonce.` : "Bien lié : chaque note rejoint la suivante." };
  }
  const longOnes = ev.filter((e, i) => { const d = (e.off ?? e.on) - e.on, next = ev[i + 1]?.on ?? e.on + 600; return d > 260 || d > 0.6 * (next - e.on); }).length;
  return { ok: longOnes === 0, detail: longOnes ? `${longOnes} note${longOnes > 1 ? "s" : ""} trop tenue${longOnes > 1 ? "s" : ""} : rebondis sur la touche, comme si elle était brûlante.` : "Bien détaché : chaque note est courte et séparée." };
}

/** Pédale « syncopée » : pour chaque accord, la pédale est relevée puis enfoncée juste APRÈS l'attaque de l'accord. */
export function judgePedal(chordOnsets: number[], pedal: { t: number; down: boolean }[]): TouchResult {
  for (let i = 0; i < chordOnsets.length; i++) {
    const t = chordOnsets[i], next = chordOnsets[i + 1] ?? Infinity;
    const down = pedal.find((p) => p.down && p.t > t + 20 && p.t < Math.min(next, t + 1600));
    if (!down) return { ok: false, detail: i === 0 ? "Enfonce la pédale juste après avoir joué le premier accord." : `Accord ${i + 1} : relève la pédale et renfonce-la juste après l'avoir joué (pas avant, sinon les deux accords se mélangent).` };
    if (i > 0 && !pedal.some((p) => !p.down && p.t > t - 150 && p.t < down.t)) return { ok: false, detail: `Accord ${i + 1} : la pédale n'a pas été relevée, les accords se mélangent.` };
    const earlyUp = pedal.find((p) => !p.down && p.t > down.t && p.t < next - 150);
    if (earlyUp && i < chordOnsets.length - 1) return { ok: false, detail: `Accord ${i + 1} : la pédale a été relâchée trop tôt, le son s'est coupé.` };
  }
  return { ok: true, detail: "Pédale bien changée : le son reste lié sans se mélanger." };
}
