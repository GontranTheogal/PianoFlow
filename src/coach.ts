/** Coach de morceau : la méthode qu'un professeur fait suivre pour apprendre un morceau, automatisée.
 *  Le morceau est découpé en sections de quelques mesures ; chaque section passe par des étapes
 *  (main droite, main gauche, mains ensemble pas à pas, puis en rythme à vitesse croissante),
 *  enfin le morceau entier en rythme. Une étape est validée par un passage réussi (score ≥ seuil).
 *  Logique pure ; la progression est rangée sous forme de nombres (fusion « meilleur des deux » entre appareils). */

import { readJson, writeJson } from "./storage";
export type CoachHand = "R" | "L" | "both";
export interface CoachStage { label: string; hand: CoachHand; mode: "step" | "rhythm"; speed: number; pass: number; }
export interface Section { a: number; b: number; }   // mesures [a, b[
/** Partie d'un long morceau : quelques sections à enchaîner (mesures [a, b[, sections [s0, s1[). */
export interface Part extends Section { s0: number; s1: number; }
export interface CoachProgress {
  /** étapes réussies par section */ sec: Record<string, number>; /** étapes réussies sur le morceau entier */ full: number;
  /** étapes réussies par partie (enchaînements des longs morceaux) */ part?: Record<string, number>;
  /** avancement en % (pour l'affichage sans recharger le morceau) */ pct?: number; /** dernier passage validé (ms) */ at?: number;
}
export type CoachTarget =
  | { kind: "section"; index: number; section: Section; stage: CoachStage; stageIndex: number }
  | { kind: "part"; index: number; section: Part; stage: CoachStage; stageIndex: number }
  | { kind: "full"; stage: CoachStage; stageIndex: number }
  | { kind: "done" };

export function stagesFor(hasR: boolean, hasL: boolean): CoachStage[] {
  const out: CoachStage[] = [];
  const both = hasR && hasL;
  if (hasR) out.push({ label: "Main droite · pas à pas", hand: "R", mode: "step", speed: 100, pass: 90 });
  if (hasL) out.push({ label: "Main gauche · pas à pas", hand: "L", mode: "step", speed: 100, pass: 90 });
  const h: CoachHand = both ? "both" : hasR ? "R" : "L";
  if (both) out.push({ label: "Mains ensemble · pas à pas", hand: "both", mode: "step", speed: 100, pass: 90 });
  out.push({ label: `${both ? "Mains ensemble · " : ""}en rythme, lent (60 %)`, hand: h, mode: "rhythm", speed: 60, pass: 85 });
  out.push({ label: `${both ? "Mains ensemble · " : ""}en rythme (80 %)`, hand: h, mode: "rhythm", speed: 80, pass: 85 });
  return out;
}
export function fullStagesFor(hasR: boolean, hasL: boolean): CoachStage[] {
  const h: CoachHand = hasR && hasL ? "both" : hasR ? "R" : "L";
  return [
    { label: "Morceau entier · en rythme (80 %)", hand: h, mode: "rhythm", speed: 80, pass: 85 },
    { label: "Morceau entier · au tempo (100 %)", hand: h, mode: "rhythm", speed: 100, pass: 90 },
  ];
}

/** Enchaîner les sections d'une partie : pas à pas, puis en rythme. */
export function partStagesFor(hasR: boolean, hasL: boolean): CoachStage[] {
  const h: CoachHand = hasR && hasL ? "both" : hasR ? "R" : "L";
  return [
    { label: "Enchaînement · pas à pas", hand: h, mode: "step", speed: 100, pass: 90 },
    { label: "Enchaînement · en rythme (80 %)", hand: h, mode: "rhythm", speed: 80, pass: 85 },
  ];
}
/** Un long morceau (plus de 4 sections) se découpe en parties de 3 ou 4 sections (une douzaine de mesures),
 *  qu'on enchaîne avant de passer à la suivante : on n'attaque jamais le morceau entier directement après les sections. */
export function partsFor(secs: Section[]): Part[] {
  if (secs.length <= 4) return [];
  const size = secs.length <= 6 ? Math.ceil(secs.length / 2) : (secs[0].b - secs[0].a) >= 4 ? 3 : 4;
  const out: Part[] = [];
  for (let s0 = 0; s0 < secs.length; s0 += size) { const s1 = Math.min(secs.length, s0 + size); out.push({ s0, s1, a: secs[s0].a, b: secs[s1 - 1].b }); }
  const last = out[out.length - 1];
  if (out.length > 1 && last.s1 - last.s0 === 1) { out.pop(); const prev = out[out.length - 1]; prev.s1 = last.s1; prev.b = last.b; }
  return out;
}

