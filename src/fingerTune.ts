/** Entraînement du modèle de doigté (utilisé par scripts/train-fingering.ts et les tests). Aucun accès au DOM.
 *  - tuneWeights : ajuste les poids des règles par descente de coordonnées ;
 *  - trainFeatures : apprend des coûts par situation (perceptron structuré moyenné), en tolérant les annotations partielles. */
import { fingerHand, FingerSolver, DEFAULT_WEIGHTS, type CoreNote, type Weights, type LearnedTable, type FeatureWeights } from "./fingerCore";
import type { HandProfile } from "./hand";

export interface Sample { hand: "R" | "L"; notes: CoreNote[]; truth: number[]; profile?: HandProfile; }

export function matchRate(samples: Sample[], profile: HandProfile, w: Weights, learned?: LearnedTable, feat?: FeatureWeights): number {
  let ok = 0, tot = 0;
  for (const s of samples) {
    const got = fingerHand(s.notes, s.hand, s.profile ?? profile, w, learned, feat);
    for (let i = 0; i < got.length; i++) { if (!s.truth[i]) continue; if (got[i] === s.truth[i]) ok++; tot++; }   // 0 = note sans doigté de référence (annotations partielles)
  }
  return tot ? ok / tot : 0;
}

export function tuneWeights(samples: Sample[], profile: HandProfile, start: Weights = DEFAULT_WEIGHTS, learned?: LearnedTable, rounds = 3, log: (s: string) => void = () => {}, feat?: FeatureWeights): Weights {
  let best = { ...start }, bestRate = matchRate(samples, profile, best, learned, feat);
  const keys = Object.keys(best) as (keyof Weights)[];
  const factors = [0.4, 0.7, 1.4, 2.5];
  for (let r = 0; r < rounds; r++) {
    let improved = false;
    for (const k of keys) {
      for (const f of factors) {
        const cand = { ...best, [k]: Math.max(0, +(best[k] * f).toFixed(4)) } as Weights;
        const rate = matchRate(samples, profile, cand, learned, feat);
        if (rate > bestRate + 1e-9) { best = cand; bestRate = rate; improved = true; log(`  ${k} → ${best[k]}  (${(rate * 100).toFixed(2)} %)`); }
      }
    }
    if (!improved) break;
  }
  return best;
}

/** Perceptron structuré moyenné, à annotations partielles : pour chaque extrait, on compare le doigté prédit au meilleur doigté
 *  compatible avec les doigts écrits (les notes non annotées restent libres), et on rend la situation prédite plus chère et la
 *  situation de référence moins chère. Le résultat s'ajoute aux règles (dont les poids restent fixes). */
export function trainFeatures(samples: Sample[], profile: HandProfile, w: Weights, learned: LearnedTable | undefined,
  opts: { epochs?: number; lr?: number; window?: number; minAbs?: number; only?: (key: string) => boolean; log?: (s: string) => void; onEpoch?: (ep: number, avg: FeatureWeights) => void } = {}): FeatureWeights {
  const epochs = opts.epochs ?? 6, lr = opts.lr ?? 0.1;
  samples = windows(samples, opts.window ?? 32);
  const theta: FeatureWeights = {}, acc: Record<string, number> = {};   // acc : somme pondérée pour la moyenne (astuce de la moyenne paresseuse)
  let c = 1;
  // ordre déterministe mais mélangé (les morceaux d'un même fichier ne se suivent pas)
  const order = samples.map((_, i) => i).sort((a, b) => ((a * 2654435761) % 4294967296) - ((b * 2654435761) % 4294967296));
  for (let ep = 0; ep < epochs; ep++) {
    let wrong = 0, total = 0, updates = 0;
    for (const idx of order) {
      const s = samples[idx], prof = s.profile ?? profile;
      const solver = new FingerSolver(s.hand, prof, w, learned, theta);
      const pred = solver.solve(s.notes);
      let miss = 0;
      for (let i = 0; i < pred.length; i++) if (s.truth[i]) { total++; if (pred[i] !== s.truth[i]) miss++; }
      wrong += miss;
      if (miss) {
        const constrained = s.notes.map((n, i) => (s.truth[i] ? { ...n, fixed: s.truth[i] } : { ...n, fixed: undefined }));
        const gold = solver.solve(constrained);
        const fp = solver.features(s.notes, pred), fg = solver.features(s.notes, gold);
        const keys = new Set([...fp.keys(), ...fg.keys()]);
        for (const k of keys) {
          if (opts.only && !opts.only(k)) continue;
          const d = lr * ((fp.get(k) ?? 0) - (fg.get(k) ?? 0));
          if (!d) continue;
          theta[k] = (theta[k] ?? 0) + d; acc[k] = (acc[k] ?? 0) + c * d;
        }
        updates++;
      }
      c++;
    }
    opts.log?.(`  passe ${ep + 1}/${epochs} : ${total ? (100 * (1 - wrong / total)).toFixed(1) : "-"} % de concordance à l'entraînement, ${updates} corrections`);
    opts.onEpoch?.(ep + 1, average(theta, acc, c, 0));
  }
  return average(theta, acc, c, opts.minAbs ?? 0.01);
}
/** Découpe les extraits en fenêtres d'environ `n` pas (sans couper un accord) : des corrections plus locales et plus fréquentes. */
function windows(samples: Sample[], n: number): Sample[] {
  const out: Sample[] = [];
  for (const s of samples) {
    const idx = s.notes.map((_, i) => i).sort((a, b) => s.notes[a].onTime - s.notes[b].onTime || s.notes[a].pitch - s.notes[b].pitch);
    let cur: number[] = [], steps = 0;
    const flush = () => { if (cur.length && cur.some((i) => s.truth[i])) out.push({ hand: s.hand, profile: s.profile, notes: cur.map((i) => s.notes[i]), truth: cur.map((i) => s.truth[i]) }); cur = []; steps = 0; };
    idx.forEach((i, k) => {
      const newStep = k === 0 || Math.abs(s.notes[i].onTime - s.notes[idx[k - 1]].onTime) >= 6;
      if (newStep && steps >= n) flush();
      if (newStep) steps++;
      cur.push(i);
    });
    flush();
  }
  return out;
}
function average(theta: FeatureWeights, acc: Record<string, number>, c: number, minAbs: number): FeatureWeights {
  const out: FeatureWeights = {};
  for (const k of Object.keys(theta)) { const v = theta[k] - acc[k] / c; if (Math.abs(v) >= minAbs && v !== 0) out[k] = +v.toFixed(3); }
  return out;
}
