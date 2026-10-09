import { StaffView } from "./staffSvg";
import { MiniKeyboard } from "./miniKeyboard";
import * as T from "./techCore";
import type { SNote } from "./solfegeCore";
import { renderXml } from "./score";
import { buildStaffXml, chord as chordEv } from "./course/xml";
import { degreeChord, invert, midiOf as cMidi, chordName, keyLabel as longKeyLabel, ALL_KEYS, INVERSION_NAME, type Pitch } from "./course/theory";
import { progression, ROMAN } from "./course/pieces";
import { ChordCollector } from "./course/engine";
import { fingerHand, triadFingering } from "./fingerCore";
import { DEFAULT_WEIGHTS } from "./fingerCore";
import { FINGERING_MODEL, FINGERING_WEIGHTS, FINGERING_FEATURES } from "./fingeringModel";
import { loadHand } from "./hand";
import { esc } from "./html";
import { readJson, writeJson } from "./storage";

/** Gammes & arpèges : comprendre (armure, recette en tons/demi-tons, doigtés, partition), jouer sur le clavier,
 *  reconstruire la gamme de mémoire avec explications, puis s'entraîner dans le moteur principal
 *  (partition, notes qui tombent, mode attente, mains séparées, tempo, boucle). */
export interface TechHost { play(pitch: number, ms?: number): void; soundOnPress(): boolean; openPractice(file: File, title: string): void; }

type Kind = "major" | "minor" | "arpeggio" | "chords";
interface St { kind: Kind; form: "natural" | "harmonic" | "melodic"; arp: "major" | "minor"; key: number; hand: "R" | "L"; show: "deg" | "fing"; oct: 1 | 2; dir: "up" | "updown"; bpm: number; ckey: number; deg: number; seventh: boolean; inv: number; voicing: "root" | "lead"; }
const KEY = "pianoflow-tech";
function load(): St {
  const d: St = { kind: "major", form: "natural", arp: "major", key: 0, hand: "R", show: "deg", oct: 1, dir: "up", bpm: 72, ckey: 0, deg: 1, seventh: false, inv: 0, voicing: "root" };
  return { ...d, ...readJson(KEY, {}) };
}

let host: TechHost, root: HTMLElement, body: HTMLElement, kbdBox: HTMLElement, kbd: MiniKeyboard;
let st = load(), active = false, token = 0, sv: StaffView | null = null, playTok = 0;
let build: { idx: number; last: number; t0: number; done: boolean } | null = null;
const save = () => { writeJson(KEY, st); };

const keysFor = (s: St): T.KeyDef[] => s.kind === "major" ? T.MAJOR_KEYS : s.kind === "minor" ? T.MINOR_KEYS : (s.arp === "major" ? T.MAJOR_KEYS : T.MINOR_KEYS).filter((k) => k.arp);
const curKey = () => { const ks = keysFor(st); st.key = Math.max(0, Math.min(ks.length - 1, st.key)); return ks[st.key]; };
function piece(oct: 1 | 2 = 1, dir: "up" | "updown" = "up"): T.Piece {
  const key = curKey();
  return { type: st.kind === "arpeggio" ? "arpeggio" : "scale", key, form: st.kind === "major" ? "major" : st.kind === "minor" ? st.form : "natural", octaves: oct, direction: dir };
}
const keyLabel = (k: T.KeyDef) => T.nameOf({ li: k.li, alter: k.alter });
const toSNote = (p: T.Pitch): SNote => ({ clef: "G", pos: p.oct * 7 + p.li - (4 * 7 + 2), alter: p.alter as -1 | 0 | 1 });

