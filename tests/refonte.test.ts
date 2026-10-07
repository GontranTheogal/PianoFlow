// Parcours refondu : test « Je connais déjà » par unité, validation des leçons, unité « Le rythme, suite », tonalités condensées.
import assert from "node:assert/strict";
const mem = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, String(v)), removeItem: (k: string) => void mem.delete(k) };
(globalThis as any).document = { body: { classList: { toggle() {} } } };
const { UNITS, LESSONS } = await import("../src/course/curriculum");
const { unitTestQuestions } = await import("../src/course/ui");
const { validateLessons, currentIndex } = await import("../src/course/engine");
const { mulberry32 } = await import("../src/course/build");

// chaque unité a un test : des questions courtes (ni explication, ni morceau), au plus 14
let n = 0;
for (const u of UNITS) {
  const qs = unitTestQuestions(u, mulberry32(UNITS.indexOf(u) + 1));
  assert.ok(qs.length >= 3, `${u.id} : ${qs.length} questions`);
  assert.ok(qs.length <= 14 && qs.every((q) => q.k !== "info" && q.k !== "piece" && q.k !== "improv"), u.id);
  n += qs.length;
}
console.log(`tests d'unité : OK (${UNITS.length} unités, ${n} questions)`);

// test réussi : l'unité et toutes celles d'avant sont validées, la suite reprend juste après
const p0 = { v: 1, done: { "u1-l1": { stars: 3, best: 100, runs: 1, at: 1791200000000 } }, xp: 25, days: [] };
const u = UNITS.find((x) => x.id === "u4")!, last = LESSONS.filter((l) => l.unit === u).pop()!;
const ids = LESSONS.filter((l) => l.index <= last.index).map((l) => l.id);
const { progress, added } = validateLessons(p0, ids, 92);
assert.equal(added, ids.length - 1, "les leçons déjà faites gardent leurs étoiles");
assert.equal(progress.done["u1-l1"].stars, 3); assert.equal(progress.done[last.id].stars, 1);
assert.equal(currentIndex(progress, LESSONS.map((l) => l.id)), last.index + 1);
console.log("validation par test : OK");

// le rythme avant les morceaux qui en ont besoin ; les tonalités lointaines en une leçon chacune
const pos = (id: string) => LESSONS.findIndex((l) => l.id === id);
assert.ok(pos("ur2-l2") < pos("u8-l7"), "rythme pointé avant la Marche militaire");
assert.ok(pos("ur2-l1") < pos("ua-l5"), "doubles croches avant le Prélude de Bach");
assert.ok(pos("ur2-l4") < pos("uacc-l1"), "6/8 avant les chansons (Douce nuit)");
const tour = UNITS.find((x) => x.id === "uk-tour")!;
assert.equal(tour.lessons.length, 8);
assert.ok(!UNITS.some((x) => /^uk-(M-(Eb|E|Ab|B|Db|Fs)|m-(C|F))$/.test(x.id)), "plus d'unité par tonalité lointaine");
console.log("ordre du parcours : OK", LESSONS.length, "leçons");
