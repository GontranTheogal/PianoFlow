import { FIRST, LAST, TOTAL_WIDTH, BLACK_RATIO, keyGeometry, isBlack } from "./keyboardLayout";
import { noteName } from "./names";

const NS = "http://www.w3.org/2000/svg";
const FELT = 5; // bande de feutre rouge au-dessus des touches (unités du viewBox)

interface Key { g: SVGGElement; ov: SVGPathElement; base: SVGPathElement; badge: SVGGElement; badgeTxt: SVGTextElement; name: SVGTextElement; black: boolean; x: number; w: number; }

/** Clavier SVG : touches blanches/noires en relief, avec 3 états visuels bien distincts :
 *  - « à jouer »  : touche teintée à la couleur de la main (bleu = droite, orange = gauche) + pastille de doigté
 *  - « juste »    : vert
 *  - « fausse »   : rouge */
export class Piano {
  private svg!: SVGSVGElement;
  private keys = new Map<number, Key>();
  private lit: number[] = [];
  private host: HTMLElement;
  private shade!: SVGRectElement;
  private felt!: SVGRectElement;

  constructor(host: HTMLElement) {
    this.host = host;
    new ResizeObserver(() => this.layout()).observe(host);
    this.rebuild();
  }

  /** (Re)construit les touches pour la plage courante de keyboardLayout. */
  rebuild() {
    this.host.innerHTML = "";
    this.keys.clear(); this.lit = [];
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.innerHTML = `<defs>
      <linearGradient id="wk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f1ea"/><stop offset=".82" stop-color="#ffffff"/><stop offset="1" stop-color="#e4e0d6"/></linearGradient>
      <linearGradient id="bk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c1c20"/><stop offset=".85" stop-color="#2d2d33"/><stop offset="1" stop-color="#101012"/></linearGradient>
      <linearGradient id="bkHi" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity=".22"/><stop offset=".45" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
      <linearGradient id="topShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".38"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
    </defs>`;
    this.svg = svg;
    const whites = document.createElementNS(NS, "g"), blacks = document.createElementNS(NS, "g");
    this.felt = document.createElementNS(NS, "rect");
    this.felt.setAttribute("fill", "#8a1f2d"); this.felt.setAttribute("x", "0"); this.felt.setAttribute("y", "0"); this.felt.setAttribute("width", String(TOTAL_WIDTH)); this.felt.setAttribute("height", String(FELT));
    this.shade = document.createElementNS(NS, "rect");
    this.shade.setAttribute("fill", "url(#topShade)"); this.shade.setAttribute("x", "0"); this.shade.setAttribute("y", String(FELT)); this.shade.setAttribute("width", String(TOTAL_WIDTH)); this.shade.setAttribute("pointer-events", "none");
    svg.append(this.felt, whites);

    for (let p = FIRST; p <= LAST; p++) {
      const black = isBlack(p);
      const { x, width } = keyGeometry(p);
      const g = document.createElementNS(NS, "g");
      g.setAttribute("class", "pk " + (black ? "pk-b" : "pk-w"));
      const base = document.createElementNS(NS, "path");
      base.setAttribute("class", "pk-base");
      base.setAttribute("fill", black ? "url(#bk)" : "url(#wk)");
      base.setAttribute("stroke", black ? "#000" : "#bdb7aa"); base.setAttribute("stroke-width", black ? "0.6" : "0.8");
      const ov = document.createElementNS(NS, "path"); ov.setAttribute("class", "pk-ov");
      const badge = document.createElementNS(NS, "g"); badge.setAttribute("class", "pk-badge");
      const bc = document.createElementNS(NS, "circle"); bc.setAttribute("r", String(black ? 5.4 : 7.4)); bc.setAttribute("cx", String(x + width / 2));
      const badgeTxt = document.createElementNS(NS, "text");
      badgeTxt.setAttribute("x", String(x + width / 2)); badgeTxt.setAttribute("class", "pk-badge-txt"); badgeTxt.setAttribute("font-size", black ? "7.5" : "10");
      badge.append(bc, badgeTxt);
      const name = document.createElementNS(NS, "text");
      name.setAttribute("x", String(x + width / 2)); name.setAttribute("class", "pk-name"); name.textContent = black ? "" : noteName(p).replace(/-?\d+$/, "");
      g.append(base, ov, badge, name);
      if (black) {
        const hi = document.createElementNS(NS, "rect"); hi.setAttribute("x", String(x + 1)); hi.setAttribute("width", String(width * 0.34)); hi.setAttribute("fill", "url(#bkHi)"); hi.setAttribute("class", "pk-hi"); hi.setAttribute("pointer-events", "none");
        g.append(hi);
        blacks.appendChild(g);
      } else whites.appendChild(g);
      this.keys.set(p, { g, ov, base, badge, badgeTxt, name, black, x, w: width });
    }
    svg.append(this.shade, blacks);
    this.host.appendChild(svg);
    this.layout();
  }