function seg(k: string, opts: [string, string][], cur: string) {
  return `<div class="sf-seg" data-k="${k}">${opts.map(([v, l]) => `<button data-v="${v}" class="${v === cur ? "on" : ""}">${l}</button>`).join("")}</div>`;
}
function renderBar() {
  root.querySelector(".sf-bar")!.innerHTML = `<button class="sf-back" data-exback>← <span class="l-ex">Exercices</span><span class="l-td">Aujourd'hui</span></button>` +
    seg("kind", [["major", "Gammes majeures"], ["minor", "Gammes mineures"], ["arpeggio", "Arpèges"], ["chords", "Accords"]], st.kind) +
    (st.kind === "chords" ? seg("seventh", [["0", "Triades"], ["1", "Septièmes"]], st.seventh ? "1" : "0") : "") +
    (st.kind === "minor" ? seg("form", [["natural", "Naturelle"], ["harmonic", "Harmonique"], ["melodic", "Mélodique"]], st.form) : "") +
    (st.kind === "arpeggio" ? seg("arp", [["major", "Accord majeur"], ["minor", "Accord mineur"]], st.arp) : "");
}
function keyRow(): string {
  return `<div class="tc-keys">${keysFor(st).map((k, i) => {
    const n = Math.abs(k.fifths);
    return `<button class="tc-key ${i === st.key ? "on" : ""}" data-key="${i}"><b>${esc(keyLabel(k))}</b><small>${n === 0 ? "♮" : n + (k.fifths > 0 ? "♯" : "♭")}</small></button>`;
  }).join("")}</div>`;
}

const THEORY: Record<string, string> = {
  major: "Toutes les gammes majeures suivent la même recette : Ton, Ton, ½ ton, Ton, Ton, Ton, ½ ton. Un demi-ton, ce sont deux touches voisines sans touche entre elles (blanche ou noire) ; un ton, il y a une touche entre les deux. C'est cette recette qui impose les dièses ou les bémols de l'armure.",
  natural: "La gamme mineure naturelle suit la recette Ton, ½, Ton, Ton, ½, Ton, Ton. Elle sonne plus sombre que la majeure parce que sa 3e note est plus proche de la tonique (3 demi-tons au lieu de 4).",
  harmonic: "La mineure harmonique relève d'un demi-ton le 7e degré de la mineure naturelle. Résultat : un grand saut d'un ton et demi entre le 6e et le 7e degré, et un 7e degré qui « tire » vers la tonique.",
  melodic: "La mineure mélodique relève les 6e et 7e degrés en montant, pour adoucir ce saut ; en descendant on retrouve la mineure naturelle. Les altérations sont rappelées à chaque passage dans la partition.",
  arpeggio: "Un arpège, ce sont les notes de l'accord parfait jouées l'une après l'autre : 1re, 3e, 5e, puis l'octave. L'accord majeur a une tierce majeure (2 tons entre la 1re et la 3e note), l'accord mineur une tierce mineure (1 ton et demi).",
};
const theoryKey = () => st.kind === "major" ? "major" : st.kind === "minor" ? st.form : "arpeggio";

function formulaHtml(p: T.Piece): string {
  const sizes = T.stepSizes(p), degs = p.type === "arpeggio" ? ["1", "3", "5", "8"] : ["1", "2", "3", "4", "5", "6", "7", "8"];
  return `<div class="tc-formula">${degs.map((d, i) => `<span class="tc-deg">${d}</span>${i < sizes.length ? `<span class="tc-step s${sizes[i]}">${T.sizeLabel(sizes[i])}</span>` : ""}`).join("")}</div>`;
}
function fingerLine(p: T.Piece): string {
  const r = T.pieceNotes({ ...p, octaves: 1, direction: "up" }, "R").fingers.join(" "), l = T.pieceNotes({ ...p, octaves: 1, direction: "up" }, "L").fingers.join(" ");
  return `<p class="sf-text"><b>Main droite</b> : ${r} &nbsp;·&nbsp; <b>Main gauche</b> : ${l}</p>`;
}

