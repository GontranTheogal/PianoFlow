import { renderXml } from "./score";
import { buildXml, type SNote, type NoteKind, type Clef } from "./solfegeCore";

const NS = "http://www.w3.org/2000/svg";
const num = (v: string | null, d = 0) => (v == null || isNaN(parseFloat(v)) ? d : parseFloat(v));
let uid = 0;

/** Une portée gravée par Verovio, rendue pilotable : les notes (et leurs lignes supplémentaires) glissent
 *  derrière la clé, qui reste fixe ; des étiquettes cliquables et une colonne de surbrillance suivent les notes.
 *  Toute la géométrie vient des données du SVG (pas de mesure de mise en page) : même résultat partout. */
export class StaffView {
  el!: SVGSVGElement;
  s = 180;                    // un « interligne » en unités du SVG
  n = 0;                      // nombre de pas de temps
  cx: number[] = [];          // abscisse du centre de chaque pas
  notes: SVGGElement[] = [];  // g.note dans l'ordre du DOM (portée haute puis basse)
  slotNotes: SVGGElement[][] = [];
  private mx = 100; private my = 100;
  private vbTop = 0; private vbH = 0;
  private yLabel = 0;
  private movers: SVGGElement[] = [];
  private overlay!: SVGGElement;
  private colEl: SVGRectElement | null = null;
  private cursorEl: SVGRectElement | null = null;
  clipLeft = 640; cursorX = 2300;
  private scrolling = false;

  static async create(top: (SNote | null)[], bottom: (SNote | null)[] | undefined, o: { kind: NoteKind; clef: Clef; scroll: boolean; spacing?: number; fifths?: number }): Promise<StaffView> {
    const v = new StaffView();
    const xml = buildXml(top, bottom, { kind: o.kind, clefTop: o.clef, fifths: o.fifths });
    const svgText = await renderXml(xml, { spacing: o.spacing });
    v.parse(svgText, top, bottom, o);
    return v;
  }

