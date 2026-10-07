/** Difficulté d'un morceau, comme un professeur la jugerait : pas un seul chiffre opaque, mais ce qui rend le morceau
 *  difficile (vitesse, main gauche, indépendance des mains, accords, écarts, sauts, plusieurs voix dans une main,
 *  armure et altérations, rythme, étendue, longueur), combiné en un niveau de 1 à 5 avec ses raisons.
 *  Logique pure, sur une représentation neutre : sert aux morceaux importés (après chargement) comme au répertoire intégré.
 *  Étalonnage : `tests/difficulty.test.ts` (des comptines au niveau 1 jusqu'à la Marche turque au niveau 5). */
import type { Step } from "./score";

export interface DNote { hand: "R" | "L"; pitch: number; /** début, en noires */ t: number; /** durée, en noires */ d: number; }
export interface DPiece { notes: DNote[]; /** noires par minute */ bpm: number; /** armure (dièses > 0, bémols < 0) */ fifths?: number; /** mesure (6/8 : temps d'une noire pointée) */ beats?: number; beatType?: number; }

export type FacetKey = "speed" | "left" | "coord" | "chords" | "stretch" | "leaps" | "shifts" | "voices" | "key" | "rhythm" | "range" | "length";
export interface Difficulty {
  /** 1 Débutant · 2 Facile · 3 Élémentaire · 4 Intermédiaire · 5 Avancé */ level: 1 | 2 | 3 | 4 | 5;
  /** note continue 0-100 (pour trier) */ score: number;
  label: string;
  /** ce qui rend le morceau difficile, du plus au moins important (au plus 3) */ reasons: string[];
  facets: Record<FacetKey, number>;
  /** mesures brutes (étalonnage) */ raw?: Record<string, number>;
}
export const LEVEL_LABEL = ["", "Débutant", "Facile", "Élémentaire", "Intermédiaire", "Avancé"];
/** Repère indicatif (examens de piano type ABRSM / conservatoire 1er cycle). */
export const LEVEL_HINT = ["", "premiers mois", "≈ 1re année · grade 1", "≈ 2e-3e année · grades 2-3", "≈ 4e-5e année · grades 4-5", "fin de 1er cycle et au-delà · grade 6+"];

/** 0 en dessous de `a`, 1 au-dessus de `b`, linéaire entre les deux. */
const ramp = (x: number, a: number, b: number) => Math.max(0, Math.min(1, (x - a) / (b - a)));
const quantile = (xs: number[], q: number) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]; };
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

/** Attaques d'une main : notes qui commencent ensemble (accord). */
function onsetsOf(notes: DNote[]): { t: number; ps: number[]; d: number }[] {
  const out: { t: number; ps: number[]; d: number }[] = [];
  for (const n of [...notes].sort((a, b) => a.t - b.t || a.pitch - b.pitch)) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.t - n.t) < 1e-3) { last.ps.push(n.pitch); last.d = Math.max(last.d, n.d); } else out.push({ t: n.t, ps: [n.pitch], d: n.d });
  }
  return out;
}