async function render() {
  const tk = ++token; playTok++; build = null;
  renderBar();
  if (st.kind === "chords") { await renderChords(tk); return; }
  const k = curKey(), p = piece(), title = T.pieceTitle(p);
  const arp = p.type === "arpeggio", nNotes = arp ? 4 : 8;
  const thumbs = T.thumbNotes(p);
  const rel = !arp ? T.relativeText(k) : "";
  body.innerHTML = `${keyRow()}
  <div class="sf-card tc-card">
    <h2>${esc(title)}</h2>
    <div class="tc-sub">${esc(T.armureText(k.fifths))}${rel ? " · " + esc(rel) : ""}</div>
    ${formulaHtml(p)}
    <div class="sf-stage lesson"><div class="sf-host"><span class="sf-loading">Chargement…</span></div></div>
    <p class="sf-text">${esc(THEORY[theoryKey()])}</p>
  </div>
  <div class="sf-card tc-card">
    <h2>Doigtés et clavier</h2>
    <div class="tc-ctrl">${seg("show", [["deg", "Numéros des notes"], ["fing", "Doigts"]], st.show)}${seg("hand", [["R", "Main droite"], ["L", "Main gauche"]], st.hand)}
      <button class="sf-btn" id="tcListen">▶ Écouter</button></div>
    ${fingerLine(p)}
    <p class="sf-text">${arp ? "Le pouce tombe sur la tonique de chaque octave." : `En main droite, le pouce passe sous la main sur ${thumbs.map(esc).join(" et sur ")}.`} Jamais de pouce sur une touche noire. Le clavier en bas montre la gamme ${arp ? "(arpège)" : ""} pour la main choisie.</p>
  </div>
  <div class="sf-card tc-card" id="tcBuild"></div>
  <div class="sf-card tc-card">
    <h2>S'entraîner avec la partition</h2>
    <p class="sf-text">Ouvre la pièce dans l'entraînement : partition, notes qui tombent, mode attente avec ton piano, <b>main droite / main gauche séparément</b>, tempo et boucle.</p>
    <div class="tc-ctrl">${seg("oct", [["1", "1 octave"], ["2", "2 octaves"]], String(st.oct))}${seg("dir", [["up", "Montée"], ["updown", "Montée + descente"]], st.dir)}
      ${seg("bpm", [["56", "Lent"], ["72", "Moyen"], ["96", "Vif"]], String(st.bpm))}</div>
    <div class="sf-actions"><button class="sf-btn pri" id="tcOpen">🎹 Ouvrir dans l'entraînement</button></div>
  </div>`;
  renderBuild();
  showOnKeyboard();
  void nNotes;
  // portée de la gamme (une octave, main droite, avec armure) ; noms cliquables
  const notes = T.pieceNotes(p, "R").pitches;
  const view = await StaffView.create(notes.map(toSNote), undefined, { kind: "whole", clef: "G", scroll: false, spacing: 0.45, fifths: k.fifths });
  if (tk !== token) return;
  sv = view; const holder = body.querySelector(".sf-host") as HTMLElement; holder.innerHTML = ""; holder.appendChild(view.el); view.setWindow(0, 0); view.el.classList.add("sf-lessonsvg");
  notes.forEach((pt, i) => view.tag(i, T.nameOf(pt), "", true));
}

// ── clavier du bas ──
const rangeFor = (hand: "R" | "L"): [number, number] => (hand === "R" ? [60, 84] : [48, 72]);
function showOnKeyboard() {
  const [lo, hi] = rangeFor(st.hand); kbd.setRange(lo, hi); kbd.showNames(true); kbd.clear(); kbd.clearLabels();
  if (build) return;
  const { pitches, fingers } = T.pieceNotes(piece(), st.hand);
  pitches.forEach((pt, i) => {
    const m = T.midiOf(pt); kbd.mark(m, i === 0 || i === pitches.length - 1 ? "sel" : "target");
    kbd.label(m, st.show === "fing" ? String(fingers[i]) : String(piece().type === "arpeggio" ? [1, 3, 5, 8][i] : i + 1), st.hand === "R" ? "rh" : "lh");
  });
}
function listen() {
  const my = ++playTok, { pitches } = T.pieceNotes(piece(1, "updown"), st.hand);
  showOnKeyboard();
  pitches.forEach((pt, i) => setTimeout(() => {
    if (my !== playTok || !active) return;
    const m = T.midiOf(pt); host.play(m, 420); kbd.clear(); kbd.mark(m, "sel");
    if (i === pitches.length - 1) setTimeout(() => my === playTok && showOnKeyboard(), 500);
  }, i * 430));
}

