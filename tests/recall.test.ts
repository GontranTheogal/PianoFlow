// Révision express (révision espacée par leçon) et composition de la séance du jour.
import assert from "node:assert/strict";
const mem = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, String(v)), removeItem: (k: string) => void mem.delete(k) };
const { dueLessons, recallQuestions, recordRecall, origin } = await import("../src/recall");
const { buildPlan } = await import("../src/today");
const { LESSONS } = await import("../src/course/curriculum");
const { dayNum } = await import("../src/review");
const { mulberry32 } = await import("../src/course/build");
const { SONGS } = await import("../src/repertoire");

const AT = 1791200000000, D0 = dayNum(new Date(AT));          // jour où les leçons ont été faites
const upTo = (id: string) => { const done: Record<string, any> = {}; for (const l of LESSONS) { done[l.id] = { stars: 3, best: 100, runs: 1, at: AT }; if (l.id === id) break; } return { v: 1, xp: 0, done, days: [] } as any; };
const dateOf = (day: number) => new Date(day * 86400000 + 12 * 3600000).toISOString().slice(0, 10);

const p = upTo("u3-l4");
assert.equal(dueLessons(p, D0).length, 0, "rien à revoir le jour même");
const due = dueLessons(p, D0 + 1);
assert.ok(due.length > 0 && due.length <= 4, `le lendemain : ${due.length} leçons`);
const qs = recallQuestions(due, mulberry32(7));
assert.ok(qs.length <= due.length * 2 && qs.length >= due.length, `${qs.length} questions`);
assert.ok(qs.every((q) => q.k !== "info" && due.some((l) => l.id === origin.get(q))), "chaque question vient d'une leçon due");
// réussie : revient dans 3 jours ; ratée : revient demain
recordRecall({ [due[0].id]: true, [due[1].id]: false }, D0 + 1);
assert.ok(!dueLessons(p, D0 + 3, 200).some((l) => l.id === due[0].id) && dueLessons(p, D0 + 4, 200).some((l) => l.id === due[0].id), "réussie : +3 jours");
assert.ok(dueLessons(p, D0 + 2, 200).some((l) => l.id === due[1].id), "ratée : demain");
console.log("révision express : OK", due.map((l) => l.id).join(" "));

// la séance : révision express le lendemain, au plus 2 nouvelles leçons, un morceau à son niveau (pas une chanson d'enfant)
mem.clear();
mem.set("pianoflow-course", JSON.stringify(upTo("u8-l2")));
for (const m of [20, 30]) {
  const plan = buildPlan(m, dateOf(D0 + 2));
  assert.ok(plan.some((x) => x.tag === "recall"), `${m} min : révision express`);
  assert.ok(plan.filter((x) => x.icon === "🗺️").length <= 2, `${m} min : au plus 2 nouvelles leçons`);
  const piece = plan.find((x) => x.tag === "piece");
  assert.ok(piece && !SONGS.some((s) => piece.action === `rep:${s.id}`), `${m} min : morceau du répertoire, pas une chanson (${piece?.action})`);
}
const p45 = buildPlan(45, dateOf(D0 + 2));
assert.ok(p45.filter((x) => x.icon === "🗺️").length <= 3, "45 min : au plus 3 nouvelles leçons");
assert.ok(new Set(p45.map((x) => x.tag)).size >= 5, "45 min : une séance variée");
console.log("séance du jour : OK", p45.map((x) => x.tag).join(" "));
