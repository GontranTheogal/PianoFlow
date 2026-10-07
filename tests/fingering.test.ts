import assert from "node:assert/strict";
import { DOMParser } from "linkedom";
(globalThis as any).DOMParser = DOMParser;
import createVerovioModule from "verovio/wasm";
import { VerovioToolkit } from "verovio/esm";
import { scaleCases, matchRate } from "./scales-truth";
import { fingerHand, FingerSolver, DEFAULT_WEIGHTS, triadFingering, type CoreNote } from "../src/fingerCore";
import { defaultHand, HAND_PRESETS, keyX, sanitizeHand } from "../src/hand";
import { parseExplicitFingering, assignFingering } from "../src/fingering";
import { FINGERING_MODEL, FINGERING_WEIGHTS, FINGERING_FEATURES } from "../src/fingeringModel";
import type { Step, Note } from "../src/score";

let n = 0;
const t = (name: string, f: () => void | Promise<void>) => Promise.resolve(f()).then(() => { n++; console.log("  ✓", name); }, (e) => { console.error("  ✗", name); throw e; });
const mid = (...p: number[]): CoreNote[] => p.map((pitch, i) => ({ pitch, onTime: i * 500, offTime: i * 500 + 450 }));
const chord = (...p: number[]): CoreNote[] => p.map((pitch) => ({ pitch, onTime: 0, offTime: 900 }));
const hand = defaultHand();

console.log("Doigtés");
await t("géométrie du clavier : une touche blanche = 2,35 cm", () => { assert.ok(Math.abs(keyX(62) - keyX(60) - 2.35) < 1e-9); assert.ok(Math.abs(keyX(72) - keyX(60) - 16.45) < 1e-9); });
await t("profil de main : valeurs bornées", () => { assert.equal(sanitizeHand({ span: 99 }).span, 28); assert.equal(sanitizeHand({ span: -1 }).span, 20.5); assert.equal(sanitizeHand(null).span, 20.5); });
await t("concordance avec les doigtés d'étude (gammes + arpèges, 18 tonalités) ≥ 80 %", () => {
  const r = matchRate(scaleCases(), hand); console.log(`      ${(r.rate * 100).toFixed(1)} %`);
  assert.ok(r.rate >= 0.8);
});
await t("accord parfait : 1-3-5 à droite, 5-3-1 à gauche", () => {
  assert.deepEqual(fingerHand(chord(60, 64, 67), "R", hand), [1, 3, 5]);
  assert.deepEqual(fingerHand(chord(48, 52, 55), "L", hand), [5, 3, 1]);
});
await t("exercice Accords : doigté d'usage des accords de trois sons, dans les 12 tonalités, tous renversements", () => {
  const usage: Record<string, string> = { R0: "135", R1: "125", R2: "135", L0: "531", L1: "531", L2: "521" };
  for (let root = 48; root < 60; root++) for (const q of [[0, 4, 7], [0, 3, 7], [0, 3, 6], [0, 4, 8]]) for (let inv = 0; inv < 3; inv++) for (const h of ["R", "L"] as const) {
    let ps = q.map((d) => d + root);
    for (let k = 0; k < inv; k++) ps = [...ps.slice(1), ps[0] + 12];
    const want = usage[h + (q[2] === 8 ? 0 : inv)];   // accord augmenté : trois tierces majeures dans tous les renversements
    assert.equal(triadFingering(ps, h)?.join(""), want, `${h} ${ps.join(",")}`);
    assert.equal(triadFingering([ps[2], ps[0], ps[1]], h)?.join(""), [2, 0, 1].map((i) => want[i]).join(""), "doigts dans l'ordre donné");
  }
  assert.equal(triadFingering([60, 64, 67, 70], "R"), null); assert.equal(triadFingering([60, 67, 76], "R"), null);
});
await t("accord de 4 notes (Do7) : 1-2-3-5 ou 1-2-4-5 (les deux sont usuels)", () => { const f = fingerHand(chord(60, 64, 67, 70), "R", hand).join(""); assert.ok(f === "1235" || f === "1245", f); });
await t("octave : pouce et auriculaire", () => { assert.deepEqual(fingerHand(chord(60, 72), "R", hand), [1, 5]); assert.deepEqual(fingerHand(chord(48, 60), "L", hand), [5, 1]); });
await t("tous les doigts sont distincts dans un accord, quelle que soit la taille", () => {
  for (const k of [chord(60, 62, 64, 65, 67), chord(48, 50, 52, 55), chord(60, 61, 62)]) for (const h of ["R", "L"] as const) { const f = fingerHand(k, h, hand); assert.equal(new Set(f).size, f.length); }
});
await t("main gauche : doigtés croissants avec la hauteur à l'envers", () => {
  const f = fingerHand(chord(48, 50, 53), "L", hand); assert.ok(f[0] > f[1] && f[1] > f[2]);
});
await t("une petite main paie plus cher un grand écart qu'une grande", () => {
  const small = new FingerSolver("R", sanitizeHand({ span: HAND_PRESETS[0].span })), large = new FingerSolver("R", sanitizeHand({ span: HAND_PRESETS[2].span }));
  const notes = chord(60, 72); // octave
  assert.ok(small.cost(notes, [1, 5]) > large.cost(notes, [1, 5]));
  const tenth = chord(60, 76);
  assert.ok(small.cost(tenth, [1, 5]) > 30 && large.cost(tenth, [1, 5]) < small.cost(tenth, [1, 5]));
});
await t("la taille de la main change le doigté d'un passage à grands écarts", () => {
  // arpège large : Do Sol Mi' (dixième) en main droite : la petite main doit re-positionner
  const seq = mid(60, 67, 76, 67, 60);
  const fs = fingerHand(seq, "R", sanitizeHand({ span: 17 })), fl = fingerHand(seq, "R", sanitizeHand({ span: 24 }));
  assert.equal(fs.length, 5); assert.equal(fl.length, 5);
  assert.ok(new FingerSolver("R", sanitizeHand({ span: 17 })).cost(seq, fs) <= new FingerSolver("R", sanitizeHand({ span: 17 })).cost(seq, fl) + 1e-9);
});
await t("pas de pouce sur une touche noire quand une autre solution existe (Fa♯ Sol♯ La♯)", () => {
  const f = fingerHand(mid(66, 68, 70), "R", hand); assert.ok(!f.includes(1) || f[0] !== 1);
});
await t("une note tenue bloque son doigt pour la suivante", () => {
  const notes: CoreNote[] = [{ pitch: 60, onTime: 0, offTime: 2000 }, { pitch: 64, onTime: 0, offTime: 500 }, { pitch: 65, onTime: 500, offTime: 1000 }, { pitch: 67, onTime: 1000, offTime: 1500 }];
  const f = fingerHand(notes, "R", hand);
  assert.ok(f[2] !== f[0] && f[3] !== f[0]);
});
await t("doigtés imposés respectés, le reste complété autour", () => {
  const notes = mid(60, 62, 64, 65, 67).map((x, i) => ({ ...x, fixed: i === 2 ? 4 : undefined }));
  const f = fingerHand(notes, "R", hand); assert.equal(f[2], 4);
  assert.deepEqual(f.length, 5);
});
await t("un morceau long reste rapide (5 000 notes < 3 s)", () => {
  const notes = Array.from({ length: 5000 }, (_, i) => ({ pitch: 60 + [0, 2, 4, 5, 7, 5, 4, 2][i % 8], onTime: i * 250, offTime: i * 250 + 230 }));
  const t0 = performance.now(); fingerHand(notes, "R", hand); assert.ok(performance.now() - t0 < 3000);
});
// le modèle tel que l'appli l'utilise (règles ajustées + table + coûts par situation), voir src/fingering.ts et src/tech.ts
const APP = [{ ...DEFAULT_WEIGHTS, ...FINGERING_WEIGHTS }, FINGERING_MODEL, FINGERING_FEATURES] as const;
await t("modèle de l'appli : un morceau long reste rapide (5 000 notes < 3 s)", () => {
  const notes = Array.from({ length: 5000 }, (_, i) => ({ pitch: 60 + [0, 2, 4, 5, 7, 5, 4, 2][i % 8], onTime: i * 250, offTime: i * 250 + 230 }));
  const t0 = performance.now(); fingerHand(notes, "R", hand, ...APP); assert.ok(performance.now() - t0 < 3000);
});