// ── exercice « construis la gamme » ──
function renderBuild() {
  const box = body.querySelector("#tcBuild") as HTMLElement; if (!box) return;
  const p = piece(), exp = T.pieceNotes(p, "R").pitches, arp = p.type === "arpeggio";
  if (!build) {
    box.innerHTML = `<h2>À toi de jouer : construis-la</h2>
      <p class="sf-text">Retrouve ${arp ? "les 4 notes de l'arpège" : "les 8 notes de la gamme"} de <b>${esc(T.pieceTitle(p).replace(/^(Gamme|Arpège) de /, ""))}</b> en montant, sans aide : l'appli te dit pourquoi si tu te trompes. Joue sur le clavier du bas (à l'écran ou avec ton piano).</p>
      <div class="sf-actions"><button class="sf-btn pri" id="tcStart">Commencer</button><button class="sf-btn" id="tcRandom">🎲 Tonalité au hasard</button></div>`;
    return;
  }
  const sizes = T.stepSizes(p);
  box.innerHTML = `<h2>À toi de jouer : construis-la</h2>
    <div class="tc-chips">${exp.map((pt, i) => `<span class="tc-chip ${i < build!.idx ? "done" : i === build!.idx ? "cur" : ""}">${i < build!.idx ? esc(T.nameOf(pt)) : i === build!.idx ? "?" : "·"}</span>`).join("")}</div>
    <div class="sf-big" id="tcFb">${build.done ? `<b class="ok">Bravo ✓</b> <small>${esc(T.pieceTitle(p))} en ${Math.round((performance.now() - build.t0) / 1000)} s.</small>`
      : build.idx === 0 ? `Joue la <b>tonique</b> : la note qui donne son nom (${esc(T.nameOf(exp[0]))}).` : `Après <b>${esc(T.nameOf(exp[build.idx - 1]))}</b>, monte de ${esc(T.sizeWords(sizes[build.idx - 1]))}.`}</div>
    <div class="sf-actions"><button class="sf-btn" id="tcStart">Recommencer</button><button class="sf-btn" id="tcRandom">🎲 Tonalité au hasard</button>${build.done ? "" : `<button class="sf-btn" id="tcShow">💡 Montre-moi</button>`}<button class="sf-btn" id="tcLeave">Quitter l'exercice</button></div>`;
}
function startBuild() { build = { idx: 0, last: -1, t0: performance.now(), done: false }; const [lo, hi] = rangeFor("R"); kbd.setRange(lo, hi); kbd.clear(); kbd.clearLabels(); kbd.showNames(true); renderBuild(); }
function buildPress(m: number) {
  if (!build || build.done) { kbd.clear(); kbd.mark(m, "sel"); return; }
  const p = piece(), exp = T.pieceNotes(p, "R").pitches, sizes = T.stepSizes(p), b = build;
  const want = exp[b.idx], wantPc = T.midiOf(want) % 12, fb = body.querySelector("#tcFb") as HTMLElement;
  kbd.clear();
  if (m % 12 === wantPc && (b.idx === 0 || m > b.last)) {
    kbd.mark(m, "ok"); b.last = m; b.idx++;
    if (b.idx >= exp.length) b.done = true;
    renderBuild();
  } else {
    kbd.mark(m, "bad");
    const name = T.nameOf(want);
    if (b.idx > 0 && m % 12 === wantPc) fb.innerHTML = `C'est bien un <b>${esc(name)}</b>, mais il faut <b>monter</b> : joue-le plus haut que la note précédente.`;
    else if (b.idx === 0) fb.innerHTML = `Ça, ce n'est pas la tonique. Pour ${esc(T.pieceTitle(p).replace(/^(Gamme|Arpège) de /, ""))}, on commence par <b>${esc(name)}</b>.`;
    else {
      const target = b.last + sizes[b.idx - 1]; if (kbd.has(target)) kbd.mark(target, "target");
      fb.innerHTML = `Pas tout à fait : après <b>${esc(T.nameOf(exp[b.idx - 1]))}</b>, on monte de <b>${esc(T.sizeWords(sizes[b.idx - 1]))}</b> — c'est <b>${esc(name)}</b>.`;
    }
  }
}


