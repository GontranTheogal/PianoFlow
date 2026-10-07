/** Doigtés automatiques : logique pure (aucun accès au DOM, testable sous Node et utilisable par le script d'entraînement).
 *
 *  Méthode : programmation dynamique (Viterbi) d'ordre 2 sur les « pas » d'une main (une note ou un accord).
 *  Chaque pas a pour états les attributions de doigts possibles (accord de k notes = k doigts distincts, rangés dans l'ordre
 *  de la main). Le coût combine :
 *    - des règles biomécaniques (écart entre deux doigts selon l'ENVERGURE mesurée de l'utilisateur, passages du pouce,
 *      touches noires, 4e doigt faible, triplets 3-4-3, doigt répété…) ;
 *    - un modèle statistique appris sur des partitions doigtées (src/fingeringModel.ts) ;
 *    - les doigtés écrits dans la partition, traités comme contraintes fixes (le reste est complété autour).
 *  Les poids des règles sont eux-mêmes ajustables par entraînement (scripts/train-fingering.ts). */
import { type HandProfile, keyX, isBlackKey, pairLimits, WHITE_CM } from "./hand";

export interface CoreNote { pitch: number; onTime: number; offTime: number; /** doigté imposé (écrit dans la partition) */ fixed?: number; }
export type LearnedTable = Record<string, Record<string, Record<string, Record<string, number>>>>;
/** Coûts appris par entraînement discriminant (perceptron structuré, scripts/train-fingering.ts) : clé de situation → coût ajouté.
 *  Clés : `u` + main + doigt + touche (b noire / w blanche) + n note seule / c accord ; `p` + main + écart + doigts (deux notes
 *  voisines d'un accord) ; `t` / `T` + main + l lié / r après un silence + forme (n note, c accord) + écart + doigts (+ couleurs des
 *  deux touches pour `T`) ; `3` + main + classes des deux écarts (voir ivClass) + trois doigts (trois notes seules liées) ; `C` + main +
 *  écarts successifs + doigts (accord entier de trois notes ou plus). Absent = 0. */
export type FeatureWeights = Record<string, number>;

export interface Weights {
  stretch: number;      // écart entre deux doigts au-delà du confort
  chordStretch: number; // idem à l'intérieur d'un accord
  crossBase: number;    // passage du pouce / enjambement (coût de base)
  crossDist: number;    // passage du pouce sur une grande distance
  badCross: number;     // croisement sans le pouce (presque interdit)
  sameFinger: number;   // même doigt sur deux touches différentes
  repeatDiff: number;   // même touche rejouée avec un doigt différent
  weak4: number;        // 4e doigt
  blackThumb: number;   // pouce sur une touche noire
  blackPinky: number;   // auriculaire sur une touche noire
  thumbBlackLand: number; // pouce qui passe et tombe sur une touche noire alors que le doigt d'avant était sur une blanche
  tri34: number;        // 3-4-3 ou 4-3-4
  restFactor: number;   // après un silence, la main se replace : coûts de déplacement atténués
  learned: number;      // poids du modèle statistique
  relax: number;        // préférence pour un écart au milieu de la zone détendue (départage les égalités)
}
export const DEFAULT_WEIGHTS: Weights = {
  stretch: 1.75, chordStretch: 1.6, crossBase: 3.5, crossDist: 0.7, badCross: 12, sameFinger: 2.24, repeatDiff: 0.9, weak4: 0.4,
  blackThumb: 3.5, blackPinky: 1.5, thumbBlackLand: 1.4, tri34: 1, restFactor: 0.25, learned: 0.3, relax: 0.12,
};

const CLAMP = 14;
/** Classe d'intervalle pour les caractéristiques d'ordre 2 : même note, seconde, tierce, quarte à quinte, au-delà (majuscule = vers l'aigu). */
const ivClass = (d: number): string => { const a = Math.abs(d), c = a === 0 ? "o" : a <= 2 ? "s" : a <= 4 ? "t" : a <= 7 ? "f" : "l"; return d > 0 ? c.toUpperCase() : c; };
const REST_MS = 250;
const BIG = 1e6;

