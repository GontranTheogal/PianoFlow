/** Petit clavier SVG cliquable, indépendant du clavier de jeu (parcours, exercices, gammes, solfège).
 *  - La plage demandée est TOUJOURS visible ; elle est élargie pour remplir la largeur disponible (touches à taille de doigt).
 *  - Chaque instance a ses propres dégradés (des id partagés entre plusieurs claviers cassaient le rendu quand le premier était masqué).
 *  - Repères (marques, pastilles, noms) conservés quand le clavier se redessine (changement de taille). */
const NS = "http://www.w3.org/2000/svg";
const BLACKS = new Set([1, 3, 6, 8, 10]);
const NAMES_FR = ["Do", "Ré", "Mi", "Fa", "Sol", "La", "Si"];
const WW = 24, BW = 14, WH = 150, BH = 92;
type MarkCls = "ok" | "bad" | "target" | "sel";
let uid = 0;

export class MiniKeyboard {
  private svg: SVGSVGElement | null = null;
  private keys = new Map<number, SVGRectElement>();
  private want: [number, number] = [48, 72];
  private shown: [number, number] = [48, 72];
  private marks = new Map<number, Set<MarkCls>>();
  private labels: { p: number; text: string; cls: string }[] = [];
  private id = ++uid;
  private fill = true;
  namesOn = true;

