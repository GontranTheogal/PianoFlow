/** Vrais échantillons de piano (pas des oscillateurs), chargés une fois depuis
 *  /piano-samples.json (inclus dans l'appli, aucun accès réseau nécessaire ensuite).
 *  Le jeu d'échantillons ne couvre pas les 88 touches : les notes manquantes sont
 *  jouées à partir de l'échantillon le plus proche, avec un léger ajustement de hauteur
 *  (playbackRate) — c'est la technique standard, le résultat reste très naturel. */
const NAMES = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"];
function nameToPitch(name: string): number {
  const m = name.match(/^([A-G]s?)(-?\d+)$/)!;
  return NAMES.indexOf(m[1]) + (parseInt(m[2], 10) + 1) * 12;
}

export class Synth {
  private ctx = new AudioContext();
  private samples: Record<string, string> = {};
  private samplePitches: number[] = [];
  private buffers = new Map<number, AudioBuffer>();
  private ready: Promise<void>;
  private metroTimer: number | undefined;
  volume = 0.8;

  constructor() {
    this.ready = fetch(`${import.meta.env.BASE_URL}piano-samples.json`)
      .then((r) => r.json())
      .then((data) => {
        this.samples = data;
        this.samplePitches = Object.keys(data).map(nameToPitch).sort((a, b) => a - b);
      })
      .catch(() => { this.samples = {}; }); // hors-ligne / échec: on retombera sur un bip simple
  }

  private ensure() { if (this.ctx.state === "suspended") this.ctx.resume(); }

  private nearest(pitch: number): number | null {
    if (!this.samplePitches.length) return null;
    let best = this.samplePitches[0];
    for (const p of this.samplePitches) if (Math.abs(p - pitch) < Math.abs(best - pitch)) best = p;
    return best;
  }

  private async bufferFor(samplePitch: number): Promise<AudioBuffer | null> {
    if (this.buffers.has(samplePitch)) return this.buffers.get(samplePitch)!;
    const name = Object.keys(this.samples).find((k) => nameToPitch(k) === samplePitch);
    if (!name) return null;
    try {
      const res = await fetch(this.samples[name]);
      const arr = await res.arrayBuffer();
      const buf = await this.ctx.decodeAudioData(arr);
      this.buffers.set(samplePitch, buf);
      return buf;
    } catch { return null; }
  }

  async playNote(pitch: number, durMs = 1200, velocity = 0.8) {
    this.ensure();
    await this.ready;
    const samplePitch = this.nearest(pitch);
    const buf = samplePitch !== null ? await this.bufferFor(samplePitch) : null;
    if (!buf) { this.beep(pitch, durMs, velocity); return; }

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = Math.pow(2, (pitch - samplePitch!) / 12);
    const gain = this.ctx.createGain();
    gain.gain.value = velocity * this.volume;
    const stopAt = this.ctx.currentTime + durMs / 1000;
    gain.gain.setValueAtTime(velocity * this.volume, stopAt - 0.08);
    gain.gain.linearRampToValueAtTime(0.0001, stopAt);
    src.connect(gain).connect(this.ctx.destination);
    src.start();
    src.stop(stopAt + 0.05);
  }

  /** Repli si les échantillons n'ont pas pu être chargés (hors-ligne sans le fichier livré). */
  private beep(pitch: number, durMs: number, velocity: number) {
    const t0 = this.ctx.currentTime;
    const freq = 440 * Math.pow(2, (pitch - 69) / 12);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(velocity * 0.3 * this.volume, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
    const osc = this.ctx.createOscillator(); osc.type = "triangle"; osc.frequency.value = freq;
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0); osc.stop(t0 + durMs / 1000 + 0.05);
  }

  click(accent: boolean) {
    this.ensure();
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator(); osc.type = "square"; osc.frequency.value = accent ? 1500 : 1000;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.22 * this.volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0); osc.stop(t0 + 0.06);
  }
  startMetronome(bpm: number) {
    this.stopMetronome();
    let beat = 0;
    this.metroTimer = window.setInterval(() => { this.click(beat % 4 === 0); beat++; }, 60000 / bpm);
  }
  stopMetronome() { if (this.metroTimer) clearInterval(this.metroTimer); this.metroTimer = undefined; }
}
