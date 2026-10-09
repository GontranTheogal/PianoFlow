/** Révision express : se rappeler ce qu'on a appris, à intervalles croissants (1, 3, 7, 14, 30, 60 jours).
 *  C'est ce qui fixe le mieux une connaissance (effet de test, révision espacée), bien plus que de la relire.
 *  - Chaque leçon faite entre dans une « boîte » ; elle revient le lendemain du jour où elle a été apprise.
 *  - La révision du jour pose deux questions de chacune des leçons dues (les plus en retard d'abord), mélangées entre elles.
 *  - Leçon sans faute : elle revient plus tard (boîte suivante) ; une erreur : elle revient demain.
 *  Stocké par leçon avec sa date : entre appareils, la mise à jour la plus récente gagne. */
import { LESSONS, type FlatLesson } from "./course/curriculum";
import type { Progress } from "./course/engine";
import type { Q } from "./course/types";
import { mulberry32 } from "./course/build";
import { dayNum } from "./review";
import { readJson, writeJson } from "./storage";

export const RECALL_KEY = "pianoflow-recall";
const GAPS = [1, 3, 7, 14, 30, 60];
/** Questions par leçon, et leçons par révision : 8 questions, environ 4 minutes. */
const PER_LESSON = 2, MAX_LESSONS = 4;
export interface RecallRec { /** boîte 0-5 */ box: number; /** jour (n° depuis 1970) où elle revient */ due: number; /** dernière mise à jour (ms) */ t: number; }

function load(): Record<string, RecallRec> { return readJson<Record<string, RecallRec>>(RECALL_KEY, {}); }
function save(all: Record<string, RecallRec>) { writeJson(RECALL_KEY, all); }

/** Ce qui se révise en une question : ni les explications, ni les morceaux entiers, ni l'improvisation. */
const gradable = (q: Q) => q.k !== "info" && q.k !== "piece" && q.k !== "improv";
const hasQ = new Map<string, boolean>();
const askable = (l: FlatLesson) => { let v = hasQ.get(l.id); if (v === undefined) { v = l.build(mulberry32(1)).some(gradable); hasQ.set(l.id, v); } return v; };

/** Les leçons à revoir ce jour-là, la plus en retard d'abord (à retard égal : la moins bien réussie, puis la plus ancienne du parcours).
 *  Jamais une leçon apprise le jour même : elle revient le lendemain. */
export function dueLessons(p: Progress, today = dayNum(), max = MAX_LESSONS): FlatLesson[] {
  const all = load();
  return LESSONS.filter((l) => p.done[l.id]).map((l) => {
    const d = p.done[l.id], learned = d.at ? dayNum(new Date(d.at)) : today - 1;
    return { l, due: all[l.id]?.due ?? learned + GAPS[0], stars: d.stars };
  }).filter((x) => x.due <= today && askable(x.l))
    .sort((a, b) => a.due - b.due || a.stars - b.stars || a.l.index - b.l.index).slice(0, max).map((x) => x.l);
}

/** D'où vient chaque question (pour savoir quelle leçon a été réussie ou ratée). */
export const origin = new WeakMap<Q, string>();
/** Deux questions par leçon, mélangées entre les leçons (alterner les sujets aide à les distinguer). */
export function recallQuestions(lessons: FlatLesson[], rng = mulberry32((Date.now() ^ (Math.random() * 1e9)) >>> 0)): Q[] {
  const out: Q[] = [];
  for (const l of lessons) {
    const qs = l.build(rng).filter(gradable);
    for (let i = qs.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [qs[i], qs[j]] = [qs[j], qs[i]]; }
    for (const q of qs.slice(0, PER_LESSON)) { origin.set(q, l.id); out.push(q); }
  }
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

/** Résultat de la révision, leçon par leçon (true = sans faute). */
export function recordRecall(results: Record<string, boolean>, today = dayNum(), now = Date.now()) {
  const all = load();
  for (const [id, ok] of Object.entries(results)) {
    const box = ok ? Math.min(GAPS.length - 1, (all[id]?.box ?? 0) + 1) : 0;   // jamais revue = boîte 0
    all[id] = { box, due: today + GAPS[box], t: now };
  }
  save(all);
}
