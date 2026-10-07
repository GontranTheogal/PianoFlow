/** Moteur d'apprentissage hors parcours : juge de rythme, coach de morceau, générateurs d'exercices, suivi quotidien. */
import assert from "node:assert/strict";
const mem = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, String(v)), removeItem: (k: string) => void mem.delete(k) };
import { RhythmJudge, WINDOWS, type TimedNote } from "../src/rhythm";
import * as Coach from "../src/coach";
import * as X from "../src/exercises";
import * as Daily from "../src/daily";
import { dayKey } from "../src/course/engine";
import { measureLength } from "../src/course/xml";
import { mulberry32 } from "../src/course/build";
import { MAJOR_KEYS, midiOf } from "../src/course/theory";

let n = 0;
const t = async (name: string, f: () => void | Promise<void>) => { try { await f(); } catch (e) { console.error("  ✗", name); throw e; } n++; console.log("  ✓", name); };
const notes = (k: number, gap = 500): TimedNote[] => Array.from({ length: k }, (_, i) => ({ id: "n" + i, pitch: 60 + (i % 5), onTime: 1000 + i * gap, measure: Math.floor(i / 4) }));

console.log("Juge de rythme");
await t("toutes les notes à l'heure : 100 %", () => {
  const ns = notes(8), j = new RhythmJudge(ns);
  for (const x of ns) assert.equal(j.press(x.pitch, x.onTime + 10).verdict, "perfect");
  const s = j.finish(); assert.equal(s.score, 100); assert.equal(s.accuracy, 100); assert.equal(s.timing, 100); assert.deepEqual(s.weak, []);
});
await t("en avance, en retard, manquée, fausse : chaque cas est classé et pénalisé", () => {
  const ns = notes(4), j = new RhythmJudge(ns);
  assert.equal(j.press(ns[0].pitch, ns[0].onTime - 200).verdict, "early");
  assert.equal(j.press(ns[1].pitch, ns[1].onTime + 100).verdict, "good");
  assert.equal(j.press(ns[2].pitch, ns[2].onTime + 220).verdict, "late");
  assert.equal(j.press(90, ns[3].onTime).verdict, "wrong");
  assert.deepEqual(j.advance(ns[3].onTime + WINDOWS.max + 1).map((x) => x.id), ["n3"]);
  const s = j.finish();
  assert.deepEqual([s.early, s.good, s.late, s.miss, s.wrong], [1, 1, 1, 1, 1]);
  assert.ok(s.score < 50 && s.score > 0, String(s.score));
});
await t("à vitesse réduite, la tolérance suit le tempo (fenêtres en temps réel)", () => {
  const ns = notes(2), j = new RhythmJudge(ns, 2);                  // lecture à 50 % : 1 ms réelle = 2 ms de partition
  assert.equal(j.press(ns[0].pitch, ns[0].onTime + 130).verdict, "perfect");   // 65 ms réelles
  assert.equal(j.press(ns[1].pitch, ns[1].onTime + 400).verdict, "late");      // 200 ms réelles
});
await t("les mesures à retravailler sont celles où l'on s'est trompé", () => {
  const ns = notes(12), j = new RhythmJudge(ns);
  for (const x of ns) if (x.measure !== 1) j.press(x.pitch, x.onTime);
  const s = j.finish(); assert.equal(s.weak[0], 1);
});

