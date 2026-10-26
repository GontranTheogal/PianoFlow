/** Piano acoustique au micro : FFT, reconnaissance des notes (piano de synthèse réaliste), calibrage d'un piano désaccordé, stockage. */
import assert from "node:assert/strict";
const mem = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, String(v)), removeItem: (k: string) => void mem.delete(k), get length() { return mem.size; }, key: (i: number) => [...mem.keys()][i] ?? null };
import { Spectrum } from "../src/mic/fft";
import { NoteDetector, WINDOW_S } from "../src/mic/detector";
import { analyzeTake, combineTakes, expectFor, fitStiffString } from "../src/mic/calibrate";
import { A0, genericModel, nominalHz, partialHz } from "../src/mic/model";
import * as P from "../src/mic/pianos";
import { mergeKey } from "../src/progressMerge";
import { SynthPiano, roomNoise, mulberry32 } from "./synth-piano";

let n = 0;
const t = async (name: string, f: () => void | Promise<void>) => { try { await f(); } catch (e) { console.error("  ✗", name); throw e; } n++; console.log("  ✓", name); };
const sr = 48000, generic = Array.from({ length: 88 }, (_, k) => genericModel(A0 + k)), piano = new SynthPiano(3);
type Ev = { pitch: number; on: boolean; at: number };
/** Fait écouter `audio` au détecteur, par blocs de 512 échantillons comme le micro ; `at` = instant estimé de la frappe (s). */
function listen(audio: Float32Array, det: NoteDetector, hint?: (t: number) => number[]): Ev[] {
  const out: Ev[] = [];
  for (let i = 0; i < audio.length; i += 512) {
    if (hint) det.setHint(hint(i / sr));
    for (const e of det.push(audio.subarray(i, i + 512))) out.push({ pitch: e.pitch, on: e.on, at: Math.min(audio.length, i + 512) / sr - (e.lag - det.inputLag) / 1000 });
  }
  return out;
}
const ons = (evs: Ev[]) => evs.filter((e) => e.on);
function scene(notes: [number, number, number, number?][], dur: number, p = piano) {
  const a = new Float32Array(Math.round(sr * dur)); roomNoise(a, -66, 7);
  for (const [m, t0, t1, db] of notes) p.strike(a, m, t0, t1, db ?? -26);
  return a;
}

console.log("Signal");
await t("FFT réelle : mêmes amplitudes qu'une transformée directe", () => {
  const r = mulberry32(1), x = Array.from({ length: 64 }, () => r() * 2 - 1), N = 128, out = new Float32Array(N / 2 + 1);
  new Spectrum(N).magnitudes((i) => x[i], 64, out);
  for (const k of [0, 1, 7, 33, 64]) {
    let re = 0, im = 0;
    for (let i = 0; i < 64; i++) { const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i + 0.5)) / 64), a = (-2 * Math.PI * k * i) / N; re += x[i] * w * Math.cos(a); im += x[i] * w * Math.sin(a); }
    assert.ok(Math.abs(Math.hypot(re, im) - out[k]) < 1e-6, `raie ${k}`);
  }
});
await t("corde raide : f0 et inharmonicité retrouvés depuis les partiels", () => {
  const pts = [1, 2, 3, 5, 8, 13].map((j) => ({ j, f: partialHz(261.63, 3e-4, j) }));
  const fit = fitStiffString(pts)!;
  assert.ok(Math.abs(fit.f0 - 261.63) < 1e-6 && Math.abs(fit.B - 3e-4) < 1e-9);
});

