/** Modèle de compétences : ce que l'élève maîtrise vraiment, exercice par exercice, et ce qu'il oublie.
 *  - Chaque résultat (exercice, manche de lecture, déchiffrage, échauffement, morceau joué en rythme) met à jour une maîtrise
 *    de 0 à 100 % : moyenne glissante, les derniers résultats comptent le plus.
 *  - Sans pratique, la maîtrise s'érode (courbe de l'oubli) ; plus une compétence a été travaillée souvent, plus elle tient.
 *  - La séance du jour prend les compétences débloquées les plus faibles (ou jamais travaillées), une par famille.
 *  Stocké par compétence avec sa date : entre appareils, la mise à jour la plus récente gagne. */
import { UNITS } from "./course/curriculum";
import { loadProgress, isDone } from "./course/engine";
import { dayNum } from "./review";
import { readJson, writeJson } from "./storage";

export const SKILLS_KEY = "pianoflow-skills";
export interface SkillRec { /** maîtrise 0-100 */ m: number; /** nombre de résultats */ n: number; /** dernière mise à jour (ms) */ t: number;
  /** jour (n° depuis 1970) de la dernière mise à jour, et maîtrise au début de ce jour-là : la séance du jour ne bouge pas en cours de route */ d: number; /** -1 : aucun résultat avant ce jour-là */ m0: number; }

export type Family = "lecture" | "rythme" | "oreille" | "technique" | "pedale" | "impro";
export const FAMILIES: Record<Family, { label: string; icon: string }> = {
  lecture: { label: "Lecture", icon: "music-4" }, rythme: { label: "Rythme", icon: "drum" }, oreille: { label: "Oreille", icon: "ear" },
  technique: { label: "Technique", icon: "hand" }, pedale: { label: "Pédale", icon: "footprints" }, impro: { label: "Improvisation", icon: "music-2" },
};
export interface Skill { key: string; label: string; family: Family; /** proposé tel quel dans la séance du jour (sinon : travaillé par une autre étape) */ practice: boolean; unlock: () => string; }

const first = (u: string) => UNITS.find((x) => x.id === u)?.lessons[0]?.id ?? "";
const last = (u: string) => { const l = UNITS.find((x) => x.id === u)?.lessons; return l?.[l.length - 1]?.id ?? ""; };
/** Les compétences suivies. `key` = la clé de l'exercice qui la travaille (onglet Exercices). */
export const SKILLS: Skill[] = [
  { key: "reading", label: "Lecture de notes", family: "lecture", practice: true, unlock: () => first("u4") },
  { key: "sight", label: "Déchiffrage", family: "lecture", practice: true, unlock: () => last("u5") },
  { key: "rhythm", label: "Lire un rythme", family: "rythme", practice: true, unlock: () => first("u6") },
  { key: "play", label: "Jouer en rythme (morceaux)", family: "rythme", practice: false, unlock: () => first("u6") },
  { key: "echo", label: "Écho", family: "oreille", practice: true, unlock: () => "u1-l3" },
  { key: "intervals", label: "Intervalles", family: "oreille", practice: true, unlock: () => last("u8") },
  { key: "chords", label: "Couleur des accords", family: "oreille", practice: true, unlock: () => last("u8") },
  { key: "warmup", label: "Gammes et cinq doigts", family: "technique", practice: false, unlock: () => last("u2") },
  { key: "fingers", label: "Trouver ses doigtés", family: "technique", practice: true, unlock: () => "udg-l1" },
  { key: "pedal", label: "Pédale", family: "pedale", practice: true, unlock: () => "upd-l1" },
  { key: "improv", label: "Improviser", family: "impro", practice: true, unlock: () => "uacc-l6" },
];
export const skillByKey = (k: string) => SKILLS.find((s) => s.key === k);

