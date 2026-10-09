/** Onglet « Exercices » : tout ce qu'on travaille à côté du parcours et des morceaux, en courtes séances. */
import * as X from "./exercises";
import { drillStats, type Drill } from "./course/ui";
import { MAJOR_KEYS, nameOf } from "./course/theory";
import { pedalDrill, fingerDrill, PEDAL_LEVELS, FINGER_LEVELS } from "./course/pedalFinger";
import { improvDrill, IMPROV_LEVELS } from "./course/accomp";
import { UNITS, LESSONS } from "./course/curriculum";
import { loadProgress, isDone } from "./course/engine";
import * as Skills from "./skills";
import { esc } from "./html";

export interface ExHost {
  startDrill(d: Drill): void;
  openPiece(xml: string, title: string, o: { mode: "step" | "rhythm"; speed: number; tag?: string }): void;
  openSolfege(): void;
  openTech(): void;
}
const LV_KEY = "pianoflow-ex-levels";
let host: ExHost, root: HTMLElement, allOpen = false, openRow = "";
let levels: Record<string, number> = load();
function load(): Record<string, number> { try { return JSON.parse(localStorage.getItem(LV_KEY) || "{}"); } catch { return {}; } }
const save = () => { try { localStorage.setItem(LV_KEY, JSON.stringify(levels)); } catch { /* ignore */ } };
/** Le niveau conseillé : on passe au suivant quand le précédent est réussi à 85 % ; les rythmes vus dans l'unité « Le rythme,
 *  suite » (doubles croches, triolets, 6/8) attendent la leçon qui les explique. */
const RHYTHM_NEEDS: Record<number, string> = { 7: "ur2-l1", 8: "ur2-l3", 9: "ur2-l4" };
export function suggestedLevel(k: string, p = loadProgress()): number {
  const c = CARDS.find((x) => x.key === k), n = c?.levels?.length ?? 1, best = drillStats();
  let L = 1;
  while (L < n && (best[`${k}-${L}`]?.best ?? 0) >= 85) L++;
  if (k === "rhythm") while (L > 1 && RHYTHM_NEEDS[L] && !isDone(p, RHYTHM_NEEDS[L])) L--;
  return L;
}
/** Le niveau choisi à la main, sinon le niveau conseillé. */
const lv = (k: string) => levels[k] ?? suggestedLevel(k);

interface Card { key: string; icon: string; color: string; title: string; text: string; levels?: string[]; action: string; }
const CARDS: Card[] = [
  { key: "reading", icon: "🎼", color: "#34d399", title: "Lecture de notes", text: "Des notes au hasard en clé de Sol et de Fa : les lire vite et sans compter. 5 minutes par jour suffisent.", action: "Ouvrir" },
  { key: "sight", icon: "👀", color: "#38bdf8", title: "Déchiffrage", text: "Un petit morceau inédit à chaque fois, à jouer en rythme du premier coup, sans s'arrêter : le meilleur entraînement à la lecture.", levels: X.SIGHT_LEVELS.map((l) => l.label), action: "Nouveau morceau" },
  { key: "rhythm", icon: "🥁", color: "#a78bfa", title: "Rythme", text: "Lire un rythme et le taper au métronome, des noires jusqu'aux triolets et au 6/8.", levels: X.RHYTHM_LEVELS.map((l) => l.label), action: "Commencer" },
  { key: "intervals", icon: "👂", color: "#f472b6", title: "Oreille · intervalles", text: "Reconnaître l'écart entre deux notes, avec un air connu comme repère pour chacun.", levels: ["Tierce, quinte, octave", "+ seconde, quarte, tierce mineure", "Tous (jusqu'à l'octave)"], action: "Commencer" },
  { key: "chords", icon: "👂", color: "#fb7185", title: "Oreille · accords", text: "Majeur ou mineur ? Puis diminué et augmenté. Entendre la couleur d'un accord.", levels: ["Majeur / mineur", "+ diminué", "+ augmenté"], action: "Commencer" },
  { key: "echo", icon: "🔁", color: "#f59e0b", title: "Oreille · écho", text: "L'appli joue une courte mélodie : rejoue-la sur ton clavier. Relie l'oreille aux doigts.", levels: X.ECHO_LEVELS.map((l) => l.label), action: "Commencer" },
  { key: "pedal", icon: "🦶", color: "#4ade80", title: "Pédale", text: "Changer la pédale de sustain à chaque accord, sans mélange ni trou. Après chaque passage, un dessin montre ce qu'a fait ton pied. (Pédale branchée sur le clavier MIDI.)", levels: PEDAL_LEVELS, action: "Commencer" },
  { key: "fingers", icon: "🖐️", color: "#fbbf24", title: "Trouver ses doigtés", text: "Sans doigté écrit : trouver la position de la main d'après l'étendue de la phrase, puis placer les passages du pouce. Et jouer avec ce doigté.", levels: FINGER_LEVELS, action: "Commencer" },
  { key: "improv", icon: "🎷", color: "#f472b6", title: "Improviser", text: "L'appli joue une grille d'accords, tu inventes une mélodie avec les touches allumées (pentatonique, puis blues). Aucune fausse note possible : le but est d'oser.", levels: IMPROV_LEVELS, action: "Commencer" },
  { key: "five", icon: "✋", color: "#fb923c", title: "Cinq doigts, 12 tonalités", text: "La position de base dans chaque tonalité, majeur puis mineur, mains ensemble : pour que toutes les touches deviennent familières.", action: "Ouvrir" },
  { key: "tech", icon: "🎹", color: "#4ade80", title: "Gammes, arpèges, accords", text: "La théorie et les doigtés de chaque tonalité, « construis-la », et l'entraînement en partition.", action: "Ouvrir" },
];