console.log("Reconnaissance (piano bien accordé, modèle moyen)");
await t("notes seules, de La0 à Do8, jouées fort ou doucement : la bonne note, rien d'autre", () => {
  for (let m = 21; m <= 108; m += 5) for (const db of [-20, -42]) {
    const got = ons(listen(scene([[m, 0.45, 1.0, db]], 1.3), new NoteDetector(sr, generic))).map((e) => e.pitch);
    assert.deepEqual(got, [m], `touche ${m} à ${db} dB`);
  }
});
await t("accords, mélodie liée, notes répétées : chaque note une fois, au bon instant (±25 ms)", () => {
  const C = (ms: number[], t0: number): [number, number, number][] => ms.map((m) => [m, t0, t0 + 0.8]);
  const mel = [60, 62, 64, 65, 67, 69, 71, 72].map((m, i) => [m, 3.2 + i * 0.25, 3.5 + i * 0.25] as [number, number, number]);
  const rep = [0, 1, 2, 3].map((i) => [76, 5.6 + i / 3, 5.8 + i / 3] as [number, number, number]);
  const notes = [...C([60, 64, 67], 0.5), ...C([53, 57, 60], 1.6), ...mel, ...rep];
  const evs = ons(listen(scene(notes, 7.2), new NoteDetector(sr, generic)));
  assert.equal(evs.length, notes.length, evs.map((e) => e.pitch).join(" "));
  for (const [m, t0] of notes) assert.ok(evs.some((e) => e.pitch === m && Math.abs(e.at - t0) < 0.025), `note ${m} à ${t0} s`);
});
await t("une basse tenue ne revient pas, et ne cache pas la mélodie jouée par-dessus", () => {
  const notes: [number, number, number, number][] = [[36, 0.5, 3, -24], [64, 0.5, 0.9, -28], [65, 1, 1.4, -28], [67, 1.5, 1.9, -28], [72, 2, 2.4, -28]];
  assert.deepEqual(ons(listen(scene(notes, 3.4), new NoteDetector(sr, generic))).map((e) => e.pitch), [36, 64, 65, 67, 72]);
});
await t("les notes attendues (partition) passent même en octave ; une fausse note s'entend quand même", () => {
  const notes: [number, number, number][] = [[60, 0.5, 1.2], [72, 0.5, 1.2], [48, 1.6, 2.3], [60, 1.6, 2.3], [65, 2.6, 3.0]];
  const expected = [[0.5, [60, 72]], [1.6, [48, 60]], [2.6, [64]]] as const;
  const hint = (tt: number) => [...(expected.find(([t0]) => Math.abs(t0 - tt) < 0.4)?.[1] ?? [])];
  assert.deepEqual(ons(listen(scene(notes, 3.4), new NoteDetector(sr, generic), hint)).map((e) => e.pitch), [60, 72, 48, 60, 65]);
});
await t("le son de l'appli (écho des haut-parleurs) n'est pas pris pour le pianiste", () => {
  const det = new NoteDetector(sr, generic);
  det.addEcho(67, 1.0, 2.0);
  assert.deepEqual(ons(listen(scene([[60, 0.5, 0.9], [67, 1.2, 1.6], [64, 2.2, 2.6]], 3), det)).map((e) => e.pitch), [60, 64]);
});
await t("bruit, claquements et voix qui parle : aucune note", () => {
  const a = new Float32Array(sr * 8), r = mulberry32(5);
  roomNoise(a, -60, 1);
  for (let tt = 0.5; tt < 2.5; tt += 0.7) { const s0 = Math.round(tt * sr); for (let i = 0; i < sr * 0.03; i++) a[s0 + i] += (r() * 2 - 1) * 0.2 * Math.exp(-i / (0.005 * sr)); }
  let ph = 0, y1 = 0, y2 = 0, z1 = 0, z2 = 0;               // voix : impulsions glottiques filtrées par deux formants, syllabes
  for (let i = 3 * sr; i < 8 * sr; i++) {
    const tt = i / sr, f0 = 130 + 50 * Math.sin(tt * 2.1) + 20 * Math.sin(tt * 7.3), syll = Math.max(0, Math.sin(tt * Math.PI * 3.2));
    ph += f0 / sr; let g = 0; if (ph >= 1) { ph -= 1; g = 1; }
    const rr = 0.97, c1 = 2 * rr * Math.cos((2 * Math.PI * (500 + 200 * Math.sin(tt * 5))) / sr), c2 = 2 * rr * Math.cos((2 * Math.PI * (1500 + 400 * Math.sin(tt * 3.3))) / sr);
    const y = g + c1 * y1 - rr * rr * y2; y2 = y1; y1 = y; const z = y + c2 * z1 - rr * rr * z2; z2 = z1; z1 = z;
    a[i] += z * 0.004 * syll;
  }
  assert.deepEqual(ons(listen(a, new NoteDetector(sr, generic))).map((e) => e.pitch), []);
});

