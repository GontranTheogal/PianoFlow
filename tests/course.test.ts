import assert from "node:assert/strict";
import { DOMParser } from "linkedom";
(globalThis as any).DOMParser = DOMParser;
import createVerovioModule from "verovio/wasm";
import { VerovioToolkit } from "verovio/esm";
import { UNITS, LESSONS } from "../src/course/curriculum";
import { mulberry32 } from "../src/course/build";
import { chordPitches, degreeChord, invert, midiOf, nameOf, chordName, MAJOR_KEYS, MINOR_KEYS, keyLabel, voiceLead } from "../src/course/theory";
import { LessonSession, completeLesson, emptyProgress, isUnlocked, currentIndex, starsFor, streak, pressOk, ChordCollector, scoreRhythm, patternBeats, judgeTouch } from "../src/course/engine";
import { buildXml, note, chord, rest, splitMeasures } from "../src/course/xml";
import { parseExplicitFingering, assignFingering } from "../src/fingering";
import type { Q } from "../src/course/types";
import type { Step, Note } from "../src/score";
import { tieEnds } from "../src/score";

let n = 0;
const t = async (name: string, f: () => void | Promise<void>) => { try { await f(); } catch (e) { console.error("  ✗", name); throw e; } n++; console.log("  ✓", name); };
const white = (m: number) => ![1, 3, 6, 8, 10].includes(m % 12);

console.log("Théorie");
await t("accords orthographiés : Fa♯ majeur = Fa♯ La♯ Do♯, Ré♭ majeur = Ré♭ Fa La♭", () => {
  assert.deepEqual(chordPitches({ li: 3, alter: 1 }, 4, "maj").map((p) => nameOf(p)), ["Fa♯", "La♯", "Do♯"]);
  assert.deepEqual(chordPitches({ li: 1, alter: -1 }, 4, "maj").map((p) => nameOf(p)), ["Ré♭", "Fa", "La♭"]);
  assert.deepEqual(chordPitches({ li: 0, alter: 0 }, 4, "min").map((p) => nameOf(p)), ["Do", "Mi♭", "Sol"]);
  assert.deepEqual(chordPitches({ li: 4, alter: 0 }, 4, "dom7").map((p) => nameOf(p)), ["Sol", "Si", "Ré", "Fa"]);
  assert.deepEqual(chordPitches({ li: 0, alter: 0 }, 4, "maj7").map((p) => nameOf(p)), ["Do", "Mi", "Sol", "Si"]);
});
await t("renversements", () => {
  const c = chordPitches({ li: 0, alter: 0 }, 4, "maj");
  assert.deepEqual(invert(c, 1).map((p) => nameOf(p) + p.oct), ["Mi4", "Sol4", "Do5"]);
  assert.deepEqual(invert(c, 2).map((p) => nameOf(p) + p.oct), ["Sol4", "Do5", "Mi5"]);
});
await t("accords diatoniques : Do majeur I IV V vi ; La mineur i iv V (majeur) ; Sol majeur ii = La mineur", () => {
  const C = MAJOR_KEYS[0], names = (k: typeof C, ds: number[]) => ds.map((d) => { const c = degreeChord(k, d); return chordName(c.root, c.q, true); });
  assert.deepEqual(names(C, [1, 2, 3, 4, 5, 6, 7]), ["Do", "Rém", "Mim", "Fa", "Sol", "Lam", "Si°"].map((s) => s.replace("m", "m")).map((s, i) => ["Do", "Ré" + "m", "Mi" + "m", "Fa", "Sol", "La" + "m", "Si°"][i]));
  const Am = MINOR_KEYS[0]; assert.deepEqual(names(Am, [1, 4, 5]), ["Lam", "Rém", "Mi"]);
  const G = MAJOR_KEYS[1]; assert.equal(names(G, [2])[0], "Lam");
  const Fs = MAJOR_KEYS.find((k) => k.id === "F♯")!; assert.deepEqual(chordPitches({ li: Fs.li, alter: Fs.alter }, 4, "maj").map((p) => nameOf(p)), ["Fa♯", "La♯", "Do♯"]);
});
await t("conduite des voix : les accords bougent peu", () => {
  const C = MAJOR_KEYS[0];
  const chords = [1, 4, 5, 1].map((d) => degreeChord(C, d).pitches);
  const lead = voiceLead(chords);
  const move = (a: typeof lead) => a.slice(1).reduce((s, v, i) => s + v.reduce((x, p, j) => x + Math.abs(midiOf(p) - midiOf(a[i][j])), 0), 0);
  assert.ok(move(lead) < move(chords));
});