/** Quand un exercice devient utile : la leçon du parcours qui le débloque (premier = début d'unité, dernier = unité finie). */
const first = (u: string) => UNITS.find((x) => x.id === u)?.lessons[0]?.id ?? "";
const last = (u: string) => { const l = UNITS.find((x) => x.id === u)?.lessons; return l?.[l.length - 1]?.id ?? ""; };
const UNLOCK: Record<string, () => string> = {
  echo: () => "u1-l3", five: () => last("u2"), reading: () => first("u4"), sight: () => last("u5"), rhythm: () => first("u6"),
  intervals: () => last("u8"), chords: () => last("u8"), fingers: () => "udg-l1", pedal: () => "upd-l1", improv: () => "uacc-l6",
};
/** Les 3 exercices « pour toi » : parmi ceux débloqués par le parcours, les compétences les plus faibles ou jamais travaillées ;
 *  à égalité, les plus récentes d'abord (ce qu'on vient d'apprendre). */
export function recommended(p = loadProgress()): string[] {
  const pos = (id: string) => LESSONS.findIndex((l) => l.id === id), st = Skills.states(p);
  const need = (k: string) => st.find((x) => x.skill.key === (k === "five" ? "warmup" : k))?.need ?? 65;
  return Object.entries(UNLOCK).map(([k, f]) => [k, f()] as const).filter(([, id]) => id && isDone(p, id))
    .sort((a, b) => need(b[0]) - need(a[0]) || pos(b[1]) - pos(a[1])).slice(0, 3).map(([k]) => k);
}

const skillOf = (k: string) => (k === "five" ? "warmup" : k);
const color = (v: number) => (v >= 85 ? "#22c55e" : v >= 60 ? "#60a5fa" : "#f59e0b");
function render() {
  const rec = recommended(), p = loadProgress(), st = Skills.states(p);
  const unitAfter = (k: string) => { const id = UNLOCK[k]?.(); return id && !isDone(p, id) ? LESSONS.find((l) => l.id === id)?.unit : undefined; };
  const stateOf = (k: string) => st.find((x) => x.skill.key === skillOf(k));
  /** Pourquoi cet exercice maintenant (ou pas) : une phrase, la même partout. */
  const why = (k: string): { txt: string; cls: string; bar?: number } => {
    const s = stateOf(k), later = unitAfter(k);
    if (later) return { txt: `Utile après « ${later.title} »`, cls: "later" };
    if (!s) return { txt: "Outil libre", cls: "" };
    if (s.level === null) return { txt: "Jamais travaillé : à découvrir", cls: "new" };
    if (s.level < 60) return { txt: `Point faible : maîtrise ${s.level} %`, cls: "weak", bar: s.level };
    if (s.days >= 7) return { txt: `Maîtrise ${s.level} %, pas travaillé depuis ${s.days} jours`, cls: "old", bar: s.level };
    return { txt: `Maîtrise ${s.level} %${s.level >= 85 ? " : bien acquis" : " : on consolide"}`, cls: s.level >= 85 ? "good" : "", bar: s.level };
  };
  const status = (k: string) => { const w = why(k); return `<small class="ex-m ${w.cls}">${w.bar !== undefined ? `<span class="bar"><i style="width:${w.bar}%;background:${color(w.bar)}"></i></span>` : ""}<b>${esc(w.txt)}</b></small>`; };
  const body = (c: Card) => {
    const sug = c.levels ? suggestedLevel(c.key, p) : 0;
    return `<p>${esc(c.text)}</p>
        ${c.levels ? `<label class="ex-lv">Niveau <select data-lv="${c.key}">${c.levels.map((l, i) => `<option value="${i + 1}" ${lv(c.key) === i + 1 ? "selected" : ""}>${i + 1} · ${esc(l)}${i + 1 === sug ? " (conseillé)" : ""}</option>`).join("")}</select></label>` : ""}
        ${c.key === "five" ? `<label class="ex-lv">Tonalité <select data-five>${MAJOR_KEYS.map((k, i) => `<option value="${i}" ${lv("five") - 1 === i ? "selected" : ""}>${esc(nameOf(k))} majeur</option>`).join("")}</select></label>` : ""}`;
  };
  const card = (c: Card, i: number) => `<div class="ex-card" style="--c:${c.color}"><div class="ex-top"><span class="ex-n">${i + 1}</span><span class="ex-ic">${c.icon}</span><b>${esc(c.title)}</b></div>${status(c.key)}${body(c)}
        <div class="ex-foot"><button class="ex-go" data-go="${c.key}">${esc(c.action)}</button></div></div>`;
  // les autres : une ligne chacun (dépliable), les utiles d'abord, puis ceux qui viendront avec le parcours
  const rows = CARDS.filter((c) => !rec.includes(c.key)).sort((a, b) => Number(!!unitAfter(a.key)) - Number(!!unitAfter(b.key)) || (stateOf(b.key)?.need ?? 0) - (stateOf(a.key)?.need ?? 0));
  const row = (c: Card) => `<details class="ex-row" style="--c:${c.color}" data-row="${c.key}" ${openRow === c.key ? "open" : ""}><summary><span class="ex-ic">${c.icon}</span><b>${esc(c.title)}</b>${status(c.key)}</summary>
        <div class="ex-rowbody">${body(c)}<div class="ex-foot"><button class="ex-go" data-go="${c.key}">${esc(c.action)}</button></div></div></details>`;
  root.innerHTML = `<div class="ex-wrap"><div class="ex-head"><h1>Exercices</h1><p>${rec.length ? "Fais-les dans l'ordre : ils sont choisis d'après ce que tu maîtrises le moins, au niveau conseillé. Le reste est rangé en dessous." : "Commence par le parcours : les exercices utiles apparaîtront ici au fur et à mesure."}</p></div>
    ${rec.length ? `<h3 class="ex-sec">À faire maintenant</h3><div class="ex-grid">${rec.map((k, i) => card(CARDS.find((c) => c.key === k)!, i)).join("")}</div>` : ""}
    <details class="ex-all" ${!rec.length || allOpen ? "open" : ""}><summary>Les autres exercices (${rows.length})</summary><div class="ex-rows">${rows.map(row).join("")}</div></details></div>`;
}