console.log("Piano désaccordé : calibrage");
const off = new Map<number, number>(), rr = mulberry32(11);
for (let m = 21; m <= 108; m++) off.set(m, -40 + 28 * Math.sin(m / 9) + (rr() - 0.5) * 20);    // de −80 à 0 cents selon les zones
const bad = new SynthPiano(8, (m) => off.get(m)!);
const prof = P.newPiano("Piano du salon", 36, 60, 3);
await t("trois frappes par touche : fréquence réelle à 2 cents près, inharmonicité à 30 % près", () => {
  for (let m = prof.lo; m <= prof.hi; m++) {
    const a = new Float32Array(Math.round(sr * 3.2)); roomNoise(a, -66, m);
    [-24, -28, -21].forEach((db, i) => bad.strike(a, m, 0.4 + i, 1.1 + i, db, m * 10 + i));
    const det = new NoteDetector(sr, generic), takes: { samples: Float32Array }[] = [];
    det.detect = false; det.capture = (tk) => takes.push(tk);
    listen(a, det);
    const ex = expectFor(m, P.centsMap(prof));
    const c = combineTakes(takes.map((tk) => analyzeTake(tk.samples, sr, m, { ...ex, window: WINDOW_S, noiseDb: -66 })), 3);
    assert.ok(c.done, `touche ${m}`);
    P.setKey(prof, m, c.done!);
    const k = bad.keys.get(m)!;
    assert.ok(Math.abs(1200 * Math.log2(c.done!.f0 / k.f0)) < 2, `f0 ${m}`);
    assert.ok(Math.abs(c.done!.B / k.B - 1) < 0.3, `B ${m}`);
  }
});
await t("reconnu tel qu'il sonne une fois calibré (le modèle moyen se trompe)", () => {
  const notes = [36, 40, 43, 47, 50, 53, 57, 60].map((m, i) => [m, 0.5 + i * 0.6, 0.9 + i * 0.6] as [number, number, number]);
  const a = scene(notes, 5.6, bad), want = notes.map(([m]) => m);
  const cal = new NoteDetector(sr, P.modelsFor(prof)); cal.setModels(P.modelsFor(prof), P.isCalibrated(prof));
  assert.deepEqual(ons(listen(a, cal)).map((e) => e.pitch), want);
  assert.notDeepEqual(ons(listen(a, new NoteDetector(sr, generic))).map((e) => e.pitch), want);
});
await t("une frappe sur la mauvaise touche est signalée, avec la touche entendue (même sur un piano désaccordé)", () => {
  const a = new Float32Array(sr); roomNoise(a, -66, 3); bad.strike(a, 52, 0.1, 0.8, -24);
  const s0 = Math.round(0.1 * sr) - 384, res = analyzeTake(a.subarray(s0, s0 + Math.round(0.6 * sr)), sr, 50, { ...expectFor(50, P.centsMap(prof)), window: WINDOW_S });
  assert.equal(res.ok, false); assert.equal(res.reason, "off"); assert.equal(res.heard, 52);            // la touche jouée, sur l'accord de ce piano
});
await t("l'octave du dessus ou du dessous à la place de la touche demandée : signalée aussi", () => {
  for (const [want, play] of [[50, 62], [60, 72], [55, 43], [62, 50]]) {
    const a = new Float32Array(sr); roomNoise(a, -66, 3); piano.strike(a, play, 0.1, 0.8, -24);
    const s0 = Math.round(0.1 * sr) - 384, res = analyzeTake(a.subarray(s0, s0 + Math.round(0.6 * sr)), sr, want, { expect: 0, search: 60, window: WINDOW_S });
    assert.deepEqual([res.ok, res.reason, res.heard], [false, "off", play], `demandé ${want}, joué ${play}`);
  }
});
await t("frappes qui ne concordent pas : la touche n'est pas réglée, les bonnes sont gardées", () => {
  const ok = (cents: number) => ({ ok: true, f0: nominalHz(60, cents), cents, B: 3e-4, amps: [1, 0.5], level: -25 });
  const c = combineTakes([ok(-30), ok(-31), ok(+40)], 3);
  assert.equal(c.done, null); assert.equal(c.keep.length, 2);
  assert.ok(combineTakes([...c.keep, ok(-29)], 3).done);
});