  /** Le viewBox suit exactement la taille réelle du conteneur : les touches ne sont jamais déformées. */
  layout() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (w < 2 || h < 2 || !this.svg) return;
    const vbH = (h * TOTAL_WIDTH) / w;
    this.svg.setAttribute("viewBox", `0 0 ${TOTAL_WIDTH} ${vbH}`);
    const kh = vbH - FELT;                          // hauteur d'une touche blanche
    this.shade.setAttribute("height", String(Math.min(kh * 0.1, 14)));
    for (const k of this.keys.values()) {
      const h2 = k.black ? kh * BLACK_RATIO : kh, r = k.black ? 2.2 : 3.2, x = k.x, y = FELT, wd = k.w;
      const gap = k.black ? 0 : 0.4;
      const d = `M${x + gap},${y} H${x + wd - gap} V${y + h2 - r} Q${x + wd - gap},${y + h2} ${x + wd - gap - r},${y + h2} H${x + gap + r} Q${x + gap},${y + h2} ${x + gap},${y + h2 - r} Z`;
      k.base.setAttribute("d", d); k.ov.setAttribute("d", d);
      const cy = y + h2 - (k.black ? 11 : 15);
      k.badge.querySelector("circle")!.setAttribute("cy", String(cy));
      k.badgeTxt.setAttribute("y", String(cy + (k.black ? 2.7 : 3.6)));
      k.name.setAttribute("y", String(y + h2 - (k.black ? 4 : 5)));
      k.name.setAttribute("font-size", "8.5");
      const hi = k.g.querySelector(".pk-hi"); if (hi) hi.setAttribute("height", String(h2 - 8));
    }
  }

  setShowNames(show: boolean) { this.svg.classList.toggle("show-names", show); }
  setColors(r: string, l: string) { this.host.style.setProperty("--hand-r", r); this.host.style.setProperty("--hand-l", l); }

  /** Touches à jouer. `finger` n'est renseigné que si le doigté doit être affiché. */
  setExpected(notes: { pitch: number; finger?: number; hand: "R" | "L"; hit?: boolean }[]) {
    for (const p of this.lit) {
      const k = this.keys.get(p); if (!k) continue;
      k.g.classList.remove("exp-r", "exp-l", "has-finger", "hit");
      k.badgeTxt.textContent = "";
    }
    this.lit = [];
    for (const { pitch, finger, hand, hit } of notes) {
      const k = this.keys.get(pitch); if (!k) continue;
      k.g.classList.add(hand === "R" ? "exp-r" : "exp-l");
      if (hit) k.g.classList.add("hit");
      if (finger) { k.g.classList.add("has-finger"); k.badgeTxt.textContent = String(finger); }
      this.lit.push(pitch);
    }
  }
  /** Touche appuyée par l'utilisateur : vert si juste, rouge si fausse. Jamais la couleur « à jouer ». */
  press(p: number, state: "ok" | "bad") { const k = this.keys.get(p); if (k) { k.g.classList.remove("down-ok", "down-bad"); k.g.classList.add(state === "ok" ? "down-ok" : "down-bad"); } }
  release(p: number) { this.keys.get(p)?.g.classList.remove("down-ok", "down-bad"); }
  releaseAll() { for (const k of this.keys.values()) k.g.classList.remove("down-ok", "down-bad"); }
}