// ═════════════════════════ accords ═════════════════════════
const CHORD_KEYS = ALL_KEYS;
const ckey = () => { st.ckey = Math.max(0, Math.min(CHORD_KEYS.length - 1, st.ckey)); return CHORD_KEYS[st.ckey]; };
const ROMAN_UP = ["", "I", "II", "III", "IV", "V", "VI", "VII"];
/** Accord choisi, avec son renversement, dans l'octave de la main active. */
function curChord() {
  const k = ckey(), c = degreeChord(k, st.deg, st.seventh, st.hand === "R" ? 4 : 3);
  const inv = Math.min(st.inv, c.pitches.length - 1);
  return { key: k, ...c, pitches: invert(c.pitches, inv), inv };
}
/** Accord de trois sons : le doigté d'usage ; accord de quatre sons : calculé pour la main de l'élève. */
function chordFingers(ps: Pitch[], hand: "R" | "L"): number[] {
  const midis = ps.map(cMidi);
  return triadFingering(midis, hand) ?? fingerHand(midis.map((pitch) => ({ pitch, onTime: 0, offTime: 900 })), hand, loadHand(), { ...DEFAULT_WEIGHTS, ...(FINGERING_WEIGHTS as any) }, FINGERING_MODEL as any, FINGERING_FEATURES);
}
/** Pourquoi ce doigté, pour un accord de trois sons (null sinon). */
function triadWhy(ps: Pitch[], hand: "R" | "L"): string | null {
  const f = triadFingering(ps.map(cMidi), hand);
  if (!f) return null;
  return f.includes(2) ? `la quarte, le plus grand écart, est en ${hand === "R" ? "haut" : "bas"} : le 2 prend la note du milieu pour laisser la place au 5` : "un doigt sur deux, la main posée sans écart";
}
let chordPlay: { col: ChordCollector; done: boolean } | null = null;
async function renderChords(tk: number) {
  const k = ckey(), c = curChord(), rn = ROMAN_UP[st.deg], pcs = [...new Set(c.pitches.map((p) => cMidi(p) % 12))];
  const diatonic = Array.from({ length: 7 }, (_, i) => { const d = degreeChord(k, i + 1, st.seventh); return { d: i + 1, name: chordName(d.root, d.q, true), roman: ROMAN(k, { d: i + 1, seventh: st.seventh }) }; });
  const fingers = chordFingers(c.pitches, st.hand), why = triadWhy(c.pitches, st.hand);
  const hand = loadHand();
  body.innerHTML = `<div class="tc-keys">${CHORD_KEYS.map((x, i) => `<button class="tc-key ${i === st.ckey ? "on" : ""}" data-ckey="${i}"><b>${esc(T.nameOf(x))}${x.mode === "minor" ? "m" : ""}</b><small>${x.fifths === 0 ? "♮" : Math.abs(x.fifths) + (x.fifths > 0 ? "♯" : "♭")}</small></button>`).join("")}</div>
  <div class="sf-card tc-card">
    <h2>Les accords de ${esc(longKeyLabel(k))}</h2>
    <div class="tc-sub">${esc(T.armureText(k.fifths))} — un accord par degré de la gamme : on empile des tierces sur chaque note.</div>
    <div class="tc-chips">${diatonic.map((x) => `<button class="tc-chip ${x.d === st.deg ? "cur" : ""}" data-deg="${x.d}" style="cursor:pointer;border:none"><div style="font-size:11px;opacity:.75">${esc(x.roman)}</div><div>${esc(x.name)}</div></button>`).join("")}</div>
    <div class="sf-stage lesson" style="height:clamp(180px,30vh,260px)"><div class="sf-host" id="tcChordStaff"><span class="sf-loading">Chargement…</span></div></div>
    <p class="sf-text"><b>${esc(chordName(c.root, c.q))}</b> (degré ${rn} de ${esc(longKeyLabel(k))}) : ${esc(c.pitches.map((p) => T.nameOf(p)).join(" – "))} · ${esc(INVERSION_NAME[c.inv])}.
      ${c.q === "maj" ? "Tierce majeure (4 demi-tons) puis tierce mineure (3) : accord majeur." : c.q === "min" ? "Tierce mineure (3 demi-tons) puis tierce majeure (4) : accord mineur." : c.q === "dim" ? "Deux tierces mineures : accord diminué (tendu, instable)." : c.q === "dom7" ? "Triade majeure + septième mineure : l'accord de dominante, qui appelle la tonique." : c.q === "maj7" ? "Triade majeure + septième majeure : douce et lumineuse." : c.q === "min7" ? "Triade mineure + septième mineure : l'accord le plus courant du jazz sur le II." : ""}</p>
  </div>
  <div class="sf-card tc-card">
    <h2>Doigtés et clavier</h2>
    <div class="tc-ctrl">${seg("chand", [["R", "Main droite"], ["L", "Main gauche"]], st.hand)}${seg("inv", Array.from({ length: c.pitches.length }, (_, i) => [String(i), i === 0 ? "Fondamental" : i + (i === 1 ? "er" : "e") + " renv."] as [string, string]), String(c.inv))}
      <button class="sf-btn" id="tcChordListen">▶ Écouter</button></div>
    <p class="sf-text">${why ? "Doigté d'usage" : `Doigtés calculés pour ta main (envergure ${hand.span} cm${hand.thumbIndex ? `, pouce–index ${hand.thumbIndex} cm` : ""})`} : <b>${fingers.join(" – ")}</b> en ${st.hand === "R" ? "main droite" : "main gauche"}, de la note grave à l'aiguë${why ? ` (${why})` : ""}. ${hand.span < 19 && c.pitches.length > 3 ? "Avec une petite main, un accord de quatre notes peut demander un léger déplacement : c'est normal." : ""}</p>
  </div>
  <div class="sf-card tc-card" id="tcChordBuild"></div>
  <div class="sf-card tc-card">
    <h2>S'entraîner : enchaîner les accords</h2>
    <p class="sf-text">Ouvre une grille dans l'entraînement (partition, mains séparées, tempo, boucle) : accords à la main droite, basse à la main gauche.</p>
    <div class="tc-ctrl">${seg("voicing", [["root", "Position fondamentale"], ["lead", "Renversements (sans bouger)"]], st.voicing)}</div>
    <div class="sf-actions"><button class="sf-btn pri" data-prog="1">I – IV – V – I</button><button class="sf-btn pri" data-prog="2">I – vi – IV – V</button><button class="sf-btn pri" data-prog="3">ii – V – I</button></div>
  </div>`;
  renderChordBuild(c, pcs);
  kbd.setRange(...(st.hand === "R" ? ([57, 84] as [number, number]) : ([40, 67] as [number, number]))); kbd.showNames(true); kbd.clear(); kbd.clearLabels();
  c.pitches.forEach((p, i) => { const m = cMidi(p); if (kbd.has(m)) { kbd.mark(m, "sel"); kbd.label(m, String(fingers[i]), st.hand === "R" ? "rh" : "lh"); } });
  try {
    const svg = await renderXml(buildStaffXml([chordEv(c.pitches, 8)], st.hand === "R" ? "G" : "F", k.fifths, 8), { spacing: 0.5 });
    if (tk !== token) return;
    const h = body.querySelector("#tcChordStaff") as HTMLElement | null; if (h) { h.innerHTML = svg; (h.firstElementChild as SVGElement | null)?.classList.add("sf-lessonsvg"); }
  } catch { /* la portée est un plus */ }
}
function renderChordBuild(c: ReturnType<typeof curChord>, pcs: number[]) {
  const box = body.querySelector("#tcChordBuild") as HTMLElement; if (!box) return;
  chordPlay = { col: new ChordCollector(pcs, st.inv > 0 ? cMidi(c.pitches[0]) % 12 : undefined, 1800), done: false };
  box.innerHTML = `<h2>À toi de jouer</h2><p class="sf-text">Joue <b>${esc(chordName(c.root, c.q, true))}</b> (${esc(c.pitches.map((p) => T.nameOf(p)).join(" – "))}) en ${esc(INVERSION_NAME[c.inv])}, toutes les touches ensemble — sur le clavier du bas ou avec ton piano.</p>
    <div class="sf-big" id="tcChordFb">En attente de ton accord…</div>
    <div class="sf-actions"><button class="sf-btn" id="tcChordAgain">Recommencer</button></div>`;
}
function chordPress(m: number) {
  const fb = body.querySelector("#tcChordFb") as HTMLElement | null; if (!chordPlay || !fb) return;
  const c = curChord(); kbd.mark(m, "sel");
  const r = chordPlay.col.add(m, performance.now());
  if (r === "ok") { chordPlay.done = true; chordPlay.col.pressed.forEach((x) => kbd.mark(x, "ok")); fb.innerHTML = `<b class="ok">Bravo ✓</b> <small>${esc(chordName(c.root, c.q))}, ${esc(INVERSION_NAME[c.inv])}.</small>`; }
  else if (r === "bad") { kbd.clear(); kbd.mark(m, "bad"); fb.innerHTML = `Ce n'est pas tout à fait ça : il faut <b>${esc(c.pitches.map((p) => T.nameOf(p)).join(" – "))}</b>${st.inv > 0 ? `, avec ${esc(T.nameOf(c.pitches[0]))} en bas` : ""}.`; chordPlay.col.reset(); }
  else fb.textContent = `${chordPlay.col.pressed.length} touche${chordPlay.col.pressed.length > 1 ? "s" : ""}… continue.`;
}
function listenChord() {
  const my = ++playTok, c = curChord(), ms = c.pitches.map(cMidi);
  showChordOnKeyboard();
  ms.forEach((m, i) => setTimeout(() => { if (my === playTok && active) host.play(m, 900); }, i * 220));          // arpégé
  setTimeout(() => { if (my === playTok && active) ms.forEach((m) => host.play(m, 1400)); }, ms.length * 220 + 450);   // puis plaqué
}
function showChordOnKeyboard() {
  const c = curChord(), fingers = chordFingers(c.pitches, st.hand);
  kbd.clear(); kbd.clearLabels();
  c.pitches.forEach((p, i) => { const m = cMidi(p); if (kbd.has(m)) { kbd.mark(m, "sel"); kbd.label(m, String(fingers[i]), st.hand === "R" ? "rh" : "lh"); } });
}
function openProgression(which: number) {
  const k = ckey();
  const steps = which === 1 ? [1, 4, 5, 1] : which === 2 ? [1, 6, 4, 5] : [2, 5, 1, 1];
  const p = progression(k, steps.map((d) => ({ d, seventh: st.seventh && (d === 5 || d === 2 || which === 3) })), { rounds: 2, lead: st.voicing === "lead" });
  host.openPractice(new File([p.xml], `${p.title}.musicxml`, { type: "application/xml" }), p.title);
}

