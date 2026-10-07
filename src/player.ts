import { Follower } from "./follower";
import type { Step } from "./score";

export type Mode = "wait" | "play";

export class Player {
  mode: Mode = "wait";
  tempo = 1;
  playhead = 0;
  once = false;
  /** Mode « En rythme » : à la fin du morceau, la tête de lecture continue (le moteur décide quand s'arrêter). */
  hold = false;
  paused = false;
  onCross: (step: Step) => void;
  onLoopComplete?: () => void;
  onFinished?: () => void;

  private raf = 0;
  private lastTs = 0;

  constructor(private follower: Follower, private onFrame: () => void, onCross: (step: Step) => void, onLoopComplete?: () => void) {
    this.onCross = onCross;
    this.onLoopComplete = onLoopComplete;
  }

  syncToStep() { this.playhead = this.follower.currentTime; }
  setMode(m: Mode) { this.mode = m; this.paused = false; this.syncToStep(); this.restart(); }
  setTempo(t: number) { this.tempo = t; }
  togglePause() { this.paused = !this.paused; return this.paused; }

  restart() {
    cancelAnimationFrame(this.raf);
    this.lastTs = performance.now();
    const loop = (ts: number) => {
      const dt = ts - this.lastTs; this.lastTs = ts;
      if (this.mode === "play" && !this.paused) {
        const prev = this.playhead;
        this.playhead += dt * this.tempo;
        const steps = this.follower.steps, loop = this.follower.loop;
        const crossing = !!loop && prev < loop.end;                       // on est avant la fin de la boucle (dedans ou avant)
        const limit = crossing ? loop!.end : Infinity;
        while (this.follower.index < steps.length && steps[this.follower.index].time <= this.playhead && steps[this.follower.index].time < limit) {
          this.onCross(steps[this.follower.index]);
          this.follower.index++;
        }
        if (crossing && this.playhead >= loop!.end) {                     // fin de boucle : retour au début (aucune note n'est sautée)
          this.onLoopComplete?.();
          this.follower.goTo(this.follower.findIndexAtOrAfter(loop!.start));
          this.playhead = this.follower.currentTime;
        } else if (!crossing && this.follower.index >= steps.length) {      // fin du morceau (si une boucle est active, elle attend sa propre fin)
          if (this.hold) { /* le moteur « en rythme » laisse le temps de jouer la dernière note */ }
          else if (this.once) { this.stop(); this.onFinished?.(); return; }
          else { this.playhead = 0; this.follower.goTo(0); }
        }
      } else if (this.mode === "wait") {
        this.playhead = this.follower.currentTime;
      }
      this.onFrame();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { cancelAnimationFrame(this.raf); }
}