  private parse(svgText: string, top: (SNote | null)[], bottom: (SNote | null)[] | undefined, o: { kind: NoteKind; scroll: boolean }) {
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    const el = document.importNode(doc.documentElement, true) as unknown as SVGSVGElement;
    this.el = el; this.n = top.length; this.scrolling = o.scroll;
    el.removeAttribute("width"); el.removeAttribute("height"); el.setAttribute("preserveAspectRatio", "xMinYMid meet");
    const inner = el.querySelector("svg.definition-scale") as SVGSVGElement;
    const pm = inner.querySelector("g.page-margin") as SVGGElement;
    const tr = /translate\(\s*([\d.-]+)[ ,]+([\d.-]+)\s*\)/.exec(pm.getAttribute("transform") || "");
    if (tr) { this.mx = num(tr[1]); this.my = num(tr[2]); }

    const staves = Array.from(pm.querySelectorAll<SVGGElement>("g.staff"));
    const rows = staves.map((st) => {
      const ys = Array.from(st.children).filter((c) => c.tagName === "path").map((c) => /M\s*[\d.-]+\s+([\d.-]+)/.exec(c.getAttribute("d") || "")).filter(Boolean).slice(0, 5).map((m) => num(m![1]));
      return { top: ys[0], bottom: ys[4] };
    });
    this.s = (rows[0].bottom - rows[0].top) / 4;
    const s = this.s;

    // centres des notes, pas par pas (portée haute puis portée basse = ordre du DOM)
    this.notes = Array.from(pm.querySelectorAll<SVGGElement>("g.note"));
    const half = (o.kind === "whole" ? 0.8 : 0.58) * s;
    let k = 0; this.slotNotes = Array.from({ length: this.n }, () => []); this.cx = new Array(this.n).fill(NaN);
    for (const arr of bottom ? [top, bottom] : [top]) arr.forEach((it, i) => {
      if (!it) return;
      const g = this.notes[k++]; this.slotNotes[i].push(g);
      const x = num(g.querySelector(".notehead use")?.getAttribute("x") ?? null) + half;
      if (isNaN(this.cx[i])) this.cx[i] = x;
    });
    for (let i = 0; i < this.n; i++) if (isNaN(this.cx[i])) this.cx[i] = i ? this.cx[i - 1] + 5 * s : 0;

    const clefUse = pm.querySelector("g.clef use");
    const clefX = num(clefUse?.getAttribute("x") ?? null, 90);
    this.clipLeft = Math.min(clefX + 3.3 * s, (this.cx[0] ?? 900) - 1.6 * s);
    this.cursorX = this.clipLeft + 1.9 * s + 1.0 * s;

    // fenêtre verticale fixe : portée(s) + 3,4 interlignes au-dessus + 5,2 en dessous (étiquettes)
    const yTop = rows[0].top, yBot = rows[rows.length - 1].bottom;
    this.vbTop = yTop - 3.4 * s + this.my; this.vbH = yBot - yTop + 8.6 * s;
    this.yLabel = yBot + 4.1 * s;

    if (o.scroll) {
      let n = 0;
      for (const st of staves) {
        const parts = Array.from(st.children).filter((c) => c.matches("g.ledgerLines, g.layer"));
        if (!parts.length) continue;
        const clip = document.createElementNS(NS, "clipPath"); const id = "sfclip" + ++uid + "_" + n++;
        clip.setAttribute("id", id);
        const r = document.createElementNS(NS, "rect");
        r.setAttribute("x", String(this.clipLeft)); r.setAttribute("y", "-20000"); r.setAttribute("width", "200000"); r.setAttribute("height", "40000");
        clip.appendChild(r); pm.appendChild(clip);
        const wrap = document.createElementNS(NS, "g"); wrap.setAttribute("clip-path", `url(#${id})`);
        const mv = document.createElementNS(NS, "g"); mv.setAttribute("class", "sf-move"); wrap.appendChild(mv);
        st.insertBefore(wrap, parts[0]); parts.forEach((p) => mv.appendChild(p)); this.movers.push(mv);
      }
      const clip = pm.querySelector("clipPath")!.cloneNode(true) as SVGClipPathElement; const id = "sfclip" + ++uid + "_o"; clip.setAttribute("id", id); pm.appendChild(clip);
      const wrap = document.createElementNS(NS, "g"); wrap.setAttribute("clip-path", `url(#${id})`);
      this.overlay = document.createElementNS(NS, "g"); this.overlay.setAttribute("class", "sf-move sf-overlay"); wrap.appendChild(this.overlay); pm.appendChild(wrap); this.movers.push(this.overlay);
      this.colEl = document.createElementNS(NS, "rect"); this.colEl.setAttribute("class", "sf-col");
      this.colEl.setAttribute("y", String(yTop - 3.2 * s)); this.colEl.setAttribute("height", String(yBot - yTop + 7.6 * s)); this.colEl.setAttribute("width", String(1.9 * s)); this.colEl.setAttribute("rx", String(0.3 * s));
      this.colEl.style.display = "none"; this.overlay.appendChild(this.colEl);
      this.cursorEl = document.createElementNS(NS, "rect"); this.cursorEl.setAttribute("class", "sf-cursor");
      this.cursorEl.setAttribute("x", String(this.cursorX - 6)); this.cursorEl.setAttribute("y", String(yTop - 3.2 * s)); this.cursorEl.setAttribute("width", "12"); this.cursorEl.setAttribute("height", String(yBot - yTop + 7.6 * s));
      pm.appendChild(this.cursorEl);
    } else {
      this.overlay = document.createElementNS(NS, "g"); this.overlay.setAttribute("class", "sf-overlay"); pm.appendChild(this.overlay);
    }
    this.setWindow(1000, 1000);
  }