interface PStep { t: number; end: number; notes: CoreNote[]; states: number[][]; }

/** Regroupe les notes (déjà dans une seule main) en pas : notes simultanées = accord. */
function toSteps(notes: CoreNote[]): PStep[] {
  const sorted = [...notes].sort((a, b) => a.onTime - b.onTime || a.pitch - b.pitch);
  const steps: PStep[] = [];
  for (const n of sorted) {
    const last = steps[steps.length - 1];
    if (last && Math.abs(n.onTime - last.t) < 6) { last.notes.push(n); last.end = Math.max(last.end, n.offTime); }
    else steps.push({ t: n.onTime, end: n.offTime, notes: [n], states: [] });
  }
  return steps;
}

function combos(k: number): number[][] {
  const out: number[][] = [];
  const rec = (start: number, cur: number[]) => {
    if (cur.length === k) { out.push([...cur]); return; }
    for (let f = start; f <= 5; f++) { cur.push(f); rec(f + 1, cur); cur.pop(); }
  };
  rec(1, []);
  return out;
}
const COMBOS = [[], ...[1, 2, 3, 4, 5].map(combos)];

/** États d'un pas : fingers[i] = doigt de la i-ème note par hauteur croissante. Main droite : doigts croissants ; gauche : décroissants. */
function statesFor(step: PStep, hand: "R" | "L"): number[][] {
  const k = step.notes.length;
  let st: number[][];
  if (k <= 5) st = COMBOS[k].map((c) => (hand === "R" ? c : [...c].reverse()));
  else {
    const f = step.notes.map((_, i) => Math.min(5, Math.floor((i * 5) / k) + 1));
    st = [hand === "R" ? f : f.map((x) => 6 - x)];
  }
  const fixed = step.notes.map((n) => n.fixed);
  if (fixed.some(Boolean)) {
    const ok = st.filter((s) => s.every((f, i) => !fixed[i] || f === fixed[i]));
    if (ok.length) return ok;
    return [step.notes.map((n, i) => n.fixed ?? st[0][i])];     // contrainte incompatible avec la main : on la respecte telle quelle
  }
  return st;
}

export class FingerSolver {
  constructor(private hand: "R" | "L", private profile: HandProfile, private w: Weights = DEFAULT_WEIGHTS, private learned?: LearnedTable, private feat?: FeatureWeights) {}
  /** Collecteur de caractéristiques (entraînement) : quand il est actif, chaque clé rencontrée y est comptée. */
  private sink: Map<string, number> | null = null;
  private f(key: string): number {
    if (this.sink) this.sink.set(key, (this.sink.get(key) ?? 0) + 1);
    return this.feat?.[key] ?? 0;
  }
  private get dir() { return this.hand === "R" ? 1 : -1; }

  /** Coût d'un écart entre deux doigts voisins qui ne bougent pas (dist en cm, toujours positive). */
  stretch(fa: number, fb: number, dist: number, k: number): number {
    if (fa === fb) return 30;                       // même doigt sur deux touches à la fois : impossible
    const L = pairLimits(fa, fb, this.profile), u = WHITE_CM;
    if (dist < L.relMin) return (k * (L.relMin - dist)) / u;
    if (dist <= L.relMax) { const half = (L.relMax - L.relMin) / 2 || 1, dv = (dist - (L.relMax + L.relMin) / 2) / half; return this.w.relax * dv * dv; }
    if (dist <= L.comfMax) return (1.2 * k * (dist - L.relMax)) / u;
    const base = (1.2 * k * (L.comfMax - L.relMax)) / u;
    if (dist <= L.absMax) return base + (4 * k * (dist - L.comfMax)) / u;
    return base + (4 * k * (L.absMax - L.comfMax)) / u + 40 + (15 * (dist - L.absMax)) / u;
  }