console.log("Moteur");
await t("étoiles, XP, déblocage linéaire, série", () => {
  assert.deepEqual([100, 90, 89, 70, 69, 0].map(starsFor), [3, 3, 2, 2, 1, 1]);
  const ids = ["a", "b", "c"]; let p = emptyProgress();
  assert.ok(isUnlocked(p, ids, 0)); assert.ok(!isUnlocked(p, ids, 1)); assert.ok(isUnlocked(p, ids, 1, true));
  const r = completeLesson(p, "a", 95, "2026-10-03"); p = r.progress;
  assert.equal(r.xp, 25); assert.ok(isUnlocked(p, ids, 1)); assert.ok(!isUnlocked(p, ids, 2)); assert.equal(currentIndex(p, ids), 1);
  const r2 = completeLesson(p, "a", 60, "2026-10-04"); assert.equal(r2.progress.done.a.stars, 3); assert.equal(r2.xp, 5);        // on garde le meilleur
  assert.equal(streak(["2026-10-01", "2026-10-02", "2026-10-03"], "2026-10-03"), 3);
  assert.equal(streak(["2026-10-01", "2026-10-02"], "2026-10-03"), 2);       // hier : la série vit encore
  assert.equal(streak(["2026-09-28"], "2026-10-03"), 0);
  assert.equal(streak(["2026-01-31", "2026-02-01"], "2026-02-01"), 2);
});
await t("file de leçon : une erreur remet la question à la fin, une seule fois", () => {
  const qs: Q[] = [{ k: "info", title: "i", body: "" }, { k: "press", prompt: "a", target: { midi: 60 }, kbd: [48, 72] }, { k: "press", prompt: "b", target: { midi: 62 }, kbd: [48, 72] }];
  const s = new LessonSession(qs);
  s.answer(true);                       // info
  s.answer(false);                      // a : raté → revient
  s.answer(true);                       // b : juste
  assert.ok(!s.done); assert.ok(s.isRetry);
  s.answer(false);                      // a raté encore : ne revient plus
  assert.ok(s.done); assert.equal(s.firstTryOk, 1); assert.equal(s.graded, 2); assert.equal(s.accuracy, 50);
});
await t("accord : fenêtre de temps, intrus, basse", () => {
  const c = new ChordCollector([0, 4, 7]);
  assert.equal(c.add(60, 0), "wait"); assert.equal(c.add(64, 100), "wait"); assert.equal(c.add(67, 200), "ok");
  const d = new ChordCollector([0, 4, 7]); d.add(60, 0); assert.equal(d.add(61, 50), "bad");
  const e = new ChordCollector([0, 4, 7]); e.add(60, 0); e.add(64, 5000); assert.equal(e.add(67, 5100), "wait");   // fenêtre expirée : on repart
  const f = new ChordCollector([0, 4, 7], 4); f.add(60, 0); f.add(64, 10); assert.equal(f.add(67, 20), "bad");   // basse attendue : Mi
  const g = new ChordCollector([0, 4, 7], 4); g.add(64, 0); g.add(67, 10); assert.equal(g.add(72, 20), "ok");
  const oct = new ChordCollector([0, 0], 0); oct.add(60, 0); assert.equal(oct.add(72, 10), "ok");          // une octave : deux touches de même nom
  const oct2 = new ChordCollector([0, 0], 0); assert.equal(oct2.add(60, 0), "wait"); assert.equal(oct2.add(60, 5), "wait"); assert.equal(oct2.add(62, 9), "bad");
  assert.ok(pressOk({ pcs: [0] }, 72) && !pressOk({ midi: 60 }, 72));
});
await t("rythme : tolérance, retard, frappes en trop", () => {
  const pat = [2, 2, 4], bpm = 60;       // temps = 1000 ms
  const ok = scoreRhythm(pat, bpm, [10, 1020, 2000], 0); assert.ok(ok.pass); assert.equal(ok.hits, 3);
  const bad = scoreRhythm(pat, bpm, [10, 700, 2600], 0); assert.ok(!bad.pass);
  const extra = scoreRhythm(pat, bpm, [0, 500, 1000, 1500, 2000, 2500], 0); assert.ok(!extra.pass);
  const silent = scoreRhythm([2, -2, 2], bpm, [0, 2000], 0); assert.ok(silent.pass);
  assert.equal(patternBeats([3, 1, 4]), 4);
});
await t("toucher : un forte joué vers 67/127 est reconnu", () => {
  const ev = (vs: number[]) => vs.map((vel, i) => ({ m: 60 + i, on: i * 400, off: i * 400 + 300, vel }));
  assert.ok(judgeTouch("f", ev([67, 70, 64, 68, 66])).ok);
  assert.ok(!judgeTouch("f", ev([50, 55, 52, 48, 54])).ok);
  assert.ok(!judgeTouch("f", ev([80, 80, 30, 80, 80])).ok);
  assert.ok(judgeTouch("p", ev([40, 45, 38, 42, 44])).ok);
});