export function drillFor(key: string, level: number): Drill | null {
  const card = CARDS.find((c) => c.key === key)!;
  const make = key === "rhythm" ? () => X.rhythmDrill(level) : key === "intervals" ? () => X.intervalDrill(level) : key === "chords" ? () => X.chordEarDrill(level) : key === "echo" ? () => X.echoDrill(level) : key === "pedal" ? () => pedalDrill(level) : key === "fingers" ? () => fingerDrill(level) : key === "improv" ? () => improvDrill(level) : null;
  if (!make) return null;
  return { key: `${key}-${level}`, title: `${card.title}${card.levels ? ` · niveau ${level}` : ""}`, color: card.color, icon: card.icon, make };
}
/** Lance un exercice (aussi utilisé par la séance du jour). */
export function launch(key: string, level = lv(key)) {
  if (key === "reading") { host.openSolfege(); return; }
  if (key === "tech") { host.openTech(); return; }
  if (key === "sight") { const p = X.sightReading(level); host.openPiece(X.xmlOf(p.spec), p.title, { mode: "rhythm", speed: 70, tag: "sight" }); return; }
  if (key === "five") { const k = MAJOR_KEYS[Math.max(0, Math.min(MAJOR_KEYS.length - 1, lv("five") - 1))]; const p = X.fiveFinger(k); host.openPiece(X.xmlOf(p.spec), p.title, { mode: "step", speed: 100, tag: "warmup" }); return; }
  const d = drillFor(key, level); if (d) host.startDrill(d);
}
export const exerciseLevel = lv;
export function openExercises() { levels = load(); render(); }
export function initExercises(rootEl: HTMLElement, h: ExHost) {
  host = h; root = rootEl;
  root.addEventListener("change", (e) => {
    const t = e.target as HTMLSelectElement;
    if (t.dataset.lv) { levels[t.dataset.lv] = Number(t.value); save(); render(); }
    if (t.dataset.five !== undefined) { levels.five = Number(t.value) + 1; save(); }
  });
  root.addEventListener("toggle", (e) => {
    const d = e.target as HTMLDetailsElement;
    if (d.classList?.contains("ex-all")) allOpen = d.open;
    if (d.classList?.contains("ex-row")) { if (d.open) openRow = d.dataset.row!; else if (openRow === d.dataset.row) openRow = ""; }
  }, true);
  root.addEventListener("click", (e) => { const b = (e.target as HTMLElement).closest("[data-go]") as HTMLElement | null; if (b) launch(b.dataset.go!); });
}