  /** Coût de passer de la touche pPrev (doigt fPrev) à la touche pCur (doigt fCur), sans modèle statistique. */
  transition(pPrev: number, fPrev: number, pCur: number, fCur: number, gap: number): number {
    const w = this.w, gf = gap >= REST_MS ? w.restFactor : 1;
    if (pPrev === pCur) return fPrev === fCur ? 0 : w.repeatDiff * (gap >= REST_MS ? 0.2 : 1);
    const d = (keyX(pCur) - keyX(pPrev)) * this.dir, ad = Math.abs(d), u = WHITE_CM;
    if (fPrev === fCur) return gf * (w.sameFinger + (ad > 3.2 * u ? 3 : 1) * (0.9 * ad) / u);
    const uncrossed = fCur > fPrev === d > 0;
    if (uncrossed) return gf * w.stretch * this.stretch(Math.min(fPrev, fCur), Math.max(fPrev, fCur), ad, 1);
    // croisement : seul le pouce peut passer sous / être enjambé
    const thumbUnder = fCur < fPrev && fCur === 1, over = fCur > fPrev && fPrev === 1;
    if (!thumbUnder && !over) return gf * (w.badCross + w.stretch * ad / u);
    const other = thumbUnder ? fPrev : fCur;
    const base = thumbUnder ? ({ 2: 2.2, 3: 1, 4: 1.15, 5: 4 } as Record<number, number>)[other] : ({ 2: 2.4, 3: 1, 4: 1.3, 5: 4.5 } as Record<number, number>)[other];
    let c = w.crossBase * base + w.crossDist * Math.max(0, ad / u - 2.5);
    const pBlackFrom = isBlackKey(pPrev), pBlackTo = isBlackKey(pCur);
    if (thumbUnder && pBlackTo && !pBlackFrom) c += w.thumbBlackLand;
    if (over && pBlackFrom && !pBlackTo) c += w.thumbBlackLand * 0.6;
    if ((thumbUnder && pBlackFrom && !pBlackTo) || (over && pBlackTo && !pBlackFrom)) c -= 0.4 * w.crossBase;   // le doigt qui passe est sur une noire : passage facile
    return gf * Math.max(0.1, c);
  }

  private noteCost(p: number, f: number): number {
    const w = this.w; let c = 0;
    if (f === 4) c += w.weak4;
    if (isBlackKey(p)) { if (f === 1) c += w.blackThumb; else if (f === 5) c += w.blackPinky; }
    return c;
  }
  private learnedCost(pPrev: number, fPrev: number, pCur: number, fCur: number): number {
    const row = this.learned?.[this.hand]?.[String(Math.max(-CLAMP, Math.min(CLAMP, pCur - pPrev)))]?.[String(fPrev)];
    const l = row?.[String(fCur)];
    return l === undefined ? 0 : this.w.learned * l;
  }

  /** Coût propre à un état (accord : écarts entre tous les doigts joués ensemble). */
  private unary(step: PStep, s: number[]): number {
    let c = 0;
    const n = step.notes, useF = !!(this.feat || this.sink), shape = n.length > 1 ? "c" : "n";
    if (useF && n.length >= 3) c += this.f(`C${this.hand}${n.slice(1).map((x, i) => Math.min(12, x.pitch - n[i].pitch)).join("|")}:${s.join("")}`);
    for (let i = 0; i < n.length; i++) {
      c += this.noteCost(n[i].pitch, s[i]);
      if (useF) {
        c += this.f(`u${this.hand}${s[i]}${isBlackKey(n[i].pitch) ? "b" : "w"}${shape}`);
        if (i + 1 < n.length) c += this.f(`p${this.hand}${Math.min(CLAMP, n[i + 1].pitch - n[i].pitch)}:${s[i]}${s[i + 1]}`);
      }
      for (let j = i + 1; j < n.length; j++) {
        const dist = Math.abs(keyX(n[j].pitch) - keyX(n[i].pitch));
        c += this.w.chordStretch * this.stretch(Math.min(s[i], s[j]), Math.max(s[i], s[j]), dist, 1);
      }
    }
    return c;
  }

