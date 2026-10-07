// Entraîne le modèle de doigté sur des partitions doigtées (MusicXML / MXL avec <fingering>, ou fichiers texte PIG).
//   npm run train:fingering -- dossier [dossier…]            évalue seulement (rien n'est modifié)
//   npm run train:fingering -- dossier [dossier…] --write    écrit src/fingeringModel.ts si le résultat s'améliore sur les morceaux mis de côté
//   npm run train:fingering -- --selftest                    vérifie la chaîne sur les gammes/arpèges intégrés
// Options : --span 20.5 (envergure de référence en cm)  --epochs 4  --lr 0.03 (perceptron)  --tune (ajuste aussi les poids des
//           règles, plus lent)  --force (écrit même sans amélioration)
// Un morceau sur cinq est mis de côté (choisi d'après le nom du fichier) : la concordance affichée est mesurée sur des morceaux
// jamais vus à l'entraînement. Les fichiers en double (mêmes notes, mêmes doigts) ne comptent qu'une fois : sinon un même morceau
// pourrait se retrouver des deux côtés et la mesure serait trop flatteuse.
import fs from "node:fs";
import path from "node:path";
import { DOMParser } from "linkedom";
import { unzipSync, strFromU8 } from "fflate";
(globalThis as any).DOMParser = DOMParser;
import { samplesFromMusicXml, samplesFromPig, learnTable, evaluate } from "../src/fingerCorpus";
import { DEFAULT_WEIGHTS, type Weights } from "../src/fingerCore";
import { tuneWeights, trainFeatures, type Sample } from "../src/fingerTune";
import { sanitizeHand } from "../src/hand";
import { FINGERING_MODEL, FINGERING_WEIGHTS, FINGERING_FEATURES } from "../src/fingeringModel";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const VALUED = ["--span", "--epochs", "--lr"];
const opt = (n: string, d: string) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const dirs = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && VALUED.includes(args[i - 1])));
const profile = sanitizeHand({ span: parseFloat(opt("--span", "20.5")) });