/** Les compétences enregistrées ; celles d'avant ce modèle sont reprises des records d'exercices (meilleur score, tous niveaux). */
function load(): Record<string, SkillRec> {
  let all: Record<string, SkillRec> = {}, drills: Record<string, { best: number; runs: number; last?: number }> = {};
  all = readJson(SKILLS_KEY, all);
  drills = readJson("pianoflow-drills", drills);
  for (const k of Object.keys(drills)) {
    const key = k.replace(/-\d+$/, ""); if (all[key] || !skillByKey(key)) continue;
    const same = Object.entries(drills).filter(([x]) => x.replace(/-\d+$/, "") === key).map(([, x]) => x);
    const lastDay = Math.max(...same.map((x) => x.last ?? 0)), s = String(lastDay);
    const d = lastDay > 19000101 ? dayNum(new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T12:00:00`)) : dayNum();
    const m = Math.max(...same.map((x) => x.best ?? 0));
    all[key] = { m, n: same.reduce((a, x) => a + (x.runs ?? 1), 0), t: 0, d, m0: m };
  }
  return all;
}
export const records = load;

/** Un résultat (0-100) : la maîtrise s'en rapproche, vite au début, puis plus posément. */
export function record(key: string, score: number, now = Date.now()) {
  if (!skillByKey(key) || !Number.isFinite(score)) return;
  const all = load(), r = all[key], s = Math.max(0, Math.min(100, score)), day = dayNum(new Date(now));
  const before = r ? current(r, day) : 0;
  const a = r ? Math.max(0.25, 1 / (r.n + 1)) : 1;
  const m = Math.round(before + a * (s - before));
  all[key] = { m, n: (r?.n ?? 0) + 1, t: now, d: day, m0: r && r.d === day ? r.m0 : r ? Math.round(before) : -1 };
  writeJson(SKILLS_KEY, all);
}

/** Maîtrise d'aujourd'hui, oubli compris : à mi-chemin d'une demi-vie sans pratique, on a perdu la moitié de ce qui peut s'oublier
 *  (au plus 40 % de la maîtrise : ce qui a été appris ne disparaît pas). La demi-vie s'allonge avec le nombre de séances. */
export function current(r: SkillRec, today = dayNum(), m = r.m): number {
  const days = Math.max(0, today - r.d), half = Math.min(60, 5 * (1 + r.n / 3));
  return m * (0.6 + 0.4 * Math.pow(0.5, days / half));
}

export const unlocked = (s: Skill, p = loadProgress()) => { const id = s.unlock(); return !!id && isDone(p, id); };

/** Urgence d'une compétence jamais travaillée : devant ce qui est bien acquis, derrière un vrai point faible (sous ~40 %). */
const NEW_NEED = 65;
export interface SkillState { skill: Skill; /** maîtrise affichée (oubli compris) ; null = jamais travaillée */ level: number | null; /** urgence 0-120 (100 − maîtrise, plus jusqu'à 20 si on ne l'a pas travaillée depuis longtemps) : plus c'est haut, plus c'est à travailler */ need: number; days: number; }
/** L'état de chaque compétence débloquée. `frozen` : la maîtrise du début de journée (pour composer la séance sans qu'elle bouge). */
export function states(p = loadProgress(), today = dayNum(), frozen = false): SkillState[] {
  const all = load();
  return SKILLS.filter((s) => unlocked(s, p)).map((s) => {
    const r = all[s.key];
    if (!r) return { skill: s, level: null, need: NEW_NEED, days: Infinity };
    const base = frozen && r.d === today ? (r.m0 < 0 ? null : r.m0) : r.m;
    if (base === null) return { skill: s, level: null, need: NEW_NEED, days: Infinity };
    const level = current(r, today, base), days = Math.max(0, today - r.d);
    return { skill: s, level: Math.round(level), need: 100 - level + Math.min(20, days), days };
  });
}

/** Les compétences à travailler, la plus urgente d'abord, une seule par famille ; à urgence égale, la plus récemment débloquée. */
export function toPractice(p = loadProgress(), today = dayNum()): SkillState[] {
  const pos = (s: Skill) => { const id = s.unlock(); let i = 0, k = 0; for (const u of UNITS) for (const l of u.lessons) { if (l.id === id) i = k; k++; } return i; };
  const st = states(p, today, true).filter((x) => x.skill.practice).sort((a, b) => b.need - a.need || pos(b.skill) - pos(a.skill));
  const seen = new Set<Family>(), out: SkillState[] = [];
  for (const x of st) if (!seen.has(x.skill.family)) { seen.add(x.skill.family); out.push(x); }
  return out;
}
