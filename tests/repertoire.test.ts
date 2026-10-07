import assert from "node:assert/strict";
import { DOMParser } from "linkedom";
(globalThis as any).DOMParser = DOMParser;
import createVerovioModule from "verovio/wasm";
import { VerovioToolkit } from "verovio/esm";
import { REPERTOIRE, repXml } from "../src/repertoire";
import { parseExplicitFingering } from "../src/fingering";
import { tieEnds } from "../src/score";
import { xmlDifficulty } from "../src/difficultyXml";

let n = 0;
const t = async (name: string, f: () => void | Promise<void>) => { try { await f(); } catch (e) { console.error("  ✗", name); throw e; } n++; console.log("  ✓", name); };
const tk = new VerovioToolkit(await createVerovioModule());
console.log("Répertoire");
await t("identifiants uniques, niveaux 1 à 3 présents", () => {
  assert.equal(new Set(REPERTOIRE.map((p) => p.id)).size, REPERTOIRE.length);
  for (const lv of [1, 2, 3]) assert.ok(REPERTOIRE.some((p) => p.level === lv));
});
const rated = new Map<string, number>();
for (const p of REPERTOIRE) {
  await t(`${p.title} : mesures complètes, Verovio, liaisons reliées, doigtés écrits sur chaque note des deux mains`, () => {
    const xml = repXml(p);
    tk.resetOptions(); tk.loadData(xml); tk.renderToSVG(1);
    const tm: any[] = tk.renderToTimemap({ includeMeasures: true }) as any;
    // toutes les liaisons de prolongation sont reliées par Verovio (sinon la note liée serait à rejouer)
    const open = tk.getMEI({}).match(/<tie (?![^>]*endid)[^>]*>/g) ?? [];
    assert.equal(open.length, 0, `${open.length} liaison(s) non reliée(s)`);
    const ties = tieEnds(tk);
    const ids = tm.flatMap((e) => e.on ?? []).filter((id: string) => !ties.has(id));
    assert.ok(ids.length >= 15, `${ids.length} notes`);
    for (const id of ids) { const v: any = tk.getMIDIValuesForElement(id); assert.ok(v.pitch >= 21 && v.pitch <= 108); }
    const ex = parseExplicitFingering(xml);
    const missing = ex.notes.filter((x) => !x.finger);
    assert.equal(missing.length, 0, `${missing.length} notes sans doigté`);
    // l'appli (attaques de Verovio, liaisons retirées) et la lecture des doigtés voient les mêmes notes
    assert.equal(ids.length, ex.notes.length, `attaques Verovio ${ids.length} ≠ notes lues ${ex.notes.length}`);
    // main droite au-dessus de Do3, main gauche en dessous de Mi5 (pas de main « à l'envers »)
    assert.ok(ex.notes.filter((x) => x.hand === "R").every((x) => x.pitch >= 48), "main droite trop grave");
    if (!p.crossing) assert.ok(ex.notes.filter((x) => x.hand === "L").every((x) => x.pitch <= 76), "main gauche trop aiguë");
    // liaisons d'expression : dans chaque voix, un début puis une fin, jamais deux débuts de suite
    const open2 = new Map<string, boolean>();
    for (const m of xml.matchAll(/<slur type="(start|stop)" number="(\d+)"/g)) {
      assert.ok(m[1] === "start" ? !open2.get(m[2]) : open2.get(m[2]), `liaison ${m[1]} déséquilibrée (voix ${m[2]})`);
      open2.set(m[2], m[1] === "start");
    }
    if (p.level > 0) rated.set(p.id, xmlDifficulty(xml).score);
    // dans un accord, des doigts différents
    const byTime = new Map<string, number[]>();
    for (const x of ex.notes) { const k = `${x.hand}|${x.q}`; byTime.set(k, [...(byTime.get(k) ?? []), x.finger!]); }
    for (const [k, f] of byTime) assert.equal(new Set(f).size, f.length, "doigt répété dans un accord " + k);
  });
}
await t("la difficulté calculée suit les niveaux du répertoire", () => {
  const avg = (lv: number) => { const v = REPERTOIRE.filter((p) => p.level === lv).map((p) => rated.get(p.id)!); return v.reduce((a, b) => a + b, 0) / v.length; };
  assert.ok(avg(1) < avg(2) && avg(2) < avg(3), `moyennes ${avg(1)}, ${avg(2)}, ${avg(3)}`);
  for (const p of REPERTOIRE.filter((x) => x.level === 1)) assert.ok(rated.get(p.id)! < 48, `${p.title} trop difficile pour le niveau 1`);
  for (const p of REPERTOIRE.filter((x) => x.level === 3)) assert.ok(rated.get(p.id)! >= 32, `${p.title} trop facile pour le niveau 3`);
});
console.log(`\n${n} tests OK`);