export function rateDifficulty(p: DPiece): Difficulty {
  const notes = p.notes.filter((n) => n.d > 0 || n.d === 0);
  const empty: Record<FacetKey, number> = { speed: 0, left: 0, coord: 0, chords: 0, stretch: 0, leaps: 0, shifts: 0, voices: 0, key: 0, rhythm: 0, range: 0, length: 0 };
  if (!notes.length) return { level: 1, score: 0, label: LEVEL_LABEL[1], reasons: [], facets: empty };
  const bpm = Math.max(30, Math.min(240, p.bpm || 100)), secPerQ = 60 / bpm;
  const R = onsetsOf(notes.filter((n) => n.hand === "R")), L = onsetsOf(notes.filter((n) => n.hand === "L"));
  const end = Math.max(...notes.map((n) => n.t + n.d));

  // ── vitesse : attaques par seconde dans les passages les plus rapides (fenêtres de 2 s), par main ──
  const peak = (on: { t: number }[]) => {
    if (on.length < 2) return 0;
    const win = 2 / secPerQ, rates: number[] = [];
    for (let i = 0, j = 0; i < on.length; i++) { while (j < on.length && on[j].t < on[i].t + win) j++; rates.push((j - i) / 2); }
    return quantile(rates, 0.9);
  };
  const pR = peak(R), pL = peak(L);
  const speed = ramp(Math.max(pR, pL * 1.15), 1.6, 9);
  // ── main gauche : elle aussi doit bouger (mélodies, Alberti, sauts de basse) ──
  const left = L.length ? ramp(pL, 1, 7.5) : 0;
  // ── indépendance : sur un même temps, les DEUX mains sont occupées (plusieurs attaques chacune), et pas au même rythme ──
  const beatLen = p.beatType === 8 && (p.beats ?? 0) % 3 === 0 ? 1.5 : 4 / (p.beatType ?? 4);
  // décalage de la grille des temps (levée) : celui qui met le plus de notes longues sur les temps
  let phase = 0, bestFit = -1;
  for (let ph = 0; ph < beatLen - 1e-6; ph += 0.25) {
    let fit = 0; for (const n of notes) { const b = (n.t - ph) / beatLen; if (Math.abs(b - Math.round(b)) < 0.02) fit += Math.min(2, n.d); }
    if (fit > bestFit + 1e-6) { bestFit = fit; phase = ph; }
  }
  const beatOf = (t: number) => (t - phase) / beatLen + 1;   // +1 : la levée tombe dans le temps 0
  const nb = Math.ceil(beatOf(end)) + 2;
  const bucket = (on: { t: number }[]) => { const b: number[][] = Array.from({ length: nb }, () => []); for (const o of on) { const x = beatOf(o.t); b[Math.max(0, Math.floor(x + 1e-6))].push(Math.round(((x % 1) + 1) % 1 * 12)); } return b; };
  const bR = bucket(R), bL = bucket(L);
  // (un arpège partagé entre les mains, sans attaque commune, n'est qu'une seule ligne : facile)
  let active = 0, load = 0;
  for (let i = 0; i < nb; i++) {
    const a = new Set(bR[i]), b = new Set(bL[i]);
    if (!a.size && !b.size) continue;
    active++;
    const common = [...a].filter((x) => b.has(x)).length;
    // deux mains occupées : vraiment ensemble (au moins deux attaques communes) ou en alternance (une main répond à l'autre)
    if (a.size >= 2 && b.size >= 2 && common >= 2) { const uni = new Set([...a, ...b]).size; load += 0.25 + 0.75 * ((uni - common) / uni); }
    else if (a.size >= 2 && b.size >= 2) load += 0.2;
    else if (common >= 1 && Math.max(a.size, b.size) >= 3) load += 0.2;     // une main joue vite pendant que l'autre tient
  }
  const coord = ramp(load / Math.max(1, active), 0.05, 0.6);
  // ── accords : taille et fréquence (les octaves comptent comme un écart, pas comme un accord) ──
  const all = [...R, ...L];
  const sizes = all.map((o) => new Set(o.ps.map((x) => x)).size);
  const bigOn = all.filter((o) => o.ps.length >= 3).sort((a, b) => a.t - b.t);
  const big = bigOn.length / all.length;
  // changer vite d'accord est bien plus dur que d'en tenir : on regarde le rythme des accords
  const chordRate = bigOn.length >= 2 ? quantile(bigOn.slice(1).map((o, i) => 1 / Math.max(0.05, (o.t - bigOn[i].t) * secPerQ)), 0.75) : 0;
  const chords = Math.min(1, ramp(quantile(sizes, 0.98), 2.5, 5) * 0.35 + ramp(big, 0.05, 0.5) * 0.15 + ramp(chordRate, 0.8, 4) * 0.6 * ramp(big, 0.02, 0.15));
  // ── écarts dans la main (accord ou notes tenues) et sauts entre deux attaques ──
  const spans = all.map((o) => Math.max(...o.ps) - Math.min(...o.ps));
  const stretch = ramp(quantile(spans, 0.97), 7, 15);
  // un saut ne pose problème que s'il faut le faire vite : au-delà d'une octave, en moins d'une demi-seconde
  const leapCount = (on: { t: number; ps: number[] }[]) => { let k = 0; for (let i = 1; i < on.length; i++) { const a = on[i - 1], b = on[i]; const dist = Math.min(Math.abs(Math.min(...b.ps) - Math.min(...a.ps)), Math.abs(Math.max(...b.ps) - Math.max(...a.ps))); const dt = (b.t - a.t) * secPerQ; if (dist > 12 && dt < 0.5) k += dist > 19 ? 2 : 1; } return k; };
  const minutes = Math.max(0.25, (end * secPerQ) / 60);
  const leaps = ramp((leapCount(R) + leapCount(L)) / minutes, 3, 45);
  // ── changements de position : la main (une sixte environ sous les doigts) doit se déplacer pour attraper la note suivante ──
  const shiftCount = (on: { ps: number[] }[]) => {
    let lo = Infinity, hi = -Infinity, k = 0;
    for (const o of on) {
      const a = Math.min(...o.ps), b = Math.max(...o.ps), nlo = Math.min(lo, a), nhi = Math.max(hi, b);
      if (nhi - nlo > 9 && lo !== Infinity) { k++; lo = a; hi = b; } else { lo = nlo; hi = nhi; }
    }
    return k;
  };
  const shiftRate = (shiftCount(R) + shiftCount(L) * 0.7) / minutes;
  const shifts = ramp(shiftRate, 25, 150);
  // ── plusieurs voix dans une main : une note tenue pendant que d'autres attaquent (Bach, mélodie + accompagnement) ──
  //    (une basse tenue sous une ou deux notes d'arpège, c'est comme la pédale : ça ne compte pas)
  const poly = (hand: "R" | "L", on: { t: number }[]) => {
    const hn = notes.filter((n) => n.hand === hand && n.d >= beatLen * 0.99); let k = 0;
    for (const o of on) if (hn.some((n) => n.t < o.t - 1e-3 && n.t + n.d > o.t + 0.05 && on.filter((x) => x.t > n.t + 1e-3 && x.t < n.t + n.d - 0.05).length >= 3)) k++;
    return on.length ? k / on.length : 0;
  };
  const voices = ramp(Math.max(poly("R", R), poly("L", L)), 0.05, 0.5);
  // ── armure et altérations accidentelles ──
  const f = p.fifths ?? 0, tonic = (((f * 7) % 12) + 12) % 12;
  const inMaj = new Set(MAJOR.map((x) => (x + tonic) % 12)); inMaj.add((tonic + 8) % 12);   // + sensible du relatif mineur
  const chrom = notes.filter((n) => !inMaj.has(n.pitch % 12)).length / notes.length;
  const key = Math.min(1, ramp(Math.abs(f), 0.5, 5) * 0.7 + ramp(chrom, 0.03, 0.25) * 0.6);
  // ── rythme : valeurs courtes, triolets / divisions irrégulières, syncopes ──
  const iois: number[] = []; for (const on of [R, L]) for (let i = 1; i < on.length; i++) iois.push(on[i].t - on[i - 1].t);
  const shortest = quantile(iois.filter((x) => x > 1e-3), 0.1) || 1;
  const offGrid = all.filter((o) => Math.abs(o.t * 4 - Math.round(o.t * 4)) > 0.05).length / all.length;
  const sync = all.filter((o) => { const b = beatOf(o.t), fr = b - Math.floor(b); return fr > 0.05 && beatOf(o.t + o.d) > Math.floor(b) + 1 + 0.05 && o.d >= beatLen * 0.75; }).length / all.length;
  const rhythm = Math.min(1, ramp(1 / shortest, 2.5, 6) * 0.35 + ramp(offGrid, 0.05, 0.4) * 0.3 + ramp(sync, 0.03, 0.25) * 0.45);
  // ── étendue et longueur ──
  const ps = notes.map((n) => n.pitch);
  const range = ramp(Math.max(...ps) - Math.min(...ps), 26, 62);
  const length = ramp(all.length, 80, 900);

  const facets: Record<FacetKey, number> = { speed, left, coord, chords, stretch, leaps, shifts, voices, key, rhythm, range, length };
  const W: Record<FacetKey, number> = { speed: 2.2, left: 1.3, coord: 1.4, chords: 1, stretch: 0.9, leaps: 1, shifts: 0.9, voices: 1.3, key: 0.7, rhythm: 1.2, range: 0.5, length: 0.5 };
  const wsum = Object.values(W).reduce((a, b) => a + b, 0);
  const mean = (Object.keys(W) as FacetKey[]).reduce((s, k) => s + W[k] * facets[k], 0) / wsum;
  const top = (Object.keys(W) as FacetKey[]).filter((k) => k !== "length" && k !== "range").map((k) => facets[k]).sort((a, b) => b - a);
  // un morceau est d'abord aussi difficile que ses deux aspects les plus durs ; le reste ajuste
  const score = Math.round(100 * Math.min(1, 0.5 * mean * 2.2 + 0.5 * ((top[0] + top[1]) / 2)));
  const level = (score < 16 ? 1 : score < 32 ? 2 : score < 48 ? 3 : score < 66 ? 4 : 5) as Difficulty["level"];
  const why: [FacetKey, string][] = [
    ["speed", speed > 0.6 ? `rapide (≈ ${Math.round(Math.max(pR, pL))} notes/s)` : "tempo soutenu"],
    ["left", "main gauche active"], ["coord", "mains indépendantes"],
    ["chords", Math.max(...sizes) >= 4 ? `accords de ${Math.max(...sizes)} notes` : "accords"],
    ["stretch", quantile(spans, 0.97) >= 12 ? "grands écarts (octave et plus)" : "écarts de la main"],
    ["leaps", "sauts fréquents"], ["shifts", "changements de position fréquents"], ["voices", "plusieurs voix dans une main"],
    ["key", Math.abs(f) >= 3 ? `${Math.abs(f)} ${f > 0 ? "dièses" : "bémols"} à la clé` : chrom > 0.1 ? "nombreuses altérations" : "altérations"],
    ["rhythm", offGrid > 0.08 ? "triolets / rythmes irréguliers" : sync > 0.05 ? "syncopes" : "valeurs rapides"],
    ["range", "tout le clavier"], ["length", "morceau long"],
  ];
  const reasons = why.filter(([k]) => facets[k] >= 0.35).sort((a, b) => facets[b[0]] * W[b[0]] - facets[a[0]] * W[a[0]]).slice(0, 3).map(([, s]) => s);
  return { level, score, label: LEVEL_LABEL[level], reasons, facets, raw: { pR, pL, shiftRate, minutes, onsets: all.length } };
}

/** Depuis un morceau chargé par le moteur (pas de la partition) : positions en noires et tempo. */
export function pieceFromSteps(steps: Step[], bpm: number, fifths = 0): DPiece {
  const msPerQ = 60000 / Math.max(20, bpm), notes: DNote[] = [];
  for (const s of steps) for (const n of s.notes) notes.push({ hand: n.hand, pitch: n.pitch, t: n.q ?? n.onTime / msPerQ, d: Math.max(0, (n.offTime - n.onTime) / msPerQ) });
  return { notes, bpm, fifths };
}

/** Compatibilité : la note 1-5 rangée dans la bibliothèque. */
export function computeDifficulty(steps: Step[], bpm = 100, fifths = 0): number {
  return rateDifficulty(pieceFromSteps(steps, bpm, fifths)).level;
}