console.log("MusicXML");
await t("construction : mesure incomplète ou à cheval refusée", () => {
  assert.throws(() => splitMeasures([note({ li: 0, alter: 0, oct: 4 }, 4), note({ li: 0, alter: 0, oct: 4 }, 6)], 8), /barre de mesure/);
  assert.throws(() => splitMeasures([note({ li: 0, alter: 0, oct: 4 }, 4)], 8), /incomplète/);
  assert.ok(buildXml({ title: "t", bpm: 60, fifths: 0, rh: [chord([{ li: 0, alter: 0, oct: 4 }, { li: 2, alter: 0, oct: 4 }], 8)], lh: [rest(8)] }).includes("<chord/>"));
});

console.log("Parcours");
await t("identifiants uniques, une leçon par fiche, ordre non vide", () => {
  const ids = LESSONS.map((l) => l.id); assert.equal(new Set(ids).size, ids.length);
  assert.ok(LESSONS.length >= 70, `${LESSONS.length} leçons`); console.log(`      ${UNITS.length} unités, ${LESSONS.length} leçons`);
  for (const l of LESSONS) assert.ok(l.goals.length >= 1 && l.title);
});

const toolkit = new VerovioToolkit(await createVerovioModule());
const seen = new Set<string>();
let pieces = 0, questions = 0;
for (const lesson of LESSONS) {
  await t(`leçon ${lesson.id} « ${lesson.title} »`, () => {
    for (const seed of [1, 2, 3]) {
      const qs = lesson.build(mulberry32(seed * 977));
      assert.ok(qs.length >= 3, "leçon trop courte");
      assert.ok(qs.length <= 24, "leçon trop longue : " + qs.length);
      assert.equal(qs[0].k === "info" || qs[0].k === "press" || qs[0].k === "seq" || qs[0].k === "choice", true);
      for (const q of qs) {
        questions++;
        if (q.k === "press") {
          const [lo, hi] = q.kbd; assert.ok(white(lo) && white(hi), "bornes du clavier sur des blanches"); assert.ok(hi - lo >= 11);
          if ("midi" in q.target) assert.ok(q.target.midi >= lo && q.target.midi <= hi, `touche ${q.target.midi} hors du clavier ${lo}-${hi}`);
          else assert.ok(q.target.pcs.every((pc) => { for (let m = lo; m <= hi; m++) if (m % 12 === pc) return true; return false; }));
        } else if (q.k === "seq") {
          const [lo, hi] = q.kbd; assert.ok(q.notes.length >= 3 && q.notes.every((m) => m >= lo && m <= hi), `suite hors clavier ${lo}-${hi} : ${q.notes}`);
          if (q.fingers) { assert.equal(q.fingers.length, q.notes.length); assert.ok(q.fingers.every((f) => f >= 1 && f <= 5)); }
        } else if (q.k === "chord") {
          const [lo, hi] = q.kbd; assert.ok(q.pcs.length >= 2); if (q.bass !== undefined) assert.ok(q.pcs.includes(q.bass));
          assert.ok(q.pcs.every((pc) => { for (let m = lo; m <= hi; m++) if (m % 12 === pc) return true; return false; }));
        } else if (q.k === "choice") {
          assert.ok(q.answer >= 0 && q.answer < q.options.length); assert.equal(new Set(q.options).size, q.options.length, "options en double : " + q.options); assert.ok(q.options.length >= 2 && q.options.length <= 4, 'options : ' + q.options.length);
          assert.ok(q.explain.length > 5);
        } else if (q.k === "rhythm") {
          const bar = q.beatType === 8 ? (q.beats ?? 6) : (q.beats ?? 4) * 2, bars = q.pattern.reduce((s, d) => s + Math.abs(d), 0) / bar;
          assert.ok(Math.abs(bars - Math.round(bars)) < 1e-6 && bars >= 1, `mesures complètes (${bars})`);
          if (q.ties) assert.ok(q.ties.every((i) => i >= 0 && i < q.pattern.length - 1 && q.pattern[i] > 0 && q.pattern[i + 1] > 0), "liaison entre deux notes"); assert.ok(q.pattern.some((d) => d > 0));
        } else if (q.k === "piece") {
          assert.ok(q.xml.length > 200);
          if (seen.has(q.xml)) continue; seen.add(q.xml); pieces++;
        }
      }
    }
  });
}

