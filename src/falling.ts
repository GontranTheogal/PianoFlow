import type { Note } from "./score";
import { TOTAL_WIDTH, FIRST, LAST, keyGeometry, isBlack } from "./keyboardLayout";
import { noteName } from "./names";

interface Spark { x: number; y: number; vx: number; vy: number; life: number; size: number; color: string; }
type RGB = [number, number, number];
function toRgb(hex: string): RGB { const n = parseInt(hex.replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: RGB, a = 1) => `rgba(${clamp(c[0])},${clamp(c[1])},${clamp(c[2])},${a})`;
const WHITE: RGB = [255, 255, 255], BLACK: RGB = [0, 0, 0];

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** Notes qui tombent, style Synthesia : fond sombre sobre, repères Do/Fa, barres colorées par main,
 *  et vert quand la note est jouée. */
export class FallingNotes {
  private ctx: CanvasRenderingContext2D;
  private notes: Note[] = [];
  private measureTimes: number[] = [];
  private lookaheadMs = 2800;
  private colors: Record<"R" | "L", RGB> = { R: toRgb("#4aa3ff"), L: toRgb("#ff9f43") };
  private okColor: RGB = toRgb("#22c55e");
  private showNames = false;
  private sparks: Spark[] = [];
  private lastPlayhead = 0;
  private lastTs = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setNotes(notes: Note[]) { this.notes = notes; }
  setMeasureTimes(t: number[]) { this.measureTimes = t; }
  setColors(r: string, l: string, ok: string) { this.colors = { R: toRgb(r), L: toRgb(l) }; this.okColor = toRgb(ok); }
  setShowNames(v: boolean) { this.showNames = v; }
  burst(n: Note) { this.spawn(n); }

  render(playhead: number, mode: "wait" | "play", hitIds: Set<string>, expectedIds: Set<string>) {
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    if (w < 2 || h < 2) return;
    const ctx = this.ctx;
    const now = performance.now();
    const dt = Math.min(64, now - (this.lastTs || now)); this.lastTs = now;
    const ph = playhead;
    const scaleX = w / TOTAL_WIDTH;
    const hitY = h;
    const pxPerMs = (h - 4) / this.lookaheadMs;
    const yOf = (t: number) => hitY - (t - ph) * pxPerMs;

    // fond
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#1b1c21"); bg.addColorStop(1, "#24262d");
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

    // colonnes des touches noires (très discrètes) + traits à chaque Do (marqué) et Fa
    ctx.fillStyle = "rgba(255,255,255,0.028)";
    for (let p = FIRST; p <= LAST; p++) if (isBlack(p)) { const g = keyGeometry(p); ctx.fillRect(g.x * scaleX, 0, g.width * scaleX, h); }
    for (let p = FIRST; p <= LAST; p++) {
      const pc = p % 12;
      if (pc !== 0 && pc !== 5) continue;
      ctx.fillStyle = pc === 0 ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.07)";
      ctx.fillRect(Math.round(keyGeometry(p).x * scaleX), 0, 1, h);
    }
    // lignes de mesure
    ctx.fillStyle = "rgba(255,255,255,0.09)";
    for (const mt of this.measureTimes) { const y = yOf(mt); if (y >= -2 && y <= h) ctx.fillRect(0, Math.round(y), w, 1); }

    // étincelles d'attaque en mode lecture
    if (mode === "play") {
      const d = ph - this.lastPlayhead;
      if (d > 0 && d < 250) for (const n of this.notes) if (n.onTime > this.lastPlayhead && n.onTime <= ph) this.spawn(n);
    }
    this.lastPlayhead = ph;

    const glowAt = new Map<number, Note>();
    for (const n of this.notes) {
      if (n.offTime < ph || n.onTime > ph + this.lookaheadMs) continue;
      const { x, width } = keyGeometry(n.pitch);
      const black = isBlack(n.pitch);
      const bottom = Math.min(hitY, yOf(n.onTime)), top = yOf(n.offTime);
      const height = Math.max(8, bottom - top);
      const gap = 1.4;
      const rx = x * scaleX + gap, rw = Math.max(2, width * scaleX - gap * 2);
      const isHit = hitIds.has(n.id), isExp = expectedIds.has(n.id);
      const sounding = mode === "play" ? n.onTime <= ph && n.offTime > ph : isExp && Math.abs(n.onTime - ph) < 40;
      const live = sounding || isHit;
      if (live) glowAt.set(n.pitch, n);

      let base = isHit ? this.okColor : this.colors[n.hand];
      if (black) base = mix(base, BLACK, 0.16);
      const rad = Math.min(6, rw / 2, height / 2);
      ctx.save();
      if (live) { ctx.shadowColor = css(base, 0.9); ctx.shadowBlur = 16; }
      const g = ctx.createLinearGradient(0, top, 0, top + height);
      g.addColorStop(0, css(mix(base, WHITE, live ? 0.32 : 0.18))); g.addColorStop(1, css(mix(base, BLACK, live ? 0 : 0.1)));
      ctx.fillStyle = g; rr(ctx, rx, top, rw, height, rad); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1; ctx.strokeStyle = css(mix(base, WHITE, 0.6), 0.6);
      rr(ctx, rx + 0.5, top + 0.5, rw - 1, height - 1, Math.max(0, rad - 0.5)); ctx.stroke();
      ctx.restore();

      // pastille de doigté (seulement si renseigné) et nom de la note
      let labelY = bottom - 13;
      const cx = rx + rw / 2;
      if (n.finger && rw >= 14 && height >= 26) {
        ctx.fillStyle = "rgba(10,12,20,0.55)"; ctx.beginPath(); ctx.arc(cx, labelY, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = "700 11px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(n.finger), cx, labelY + 0.5);
        labelY -= 18;
      }
      if (this.showNames && rw >= 17 && height >= (labelY < bottom - 13 ? 46 : 26)) {
        ctx.fillStyle = "rgba(10,12,20,0.85)"; ctx.font = "700 11px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(noteName(n.pitch).replace(/-?\d+$/, ""), cx, labelY + 0.5);
      }
      ctx.textBaseline = "alphabetic";
    }

    // lueur au niveau du clavier pour les notes actives
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const [p, n] of glowAt) {
      const { x, width } = keyGeometry(p);
      const cx = (x + width / 2) * scaleX, rad = Math.max(30, width * scaleX * 2.4);
      const col = mix(this.colors[n.hand], WHITE, 0.15);
      const rg = ctx.createRadialGradient(cx, hitY, 0, cx, hitY, rad);
      rg.addColorStop(0, css(col, 0.5)); rg.addColorStop(1, css(col, 0));
      ctx.fillStyle = rg; ctx.fillRect(cx - rad, hitY - rad, rad * 2, rad);
    }
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.22)"; ctx.fillRect(0, hitY - 1, w, 1);
    this.drawSparks(dt);
  }

  private spawn(n: Note) {
    const { x, width } = keyGeometry(n.pitch);
    const r = this.canvas.getBoundingClientRect();
    const scaleX = r.width / TOTAL_WIDTH;
    const cx = (x + width / 2) * scaleX, y = r.height - 2;
    const col = css(mix(this.colors[n.hand], WHITE, 0.35));
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * (0.15 + Math.random() * 0.7), sp = 0.08 + Math.random() * 0.2;
      this.sparks.push({ x: cx + (Math.random() - 0.5) * width * scaleX * 0.6, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, size: 1 + Math.random() * 1.5, color: col });
    }
  }

  private drawSparks(dt: number) {
    const ctx = this.ctx;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    this.sparks = this.sparks.filter((s) => s.life > 0);
    for (const s of this.sparks) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 0.0004 * dt; s.life -= dt / 600;
      const a = Math.max(0, s.life), r = s.size * 3;
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
      g.addColorStop(0, s.color.replace(/[\d.]+\)$/, `${a})`)); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(s.x - r, s.y - r, r * 2, r * 2);
    }
    ctx.restore();
  }
}