console.log("Pianos gardés dans le navigateur");
await t("enregistrés, relus, choisis, supprimés", () => {
  P.savePiano(prof); P.setActivePiano(prof.id);
  const back = P.getPiano(prof.id)!;
  assert.equal(back.name, "Piano du salon"); assert.equal(Object.keys(back.keys).length, 25);
  assert.ok(Math.abs(back.keys[48].f0 - prof.keys[48].f0) < 0.01);
  assert.deepEqual(P.keysToDo(back), []);
  assert.equal(P.activePianoId(), prof.id);
  P.deletePiano(prof.id);
  assert.equal(P.activePianoId(), ""); assert.equal(P.listPianos().length, 0);
});
await t("touches non calibrées : décalées comme leurs voisines (un piano désaccordé l'est par zones)", () => {
  const p = P.newPiano("t", 21, 108, 3);
  P.setKey(p, 60, { f0: nominalHz(60, -50), B: 3e-4, amps: [1, 0.5], level: -25 });
  P.setKey(p, 64, { f0: nominalHz(64, -30), B: 3e-4, amps: [1, 0.5], level: -25 });
  const ms = P.modelsFor(p);
  assert.ok(Math.abs(1200 * Math.log2(ms[62 - A0].f0 / nominalHz(62)) + 40) < 0.5, "Ré4 entre les deux");
  assert.ok(Math.abs(1200 * Math.log2(ms[30 - A0].f0 / nominalHz(30)) + 50) < 0.5, "grave : comme la plus proche");
});
await t("stockage abîmé ou sauvegarde trafiquée : ignorés sans planter", () => {
  mem.set("pianoflow-pianos", JSON.stringify({ a: null, b: { name: 3 }, c: { name: "ok", lo: 40, hi: 30 }, d: { name: "x", lo: 21, hi: 108, keys: { 60: { f0: "x" }, 61: { f0: 277, B: 2e-4, amps: [0, -6] } } } }));
  const list = P.listPianos();
  assert.deepEqual(list.map((p) => p.id), ["d"]); assert.deepEqual(Object.keys(list[0].keys), ["61"]);
  mem.set("pianoflow-pianos", "{pas du json"); assert.deepEqual(P.listPianos(), []);
});
await t("import d'une sauvegarde : chaque piano garde sa version la plus récente, sans mélange", () => {
  const a = { name: "salon", updatedAt: 10, keys: { 60: { f0: 260 } } }, b = { name: "salon", updatedAt: 20, keys: { 62: { f0: 292 } } };
  assert.deepEqual(mergeKey("pianoflow-pianos", { p1: a }, { p1: b, p2: a }), { p1: b, p2: a });
  assert.deepEqual(mergeKey("pianoflow-pianos", { p1: b }, { p1: a }), { p1: b });
});

console.log(`\n${n} tests micro OK`);