  /** Coût de la liaison entre deux pas : on suit les deux notes les plus proches (celles que la main relie réellement). */
  private link(a: PStep, sa: number[], b: PStep, sb: number[]): number {
    let bi = 0, bj = 0, best = Infinity;
    for (let i = 0; i < a.notes.length; i++) for (let j = 0; j < b.notes.length; j++) {
      const d = Math.abs(a.notes[i].pitch - b.notes[j].pitch);
      if (d < best) { best = d; bi = i; bj = j; }
    }
    const gap = b.t - a.end;
    let c = this.transition(a.notes[bi].pitch, sa[bi], b.notes[bj].pitch, sb[bj], gap);
    if (a.notes.length === 1 && b.notes.length === 1 && gap < REST_MS) c += this.learnedCost(a.notes[0].pitch, sa[0], b.notes[0].pitch, sb[0]);
    if (this.feat || this.sink) {
      const pa = a.notes[bi].pitch, pb = b.notes[bj].pitch, iv = Math.max(-CLAMP, Math.min(CLAMP, pb - pa));
      const k = `${this.hand}${gap < REST_MS ? "l" : "r"}${a.notes.length > 1 ? "c" : "n"}${b.notes.length > 1 ? "c" : "n"}${iv}:${sa[bi]}${sb[bj]}`;
      c += this.f("t" + k) + this.f(`T${k}${isBlackKey(pa) ? "b" : "w"}${isBlackKey(pb) ? "b" : "w"}`);
    }
    // doigt déjà occupé par une note encore tenue
    for (let i = 0; i < a.notes.length; i++) if (a.notes[i].offTime > b.t + 30) for (let j = 0; j < b.notes.length; j++) if (sa[i] === sb[j] && a.notes[i].pitch !== b.notes[j].pitch) c += BIG;
    return c;
  }

  private tri(sa: number[], a: PStep, sb: number[], b: PStep, sc: number[], c: PStep): number {
    if (a.notes.length !== 1 || b.notes.length !== 1 || c.notes.length !== 1) return 0;
    const x = sa[0], y = sb[0], z = sc[0];
    let cost = (x === 3 && y === 4 && z === 3) || (x === 4 && y === 3 && z === 4) ? this.w.tri34 : 0;
    if ((this.feat || this.sink) && b.t - a.end < REST_MS && c.t - b.end < REST_MS) {
      const d1 = b.notes[0].pitch - a.notes[0].pitch, d2 = c.notes[0].pitch - b.notes[0].pitch;
      cost += this.f(`3${this.hand}${ivClass(d1)}${ivClass(d2)}:${x}${y}${z}`);
    }
    return cost;
  }

  /** Coût total d'un doigté donné (pour comparer, déboguer et entraîner). */
  cost(notes: CoreNote[], fingers: number[]): number {
    const idx = new Map(notes.map((n, i) => [n, i]));
    const steps = toSteps(notes);
    let c = 0;
    const st = steps.map((s) => s.notes.map((n) => fingers[idx.get(n)!]));
    steps.forEach((s, i) => {
      c += this.unary(s, st[i]);
      if (i) c += this.link(steps[i - 1], st[i - 1], s, st[i]);
      if (i > 1) c += this.tri(st[i - 2], steps[i - 2], st[i - 1], steps[i - 1], st[i], s);
    });
    return c;
  }

  /** Caractéristiques apprises d'un doigté donné (clé → nombre d'occurrences), pour l'entraînement. */
  features(notes: CoreNote[], fingers: number[]): Map<string, number> {
    this.sink = new Map();
    try { this.cost(notes, fingers); return this.sink; } finally { this.sink = null; }
  }

