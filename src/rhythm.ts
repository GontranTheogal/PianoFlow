/** Jugement « en rythme » : chaque note attendue doit être jouée au bon moment (tolérance en temps réel, indépendante du tempo).
 *  Logique pure (testable) : le moteur de jeu lui passe les notes de la main travaillée et les frappes avec leur instant (temps de partition). */

export interface TimedNote { id: string; pitch: number; onTime: number; measure: number; }
export type Verdict = "perfect" | "good" | "early" | "late" | "miss";
export interface RhythmSummary {
  total: number; perfect: number; good: number; early: number; late: number; miss: number; wrong: number;
  /** % de notes jouées (justes, même un peu décalées) */ accuracy: number;
  /** % de notes dans le temps parmi les notes jouées */ timing: number;
  /** note globale 0-100 : justesse et précision rythmique, fausses notes pénalisées */ score: number;
  /** mesures (index à partir de 0) où il y a eu le plus de soucis, les pires d'abord */ weak: number[];
}

/** Fenêtres en millisecondes RÉELLES ; « tempo » = vitesse de lecture (1 = 100 %). */
export const WINDOWS = { perfect: 70, good: 140, max: 260 };

export class RhythmJudge {
  private pending: TimedNote[];
  private byId: Map<string, TimedNote>;
  private verdicts = new Map<string, Verdict>();
  private wrongByMeasure = new Map<number, number>();
  wrong = 0;
  constructor(notes: TimedNote[], private tempo = 1) {
    this.pending = [...notes].sort((a, b) => a.onTime - b.onTime);
    this.byId = new Map(notes.map((n) => [n.id, n]));
  }
  /** Fenêtre en temps de partition. */
  private w(ms: number) { return ms * this.tempo; }

  /** Une touche frappée à l'instant `t` (temps de partition). */
  press(pitch: number, t: number): { verdict: Verdict | "wrong"; note?: TimedNote; dt: number } {
    let best: TimedNote | null = null, bd = Infinity;
    for (const n of this.pending) {
      if (n.onTime - t > this.w(WINDOWS.max)) break;
      if (n.pitch !== pitch) continue;
      const d = Math.abs(n.onTime - t);
      if (d <= this.w(WINDOWS.max) && d < bd) { bd = d; best = n; }
    }
    if (!best) {
      this.wrong++;
      const m = this.measureAt(t); this.wrongByMeasure.set(m, (this.wrongByMeasure.get(m) ?? 0) + 1);
      return { verdict: "wrong", dt: 0 };
    }
    const dtReal = (t - best.onTime) / this.tempo;
    const v: Verdict = Math.abs(dtReal) <= WINDOWS.perfect ? "perfect" : Math.abs(dtReal) <= WINDOWS.good ? "good" : dtReal < 0 ? "early" : "late";
    this.verdicts.set(best.id, v);
    this.pending = this.pending.filter((n) => n !== best);
    return { verdict: v, note: best, dt: dtReal };
  }
  private lastMeasure = 0;
  private measureAt(t: number) {
    let m = this.lastMeasure;
    for (const n of this.pending) { if (n.onTime > t + this.w(WINDOWS.max)) break; m = n.measure; if (n.onTime >= t) break; }
    return m;
  }
  /** Appelé à chaque image : les notes dont la fenêtre est passée sont manquées. */
  advance(t: number): TimedNote[] {
    const missed: TimedNote[] = [];
    while (this.pending.length && this.pending[0].onTime < t - this.w(WINDOWS.max)) {
      const n = this.pending.shift()!; this.verdicts.set(n.id, "miss"); missed.push(n); this.lastMeasure = n.measure;
    }
    return missed;
  }
  /** Fin du passage : tout ce qui reste est manqué. */
  finish(): RhythmSummary {
    for (const n of this.pending) this.verdicts.set(n.id, "miss");
    this.pending = [];
    return this.summary();
  }
  verdict(id: string) { return this.verdicts.get(id); }
  get remaining() { return this.pending.length; }

  summary(): RhythmSummary {
    const c = { perfect: 0, good: 0, early: 0, late: 0, miss: 0 };
    for (const v of this.verdicts.values()) c[v]++;
    const total = this.verdicts.size, played = total - c.miss;
    const accuracy = total ? Math.round((played / total) * 100) : 100;
    const timing = played ? Math.round(((c.perfect + c.good) / played) * 100) : 0;
    const raw = total ? (c.perfect + 0.85 * c.good + 0.5 * (c.early + c.late) - 0.5 * this.wrong) / total : 1;
    const score = Math.max(0, Math.min(100, Math.round(raw * 100)));
    // mesures faibles : manquées / décalées / fausses notes
    const bad = new Map<number, number>(this.wrongByMeasure);
    for (const [id, v] of this.verdicts) {
      if (v === "perfect" || v === "good") continue;
      const n = this.byId.get(id); if (!n) continue;
      bad.set(n.measure, (bad.get(n.measure) ?? 0) + (v === "miss" ? 2 : 1));
    }
    const weak = [...bad.entries()].filter(([, k]) => k >= 2).sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 3).map(([m]) => m);
    return { total, ...c, wrong: this.wrong, accuracy, timing, score, weak };
  }
}