// ── événements ──
function onPress(m: number, fromMidi = false) {
  if (!fromMidi || host.soundOnPress()) host.play(m, 700);
  if (st.kind === "chords") { chordPress(m); return; }
  if (build) buildPress(m); else { kbd.clear(); showMarks(); kbd.mark(m, "sel"); }
}
function showMarks() { /* en mode exploration, on garde les repères de la gamme visibles sous la touche sélectionnée */
  const { pitches } = T.pieceNotes(piece(), st.hand); pitches.forEach((pt) => kbd.mark(T.midiOf(pt), "target"));
}
function openPractice() {
  const p = piece(st.oct, st.dir), xml = T.buildPieceXml(p, st.bpm), title = T.pieceTitle(p);
  host.openPractice(new File([xml], `${title} (${st.oct} octave${st.oct > 1 ? "s" : ""}).musicxml`, { type: "application/xml" }), title);
}

export function techMidi(pitch: number, _vel: number, on: boolean) { if (active && on) onPress(pitch, true); }
export const techActive = () => active;
export function openTech() { active = true; render(); }
export function closeTech() { active = false; token++; playTok++; build = null; }

export function initTech(rootEl: HTMLElement, h: TechHost) {
  host = h; root = rootEl;
  root.innerHTML = `<div class="sf-bar"></div><div class="sf-body" id="tcBody"></div><div class="sf-kbd" id="tcKbd"></div>`;
  body = root.querySelector("#tcBody")!; kbdBox = root.querySelector("#tcKbd")!;
  kbd = new MiniKeyboard(kbdBox, (m) => onPress(m));
  kbd.setRange(60, 84);
  root.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const segBtn = t.closest(".sf-seg button") as HTMLElement | null;
    if (segBtn) {
      const k = (segBtn.parentElement as HTMLElement).dataset.k!, v = segBtn.dataset.v!;
      if (k === "kind") { st.kind = v as Kind; st.key = 0; }
      else if (k === "seventh") { st.seventh = v === "1"; st.inv = 0; }
      else if (k === "chand") { st.hand = v as St["hand"]; }
      else if (k === "inv") { st.inv = Number(v); }
      else if (k === "voicing") { st.voicing = v as St["voicing"]; save(); body.querySelectorAll('[data-k="voicing"] button').forEach((b) => b.classList.toggle("on", (b as HTMLElement).dataset.v === v)); return; }
      else if (k === "form") st.form = v as St["form"];
      else if (k === "arp") { st.arp = v as St["arp"]; st.key = 0; }
      else if (k === "show") { st.show = v as St["show"]; save(); renderBar(); body.querySelectorAll('[data-k="show"] button').forEach((b) => b.classList.toggle("on", (b as HTMLElement).dataset.v === v)); if (!build) showOnKeyboard(); return; }
      else if (k === "hand") { st.hand = v as St["hand"]; save(); body.querySelectorAll('[data-k="hand"] button').forEach((b) => b.classList.toggle("on", (b as HTMLElement).dataset.v === v)); if (!build) showOnKeyboard(); return; }
      else if (k === "oct") st.oct = Number(v) as 1 | 2;
      else if (k === "dir") st.dir = v as St["dir"];
      else if (k === "bpm") st.bpm = Number(v);
      save();
      if (["oct", "dir", "bpm"].includes(k)) { body.querySelectorAll(`[data-k="${k}"] button`).forEach((b) => b.classList.toggle("on", (b as HTMLElement).dataset.v === v)); return; }
      void render(); return;
    }
    const ck = t.closest("[data-ckey]") as HTMLElement | null; if (ck) { st.ckey = Number(ck.dataset.ckey); st.inv = 0; save(); void render(); return; }
    const dg = t.closest("[data-deg]") as HTMLElement | null; if (dg) { st.deg = Number(dg.dataset.deg); st.inv = 0; save(); void render(); return; }
    const pg = t.closest("[data-prog]") as HTMLElement | null; if (pg) { openProgression(Number(pg.dataset.prog)); return; }
    if (t.closest("#tcChordListen")) { listenChord(); return; }
    if (t.closest("#tcChordAgain")) { const c = curChord(); kbd.clear(); showChordOnKeyboard(); renderChordBuild(c, [...new Set(c.pitches.map((p) => cMidi(p) % 12))]); return; }
    const kb = t.closest("[data-key]") as HTMLElement | null; if (kb) { st.key = Number(kb.dataset.key); save(); void render(); return; }
    const tag = t.closest(".sf-tag") as SVGElement | null, note = t.closest("g.note") as SVGGElement | null;
    if (sv && (tag || note)) {
      const i = tag ? Number(tag.getAttribute("data-slot")) : sv.slotNotes.findIndex((a) => a.includes(note!));
      const pt = T.pieceNotes(piece(), "R").pitches[i]; if (pt) { host.play(T.midiOf(pt), 700); for (let j = 0; j < sv.n; j++) sv.mark(j, null); sv.mark(i, "sf-sel"); }
      return;
    }
    if (t.closest("#tcListen")) { listen(); return; }
    if (t.closest("#tcStart")) { startBuild(); return; }
    if (t.closest("#tcLeave")) { build = null; renderBuild(); showOnKeyboard(); return; }
    if (t.closest("#tcShow")) { if (build && !build.done) { const exp = T.pieceNotes(piece(), "R").pitches; const want = T.midiOf(exp[build.idx]); const sizes = T.stepSizes(piece()); const m = build.idx === 0 ? 60 + (((want % 12) + 12) % 12) : build.last + sizes[build.idx - 1]; kbd.clear(); if (kbd.has(m)) kbd.mark(m, "target"); } return; }
    if (t.closest("#tcRandom")) { const n = keysFor(st).length; let i = st.key; while (n > 1 && i === st.key) i = Math.floor(Math.random() * n); st.key = i; save(); void render().then(() => startBuild()); startBuildSoon(); return; }
    if (t.closest("#tcOpen")) { openPractice(); return; }
  });
}
function startBuildSoon() { setTimeout(() => { if (active && !build) startBuild(); }, 0); }