  /** Renvoie les doigts (1-5) de chaque note dans l'ordre d'entrée. */
  solve(notes: CoreNote[]): number[] {
    const out = new Map<CoreNote, number>();
    const steps = toSteps(notes);
    const n = steps.length;
    if (!n) return [];
    for (const s of steps) s.states = statesFor(s, this.hand);
    const un = steps.map((s) => s.states.map((st) => this.unary(s, st)));
    let pick: number[] = [];
    if (n === 1) {
      let b = 0; for (let k = 1; k < un[0].length; k++) if (un[0][k] < un[0][b]) b = k;
      pick = [b];
    } else {
      // dp[i][a][b] : meilleur coût jusqu'au pas i, état a au pas i-1, état b au pas i
      const S = steps.map((s) => s.states.length);
      const dp: Float64Array[] = [], bp: Int16Array[] = [];
      for (let i = 1; i < n; i++) {
        const cur = new Float64Array(S[i - 1] * S[i]).fill(Infinity), back = new Int16Array(S[i - 1] * S[i]).fill(-1);
        for (let a = 0; a < S[i - 1]; a++) for (let b = 0; b < S[i]; b++) {
          const lk = this.link(steps[i - 1], steps[i - 1].states[a], steps[i], steps[i].states[b]) + un[i][b];
          if (i === 1) { cur[a * S[i] + b] = un[0][a] + lk; continue; }
          let best = Infinity, bk = -1;
          for (let z = 0; z < S[i - 2]; z++) {
            const prev = dp[i - 2][z * S[i - 1] + a];
            if (prev === Infinity) continue;
            const v = prev + lk + this.tri(steps[i - 2].states[z], steps[i - 2], steps[i - 1].states[a], steps[i - 1], steps[i].states[b], steps[i]);
            if (v < best) { best = v; bk = z; }
          }
          cur[a * S[i] + b] = best; back[a * S[i] + b] = bk;
        }
        dp.push(cur); bp.push(back);
      }
      const last = dp[n - 2], Sa = S[n - 2], Sb = S[n - 1];
      let ba = 0, bb = 0, bv = Infinity;
      for (let a = 0; a < Sa; a++) for (let b = 0; b < Sb; b++) if (last[a * Sb + b] < bv) { bv = last[a * Sb + b]; ba = a; bb = b; }
      pick = new Array(n);
      pick[n - 1] = bb; pick[n - 2] = ba;
      for (let i = n - 2; i >= 1; i--) { const z = bp[i][pick[i] * S[i + 1] + pick[i + 1]]; pick[i - 1] = z; }
    }
    steps.forEach((s, i) => s.notes.forEach((note, j) => out.set(note, s.states[pick[i]][j])));
    return notes.map((x) => out.get(x)!);
  }
}

/** Doigté d'usage d'un accord de trois sons serré (état fondamental ou renversement), tel qu'on l'enseigne, quelle que soit la
 *  tonalité : main droite 1-3-5, ou 1-2-5 quand la quarte est en haut (1er renversement) ; main gauche 5-3-1, ou 5-2-1 quand la
 *  quarte est en bas (2e renversement). Renvoie null pour tout autre accord. Doigts dans l'ordre des hauteurs données. */
export function triadFingering(pitches: number[], hand: "R" | "L"): number[] | null {
  if (pitches.length !== 3) return null;
  const order = [0, 1, 2].sort((a, b) => pitches[a] - pitches[b]);
  const lo = pitches[order[1]] - pitches[order[0]], hi = pitches[order[2]] - pitches[order[1]];
  if (lo < 3 || hi < 3 || lo > 6 || hi > 6 || (lo > 4 && hi > 4)) return null;   // des tierces, et au plus une quarte ou un triton
  const byPitch = hand === "R" ? (hi > 4 ? [1, 2, 5] : [1, 3, 5]) : (lo > 4 ? [5, 2, 1] : [5, 3, 1]);
  const out = [0, 0, 0];
  order.forEach((idx, k) => { out[idx] = byPitch[k]; });
  return out;
}

/** Raccourci : doigtés d'une main pour une suite de notes. */
export function fingerHand(notes: CoreNote[], hand: "R" | "L", profile: HandProfile, weights: Weights = DEFAULT_WEIGHTS, learned?: LearnedTable, feat?: FeatureWeights): number[] {
  return new FingerSolver(hand, profile, weights, learned, feat).solve(notes);
}
