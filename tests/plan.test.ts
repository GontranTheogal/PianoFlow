// La séance du jour d'un débutant ne se limite pas aux leçons : échauffement, morceau et oreille arrivent tôt.
import assert from "node:assert/strict";
const mem = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, String(v)), removeItem: (k: string) => void mem.delete(k) };
const { buildPlan } = await import("../src/today");
const { UNITS, LESSONS } = await import("../src/course/curriculum");
const { recommended } = await import("../src/exercisesView");
const done: Record<string, unknown> = {};
const tags = () => { mem.set("pianoflow-course", JSON.stringify({ done, days: [] })); return buildPlan(20, "2026-10-03").map((x) => x.tag); };
const finish = (...ids: string[]) => ids.forEach((id) => UNITS.find((u) => u.id === id)!.lessons.forEach((l) => (done[l.id] = { stars: 3, at: 1791200000000 })));
assert.deepEqual(tags(), ["lesson", "lesson:u1-l2"]);
finish("u1");
assert.ok(tags().includes("drill:echo"), "écho après « Do, Ré, Mi »");
finish("u2");
const t = tags();
for (const k of ["warmup", "lesson", "piece", "drill:echo"]) assert.ok(t.includes(k), `${k} après la main droite`);
// Exercices « pour toi » : au plus 3, ceux débloqués le plus récemment
assert.deepEqual(recommended({ done, days: [] } as any), ["five", "echo"]);
// pédale : dès la première leçon de l'unité, elle entre dans la séance et en tête des exercices
for (const l of LESSONS) { done[l.id] = { stars: 3, at: 1791200000000 }; if (l.id === "upd-l1") break; }
assert.ok(tags().includes("drill:pedal"), "pédale dans la séance");
assert.equal(recommended({ done, days: [] } as any)[0], "pedal");
assert.ok(recommended({ done, days: [] } as any).length <= 3);
mem.set("pianoflow-drills", JSON.stringify({ "pedal-2": { best: 95, runs: 1, last: 95 } }));
assert.ok(!tags().includes("drill:pedal"), "pédale acquise : elle laisse la place");
console.log("séance du jour du débutant : OK");
// la durée choisie compte : plus de temps = plus d'étapes (des leçons en plus), jamais plus que l'objectif
{
  for (const k of Object.keys(done)) delete done[k];
  finish("u1", "u2");
  mem.set("pianoflow-course", JSON.stringify({ done, days: [] }));
  const mins = (m: number) => buildPlan(m, "2026-10-03").reduce((a, x) => a + x.min, 0);
  const n = (m: number) => buildPlan(m, "2026-10-03").length;
  assert.ok(n(10) < n(20) && n(20) < n(30) && n(30) < n(45), `étapes ${n(10)} ${n(20)} ${n(30)} ${n(45)}`);
  for (const m of [20, 30, 45]) assert.ok(mins(m) <= m + 2 && mins(m) >= m - 8, `${m} min → ${mins(m)} min`);
  const lessons = buildPlan(45, "2026-10-03").filter((x) => x.icon === "🗺️").map((x) => x.action);
  assert.equal(new Set(lessons).size, lessons.length, "pas de leçon en double");
  console.log("durée de la séance : OK", [10, 20, 30, 45].map((m) => `${m}→${n(m)} étapes/${mins(m)} min`).join(", "));
}
// parcours fini : les révisions remplissent la durée choisie, et la liste ne change pas d'un affichage à l'autre
{
  for (const l of LESSONS) done[l.id] = { stars: 3, at: 1791200000000 + l.index };
  done[LESSONS[40].id] = { stars: 2, at: 1791300000000 };
  mem.set("pianoflow-course", JSON.stringify({ done, days: [] }));
  const plan = buildPlan(45, "2026-10-03"), mins = plan.reduce((a, x) => a + x.min, 0);
  assert.ok(mins >= 37 && mins <= 47, `45 min → ${mins} min`);
  assert.deepEqual(buildPlan(45, "2026-10-03").map((x) => x.action), plan.map((x) => x.action), "même séance à chaque affichage");
  const revs = plan.filter((x) => x.title.startsWith("Révision : ")).map((x) => x.action);
  assert.equal(revs[0], `lesson:${LESSONS[40].id}`, "la leçon la moins bien réussie d'abord");
  assert.equal(new Set(revs).size, revs.length, "pas de révision en double");
  console.log("parcours fini : OK", plan.map((x) => x.action).join(" "));
}