console.log("Coach");
await t("sections : 4 mesures (moins si dense), jamais une mesure isolée à la fin", () => {
  assert.deepEqual(Coach.sectionsFor([4, 4, 4, 4, 4, 4, 4, 4, 4]), [{ a: 0, b: 4 }, { a: 4, b: 9 }]);
  assert.deepEqual(Coach.sectionsFor([16, 16, 16, 16]), [{ a: 0, b: 2 }, { a: 2, b: 4 }]);
  assert.deepEqual(Coach.sectionsFor([3, 3, 3]), [{ a: 0, b: 3 }]);
});
await t("progression : MD, MG, ensemble pas à pas, puis rythme 60 % et 80 %, puis le morceau entier", () => {
  const secs = Coach.sectionsFor([4, 4, 4, 4, 4, 4, 4, 4]), st = Coach.stagesFor(true, true), full = Coach.fullStagesFor(true, true);
  assert.deepEqual(st.map((s) => [s.hand, s.mode, s.speed]), [["R", "step", 100], ["L", "step", 100], ["both", "step", 100], ["both", "rhythm", 60], ["both", "rhythm", 80]]);
  let p = Coach.emptyProgress(), guard = 0;
  for (;;) {
    const tg = Coach.nextTarget(p, secs, st, full); if (tg.kind === "done") break;
    const loop = tg.kind === "section" ? tg.section : null;
    // un passage trop lent ou mal noté ne valide pas ; le bon passage, si
    assert.equal(Coach.passMatches(tg, { mode: tg.stage.mode, score: tg.stage.pass - 1, speed: tg.stage.speed, hand: tg.stage.hand, loop }), false);
    if (tg.stage.mode === "rhythm") assert.equal(Coach.passMatches(tg, { mode: "rhythm", score: 100, speed: tg.stage.speed - 10, hand: tg.stage.hand, loop }), false);
    assert.ok(Coach.passMatches(tg, { mode: tg.stage.mode, score: tg.stage.pass, speed: tg.stage.speed, hand: tg.stage.hand, loop }));
    p = Coach.advance(p, tg); assert.ok(++guard < 50);
  }
  assert.equal(guard, secs.length * st.length + full.length);
  assert.equal(Coach.progressRatio(p, secs, st, full), 1);
});
await t("long morceau : parties de quelques sections, enchaînées avant de passer à la suite", () => {
  const secs = Coach.sectionsFor(new Array(40).fill(4)), st = Coach.stagesFor(true, true), full = Coach.fullStagesFor(true, true);
  const parts = Coach.partsFor(secs), ps = Coach.partStagesFor(true, true);
  assert.equal(secs.length, 10); assert.ok(parts.length >= 2);
  assert.deepEqual(parts.map((x) => [x.s0, x.s1]).flat()[0], 0); assert.equal(parts[parts.length - 1].s1, secs.length);
  assert.ok(parts.every((x) => x.s1 - x.s0 >= 2 && x.a === secs[x.s0].a && x.b === secs[x.s1 - 1].b));
  assert.deepEqual(Coach.partsFor(Coach.sectionsFor(new Array(12).fill(4))), [], "3 sections : pas de parties");
  let p = Coach.emptyProgress(), guard = 0; const order: string[] = [];
  for (;;) {
    const tg = Coach.nextTarget(p, secs, st, full, parts, ps); if (tg.kind === "done") break;
    order.push(tg.kind === "section" ? `s${tg.index}` : tg.kind === "part" ? `p${tg.index}` : "full");
    const loop = tg.kind === "full" ? null : tg.section;
    assert.ok(Coach.passMatches(tg, { mode: tg.stage.mode, score: 100, speed: 100, hand: tg.stage.hand, loop }));
    if (tg.kind === "part") assert.equal(Coach.passMatches(tg, { mode: tg.stage.mode, score: 100, speed: 100, hand: tg.stage.hand, loop: secs[parts[tg.index].s0] }), false, "une section seule ne valide pas l'enchaînement");
    p = Coach.advance(p, tg); assert.ok(++guard < 200);
  }
  // la 1re partie est enchaînée avant de commencer les sections de la 2e
  assert.ok(order.indexOf("p0") < order.indexOf(`s${parts[1].s0}`));
  assert.equal(guard, secs.length * st.length + parts.length * ps.length + full.length);
  assert.equal(Coach.progressRatio(p, secs, st, full, parts, ps), 1);
});

console.log("Pédale dans les morceaux");
await t("indications de pédale lues dans la partition, pied jugé dessus", async () => {
  const { DOMParser } = await import("linkedom"); (globalThis as any).DOMParser = DOMParser;
  const { pedalMarks, judgePedalMarks } = await import("../src/pedalJudge");
  const { repXml, repById } = await import("../src/repertoire");
  const marks = pedalMarks(repXml(repById("chopin7")!));
  assert.ok(marks.length >= 8 && marks[0].type === "start", `${marks.length} indications`);
  const at = (q: number) => q * 500;
  const perfect = marks.flatMap((m) => m.type === "stop" ? [{ t: at(m.q) + 50, down: false }] : m.type === "start" ? [{ t: at(m.q) + 120, down: true }] : [{ t: at(m.q) - 20, down: false }, { t: at(m.q) + 120, down: true }]);
  const r = judgePedalMarks(marks, at, perfect, 500); assert.equal(r.ok, r.total);
  const never = judgePedalMarks(marks, at, [{ t: -100, down: true }], 500); assert.ok(never.ok <= 1);
});

await t("révision espacée : raté → demain, puis 3, 7, 14 jours, puis sorti ; raté de nouveau → on recommence", async () => {
  const R = await import("../src/review");
  const d0 = 20000, k = R.measureKey("x.musicxml", 3);
  R.reviewFail(k, "mesure 4", "loop:x.musicxml|3", d0);
  assert.equal(R.dueReviews(d0).length, 0); assert.equal(R.dueReviews(d0 + 1)[0].key, k);
  R.reviewPass(k, d0);  // en avance : ne compte pas
  assert.equal(R.dueReviews(d0 + 1)[0].box, 0);
  let day = d0 + 1;
  for (const gap of [3, 7, 14]) { R.reviewPass(k, day); assert.equal(R.dueReviews(day + gap - 1).filter((x) => x.key === k).length, 0); day += gap; assert.equal(R.dueReviews(day)[0].key, k); }
  R.reviewPass(k, day); assert.equal(R.dueReviews(day + 100).filter((x) => x.key === k).length, 0);
  R.reviewFail(k, "mesure 4", "loop:x.musicxml|3", day); assert.equal(R.dueReviews(day + 1)[0].miss, 2);
});

