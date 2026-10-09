// Modèle de compétences : maîtrise, oubli, choix de ce qu'on travaille, séance stable dans la journée, synchro.
import assert from "node:assert/strict";
const mem = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, String(v)), removeItem: (k: string) => void mem.delete(k) };
const S = await import("../src/skills");
const { buildPlan } = await import("../src/today");
const { LESSONS } = await import("../src/course/curriculum");
const { dayNum } = await import("../src/review");
const { mergeKey } = await import("../src/progressMerge");
const day = (s: string) => new Date(s + "T12:00:00").getTime();

// maîtrise : le premier résultat la fixe, les suivants la déplacent de moins en moins
S.record("rhythm", 40, day("2026-10-01"));
assert.equal(S.records().rhythm.m, 40);
S.record("rhythm", 100, day("2026-10-02"));
assert.ok(Math.abs(S.records().rhythm.m - 70) <= 2, "à mi-chemin");
for (let i = 0; i < 6; i++) S.record("rhythm", 100, day("2026-10-02"));
assert.ok(S.records().rhythm.m >= 90, `maîtrise ${S.records().rhythm.m}`);
// oubli : baisse sans pratique, jamais sous 60 % ; une compétence souvent travaillée tient plus longtemps
const r = S.records().rhythm, t = dayNum(new Date(day("2026-10-02")));
assert.ok(S.current(r, t + 30) < r.m && S.current(r, t + 30) >= 0.6 * r.m);
assert.ok(S.current({ ...r, n: 20 }, t + 30) > S.current({ ...r, n: 1 }, t + 30), "la répétition fait tenir");
mem.clear();
console.log("maîtrise et oubli : OK");

// ce qu'on travaille : le plus faible d'abord, une compétence par famille, rien de verrouillé
const done: Record<string, unknown> = {};
for (const l of LESSONS) { done[l.id] = { stars: 3, at: 1791200000000 }; if (l.id === "upd-l1") break; }
mem.set("pianoflow-course", JSON.stringify({ done, days: [] }));
const D = "2026-10-03", now = day(D), today = dayNum(new Date(now));
for (const k of ["reading", "sight", "rhythm", "echo", "intervals", "chords", "fingers", "pedal"]) S.record(k, 95, now - 86400000);
S.record("rhythm", 20, now - 86400000);   // le rythme est raté hier
let pr = S.toPractice(undefined, today).map((x) => x.skill.key);
assert.equal(pr[0], "rhythm", `${pr}`);
assert.equal(new Set(pr.map((k) => S.skillByKey(k)!.family)).size, pr.length, "une par famille");
assert.ok(!pr.includes("improv"), "l'improvisation n'est pas encore débloquée");
// dans la séance du jour
const tags = () => buildPlan(30, D).map((x) => x.tag);
assert.ok(tags().includes("drill:rhythm"), `${tags()}`);
assert.ok(buildPlan(30, D).find((x) => x.tag === "drill:rhythm")!.detail.includes("point"), "elle dit pourquoi");
// une fois travaillé aujourd'hui (et réussi), il reste dans la séance : la liste ne change pas sous les yeux
const before = buildPlan(30, D).map((x) => x.action);
S.record("rhythm", 100, now);
mem.set("pianoflow-daily", JSON.stringify({ [D]: { s: 0, done: ["drill:rhythm"] } }));
assert.deepEqual(buildPlan(30, D).map((x) => x.action), before, "séance stable");
// le lendemain, le rythme réussi laisse la place au plus faible
S.record("echo", 30, now);
const tomorrow = S.toPractice(undefined, today + 1).map((x) => x.skill.key);
assert.equal(tomorrow[0], "echo", `${tomorrow}`);
console.log("compétences à travailler : OK", pr.join(" "));

// anciens records d'exercices repris (meilleur score, tous niveaux)
mem.clear();
mem.set("pianoflow-drills", JSON.stringify({ "pedal-1": { best: 70, runs: 2, last: 20261001 }, "pedal-2": { best: 85, runs: 1, last: 20261002 } }));
assert.equal(S.records().pedal.m, 85); assert.equal(S.records().pedal.n, 3);
// synchro : par compétence, la mise à jour la plus récente gagne (la maîtrise peut baisser)
const a = { rhythm: { m: 90, n: 5, t: 1, d: 1, m0: 80 }, echo: { m: 40, n: 1, t: 5, d: 1, m0: -1 } };
const b = { rhythm: { m: 60, n: 6, t: 2, d: 2, m0: 90 }, echo: { m: 80, n: 2, t: 3, d: 1, m0: 40 } };
assert.deepEqual(mergeKey("pianoflow-skills", a, b), { rhythm: b.rhythm, echo: a.echo });
console.log("reprise et synchro : OK");
