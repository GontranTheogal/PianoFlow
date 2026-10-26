/** Pianos calibrés, gardés dans ce navigateur (localStorage, clé « pianoflow-pianos ») : rien n'est envoyé en ligne.
 *  Ils font partie de la sauvegarde exportable ; à l'import, chaque piano garde sa version la plus récente. */
import { readJson, readStr, writeJson, writeStr } from "../storage";
import { expectFor } from "./calibrate";
import { A0, C8, centsFrom, genericB, genericModel, type KeyModel } from "./model";

const KEY = "pianoflow-pianos", ACTIVE = "pianoflow-piano";

/** Une touche calibrée : fondamentale réelle (Hz), inharmonicité, partiels (dB sous le plus fort, entiers) et niveau des frappes. */
export interface KeyCal { f0: number; B: number; amps: number[]; level: number; at: number; }
export interface PianoProfile {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** touches à calibrer (MIDI) */
  lo: number; hi: number;
  /** frappes demandées par touche */
  takes: number;
  keys: Record<string, KeyCal>;
  /** touches passées (cassées, muettes…) : on ne les redemande pas */
  skipped: number[];
}

const num = (x: unknown, lo: number, hi: number): number | null => (typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi ? x : null);
/** Relit un piano venu du stockage (ou d'une sauvegarde importée) : ce qui est invalide est écarté. */
function clean(id: string, p: any): PianoProfile | null {
  if (!p || typeof p !== "object" || typeof p.name !== "string") return null;
  const lo = num(p.lo, A0, C8), hi = num(p.hi, A0, C8);
  if (lo === null || hi === null || lo > hi) return null;
  const keys: Record<string, KeyCal> = {};
  for (const [k, v] of Object.entries(p.keys && typeof p.keys === "object" ? p.keys : {})) {
    const m = Number(k), c = v as any;
    if (!Number.isInteger(m) || m < A0 || m > C8 || !c) continue;
    const f0 = num(c.f0, 20, 5000), B = num(c.B, 0, 0.1), level = num(c.level, -120, 0);
    if (f0 === null || B === null || !Array.isArray(c.amps) || !c.amps.length) continue;
    keys[m] = { f0, B, amps: c.amps.slice(0, 40).map((a: unknown) => num(a, -99, 0) ?? -99), level: level ?? -30, at: num(c.at, 0, 1e15) ?? 0 };
  }
  return {
    id, name: p.name.slice(0, 60) || "Piano", createdAt: num(p.createdAt, 0, 1e15) ?? 0, updatedAt: num(p.updatedAt, 0, 1e15) ?? 0,
    lo, hi, takes: num(p.takes, 1, 9) ?? 3, keys,
    skipped: Array.isArray(p.skipped) ? p.skipped.filter((m: unknown) => num(m, A0, C8) !== null) : [],
  };
}

function all(): Record<string, unknown> { const o = readJson<Record<string, unknown>>(KEY, {}); return o && typeof o === "object" && !Array.isArray(o) ? o : {}; }
export function listPianos(): PianoProfile[] {
  return Object.entries(all()).map(([id, p]) => clean(id, p)).filter((p): p is PianoProfile => !!p).sort((a, b) => a.createdAt - b.createdAt);
}
export function getPiano(id: string): PianoProfile | null { return id ? clean(id, all()[id]) : null; }
export function savePiano(p: PianoProfile): void {
  const o = all();
  p.updatedAt = Date.now();
  o[p.id] = p;
  writeJson(KEY, o);
}
export function deletePiano(id: string): void {
  const o = all(); delete o[id]; writeJson(KEY, o);
  if (activePianoId() === id) setActivePiano("");
}
/** Piano utilisé par la reconnaissance ; "" = piano bien accordé, sans calibrage. */
export function activePianoId(): string { const id = readStr(ACTIVE, ""); return id && getPiano(id) ? id : ""; }
export function setActivePiano(id: string): void { writeStr(ACTIVE, id); }

export function newPiano(name: string, lo: number, hi: number, takes: number): PianoProfile {
  const now = Date.now();
  return { id: "p" + now.toString(36) + Math.random().toString(36).slice(2, 6), name: name.trim().slice(0, 60) || "Mon piano", createdAt: now, updatedAt: now, lo, hi, takes, keys: {}, skipped: [] };
}

const toDb = (a: number) => (a > 0 ? Math.max(-99, Math.round(20 * Math.log10(a))) : -99);
const fromDb = (d: number) => (d <= -99 ? 0 : 10 ** (d / 20));
/** Enregistre (en mémoire) le calibrage d'une touche ; `savePiano` l'écrit. */
export function setKey(p: PianoProfile, m: number, c: { f0: number; B: number; amps: number[]; level: number }): void {
  p.keys[m] = { f0: Math.round(c.f0 * 1000) / 1000, B: Number(c.B.toPrecision(3)), amps: c.amps.map(toDb), level: Math.round(c.level * 10) / 10, at: Date.now() };
  p.skipped = p.skipped.filter((k) => k !== m);
}
/** Touches de la plage encore à jouer (ni calibrées, ni passées), du grave à l'aigu. */
export function keysToDo(p: PianoProfile): number[] {
  const out: number[] = [];
  for (let m = p.lo; m <= p.hi; m++) if (!p.keys[m] && !p.skipped.includes(m)) out.push(m);
  return out;
}
/** Écart de chaque touche calibrée au piano bien accordé, en cents. */
export function centsMap(p: PianoProfile): Map<number, number> {
  return new Map(Object.entries(p.keys).map(([k, c]) => [Number(k), centsFrom(Number(k), c.f0)]));
}

/** Les 88 gabarits pour la reconnaissance. Touche calibrée : ses valeurs mesurées. Sinon : un piano moyen, décalé comme ses voisines
 *  calibrées (un piano désaccordé l'est d'ordinaire par zones), avec le timbre d'une voisine proche s'il y en a une. */
export function modelsFor(p: PianoProfile | null): KeyModel[] {
  const cents = p ? centsMap(p) : new Map<number, number>(), out: KeyModel[] = [];
  for (let m = A0; m <= C8; m++) {
    const c = p?.keys[m];
    if (c) { out.push({ f0: c.f0, B: c.B, amps: c.amps.map(fromDb) }); continue; }
    const g = genericModel(m, cents.size ? expectFor(m, cents).expect : 0);
    const nb = p ? [m - 1, m + 1, m - 2, m + 2].find((k) => p.keys[k]) : undefined;
    if (nb !== undefined) { const n = p!.keys[nb]; g.amps = n.amps.map(fromDb); g.B = (n.B * genericB(m)) / genericB(nb); }
    out.push(g);
  }
  return out;
}
/** Le piano est-il assez calibré pour qu'on se fie à son timbre (au moins une touche sur deux de sa plage) ? */
export const isCalibrated = (p: PianoProfile | null) => !!p && Object.keys(p.keys).length >= Math.max(1, (p.hi - p.lo + 1) / 2);

/** Accord du piano en bref : écart moyen, écart le plus grand (cents), nombre de touches calibrées. */
export function tuningSummary(p: PianoProfile): { n: number; mean: number; worst: number } {
  const cs = [...centsMap(p).values()];
  if (!cs.length) return { n: 0, mean: 0, worst: 0 };
  const mean = cs.reduce((s, c) => s + c, 0) / cs.length;
  return { n: cs.length, mean, worst: cs.reduce((w, c) => (Math.abs(c) > Math.abs(w) ? c : w), 0) };
}