  constructor(private host: HTMLElement, private onPress: (p: number) => void, private onRelease?: (p: number) => void) {
    host.addEventListener("pointerdown", (e) => {
      const t = (e.target as Element).closest("[data-p]") as SVGElement | null;
      if (!t) return;
      e.preventDefault();
      const p = Number(t.getAttribute("data-p"));
      this.onPress(p);
      if (this.onRelease) {
        const up = () => { this.onRelease!(p); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };
        window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
      }
    });
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => { if (this.svg && this.fill) { const r = this.fitted(); if (r[0] !== this.shown[0] || r[1] !== this.shown[1]) this.draw(); } }).observe(host);
  }

  /** Plage à montrer au minimum ; `fill` : l'élargir pour remplir la largeur du conteneur. */
  setRange(lo: number, hi: number, fill = true) {
    this.want = [lo, hi]; this.fill = fill;
    this.marks.clear(); this.labels = [];
    this.draw();
  }
  get range(): [number, number] { return [...this.shown] as [number, number]; }

  private fitted(): [number, number] {
    let [lo, hi] = this.want;
    while (BLACKS.has(((lo % 12) + 12) % 12)) lo--;
    while (BLACKS.has(((hi % 12) + 12) % 12)) hi++;
    if (!this.fill) return [lo, hi];
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return this.shown[0] <= lo && this.shown[1] >= hi ? this.shown : [lo, hi];
    // nombre de touches blanches pour que le clavier occupe toute la largeur (rapport des touches réelles)
    const want = Math.max(8, Math.min(52, Math.floor((w / Math.max(60, h)) * (WH / WW))));
    const whites = (a: number, b: number) => { let n = 0; for (let m = a; m <= b; m++) if (!BLACKS.has(m % 12)) n++; return n; };
    let flip = false;
    while (whites(lo, hi) < want && (lo > 21 || hi < 108)) {
      if ((flip && lo > 21) || hi >= 108) { lo--; while (BLACKS.has(lo % 12)) lo--; } else { hi++; while (BLACKS.has(hi % 12)) hi++; }
      flip = !flip;
    }
    return [lo, hi];
  }

  private draw() {
    const [lo, hi] = this.fitted(); this.shown = [lo, hi];
    this.host.innerHTML = ""; this.keys.clear();
    const whites: number[] = []; for (let p = lo; p <= hi; p++) if (!BLACKS.has(p % 12)) whites.push(p);
    const idx = new Map(whites.map((p, i) => [p, i]));
    const gw = `mkw${this.id}`, gb = `mkb${this.id}`;
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${whites.length * WW} ${WH}`); svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.innerHTML = `<defs><linearGradient id="${gw}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f1ea"/><stop offset=".85" stop-color="#fff"/><stop offset="1" stop-color="#e2ddd2"/></linearGradient>
      <linearGradient id="${gb}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c1c20"/><stop offset=".85" stop-color="#2f2f36"/><stop offset="1" stop-color="#0f0f12"/></linearGradient></defs>`;
    const gW = document.createElementNS(NS, "g"), gB = document.createElementNS(NS, "g"), gT = document.createElementNS(NS, "g");
    for (const p of whites) {
      const r = document.createElementNS(NS, "rect");
      r.setAttribute("class", "sk sk-w"); r.setAttribute("data-p", String(p)); r.setAttribute("fill", `url(#${gw})`);
      r.setAttribute("x", String(idx.get(p)! * WW + 0.4)); r.setAttribute("y", "0"); r.setAttribute("width", String(WW - 0.8)); r.setAttribute("height", String(WH)); r.setAttribute("rx", "3");
      gW.appendChild(r); this.keys.set(p, r);
      const li = [0, 2, 4, 5, 7, 9, 11].indexOf(p % 12);
      const t = document.createElementNS(NS, "text");
      t.setAttribute("class", "sk-name" + (p % 12 === 0 ? " sk-c" : "")); t.setAttribute("x", String(idx.get(p)! * WW + WW / 2)); t.setAttribute("y", String(WH - 8));
      t.textContent = NAMES_FR[li] + (p % 12 === 0 ? String(Math.floor(p / 12) - 1) : "");
      gT.appendChild(t);
    }
    for (let p = lo; p <= hi; p++) {
      if (!BLACKS.has(p % 12) || !idx.has(p - 1)) continue;
      const r = document.createElementNS(NS, "rect");
      r.setAttribute("class", "sk sk-b"); r.setAttribute("data-p", String(p)); r.setAttribute("fill", `url(#${gb})`);
      r.setAttribute("x", String(idx.get(p - 1)! * WW + WW - BW / 2)); r.setAttribute("y", "0"); r.setAttribute("width", String(BW)); r.setAttribute("height", String(BH)); r.setAttribute("rx", "2.5");
      gB.appendChild(r); this.keys.set(p, r);
    }
    svg.append(gW, gT, gB); this.host.appendChild(svg); this.svg = svg;
    svg.classList.toggle("names", this.namesOn);
    for (const [p, cls] of this.marks) for (const c of cls) this.keys.get(p)?.classList.add("m-" + c);
    for (const l of this.labels) this.drawLabel(l.p, l.text, l.cls);
  }

  showNames(on: boolean) { this.namesOn = on; this.svg?.classList.toggle("names", on); }
  /** Pastille (n° de doigt, degré…) posée sur une touche. */
  label(p: number, text: string, cls = "") { this.labels.push({ p, text, cls }); this.drawLabel(p, text, cls); }
  private drawLabel(p: number, text: string, cls: string) {
    const k = this.keys.get(p); if (!k || !this.svg) return;
    const x = Number(k.getAttribute("x")) + Number(k.getAttribute("width")) / 2, black = k.classList.contains("sk-b"), y = black ? 70 : 118;
    const g = document.createElementNS(NS, "g"); g.setAttribute("class", "sk-lab " + cls); g.setAttribute("pointer-events", "none");
    const c = document.createElementNS(NS, "circle"); c.setAttribute("cx", String(x)); c.setAttribute("cy", String(y)); c.setAttribute("r", "7.5");
    const t = document.createElementNS(NS, "text"); t.setAttribute("x", String(x)); t.setAttribute("y", String(y + 3.2)); t.textContent = text;
    g.append(c, t); this.svg.appendChild(g);
  }
  clearLabels() { this.labels = []; this.svg?.querySelectorAll(".sk-lab").forEach((e) => e.remove()); }
  mark(p: number, cls: MarkCls) {
    let s = this.marks.get(p); if (!s) this.marks.set(p, (s = new Set()));
    s.add(cls); this.keys.get(p)?.classList.add("m-" + cls);
  }
  unmark(p: number) { this.marks.delete(p); this.keys.get(p)?.classList.remove("m-ok", "m-bad", "m-target", "m-sel"); }
  clear() { this.marks.clear(); for (const k of this.keys.values()) k.classList.remove("m-ok", "m-bad", "m-target", "m-sel"); }
  has(p: number) { return this.keys.has(p); }
}
