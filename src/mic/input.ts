/** Le micro du navigateur, branché sur le détecteur de notes : capture brute (sans les traitements prévus pour la voix, qui abîment
 *  le son d'un piano), AudioWorklet pour recevoir chaque échantillon (repli : ScriptProcessor), et les notes reconnues en sortie,
 *  comme un clavier MIDI. */
import { NoteDetector, type Take } from "./detector";
import type { KeyModel } from "./model";

export type MicState = "off" | "starting" | "on" | "paused" | "denied" | "nodevice" | "unsupported" | "error";
export interface MicStatus { state: MicState; detail: string; }
/** Note reconnue : comme une touche MIDI, plus le retard (ms) entre la frappe et l'annonce, pour juger le rythme à l'instant de la frappe. */
export type MicNote = (pitch: number, velocity: number, on: boolean, lagMs: number) => void;

/** Processeur audio minimal : il renvoie le son du micro par blocs de 512 échantillons. Chargé depuis le code (pas de fichier à part). */
const TAP = `class PfMicTap extends AudioWorkletProcessor {
  constructor() { super(); this.b = new Float32Array(512); this.n = 0; }
  process(inputs) {
    const c = inputs[0] && inputs[0][0];
    if (c) for (let i = 0; i < c.length; i++) { this.b[this.n++] = c[i]; if (this.n === 512) { this.port.postMessage(this.b, [this.b.buffer]); this.b = new Float32Array(512); this.n = 0; } }
    return true;
  }
}
registerProcessor("pf-mic-tap", PfMicTap);`;

export class MicInput {
  status: MicStatus = { state: "off", detail: "Micro éteint" };
  onStatus: (s: MicStatus) => void = () => {};
  /** reçoit les notes reconnues ; l'assistant de calibrage le remplace le temps de ses écrans */
  sink: MicNote = () => {};
  /** latence de sortie du son de l'appli (s) : ses notes arrivent au micro un peu après avoir été lancées */
  outLatency = 0.08;
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private nodes: AudioNode[] = [];
  private det: NoteDetector | null = null;
  private calibrated = false;
  private sens = 1;
  private capture: ((t: Take) => void) | null = null;
  private lastFeed = 0;
  private opening: Promise<boolean> | null = null;
  private hintSig = "";
  private resumeArmed = false;

  constructor(private models: KeyModel[]) {}

  /** Micro ouvert (il peut attendre un geste pour démarrer). */
  get open(): boolean { return !!this.ctx; }
  /** Micro qui écoute vraiment. */
  get listening(): boolean { return this.status.state === "on"; }
  get level(): number { return this.det?.level ?? -100; }

  /** Ouvre le micro (la première fois, le navigateur demande l'autorisation). Vrai si le micro est ouvert. */
  start(): Promise<boolean> {
    this.wanted = true;
    if (this.ctx) { this.resume(); return Promise.resolve(true); }
    return (this.opening ??= this.openMic().finally(() => (this.opening = null)));
  }
  /** faux dès qu'on a demandé l'arrêt : un micro autorisé après coup (fenêtre d'autorisation encore ouverte) est aussitôt refermé */
  private wanted = false;