await t(`${"toutes les partitions"} se chargent dans Verovio, avec des notes jouables`, () => {
  assert.ok(seen.size > 100, `${seen.size} partitions`);
  let bad = 0;
  for (const xml of seen) {
    toolkit.resetOptions(); toolkit.loadData(xml); toolkit.renderToSVG(1);
    const tm: any[] = toolkit.renderToTimemap({ includeMeasures: true }) as any;
    const notes = tm.flatMap((e) => e.on ?? []);
    if (!notes.length) { bad++; console.error("      aucune note :", xml.slice(0, 160)); continue; }
    for (const id of notes) { const pv: any = toolkit.getMIDIValuesForElement(id); if (!pv || pv.pitch < 21 || pv.pitch > 108) { bad++; console.error("      hauteur hors piano :", pv); } }
  }
  assert.equal(bad, 0);
  console.log(`      ${seen.size} partitions distinctes vérifiées`);
});
await t("les doigtés de chaque partition sont calculables, distincts dans les accords et bornés", () => {
  let checked = 0;
  for (const xml of seen) {
    toolkit.resetOptions(); toolkit.loadData(xml); toolkit.renderToSVG(1);
    const tm: any[] = toolkit.renderToTimemap({ includeMeasures: true }) as any;
    const steps: Step[] = [];
    const ties = tieEnds(toolkit);   // une note liée n'est pas une nouvelle attaque (comme loadScore dans l'appli)
    for (const e of tm) { const on = (e.on ?? []).filter((id: string) => !ties.has(id)); if (on.length) steps.push({ time: e.tstamp, notes: on.map((id: string) => ({ id, pitch: (toolkit.getMIDIValuesForElement(id) as any).pitch, hand: "R", onTime: e.tstamp, offTime: e.tstamp + 400, q: e.qstamp } as Note)) }); }
    // la main vient de la portée du fichier (comme annotateHands dans l'appli)
    const handOf = new Map(parseExplicitFingering(xml).notes.map((x) => [`${x.pitch}|${Math.round(x.q * 16)}`, x.hand]));
    for (const s of steps) for (const nn of s.notes) nn.hand = handOf.get(`${nn.pitch}|${Math.round((nn.q ?? 0) * 16)}`) ?? "R";
    assignFingering(steps, xml.includes("<fingering") ? parseExplicitFingering(xml) : { R: [], L: [] }, { span: 20.5 });
    for (const s of steps) { for (const nn of s.notes) assert.ok(nn.finger && nn.finger >= 1 && nn.finger <= 5); for (const h of ["R", "L"]) { const f = s.notes.filter((x) => x.hand === h).map((x) => x.finger); assert.equal(new Set(f).size, f.length, `${xml.match(/<work-title>([^<]*)/)?.[1]} : doigts ${f} sur ${s.notes.filter((x) => x.hand === h).map((x) => x.pitch)}`); } }
    checked++;
  }
  assert.equal(checked, seen.size);
});

console.log(`\n${n} tests OK — ${questions} questions, ${pieces} partitions`);
void keyLabel;