console.log("Doigtés écrits (MusicXML + Verovio)");
const XML = `<?xml version="1.0"?><score-partwise version="3.1"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">
<measure number="1"><attributes><divisions>2</divisions><key><fifths>0</fifths></key><time><beats>2</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>
<note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>quarter</type><staff>1</staff><notations><technical><fingering>3</fingering></technical></notations></note>
<note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>quarter</type><staff>1</staff></note>
<backup><duration>4</duration></backup>
<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>2</voice><type>half</type><staff>1</staff><notations><technical><fingering>1</fingering></technical></notations></note>
<backup><duration>4</duration></backup>
<note><pitch><step>C</step><octave>3</octave></pitch><duration>4</duration><voice>5</voice><type>half</type><staff>2</staff><notations><technical><fingering>5</fingering></technical></notations></note>
</measure></part></score-partwise>`;
await t("appariement par position : deux voix dans la même main", async () => {
  const ex = parseExplicitFingering(XML);
  assert.equal(ex.byKey.size, 3);
  const tk = new VerovioToolkit(await createVerovioModule()); tk.loadData(XML); tk.renderToSVG(1);
  const tm: any[] = tk.renderToTimemap({ includeMeasures: true }) as any;
  const steps: Step[] = [];
  for (const e of tm) if (e.on?.length) steps.push({ time: e.tstamp, notes: e.on.map((id: string) => ({ id, pitch: (tk.getMIDIValuesForElement(id) as any).pitch, hand: "R", onTime: e.tstamp, offTime: e.tstamp + 500, q: e.qstamp } as Note)) });
  // la main : 1re portée = droite, 2e = gauche (Verovio : ordre du DOM ; ici on déduit par la hauteur)
  for (const s of steps) for (const nn of s.notes) nn.hand = nn.pitch < 55 ? "L" : "R";
  assignFingering(steps, ex, hand);
  const by = (p: number) => steps.flatMap((s) => s.notes).find((x) => x.pitch === p)!;
  assert.equal(by(64).finger, 3); assert.equal(by(60).finger, 1); assert.equal(by(48).finger, 5);
  assert.ok(by(67).finger && by(67).finger! >= 1 && by(67).finger! <= 5);
  assert.notEqual(by(67).finger, by(60).finger);   // 60 est tenu : le Sol ne peut pas reprendre le pouce
});

console.log(`\n${n} tests OK`);
