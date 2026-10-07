import type { Step, Note } from "./score";
export type Hand = "both" | "R" | "L";

interface Callbacks { onStep: () => void; onEnd: () => void; onLoopComplete?: () => void; }

export class Follower {
  steps: Step[] = [];
  index = 0;
  hand: Hand = "both";
  loop: { start: number; end: number } | null = null;
  private hit = new Set<number>();
  private wrapping = false;
  private noWrap = false;

  constructor(private cb: Callbacks) {}

  active(step: Step): Note[] { return step.notes.filter((n) => this.hand === "both" || n.hand === this.hand); }
  get expected(): Note[] { const s = this.steps[this.index]; return s ? this.active(s) : []; }
  /** Notes du pas courant déjà correctement jouées (pour ne les colorer en vert qu'à ce moment-là). */
  get hitNotes(): Note[] { return this.expected.filter((n) => this.hit.has(n.pitch)); }
  get currentTime(): number { return this.steps[this.index]?.time ?? 0; }

  load(steps: Step[]) { this.steps = steps; this.goTo(0); }
  setHand(h: Hand) { this.hand = h; this.goTo(this.index); }

  /** Déplacement voulu par l'utilisateur (glisser la partition, toucher une note) : on respecte l'endroit choisi,
   *  même s'il est hors de la boucle. La boucle ne se « réveille » que quand on la rejoint. */
  seek(i: number) { this.noWrap = true; try { this.goTo(i); } finally { this.noWrap = false; } }

  goTo(i: number) {
    this.hit.clear();
    let j = i;
    while (j < this.steps.length && this.active(this.steps[j]).length === 0) j++;
    const l = this.loop;
    if (l) {
      const lo = this.findIndexAtOrAfter(l.start), hi = this.findIndexAtOrAfter(l.end);
      if (lo >= hi) this.loop = null;                                                        // boucle vide : on l'abandonne
      else if (j >= hi && !this.noWrap && this.index >= lo && this.index < hi) {             // on vient de finir la boucle en jouant
        if (this.wrapping) this.loop = null;                                                 // aucune note à jouer dedans : on la lâche
        else { this.wrapping = true; this.cb.onLoopComplete?.(); this.goTo(lo); this.wrapping = false; return; }
      }
    }
    if (j >= this.steps.length) { this.index = this.steps.length; this.cb.onEnd(); return; }
    this.index = j;
    this.cb.onStep();
  }
  findIndexAtOrAfter(time: number) { const i = this.steps.findIndex((s) => s.time >= time); return i < 0 ? this.steps.length : i; }
  next() { this.goTo(this.index + 1); }
  prev() { let j = Math.min(this.index, this.steps.length) - 1; while (j > 0 && this.active(this.steps[j]).length === 0) j--; this.goTo(j); }

  noteOn(pitch: number): boolean {
    const exp = this.expected;
    if (!exp.some((n) => n.pitch === pitch)) return false;
    this.hit.add(pitch);
    if (exp.every((n) => this.hit.has(n.pitch))) this.next();
    return true;
  }
}