  /** Cadre visible. `aspect` = largeur/hauteur de la zone d'affichage (mode défilant), sinon cadre ajusté au contenu. */
  setWindow(hostW: number, hostH: number) {
    const h = this.vbH;
    const W = this.scrolling ? h * (hostW / Math.max(1, hostH)) : this.cx[this.n - 1] + this.mx + 2.6 * this.s;
    this.el.setAttribute("viewBox", `0 0 ${W} ${h}`);
    const inner = this.el.querySelector("svg.definition-scale")!;
    inner.setAttribute("viewBox", `0 ${this.vbTop} ${W} ${h}`);
    inner.setAttribute("x", "0"); inner.setAttribute("y", "0"); inner.setAttribute("width", String(W)); inner.setAttribute("height", String(h));
  }
  get ratio() { return this.el.viewBox.baseVal && this.el.viewBox.baseVal.height ? this.el.viewBox.baseVal.width / this.el.viewBox.baseVal.height : 2; }

  /** Place le pas fractionnaire P sous le curseur (mode défilant). */
  scrollTo(P: number) {
    if (!this.movers.length) return;
    const i = Math.max(0, Math.min(this.n - 1, Math.floor(P))), f = P - i;
    const x0 = this.cx[Math.max(0, Math.min(this.n - 1, i))];
    const x1 = i + 1 < this.n ? this.cx[i + 1] : x0 + 5 * this.s;
    const pos = P < 0 ? this.cx[0] + P * (this.cx[1] != null && this.n > 1 ? this.cx[1] - this.cx[0] : 5 * this.s) : x0 + f * (x1 - x0);
    const tx = this.cursorX - pos;
    for (const m of this.movers) m.setAttribute("transform", `translate(${tx.toFixed(1)} 0)`);
  }
  showCursor(on: boolean) { if (this.cursorEl) this.cursorEl.style.display = on ? "" : "none"; }
  /** Colonne de surbrillance derrière le pas i (null = masquée). */
  col(i: number | null) {
    if (!this.colEl) return;
    if (i == null || i < 0 || i >= this.n) { this.colEl.style.display = "none"; return; }
    this.colEl.style.display = ""; this.colEl.setAttribute("x", String(this.cx[i] - 0.95 * this.s));
  }
  mark(i: number, cls: string | null) {
    for (const g of this.slotNotes[i] ?? []) { g.classList.remove("sf-ok", "sf-ko", "sf-sel", "sf-cur"); if (cls) g.classList.add(cls); }
  }
  /** Étiquette (nom de la note) sous le pas i ; cliquable si `clickable`. */
  tag(i: number, text: string, cls = "", clickable = false) {
    const old = this.overlay.querySelector(`[data-slot="${i}"]`); old?.remove();
    const fs = 0.95 * this.s, w = Math.max(1.9 * this.s, text.length * 0.62 * fs + 0.9 * this.s), h = 1.5 * this.s;
    const g = document.createElementNS(NS, "g"); g.setAttribute("class", "sf-tag " + cls + (clickable ? " clickable" : "")); g.setAttribute("data-slot", String(i));
    const r = document.createElementNS(NS, "rect"); r.setAttribute("x", String(this.cx[i] - w / 2)); r.setAttribute("y", String(this.yLabel - h / 2)); r.setAttribute("width", String(w)); r.setAttribute("height", String(h)); r.setAttribute("rx", String(h / 2));
    const t = document.createElementNS(NS, "text"); t.setAttribute("x", String(this.cx[i])); t.setAttribute("y", String(this.yLabel + fs * 0.35)); t.setAttribute("font-size", String(fs)); t.setAttribute("text-anchor", "middle");
    t.textContent = text; g.append(r, t); this.overlay.appendChild(g);
  }
  clearTags() { this.overlay.querySelectorAll(".sf-tag").forEach((e) => e.remove()); }
  /** Abscisse du centre du pas i, pour les tests. */
  get window() { return { top: this.vbTop, h: this.vbH, s: this.s, clipLeft: this.clipLeft, cursorX: this.cursorX }; }
}