function* walk(d: string): Generator<string> {
  for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(d, e.name); if (e.isDirectory()) yield* walk(p); else yield p;
  }
}
function mxlToXml(buf: Uint8Array): string {
  const files = unzipSync(buf);
  const c = files["META-INF/container.xml"];
  let root = c ? /full-path="([^"]+)"/.exec(strFromU8(c))?.[1] : undefined;
  if (!root || !files[root]) root = Object.keys(files).find((k) => /\.(xml|musicxml)$/i.test(k) && !k.startsWith("META-INF"));
  return root ? strFromU8(files[root]) : "";
}
const bucket = (name: string) => [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 5;   // 1 morceau sur 5 mis de côté pour juger honnêtement
/** Empreinte d'un fichier lu (hauteurs, attaques, doigts) pour repérer les doublons. */
const print = (s: Sample[]) => {
  let h = 2166136261;
  for (const x of s) for (let i = 0; i < x.notes.length; i++) for (const v of [x.notes[i].pitch, Math.round(x.notes[i].onTime), x.truth[i]]) h = Math.imul(h ^ v, 16777619) >>> 0;
  return h;
};

const train: Sample[] = [], test: Sample[] = [], testBy = new Map<string, Sample[]>();
let files = 0, skipped = 0, dupes = 0;
if (flag("--selftest")) {
  const { scaleCases } = await import("../tests/scales-truth");
  scaleCases().forEach((c, i) => ((i % 5 === 0 ? test : train).push({ hand: c.hand, notes: c.notes, truth: c.truth })));
  files = 120;
} else {
  if (!dirs.length || dirs.some((d) => !fs.existsSync(d))) { console.error("Indique le ou les dossiers des partitions doigtées.\n  npm run train:fingering -- dossier [dossier…] [--write]\n  (ou --selftest)"); process.exit(1); }
  const seen = new Set<number>();
  for (const dir of dirs) for (const f of walk(dir)) {
    const ext = path.extname(f).toLowerCase();
    try {
      let s: Sample[] = [];
      if (ext === ".mxl") s = samplesFromMusicXml(mxlToXml(fs.readFileSync(f)));
      else if (ext === ".xml" || ext === ".musicxml") s = samplesFromMusicXml(fs.readFileSync(f, "utf8"));
      else if (ext === ".txt") s = samplesFromPig(fs.readFileSync(f, "utf8"));
      else continue;
      files++;
      if (!s.length) { skipped++; continue; }
      const fp = print(s); if (seen.has(fp)) { dupes++; continue; } seen.add(fp);
      if (bucket(path.basename(f)) === 0) {
        test.push(...s);
        const label = path.basename(path.resolve(dir));
        testBy.set(label, [...(testBy.get(label) ?? []), ...s]);
      } else train.push(...s);
    } catch (e) { skipped++; console.warn("  ignoré :", f, String((e as Error).message).slice(0, 80)); }
  }
}
const count = (a: Sample[]) => a.reduce((n, s) => n + s.truth.filter(Boolean).length, 0);
console.log(`\nCorpus : ${files} fichiers lus${skipped ? `, ${skipped} sans doigtés exploitables` : ""}${dupes ? `, ${dupes} doublons ignorés` : ""} · ` +
  `entraînement ${count(train)} notes doigtées · mis de côté ${count(test)} notes doigtées`);
if (count(train) < 200 || count(test) < 50) { console.error("Trop peu de notes doigtées pour entraîner quelque chose de fiable (il en faut plusieurs milliers)."); process.exit(2); }

const pct = (x: number) => (x * 100).toFixed(1) + " %";
const show = (label: string, w: Weights, table?: any, feat?: any) => {
  const r = evaluate(test, profile, w, table, feat);
  const parts = testBy.size > 1 ? " · " + [...testBy].map(([k, s]) => `${k} ${pct(evaluate(s, profile, w, table, feat).rate)}`).join(" · ") : "";
  console.log(`  ${label.padEnd(40)} ${pct(r.rate)}   (D ${pct(r.R)} · G ${pct(r.L)}${parts})`);
  return r;
};
console.log(`\nConcordance avec les doigtés de référence, sur les morceaux mis de côté (main de ${profile.span} cm) :`);
const before = show("modèle actuel de l'appli", { ...DEFAULT_WEIGHTS, ...FINGERING_WEIGHTS } as Weights, FINGERING_MODEL, FINGERING_FEATURES);
show("règles seules, sans modèle appris", DEFAULT_WEIGHTS);

// 1. table de coûts (fréquences des enchaînements de doigts) ; 2. poids des règles (facultatif) ; 3. coûts par situation (perceptron)
const table = learnTable(train);
let weights: Weights = { ...DEFAULT_WEIGHTS };
if (flag("--tune")) {
  const tuneSet: Sample[] = []; let budget = 25000;
  for (const s of train) { if (budget <= 0) break; tuneSet.push(s); budget -= s.notes.length; }
  console.log(`\nAjustement des poids des règles sur ${tuneSet.reduce((n, s) => n + s.notes.length, 0)} notes…`);
  weights = tuneWeights(tuneSet, profile, DEFAULT_WEIGHTS, table, 3, console.log);
}
const epochs = parseInt(opt("--epochs", "4"), 10), lr = parseFloat(opt("--lr", "0.03"));
console.log(`\nApprentissage des coûts par situation (perceptron structuré, ${epochs} passes, pas ${lr})…`);
const feat = trainFeatures(train, profile, weights, table, { epochs, lr, window: 32, minAbs: 0.02, log: console.log });
console.log(`  ${Object.keys(feat).length} situations retenues`);
console.log("");
const after = show("modèle réentraîné", weights, table, feat);
console.log(`\n  ${after.rate >= before.rate ? "Amélioration" : "Régression"} : ${((after.rate - before.rate) * 100).toFixed(1)} points`);

if (flag("--write")) {
  if (after.rate < before.rate && !flag("--force")) { console.log("Rien n'est écrit (le résultat est moins bon que l'actuel). --force pour écrire quand même."); process.exit(0); }
  const changed = Object.fromEntries(Object.entries(weights).filter(([k, v]) => v !== (DEFAULT_WEIGHTS as any)[k]));
  const out = `// Modèle de doigté appris à partir de partitions doigtées réelles. Généré par scripts/train-fingering.ts, voir TRAINING.md.
// Ne pas modifier à la main.
// Entraînement : ${count(train)} notes doigtées (${files - skipped - dupes} fichiers utilisables, dont un sur cinq mis de côté) ; concordance sur les
// ${count(test)} notes doigtées mises de côté : ${pct(after.rate)} (varie selon les morceaux tirés ; validation croisée dans TRAINING.md).

/** Table de coûts : écart en demi-tons -> doigt de départ -> doigt d'arrivée -> coût (−log probabilité). */
export const FINGERING_MODEL: Record<'R'|'L', Record<string, Record<string, Record<string, number>>>> = ${JSON.stringify(table)};

/** Poids des règles biomécaniques qui diffèrent des valeurs par défaut de fingerCore.ts. */
export const FINGERING_WEIGHTS: Record<string, number> = ${JSON.stringify(changed)};

/** Coûts par situation appris par perceptron structuré (clés décrites dans fingerCore.ts, type FeatureWeights). */
export const FINGERING_FEATURES: Record<string, number> = ${JSON.stringify(feat)};
`;
  fs.writeFileSync(path.resolve(path.dirname(new URL(import.meta.url).pathname), "../src/fingeringModel.ts"), out);
  console.log("\nsrc/fingeringModel.ts mis à jour. Relance « npm test » et « npm run build », puis commit.");
}