/** Découpe en sections : environ 4 mesures (2 si le passage est dense), jamais une section d'une seule mesure isolée à la fin. */
export function sectionsFor(notesPerMeasure: number[]): Section[] {
  const M = notesPerMeasure.length;
  if (!M) return [];
  const avg = notesPerMeasure.reduce((a, b) => a + b, 0) / M;
  const size = avg > 14 ? 2 : avg > 7 ? 3 : 4;
  if (M <= size + 1) return [{ a: 0, b: M }];
  const out: Section[] = [];
  for (let a = 0; a < M; a += size) out.push({ a, b: Math.min(M, a + size) });
  const last = out[out.length - 1];
  if (last.b - last.a === 1 && out.length > 1) { out.pop(); out[out.length - 1].b = M; }
  return out;
}

export const emptyProgress = (): CoachProgress => ({ sec: {}, full: 0 });

/** Prochaine étape à travailler : partie par partie, ses sections puis leur enchaînement ; enfin le morceau entier. */
export function nextTarget(p: CoachProgress, secs: Section[], stages: CoachStage[], full: CoachStage[], parts: Part[] = [], partStages: CoachStage[] = []): CoachTarget {
  const groups = parts.length ? parts : [{ s0: 0, s1: secs.length, a: 0, b: 0 }];
  for (let g = 0; g < groups.length; g++) {
    for (let i = groups[g].s0; i < groups[g].s1; i++) {
      const done = p.sec[String(i)] ?? 0;
      if (done < stages.length) return { kind: "section", index: i, section: secs[i], stage: stages[done], stageIndex: done };
    }
    if (parts.length) {
      const done = p.part?.[String(g)] ?? 0;
      if (done < partStages.length) return { kind: "part", index: g, section: parts[g], stage: partStages[done], stageIndex: done };
    }
  }
  if (p.full < full.length) return { kind: "full", stage: full[p.full], stageIndex: p.full };
  return { kind: "done" };
}

export interface PassInfo { mode: "step" | "rhythm"; score: number; speed: number; hand: CoachHand; loop: Section | null; }
/** Un passage valide-t-il l'étape visée ? */
export function passMatches(t: CoachTarget, r: PassInfo): boolean {
  if (t.kind === "done") return false;
  const s = t.stage;
  if (r.mode !== s.mode || r.hand !== s.hand || r.speed < s.speed || r.score < s.pass) return false;
  if (t.kind === "section" || t.kind === "part") return !!r.loop && r.loop.a <= t.section.a && r.loop.b >= t.section.b;
  return !r.loop;
}
export function advance(p: CoachProgress, t: CoachTarget): CoachProgress {
  if (t.kind === "section") return { ...p, sec: { ...p.sec, [String(t.index)]: Math.max(p.sec[String(t.index)] ?? 0, t.stageIndex + 1) } };
  if (t.kind === "part") return { ...p, part: { ...(p.part ?? {}), [String(t.index)]: Math.max(p.part?.[String(t.index)] ?? 0, t.stageIndex + 1) } };
  if (t.kind === "full") return { ...p, full: Math.max(p.full, t.stageIndex + 1) };
  return p;
}
/** Avancement global (0 à 1). */
export function progressRatio(p: CoachProgress, secs: Section[], stages: CoachStage[], full: CoachStage[], parts: Part[] = [], partStages: CoachStage[] = []): number {
  const total = secs.length * stages.length + parts.length * partStages.length + full.length;
  if (!total) return 0;
  const done = secs.reduce((s, _, i) => s + Math.min(stages.length, p.sec[String(i)] ?? 0), 0)
    + parts.reduce((s, _, i) => s + Math.min(partStages.length, p.part?.[String(i)] ?? 0), 0) + Math.min(full.length, p.full);
  return done / total;
}

// ── stockage ──
const KEY = "pianoflow-coach";
export function loadAll(): Record<string, CoachProgress> { return readJson<Record<string, CoachProgress>>(KEY, {}); }
export function loadCoach(id: string): CoachProgress { const p = loadAll()[id]; return { sec: p?.sec ?? {}, full: p?.full ?? 0, part: p?.part ?? {}, pct: p?.pct ?? 0, at: p?.at ?? 0 }; }
export function saveCoach(id: string, p: CoachProgress) { const all = loadAll(); all[id] = p; writeJson(KEY, all); }