await t("improvisation : assez de notes, presque toutes dans la gamme", async () => {
  const { judgeImprov } = await import("../src/course/engine");
  const penta = [0, 2, 4, 7, 9];
  assert.equal(judgeImprov([60, 62, 64], penta, 8).ok, false);
  assert.equal(judgeImprov(Array.from({ length: 20 }, (_, i) => 60 + penta[i % 5]), penta, 8).ok, true);
  assert.equal(judgeImprov(Array.from({ length: 20 }, (_, i) => 60 + i), penta, 8).ok, false);
});

console.log("Exercices générés");
await t("déchiffrage : mesures complètes, doigtés 1-5, position de cinq doigts, à tous les niveaux", () => {
  for (let level = 1; level <= X.SIGHT_LEVELS.length; level++) for (let seed = 1; seed <= 40; seed++) {
    const { spec } = X.sightReading(level, mulberry32(seed * 31 + level));
    const len = measureLength(spec);
    for (const hand of [spec.rh, spec.lh]) {
      if (!hand) continue;
      const total = hand.reduce((s, e) => s + e.dur, 0);
      assert.equal(total % len, 0, `niveau ${level} : ${total} croches pour des mesures de ${len}`);
      for (const e of hand) for (const x of e.notes) assert.ok(x.finger && x.finger >= 1 && x.finger <= 5);
      const ms = hand.flatMap((e) => e.notes.map((x) => midiOf(x.p)));
      assert.ok(Math.max(...ms) - Math.min(...ms) <= 9, "reste dans une position de cinq doigts");
    }
    if (X.SIGHT_LEVELS[level - 1].hands === "both") assert.ok(spec.lh && spec.lh.length > 0);
  }
});
await t("rythmes : chaque motif remplit exactement ses mesures", () => {
  for (let level = 1; level <= X.RHYTHM_LEVELS.length; level++) for (let seed = 1; seed <= 30; seed++) {
    const L = X.RHYTHM_LEVELS[level - 1], pat = X.rhythmPattern(level, mulberry32(seed));
    const bar = L.beatType === 8 ? L.beats : L.beats * 2, bars = pat.reduce((s, d) => s + Math.abs(d), 0) / bar;
    assert.ok(Math.abs(bars - Math.round(bars)) < 1e-6, `niveau ${level} : ${bars} mesures`);   // triolets : 3 × ⅔ à l'arrondi près
    assert.ok(pat.some((d) => d > 0));
  }
});
await t("oreille : bonne réponse présente, options distinctes, notes jouables", () => {
  for (let level = 1; level <= 3; level++) {
    for (const q of [...X.intervalDrill(level, mulberry32(level), 20), ...X.chordEarDrill(level, mulberry32(level + 9), 20)]) {
      assert.equal(q.k, "choice"); if (q.k !== "choice") continue;
      assert.ok(q.answer >= 0 && q.answer < q.options.length); assert.equal(new Set(q.options).size, q.options.length);
      assert.ok(q.audio && q.audio.steps.flat().every((m) => m >= 36 && m <= 96));
    }
  }
  for (let level = 1; level <= X.ECHO_LEVELS.length; level++) for (const q of X.echoDrill(level, mulberry32(level), 10)) {
    if (q.k !== "seq") assert.fail("écho = suite"); else { assert.equal(q.notes.length, X.ECHO_LEVELS[level - 1].len); assert.ok(q.notes.every((m) => m >= q.kbd[0] && m <= q.kbd[1])); assert.ok(q.hidden); }
  }
});
await t("cinq doigts : 12 tonalités, majeur puis mineur, doigts miroir aux deux mains", () => {
  for (const k of MAJOR_KEYS) {
    const { spec } = X.fiveFinger(k);
    assert.equal(spec.rh!.length, spec.lh!.length);
    spec.rh!.forEach((e, i) => assert.equal(e.notes[0].finger! + spec.lh![i].notes[0].finger!, 6));
  }
});

console.log("Suivi quotidien");
await t("tâches du jour, jours de pratique et historique", () => {
  Daily.markDone("lesson"); Daily.markDone("lesson"); Daily.markDone("warmup");
  assert.deepEqual(Daily.day().done, ["lesson", "warmup"]);
  assert.ok(Daily.isDone("warmup") && !Daily.isDone("piece"));
  assert.ok(Daily.practiceDays().includes(dayKey()));
  const h = Daily.history(14); assert.equal(h.length, 14); assert.equal(h[13].day, dayKey());
});

console.log(`\n${n} tests OK`);