  private async openMic(): Promise<boolean> {
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === "undefined") {
      this.set("unsupported", "Ce navigateur ne donne pas accès au micro (il faut une page en https).");
      return false;
    }
    this.set("starting", "Ouverture du micro…");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
    } catch (e) {
      const name = (e as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") this.set("denied", "Accès au micro refusé. Autorise-le pour ce site dans le navigateur (icône à gauche de l'adresse), puis réessaie.");
      else if (name === "NotFoundError" || name === "OverconstrainedError") this.set("nodevice", "Aucun micro trouvé sur cet appareil.");
      else this.set("error", "Micro indisponible : " + ((e as Error)?.message ?? e));
      return false;
    }
    if (!this.wanted) { stream.getTracks().forEach((t) => t.stop()); this.set("off", "Micro éteint"); return false; }
    const ctx = new AudioContext({ latencyHint: "interactive" });
    try {
      const src = ctx.createMediaStreamSource(stream), mute = ctx.createGain();
      mute.gain.value = 0;                                     // le nœud doit être relié à la sortie pour être appelé, mais muet
      let tap: AudioNode;
      try {
        const url = URL.createObjectURL(new Blob([TAP], { type: "text/javascript" }));
        try { await ctx.audioWorklet.addModule(url); } finally { URL.revokeObjectURL(url); }
        const node = new AudioWorkletNode(ctx, "pf-mic-tap", { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: "explicit" });
        node.port.onmessage = (e) => this.feed(e.data as Float32Array);
        tap = node;
      } catch {
        const sp = ctx.createScriptProcessor(1024, 1, 1);    // navigateurs anciens
        sp.onaudioprocess = (e) => this.feed(new Float32Array(e.inputBuffer.getChannelData(0)));
        tap = sp;
      }
      src.connect(tap); tap.connect(mute).connect(ctx.destination);
      this.nodes = [src, tap, mute];
    } catch (e) {
      stream.getTracks().forEach((t) => t.stop()); void ctx.close();
      this.set("error", "Micro indisponible : " + ((e as Error)?.message ?? e));
      return false;
    }
    if (!this.wanted) {                                       // arrêt demandé pendant le chargement du processeur audio
      stream.getTracks().forEach((t) => t.stop()); for (const n of this.nodes) n.disconnect(); this.nodes = []; void ctx.close();
      this.set("off", "Micro éteint");
      return false;
    }
    this.ctx = ctx; this.stream = stream;
    const det = (this.det = new NoteDetector(ctx.sampleRate, this.models));
    det.setModels(this.models, this.calibrated); det.sensitivity = this.sens; this.applyCapture();
    const lat = (stream.getAudioTracks()[0]?.getSettings() as { latency?: number } | undefined)?.latency;
    if (typeof lat === "number" && lat >= 0 && lat < 0.5) det.inputLag = lat * 1000 + 5;
    stream.getAudioTracks()[0]?.addEventListener("ended", () => { this.stop(); this.set("error", "Le micro a été débranché ou coupé."); });
    ctx.onstatechange = () => this.refresh();
    this.refresh();
    return true;
  }

  /** Coupe le micro (le navigateur cesse d'enregistrer). Les notes qui sonnaient sont relâchées. */
  stop(): void {
    this.wanted = false;
    for (const p of this.det?.sounding ?? []) this.sink(p, 0, false, 0);
    this.stream?.getTracks().forEach((t) => t.stop());
    for (const n of this.nodes) n.disconnect();
    void this.ctx?.close().catch(() => {});
    this.ctx = null; this.stream = null; this.nodes = []; this.det = null; this.hintSig = "";
    this.set("off", "Micro éteint");
  }

  /** Gabarits des touches (piano choisi, calibré ou non). */
  setModels(models: KeyModel[], calibrated: boolean): void {
    this.models = models; this.calibrated = calibrated;
    this.det?.setModels(models, calibrated); this.det?.reset();
  }
  setSensitivity(s: number): void { this.sens = s; if (this.det) this.det.sensitivity = s; }
  /** Calibrage : chaque frappe brute est confiée à `fn`, et plus aucune note n'est annoncée. `null` : reconnaissance normale. */
  setCapture(fn: ((t: Take) => void) | null): void { this.capture = fn; this.applyCapture(); }
  private applyCapture() { if (this.det) { this.det.capture = this.capture; this.det.detect = !this.capture; } }
  /** Notes attendues par la partition à l'instant présent. */
  setHint(pitches: number[]): void {
    const sig = pitches.join(",");
    if (sig === this.hintSig || !this.det) return;
    this.hintSig = sig; this.det.setHint(pitches);
  }
  /** L'appli joue elle-même `pitch` (haut-parleurs) pendant `ms` : le micro va l'entendre, ce n'est pas le pianiste. */
  echoNote(pitch: number, ms: number, tail = 0.5): void {
    const d = this.det; if (!d) return;
    const t = d.time + (performance.now() - this.lastFeed) / 1000;
    d.addEcho(pitch, t - 0.03, t + this.outLatency + ms / 1000 + tail);
  }
  /** Un clic de métronome (onde carrée) : ses partiels impairs tombent sur quelques touches aiguës. */
  echoTone(freq: number, ms: number): void {
    for (let f = freq; f < 9000; f += 2 * freq) {
      const m = 69 + 12 * Math.log2(f / 440);
      for (const p of new Set([Math.floor(m), Math.ceil(m)])) if (p >= 21 && p <= 108) this.echoNote(p, ms, 0.1);
    }
  }

  private feed(chunk: Float32Array) {
    const d = this.det; if (!d) return;
    this.lastFeed = performance.now();
    for (const e of d.push(chunk)) this.sink(e.pitch, e.velocity, e.on, e.lag);
  }
  private resume() {
    const ctx = this.ctx; if (!ctx || ctx.state !== "suspended") return;
    void ctx.resume().catch(() => {});
  }
  /** Le navigateur ne laisse démarrer le son qu'après un geste (toucher, clic, touche) : on attend le premier. */
  private armResume() {
    if (this.resumeArmed) return;
    this.resumeArmed = true;
    const go = () => { this.resumeArmed = false; for (const ev of EVENTS) window.removeEventListener(ev, go, true); this.resume(); };
    for (const ev of EVENTS) window.addEventListener(ev, go, true);
  }
  private refresh() {
    const st = this.ctx?.state;
    if (st === "running") this.set("on", "Micro : à l'écoute");
    else if (st === "suspended" || (st as string) === "interrupted") { this.set("paused", "Micro en attente : touche l'écran pour qu'il écoute"); this.armResume(); }
  }
  private set(state: MicState, detail: string) { this.status = { state, detail }; this.onStatus(this.status); }
}
const EVENTS = ["pointerdown", "keydown", "touchend"];
