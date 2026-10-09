/** Interface du parcours : la carte des leçons (déblocage linéaire) et le déroulé d'une leçon façon Duolingo
 *  (questions courtes, retour immédiat, erreurs rejouées en fin de leçon, étoiles, XP, série). */
import { MiniKeyboard } from "../miniKeyboard";
import { renderXml } from "../score";
import { UNITS, LESSONS, lessonById, type FlatLesson } from "./curriculum";
import { reviewFail, reviewPass } from "../review";
import { LessonSession, ChordCollector, loadProgress, saveProgress, completeLesson, validateLessons, isUnlocked, isDone, currentIndex, streak, pressOk, scoreRhythm, patternBeats, judgeTouch, judgePedal, judgeImprov, resetCourse, dayKey, type Progress, type KeyEvent } from "./engine";
import { buildStaffXml, note as noteEv, rest as restEv, type Ev, type Dur } from "./xml";
import { mulberry32, P, fr } from "./build";
import { markDone } from "../daily";
import { record as recordSkill } from "../skills";
import { dueLessons, recallQuestions, recordRecall, origin as recallOrigin } from "../recall";
import type { Q, Show, Audio, Unit } from "./types";
import { esc } from "../html";
import { icon, iconOrText } from "../icons";
import { readJson, writeJson } from "../storage";

export interface CourseHost {
  play(pitch: number, ms?: number): void;
  click(accent: boolean): void;
  soundOnPress(): boolean;
  /** Ouvre un exercice dans le moteur d'entraînement ; `onResult` reçoit le score (%) d'un passage noté. */
  openPiece(xml: string, title: string, o: { pass: number; hands: "R" | "L" | "both"; mode: "step" | "rhythm"; minSpeed: number; onResult: (acc: number) => void }): void;
  /** Un exercice libre (oreille, rythme…) est terminé ou abandonné : on revient à la page des exercices. */
  onDrillExit?(): void;
}
/** Exercice libre : même déroulé qu'une leçon, sans déblocage ; les questions sont régénérées à chaque partie. */
export interface Drill { key: string; title: string; color: string; icon: string; make: () => Q[]; }

const UI_KEY = "pianoflow-course-ui";
interface UiPrefs { unlockAll: boolean; names: boolean; }
const loadPrefs = (): UiPrefs => ({ unlockAll: false, names: false, ...readJson(UI_KEY, {}) });
const savePrefs = () => { writeJson(UI_KEY, prefs); };

let host: CourseHost, root: HTMLElement, kbd: MiniKeyboard | null = null;
let prefs = loadPrefs(), prog: Progress = loadProgress(), active = false;
let run: Run | null = null;

interface Run {
  lesson: FlatLesson; session: LessonSession; q: Q; mistakes: number; resolved: boolean; hinted: boolean; seqPos: number;
  chord: ChordCollector | null; staffEl: HTMLElement | null; tokens: number; rhythm: RhythmState | null; startedAt: number; summary: boolean;
  /** résultat de la question une fois répondue (compte pour le score seulement s'il est vrai) */ outcome: boolean;
  drill?: Drill; touch?: KeyEvent[]; pedal?: { t: number; down: boolean }[]; chordOnsets?: number[]; chordIdx?: number; chordKeys?: Set<number>; /** score du dernier passage noté de l'exercice en cours */ pieceAcc?: number; /** instant du retour affiché */ resolvedAt?: number; improv?: { on: boolean; notes: number[] };
  result?: { xp: number; stars: number; accuracy: number; first: boolean; streak: number };
}
interface RhythmState { phase: "idle" | "count" | "rec" | "done"; t0: number; taps: number[]; timers: number[]; }

const DONE_MSG = ["Bien joué !", "Parfait !", "Excellent !", "Exactement !", "Bravo !"];
const nameOfTarget = (q: Q) => (q.k === "press" ? ("midi" in q.target ? fr(q.target.midi) : fr(q.target.pcs[0])) : "");

// ───────────────────────────── carte du parcours ─────────────────────────────
const NODE_SHIFT = [0, 34, 56, 34, 0, -34, -56, -34];
const ids = () => LESSONS.map((l) => l.id);

function renderPath() {
  focus(false);
  run = run?.summary ? null : run;
  const st = streak(prog.days), cur = currentIndex(prog, ids()), total = LESSONS.length, doneN = LESSONS.filter((l) => isDone(prog, l.id)).length;
  const next = LESSONS[Math.min(cur, total - 1)];
  const stars = Object.values(prog.done).reduce((s, d) => s + d.stars, 0);
  root.innerHTML = `<div class="cs-path">
    <aside class="cs-side">
      <div class="cs-stats">
        <div class="cs-stat" title="Jours d'affilée"><b>${icon("flame")} ${st}</b><small>série</small></div>
        <div class="cs-stat"><b>${icon("zap")} ${prog.xp}</b><small>XP</small></div>
        <div class="cs-stat"><b>${icon("star")} ${stars}</b><small>étoiles</small></div>
      </div>
      <div class="cs-ovr"><div class="cs-ovr-bar"><i style="width:${(doneN / total) * 100}%"></i></div><small>${doneN} / ${total} leçons</small></div>
      <nav class="cs-toc">${UNITS.map((u) => {
        const ls = LESSONS.filter((l) => l.unit === u), d = ls.filter((l) => isDone(prog, l.id)).length, open = ls.some((l) => isUnlocked(prog, ids(), l.index, prefs.unlockAll));
        return `<button data-unit="${u.id}" class="${d === ls.length ? "full" : ""} ${open ? "" : "lock"}"><span class="cs-ic" style="--c:${u.color}">${iconOrText(u.icon, esc)}</span><span class="cs-tt">${esc(u.title)}</span><small>${d}/${ls.length}</small></button>`;
      }).join("")}</nav>
    </aside>
    <div class="cs-scroll" id="csScroll">
      ${cur < total ? `<div class="cs-resume"><div><small>${esc(next.unit.title)} · leçon ${next.inUnit + 1}</small><b>${esc(next.title)}</b></div><button class="sf-btn pri" data-start="${next.id}">${isDone(prog, next.id) ? "Refaire" : doneN === 0 ? "Commencer" : "Continuer"}</button></div>`
        : `<div class="cs-resume"><div><small>Parcours terminé</small><b>Tu as fini toutes les leçons ${icon("party-popper")}</b></div></div>`}
      ${doneN === 0 ? `<p class="cs-tiptest">Tu as déjà joué du piano ? Chaque unité a un bouton <b>${icon("fast-forward")} Je connais déjà</b> : un court test la valide d'un coup, avec toutes celles d'avant.</p>` : ""}
      ${UNITS.map((u) => {
        const ls = LESSONS.filter((l) => l.unit === u);
        const full = ls.every((l) => isDone(prog, l.id));
        return `<section class="cs-unit" id="unit-${u.id}"><header style="--c:${u.color}"><span class="cs-uic">${iconOrText(u.icon, esc)}</span><div><small>Unité ${UNITS.indexOf(u) + 1}</small><h3>${esc(u.title)}</h3><p>${esc(u.sub)}</p></div>${full ? "" : `<button class="cs-test" data-test="${u.id}" title="Un court test sur toute l'unité : réussi, elle est validée d'un coup">${icon("fast-forward")} Je connais déjà</button>`}</header>
          <div class="cs-nodes">${ls.map((l) => {
            const done = isDone(prog, l.id), unlocked = isUnlocked(prog, ids(), l.index, prefs.unlockAll), isCur = l.index === cur;
            const s = prog.done[l.id]?.stars ?? 0, shift = NODE_SHIFT[l.inUnit % NODE_SHIFT.length];
            return `<div class="cs-row" style="transform:translateX(${shift}px)"><button class="cs-node ${done ? "done" : unlocked ? "open" : "lock"} ${isCur ? "cur" : ""}" style="--c:${u.color}" data-lesson="${l.id}" aria-label="${esc(l.title)}">
              ${isCur ? `<span class="cs-go">GO</span>` : ""}<span class="cs-n">${done ? "✓" : unlocked ? l.inUnit + 1 : icon("lock")}</span></button>
              <div class="cs-lt"><b>${esc(l.title)}</b>${done ? `<span class="cs-st">${"★".repeat(s)}${"☆".repeat(3 - s)}</span>` : ""}</div></div>`;
          }).join("")}</div></section>`;
      }).join("")}
      <details class="cs-opts"><summary>Options du parcours</summary>
        <label class="sf-chk"><input type="checkbox" id="csFree" ${prefs.unlockAll ? "checked" : ""}/> Mode libre : tout débloquer, sans suivre l'ordre</label>
        <button class="cs-reset" data-coursereset title="Efface les leçons réussies. Les jours de pratique et tes morceaux ne bougent pas.">↺ Recommencer le parcours depuis le début</button>
      </details>
    </div>
    <div class="cs-sheet hidden" id="csSheet"></div>
  </div>`;
  const curEl = root.querySelector(".cs-node.cur"); curEl?.scrollIntoView({ block: "center" });
}

function openSheet(l: FlatLesson) {
  const sheet = root.querySelector("#csSheet") as HTMLElement, d = prog.done[l.id], unlocked = isUnlocked(prog, ids(), l.index, prefs.unlockAll);
  const prev = LESSONS[l.index - 1];
  sheet.innerHTML = `<div class="cs-card" style="--c:${l.unit.color}"><button class="cs-close" data-close>✕</button>
    <small>${esc(l.unit.title)} · leçon ${l.inUnit + 1}</small><h3>${esc(l.title)}</h3>
    <ul>${l.goals.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>
    ${d ? `<p class="cs-best">${"★".repeat(d.stars)}${"☆".repeat(3 - d.stars)} · meilleur score ${d.best} %</p>` : ""}
    ${unlocked ? `<button class="sf-btn pri" data-start="${l.id}">${d ? "Refaire la leçon" : "Commencer"}</button>`
      : `<p class="cs-lockmsg">${icon("lock")} Termine d'abord « ${esc(prev?.title ?? "")} » pour ouvrir celle-ci. (Tu peux aussi activer le mode libre.)</p>`}</div>`;
  sheet.classList.remove("hidden");
}

// ── test « Je connais déjà » : quelques questions de chaque leçon de l'unité ──
const TEST_PASS = 80;
/** Questions du test : jusqu'à 2 par leçon (pas les explications, ni les morceaux, longs à jouer), 14 au plus. */
export function unitTestQuestions(u: Unit, rng = mulberry32((Date.now() ^ (Math.random() * 1e9)) >>> 0)): Q[] {
  const out: Q[] = [];
  for (const l of u.lessons) {
    const qs = l.build(rng).filter((q) => q.k !== "info" && q.k !== "piece" && q.k !== "improv");
    for (let i = qs.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [qs[i], qs[j]] = [qs[j], qs[i]]; }
    out.push(...qs.slice(0, 2));
  }
  while (out.length > 14) out.splice(Math.floor(rng() * out.length), 1);
  return out;
}
function openTestSheet(u: Unit) {
  const sheet = root.querySelector("#csSheet") as HTMLElement, n = unitTestQuestions(u).length;
  sheet.innerHTML = `<div class="cs-card" style="--c:${u.color}"><button class="cs-close" data-close>✕</button>
    <small>Unité ${UNITS.indexOf(u) + 1}</small><h3>${esc(u.title)} : je connais déjà</h3>
    ${n >= 3 ? `<p class="cs-lockmsg">${n} questions tirées de toute l'unité. Avec ${TEST_PASS} % ou plus du premier coup, l'unité est validée, et toutes celles d'avant aussi (une étoile par leçon ; tu pourras refaire une leçon pour en gagner plus).</p>
    <button class="sf-btn pri" data-runtest="${u.id}">Passer le test</button>`
      : `<p class="cs-lockmsg">Cette unité se valide en jouant ses morceaux : ouvre ses leçons une par une.</p>`}</div>`;
  sheet.classList.remove("hidden");
}
function runTest(u: Unit) {
  startDrill({ key: `test-${u.id}`, title: `Test : ${u.title}`, color: u.color, icon: u.icon, make: () => unitTestQuestions(u) }, "Retour au parcours");
}
function finishTest(r: Run, accuracy: number) {
  const u = UNITS.find((x) => `test-${x.id}` === r.drill!.key)!, ok = accuracy >= TEST_PASS;
  r.summary = true;
  let added = 0;
  if (ok) {
    const last = LESSONS.filter((l) => l.unit === u).pop()!;
    const res = validateLessons(prog, LESSONS.filter((l) => l.index <= last.index).map((l) => l.id), accuracy);
    prog = res.progress; added = res.added; saveProgress(prog);
  }
  const first = LESSONS.find((l) => l.unit === u && !isDone(prog, l.id));
  root.innerHTML = `<div class="cs-lesson cs-done" style="--c:${u.color}"><div class="cs-sum">
    <div class="cs-pic">${ok ? icon("party-popper") : icon("biceps-flexed")}</div>
    <h2>${ok ? "Unité validée !" : "Pas encore"}</h2>
    <p class="cs-small">${ok ? `${accuracy} % du premier coup : ${added} leçon${added > 1 ? "s" : ""} validée${added > 1 ? "s" : ""}. On continue à partir de la suite.` : `${accuracy} % du premier coup (il en faut ${TEST_PASS}). Les leçons de cette unité vont te remettre à niveau rapidement.`}</p>
    <div class="cs-sumbtns">${!ok && first ? `<button class="sf-btn pri" data-start="${first.id}">Commencer : ${esc(first.title)}</button>` : ""}<button class="sf-btn ${ok ? "pri" : ""}" data-leave>Retour au parcours</button></div></div></div>`;
}

// ───────────────────────────── leçon ─────────────────────────────
function startLesson(id: string) {
  const lesson = lessonById(id); if (!lesson) return;
  const qs = lesson.build(mulberry32((Date.now() ^ (Math.random() * 1e9)) >>> 0));
  const session = new LessonSession(qs);
  run = { lesson, session, q: session.current!, mistakes: 0, resolved: false, hinted: false, seqPos: 0, chord: null, staffEl: null, tokens: 0, rhythm: null, startedAt: Date.now(), summary: false, outcome: false };
  renderLesson();
}
function leaveLesson() { clearRhythm(); focus(false); const d = run?.drill; run = null; if (d?.key.startsWith("test-")) renderPath(); else if (d) host.onDrillExit?.(); else if (exitTo) { const f = exitTo; exitTo = null; f(); } else renderPath(); }
/** Leçon ouverte depuis la séance du jour : on y revient en quittant. */
let exitTo: (() => void) | null = null, exitLabel = "", drillBack = "Retour aux exercices";

/** Lance un exercice libre dans le déroulé des leçons (appelé depuis l'onglet Exercices). */
export function startDrill(d: Drill, backLabel = "Retour aux exercices") {
  active = true; drillBack = backLabel;
  const unit: Unit = { id: "drill", title: d.title, sub: "", icon: d.icon, color: d.color, lessons: [] };
  const lesson: FlatLesson = { id: "drill-" + d.key, title: d.title, goals: [], build: () => d.make(), unit, index: -1, inUnit: 0 };
  const session = new LessonSession(d.make());
  run = { lesson, session, q: session.current!, mistakes: 0, resolved: false, hinted: false, seqPos: 0, chord: null, staffEl: null, tokens: 0, rhythm: null, startedAt: Date.now(), summary: false, outcome: false, drill: d };
  renderLesson();
}
/** Ouvre directement une leçon (séance du jour). */
export function startLessonById(id: string, onExit?: () => void, label = "Retour à la séance du jour") { active = true; prog = loadProgress(); exitTo = onExit ?? null; exitLabel = label; startLesson(id); }

/** Pendant une leçon ou un exercice, les onglets disparaissent : une seule chose à l'écran. */
const focus = (on: boolean) => document.body.classList.toggle("in-lesson", on);
function renderLesson() {
  const r = run; if (!r) return;
  focus(true);
  clearRhythm();
  r.q = r.session.current!; r.mistakes = 0; r.resolved = false; r.outcome = false; r.hinted = false; r.seqPos = 0; r.chord = null; r.rhythm = null;
  r.touch = []; r.pedal = []; r.chordOnsets = []; r.chordIdx = 0; r.chordKeys = new Set();
  const q = r.q, tok = ++r.tokens;
  const retry = r.session.isRetry ? `<span class="cs-retry">↻ Essaie encore</span>` : "";
  root.innerHTML = `<div class="cs-lesson" style="--c:${r.lesson.unit.color}">
    <div class="cs-top"><button class="cs-x" data-leave title="Quitter la leçon">✕</button><div class="cs-bar"><i style="width:${r.session.progress * 100}%"></i></div>
      <label class="cs-names" title="Afficher le nom des notes sur le clavier"><input type="checkbox" id="csNames" ${prefs.names ? "checked" : ""}/> Aa</label></div>
    <div class="cs-main" id="csMain">${retry}${stageHtml(q)}</div>
    <div class="cs-foot" id="csFoot">${footIdle(q)}</div>
    <div class="sf-kbd cs-kbd ${needsKeyboard(q) ? "" : "hidden"}" id="csKbd"></div></div>`;
  setupKeyboard(q);
  if (!(q.k === "seq" && q.hidden)) void drawStaff(q.k === "rhythm" ? undefined : (q as any).show, tok);
  if (q.k === "rhythm") void drawRhythmStaff(q.pattern, tok, q.beats ?? 4, q.ties, q.beatType ?? 4);
  if (q.k === "improv") setTimeout(() => { if (run?.q === q) markScale(q); }, 0);
  const au = audioOf(q); if (au) setTimeout(() => { if (run === r && r.tokens === tok) playAudio(au); }, 450);
  if (q.k === "piece" && r.pieceAcc !== undefined) { const acc = r.pieceAcc; r.pieceAcc = undefined; showPieceResult(q, acc); }
}
const needsKeyboard = (q: Q) => q.k === "improv" || q.k === "press" || q.k === "seq" || q.k === "chord" || q.k === "rhythm" || q.k === "touch" || q.k === "pedal" || (q.k === "info" && !!(q.kbd || q.show?.marks || q.show?.badges)) || (q.k === "choice" && !!q.kbd);
const audioOf = (q: Q): Audio | undefined => ("audio" in q ? q.audio : undefined);
/** Joue un énoncé sonore : chaque pas = notes simultanées. */
function playAudio(a: Audio) {
  const ms = a.ms ?? 650;
  a.steps.forEach((notes, i) => setTimeout(() => { if (active) for (const m of notes) host.play(m, ms * 1.4); }, i * ms));
}
/** Dernier événement MIDI vu : les questions de toucher / pédale proposent de passer s'il n'y a pas de clavier MIDI. */
let midiSeen = false;

function stageHtml(q: Q): string {
  switch (q.k) {
    case "info": return `<div class="cs-info"><h2>${esc(q.title)}</h2><div class="cs-staff" id="csStaff"></div><p>${esc(q.body)}</p></div>`;
    case "press": case "seq": case "chord":
      return `<h2 class="cs-prompt">${esc(q.prompt)}</h2>${audioBtn(q)}<div class="cs-staff" id="csStaff"></div>${q.k === "seq" && q.hidden ? `<div class="cs-dots">${q.notes.map(() => "<i></i>").join("")}</div>` : ""}<div class="cs-hint" id="csHint"></div>`;
    case "choice": return `<h2 class="cs-prompt">${esc(q.prompt)}</h2>${audioBtn(q)}<div class="cs-staff" id="csStaff"></div><div class="cs-opts">${q.options.map((o, i) => `<button class="cs-opt" data-opt="${i}">${esc(o)}</button>`).join("")}</div>`;
    case "touch": case "pedal":
      return `<h2 class="cs-prompt">${esc(q.prompt)}</h2><div class="cs-staff" id="csStaff"></div>${q.k === "pedal" ? `<div class="cs-pedal" id="csPedal">pédale en haut</div>` : ""}<div class="cs-hint" id="csHint">${q.k === "pedal" ? "Il faut un clavier MIDI avec une pédale de sustain branchée." : "Il faut un clavier MIDI : l'appli mesure la force et la durée de chaque note."}</div>`;
    case "improv": return `<h2 class="cs-prompt">${esc(q.prompt)}</h2><div class="cs-imp"><div class="cs-imp-chord" id="csImp">${esc(q.names.join(" – "))}</div><small>${esc(q.scaleName)} : les touches allumées sur le clavier. ${q.rounds} tours de la grille.</small></div>
      <div class="cs-hint" id="csHint">${esc(q.hint ?? "L'appli joue les accords ; toi, joue ce que tu veux avec les notes allumées : des notes longues, des répétitions, des petites phrases. Pas de fausse note possible !")}</div>
      <div class="cs-rctl"><button class="sf-btn pri" data-improv>▶ Lancer l'accompagnement</button></div>`;
    case "rhythm": return `<h2 class="cs-prompt">${esc(q.prompt)}</h2><div class="cs-staff cs-rstaff" id="csStaff"></div><div class="cs-hint" id="csHint">${esc(q.hint ?? "Quatre clics de préparation, puis tape sur chaque note (n'importe quelle touche, la barre espace, ou ce bouton).")}</div>
      <div class="cs-rctl"><button class="sf-btn" data-rlisten>▶ Écouter</button><button class="sf-btn pri" data-rstart>${icon("drum")} Commencer</button></div><button class="cs-tap" id="csTap" data-tap>TAPE</button>`;
    case "piece": return `<div class="cs-piece"><div class="cs-pic">${icon("piano")}</div><h2>${esc(q.title)}</h2><p>${esc(q.goal)}</p><p class="cs-small">Objectif : ${q.pass} % ${q.mode === "rhythm" ? `en mode « En rythme », mains ensemble, à ${q.speed ?? 70} % de la vitesse au moins` : "de justesse en « Pas à pas »"}. L'exercice s'ouvre dans l'entraînement (partition, notes qui tombent, mains séparées) ; travaille-le comme tu veux, puis fais un passage validant.</p>
      <button class="sf-btn pri" data-openpiece>Ouvrir l'exercice</button></div>`;
  }
}
const audioBtn = (q: Q) => (audioOf(q) ? `<button class="sf-btn cs-listen" data-replay>${icon("volume-2")} Réécouter</button>` : "");
function footIdle(q: Q): string {
  if (q.k === "info") return `<button class="cs-cta" data-next>Compris</button>`;
  if (q.k === "touch" || q.k === "pedal") return `${"hint" in q && q.hint ? `<button class="cs-skip" data-hintbtn>${icon("lightbulb")} Indice</button>` : ""}<button class="cs-skip" data-nomidi>${midiSeen ? "Passer" : "Pas de clavier MIDI : passer"}</button>`;
  if (q.k === "piece") return `<button class="cs-skip" data-skip>Passer (compte comme raté)</button>`;
  const hint = "hint" in q && q.hint ? `<button class="cs-skip" data-hintbtn>${icon("lightbulb")} Indice</button>` : "";
  return hint;
}

// ── portée fixe de l'énoncé ──
const DURS = new Set([0.5, 1, 1.5, 2, 3, 4, 6, 8]);
async function drawStaff(show: Show | undefined, tok: number) {
  const host_ = root.querySelector("#csStaff") as HTMLElement | null; if (!host_ || !show?.staff) return;
  host_.innerHTML = `<span class="sf-loading">…</span>`;
  try {
    const evs = show.staff.evs.map((e) => ({ ...e, dur: (DURS.has(e.dur) ? e.dur : 2) as Dur }));
    const svg = await renderXml(buildStaffXml(evs, show.staff.clef, show.staff.fifths ?? 0, Math.max(8, evs.reduce((s, e) => s + e.dur, 0))), { spacing: 0.5 });
    if (!run || run.tokens !== tok) return;
    host_.innerHTML = svg; run.staffEl = host_;
    const labels = show.staff.labels;
    if (labels) requestAnimationFrame(() => placeLabels(host_, labels));
  } catch (e) { console.warn("parcours : portée", e); host_.innerHTML = ""; }
}
function placeLabels(host_: HTMLElement, labels: string[]) {
  // une étiquette par note isolée ou par accord (et non par tête de note : un accord en a plusieurs)
  const hr = host_.getBoundingClientRect(), heads = Array.from(host_.querySelectorAll("g.chord, g.note"))
    .filter((el) => el.classList.contains("chord") || !el.closest("g.chord")).map((el) => el.querySelector(".notehead")).filter((h): h is Element => !!h);
  const bar = document.createElement("div"); bar.className = "cs-labels";
  heads.forEach((h, i) => { if (!labels[i]) return; const r = h.getBoundingClientRect(); const s = document.createElement("span"); s.textContent = labels[i]; s.style.left = r.left + r.width / 2 - hr.left + "px"; bar.appendChild(s); });
  host_.appendChild(bar);
}
async function drawRhythmStaff(pattern: number[], tok: number, beats = 4, ties: number[] = [], beatType: 4 | 8 = 4) {
  const host_ = root.querySelector("#csStaff") as HTMLElement | null; if (!host_) return;
  const evs: Ev[] = pattern.map((d) => (d > 0 ? noteEv(P("B4"), d as Dur) : restEv(-d as Dur)));
  for (const i of ties) { if (evs[i]) evs[i].tie = evs[i].tie === "stop" ? "both" : "start"; if (evs[i + 1]) evs[i + 1].tie = evs[i + 1].tie === "start" ? "both" : "stop"; }
  try {
    const svg = await renderXml(buildStaffXml(evs, "G", 0, beatType === 8 ? beats : beats * 2, { beats, beatType }), { spacing: 0.55 });
    if (!run || run.tokens !== tok) return;
    host_.innerHTML = svg; run.staffEl = host_;
  } catch { /* ignore */ }
}
const markNote = (i: number, cls: string) => { const g = run?.staffEl?.querySelectorAll("g.note")[i]; if (g) { g.classList.remove("sf-ok", "sf-ko", "sf-sel"); g.classList.add(cls); } };

// ── clavier du bas ──
function setupKeyboard(q: Q) {
  const box = root.querySelector("#csKbd") as HTMLElement; if (!box) return;
  kbd = new MiniKeyboard(box, (m) => onKey(m, false));
  const [lo, hi] = "kbd" in q && q.kbd ? q.kbd : ([48, 76] as [number, number]);
  kbd.setRange(lo, hi);
  // les noms sur les touches : toujours dans les explications, à la demande (Aa) ailleurs — sinon ils donneraient la réponse
  kbd.showNames(q.k === "info" || prefs.names);
  const show = "show" in q ? q.show : undefined;
  for (const m of show?.marks ?? []) kbd.mark(m.m, m.c);
  for (const b of show?.badges ?? []) kbd.label(b.m, b.t, b.hand === "L" ? "lh" : "");
}

// ───────────────────────────── réponses ─────────────────────────────
/** Retour immédiat sous la question. `counts: false` : juste, mais avec de l'aide ou des erreurs → la question reviendra en fin de leçon. */
function flash(ok: boolean, message: string, opts: { detail?: string; counts?: boolean } = {}) {
  const r = run; if (!r) return;
  const foot = root.querySelector("#csFoot") as HTMLElement;
  r.resolved = true; r.outcome = ok && opts.counts !== false;
  const good = r.outcome;
  foot.className = "cs-foot " + (good ? "good" : "bad");
  foot.innerHTML = `<div class="cs-fb"><b>${good ? "✓ " : ok ? "◐ " : "✗ "}${esc(message)}</b>${opts.detail ? `<div>${esc(opts.detail)}</div>` : ""}</div><button class="cs-cta ${good ? "" : "bad"}" data-next>Continuer</button>`;
  (foot.querySelector("[data-next]") as HTMLElement)?.focus?.();
  r.resolvedAt = performance.now();
  // juste : on passe tout seul à la suite, le temps de lire le retour (le bouton reste là pour aller plus vite).
  // Un exercice de morceau revient d'un autre écran : son résultat attend qu'on l'ait lu.
  if (ok && r.q.k !== "piece") {
    const tok = r.tokens, len = message.length + (opts.detail?.length ?? 0);
    const wait = good && !opts.detail ? 900 : Math.min(4000, 1200 + len * 30);
    setTimeout(() => { if (run === r && r.tokens === tok && r.resolved && !r.summary) settle(r.outcome); }, wait);
  }
}
function settle(good: boolean) {
  const r = run; if (!r) return;
  const next = r.session.answer(good);
  if (!next) { finishLesson(); return; }
  renderLesson();
}

function onKey(m: number, fromMidi: boolean, vel = 90) {
  const r = run; if (!r || !active) return;
  if (!fromMidi || host.soundOnPress()) host.play(m, 700);
  // après une erreur, une touche du piano vaut « Continuer » : les mains restent sur le clavier
  // (pas tout de suite, pour qu'une note jouée dans l'élan ne fasse pas sauter la correction)
  if (r.resolved) { if (fromMidi && !r.outcome && r.q.k !== "piece" && performance.now() - (r.resolvedAt ?? 0) > 800) settle(false); return; }
  const q = r.q;
  if (q.k === "rhythm") { tapRhythm(); return; }
  if (!kbd) return;
  if (q.k === "touch") { touchPress(q, m, fromMidi, vel); return; }
  if (q.k === "pedal") { pedalNote(q, m); return; }
  if (q.k === "improv") { if (r.improv?.on) { r.improv.notes.push(m); kbd.mark(m, q.scale.includes(m % 12) ? "ok" : "bad"); setTimeout(() => { if (run === r && r.q === q) markScale(q); }, 250); } return; }
  if (q.k === "press") {
    kbd.clear();
    if (pressOk(q.target, m)) {
      kbd.mark(m, "ok");
      flash(true, r.hinted ? "Juste, mais avec l'indice : on la refait" : (q.ok ?? pick(DONE_MSG)), { counts: !r.hinted });
    } else {
      kbd.mark(m, "bad"); markTargets(q);
      flash(false, `C'était ${nameOfTarget(q) || "une autre touche"}`, { detail: q.hint ?? "" });
    }
  } else if (q.k === "seq") {
    const want = q.notes[r.seqPos];
    if (m === want) {
      kbd.clear(); kbd.mark(m, "ok"); markNote(r.seqPos, "sf-ok"); root.querySelectorAll(".cs-dots i")[r.seqPos]?.classList.add("ok"); r.seqPos++;
      if (r.seqPos >= q.notes.length) {
        const clean = r.mistakes === 0 && !r.hinted;
        flash(true, clean ? pick(DONE_MSG) : "Bien joué, mais avec des erreurs ou de l'aide : on la refait", { counts: clean });
      } else { markNote(r.seqPos, "sf-sel"); (root.querySelector("#csHint") as HTMLElement).textContent = ""; }
    } else {
      r.mistakes++; kbd.clear(); kbd.mark(m, "bad");
      const hintEl = root.querySelector("#csHint") as HTMLElement;
      hintEl.textContent = `Ce n'est pas ${fr(m)}. Prochaine note : ${r.mistakes >= 2 ? fr(want) : "regarde la portée"}.`;
      if (r.mistakes >= 2) kbd.mark(want, "target");
    }
  } else if (q.k === "chord") {
    if (!r.chord) r.chord = new ChordCollector(q.pcs, q.bass);
    const res = r.chord.add(m, performance.now());
    kbd.mark(m, res === "bad" ? "bad" : "sel");
    if (res === "ok") { r.chord.pressed.forEach((k) => kbd!.mark(k, "ok")); flash(true, r.hinted ? "Juste, mais avec l'indice : on la refait" : `${q.name} : accord réussi`, { counts: !r.hinted }); }
    else if (res === "bad") {
      for (let k = q.kbd[0]; k <= q.kbd[1]; k++) if (q.pcs.includes(k % 12)) kbd.mark(k, "target");
      flash(false, "Pas tout à fait", { detail: `Il faut ${q.pcs.map(fr).join(" – ")}${q.bass !== undefined ? `, avec ${fr(q.bass)} en bas` : ""}. ${q.hint ?? ""}` });
    }
  }
}
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

// ── toucher : nuances / legato / staccato (il faut les vélocités et les relâchés du clavier MIDI) ──
function touchPress(q: Extract<Q, { k: "touch" }>, m: number, fromMidi: boolean, vel: number) {
  const r = run!; const hint = root.querySelector("#csHint") as HTMLElement;
  if (!fromMidi) { hint.textContent = "Avec le clavier de l'écran, l'appli ne peut pas mesurer la force ni la durée : joue sur ton piano MIDI, ou passe."; return; }
  const want = q.notes[r.touch!.length];
  if (m !== want) { kbd!.mark(m, "bad"); hint.textContent = `Ce n'est pas la bonne note : recommence la suite depuis le début (${q.notes.map(fr).join(" – ")}).`; r.touch = []; r.mistakes++; return; }
  kbd!.clear(); kbd!.mark(m, "ok");
  r.touch!.push({ m, on: performance.now(), vel });
  hint.textContent = `${r.touch!.length} / ${q.notes.length}`;
  if (r.touch!.length === q.notes.length) setTimeout(() => finishTouch(q), q.want === "legato" || q.want === "staccato" ? 700 : 50);
}
function keyUp(m: number) {
  const r = run; if (!r || r.resolved) return;
  const ev = [...(r.touch ?? [])].reverse().find((e) => e.m === m && e.off === undefined);
  if (ev) ev.off = performance.now();
}
function finishTouch(q: Extract<Q, { k: "touch" }>) {
  const r = run; if (!r || r.q !== q || r.resolved) return;
  for (const e of r.touch!) if (e.off === undefined) e.off = performance.now();
  const res = judgeTouch(q.want, r.touch!);
  flash(res.ok, res.ok ? pick(DONE_MSG) : "Pas encore", { detail: res.detail, counts: r.mistakes === 0 });
}
// ── improvisation ──
function markScale(q: Extract<Q, { k: "improv" }>) { if (!kbd) return; kbd.clear(); for (let k = q.kbd[0]; k <= q.kbd[1]; k++) if (q.scale.includes(k % 12)) kbd.mark(k, "target"); }
function startImprov() {
  const r = run; if (!r || r.q.k !== "improv" || r.improv?.on || r.resolved) return;
  const q = r.q, bar = (60000 / q.bpm) * 4, total = q.grid.length * q.rounds;
  r.improv = { on: true, notes: [] };
  const box = root.querySelector("#csImp") as HTMLElement, btn = root.querySelector("[data-improv]") as HTMLElement | null;
  if (btn) btn.setAttribute("disabled", "");
  markScale(q);
  for (let i = 0; i <= total; i++) setTimeout(() => {
    if (run !== r || r.q !== q || !r.improv?.on) return;
    if (i === total) {   // fin : le jugement
      r.improv.on = false;
      const res = judgeImprov(r.improv.notes, q.scale, total);
      flash(res.ok, res.ok ? pick(DONE_MSG) : "Encore un tour", { detail: res.detail });
      return;
    }
    const ch = q.grid[i % q.grid.length];
    if (box) box.innerHTML = q.names.map((n, k) => (k === i % q.grid.length ? `<b>${esc(n)}</b>` : esc(n))).join(" – ") + `<small> · mesure ${i + 1}/${total}</small>`;
    for (const m of ch) host.play(m, bar * 0.95);
    for (let b = 1; b < 4; b++) setTimeout(() => { if (run === r && r.improv?.on) host.click(false); }, (bar / 4) * b);
    host.click(true);
  }, 600 + i * bar);
}
// ── pédale ──
function pedalNote(q: Extract<Q, { k: "pedal" }>, m: number) {
  const r = run!; const want = q.chords[r.chordIdx!] ?? [];
  const hint = root.querySelector("#csHint") as HTMLElement;
  if (!want.includes(m)) { kbd!.mark(m, "bad"); return; }
  kbd!.mark(m, "ok");
  if (!r.chordKeys!.size) r.chordOnsets!.push(performance.now());
  r.chordKeys!.add(m);
  if (r.chordKeys!.size >= new Set(want).size) {
    r.chordIdx!++; r.chordKeys = new Set();
    hint.textContent = r.chordIdx! < q.chords.length ? `Accord ${r.chordIdx} joué : change la pédale, puis joue le suivant.` : "Dernier accord : enfonce la pédale et écoute le son durer…";
    setTimeout(() => kbd?.clear(), 400);
    if (r.chordIdx! >= q.chords.length) setTimeout(() => { if (run === r && r.q === q && !r.resolved) { const res = judgePedal(r.chordOnsets!, r.pedal!); hint.innerHTML = pedalTimeline(r.chordOnsets!, r.pedal!); flash(res.ok, res.ok ? pick(DONE_MSG) : "La pédale n'est pas encore au point", { detail: res.detail }); } }, 1700);
  }
}
function markTargets(q: Q) {
  if (!kbd || q.k !== "press") return;
  if ("midi" in q.target) kbd.mark(q.target.midi, "target");
  else for (let k = q.kbd[0]; k <= q.kbd[1]; k++) if (q.target.pcs.includes(k % 12)) kbd.mark(k, "target");
}
function onHint() {
  const r = run; if (!r || r.resolved) return;
  const q = r.q; r.hinted = true;
  const el = root.querySelector("#csHint") as HTMLElement;
  if ("hint" in q && q.hint && el) el.textContent = q.hint;
  if (q.k === "press") markTargets(q);
  if (q.k === "seq" && kbd) kbd.mark(q.notes[r.seqPos], "target");
  if (q.k === "chord" && kbd) for (let k = q.kbd[0]; k <= q.kbd[1]; k++) if (q.pcs.includes(k % 12)) kbd.mark(k, "target");
}
function onChoice(i: number) {
  const r = run; if (!r || r.resolved || r.q.k !== "choice") return;
  const q = r.q, ok = i === q.answer;
  root.querySelectorAll<HTMLButtonElement>(".cs-opt").forEach((b, k) => { b.disabled = true; b.classList.toggle("right", k === q.answer); b.classList.toggle("wrong", k === i && !ok); });
  flash(ok, ok ? pick(DONE_MSG) : `Réponse : ${q.options[q.answer]}`, { detail: q.explain });
}

// ── rythme ──
function clearRhythm() { run?.rhythm?.timers.forEach((t) => clearTimeout(t)); if (run?.rhythm) run.rhythm.timers = []; }
function startRhythm(listen: boolean) {
  const r = run; if (!r || r.q.k !== "rhythm" || r.resolved) return;
  clearRhythm();
  // en 6/8 (unité = la croche), le métronome clique chaque croche ; sinon chaque noire
  const q = r.q, eighth = 30000 / q.bpm, beat = q.beatType === 8 ? eighth : 2 * eighth, st: RhythmState = { phase: "count", t0: 0, taps: [], timers: [] };
  r.rhythm = st;
  const bpb = q.beats ?? 4, tied = new Set((q.ties ?? []).map((i) => i + 1));
  const now = performance.now(); st.t0 = now + bpb * beat;
  for (let i = 0; i < bpb; i++) st.timers.push(window.setTimeout(() => host.click(i === 0), i * beat));
  const total = q.beatType === 8 ? patternBeats(q.pattern) * 2 : patternBeats(q.pattern);
  for (let i = 0; i < total; i++) st.timers.push(window.setTimeout(() => host.click(i % bpb === 0), bpb * beat + i * beat));
  if (listen) {
    let t = 0; q.pattern.forEach((d, i) => { if (d > 0 && !tied.has(i)) st.timers.push(window.setTimeout(() => { host.play(71, 300); markNote(i, "sf-sel"); }, bpb * beat + t * eighth)); t += Math.abs(d); });
    st.timers.push(window.setTimeout(() => { run?.staffEl?.querySelectorAll("g.note").forEach((g) => g.classList.remove("sf-sel")); if (run?.rhythm === st) st.phase = "idle"; }, bpb * beat + total * beat + 100));
    return;
  }
  const hint = root.querySelector("#csHint") as HTMLElement; if (hint) hint.textContent = `Écoute les ${bpb} clics…`;
  st.timers.push(window.setTimeout(() => { st.phase = "rec"; if (hint) hint.textContent = "À toi !"; }, (bpb - 0.4) * beat));
  st.timers.push(window.setTimeout(() => finishRhythm(st), bpb * beat + total * beat + 0.45 * beat));
}
function tapRhythm() {
  const st = run?.rhythm; if (!st) return;
  if (st.phase === "count" || st.phase === "rec") { if (performance.now() > st.t0 - 0.5 * (60000 / (run!.q as any).bpm)) st.taps.push(performance.now()); }
  const pad = root.querySelector("#csTap") as HTMLElement | null; pad?.classList.add("hit"); setTimeout(() => pad?.classList.remove("hit"), 90);
}
function finishRhythm(st: RhythmState) {
  const r = run; if (!r || r.q.k !== "rhythm" || r.rhythm !== st) return;
  st.phase = "done";
  const res = scoreRhythm(r.q.pattern, r.q.bpm, st.taps, st.t0, r.q.ties);
  const tied = new Set((r.q.ties ?? []).map((i) => i + 1));
  let k = 0; r.q.pattern.forEach((d, i) => { if (d > 0 && !tied.has(i)) { markNote(i, res.perNote[k++] === "ok" ? "sf-ok" : "sf-ko"); } });
  const late = res.perNote.filter((x) => x === "late").length, early = res.perNote.filter((x) => x === "early").length;
  const detail = `${res.hits} / ${res.total} bien placées${res.extra ? ` · ${res.extra} frappe${res.extra > 1 ? "s" : ""} en trop` : ""}${late > early ? " · tu es plutôt en retard" : early > late ? " · tu es plutôt en avance" : ""}.`;
  flash(res.pass, res.pass ? pick(DONE_MSG) : "Pas assez régulier", { detail });
}

// ── exercice dans le moteur d'entraînement ──
function openPiece() {
  const r = run; if (!r || r.q.k !== "piece" || r.resolved) return;
  const q = r.q;
  host.openPiece(q.xml, q.title, { pass: q.pass, hands: q.hands ?? "both", mode: q.mode ?? "step", minSpeed: q.mode === "rhythm" ? (q.speed ?? 70) : 40, onResult: (acc) => { if (run === r && r.q === q && !r.resolved) r.pieceAcc = acc; } });
}
function showPieceResult(q: Extract<Q, { k: "piece" }>, acc: number) {
  if (acc >= q.pass) flash(true, `${acc} % : objectif atteint !`);
  else flash(false, `${acc} % : il en faut ${q.pass}`, { detail: "Rejoue-le un peu plus lentement (vitesse −), ou mains séparées." });
}

// ───────────────────────────── fin de leçon ─────────────────────────────
function finishLesson() {
  const r = run; if (!r) return;
  const accuracy = r.session.accuracy;
  if (r.drill) { finishDrill(r, accuracy); return; }
  const res = completeLesson(prog, r.lesson.id, accuracy);
  prog = res.progress; saveProgress(prog); markDone("lesson"); markDone("lesson:" + r.lesson.id);
  r.summary = true; r.result = { xp: res.xp, stars: res.stars, accuracy, first: res.first, streak: streak(prog.days) };
  const next = LESSONS[r.lesson.index + 1];
  const nextOpen = next && isUnlocked(prog, ids(), next.index, prefs.unlockAll);
  root.innerHTML = `<div class="cs-lesson cs-done" style="--c:${r.lesson.unit.color}"><div class="cs-sum">
    <div class="cs-bigstars">${[1, 2, 3].map((i) => `<span class="${i <= res.stars ? "on" : ""}">★</span>`).join("")}</div>
    <h2>${res.stars === 3 ? "Leçon maîtrisée !" : res.stars === 2 ? "Bien joué !" : "Leçon terminée"}</h2>
    <p class="cs-small">${esc(r.lesson.title)}</p>
    <div class="cs-sumstats"><div><b>${accuracy} %</b><small>du premier coup</small></div><div><b>+${res.xp}</b><small>XP</small></div><div><b>${icon("flame")} ${r.result.streak}</b><small>jour${r.result.streak > 1 ? "s" : ""} d'affilée</small></div></div>
    ${accuracy < 70 ? `<p class="cs-small">Tu peux la refaire pour décrocher plus d'étoiles : la répétition, c'est comme ça qu'on apprend.</p>` : ""}
    <div class="cs-sumbtns">${nextOpen ? `<button class="sf-btn pri" data-start="${next.id}">Leçon suivante : ${esc(next.title)}</button>` : ""}<button class="sf-btn" data-again="${r.lesson.id}">Refaire</button><button class="sf-btn" data-leave>${exitTo ? esc(exitLabel) : "Retour au parcours"}</button></div></div></div>`;
}

const DRILL_KEY = "pianoflow-drills";
export function drillStats(): Record<string, { best: number; runs: number; last: number }> { return readJson<Record<string, { best: number; runs: number; last: number }>>(DRILL_KEY, {}); }
/** Révision express du jour (séance du jour) : null s'il n'y a rien à revoir. */
export function recallDrill(): Drill | null {
  const lessons = dueLessons(loadProgress());
  return lessons.length ? { key: "recall", title: "Révision express", color: "#0ea5e9", icon: "brain", make: () => recallQuestions(lessons) } : null;
}
function finishRecall(r: Run, accuracy: number) {
  // une leçon est « fixée » si toutes ses questions ont été réussies du premier coup ; les questions passées ne comptent pas
  const res: Record<string, boolean> = {};
  for (const [q, ok] of r.session.firstTry) { const id = recallOrigin.get(q); if (id) res[id] = (res[id] ?? true) && ok; }
  recordRecall(res); markDone("recall");
  const p = loadProgress(); if (!p.days.includes(dayKey())) { p.days = [...p.days, dayKey()].sort().slice(-400); saveProgress(p); prog = p; }
 
  r.summary = true;
  const rows = Object.entries(res).map(([id, ok]) => `<li class="${ok ? "ok" : "ko"}"><b>${ok ? "✓" : "↺"}</b> ${esc(lessonById(id)?.title ?? id)}<small>${ok ? "bien retenu : elle reviendra plus tard" : "elle revient demain"}</small></li>`).join("");
  root.innerHTML = `<div class="cs-lesson cs-done" style="--c:${r.drill!.color}"><div class="cs-sum">
    <div class="cs-pic">${icon("brain")}</div><h2>Révision express</h2>
    <p class="cs-small">${accuracy} % du premier coup. Se rappeler ce qu'on a appris, à intervalles de plus en plus longs, c'est ce qui le fixe.</p>
    ${rows ? `<ul class="cs-recall">${rows}</ul>` : ""}
    <div class="cs-sumbtns"><button class="sf-btn pri" data-leave>${esc(drillBack)}</button></div></div></div>`;
}
function finishDrill(r: Run, accuracy: number) {
  if (r.drill!.key.startsWith("test-")) { finishTest(r, accuracy); return; }
  if (r.drill!.key === "recall") { finishRecall(r, accuracy); return; }
  const d = r.drill!, all = drillStats(), prev = all[d.key];
  all[d.key] = { best: Math.max(prev?.best ?? 0, accuracy), runs: (prev?.runs ?? 0) + 1, last: Math.max(prev?.last ?? 0, Number(dayKey().replace(/-/g, ""))) };
  writeJson(DRILL_KEY, all);
  markDone("drill:" + d.key.replace(/-\d+$/, "")); recordSkill(d.key.replace(/-\d+$/, ""), accuracy);
  // révision espacée : un exercice raté revient dans la séance du jour
  if (accuracy < 80) reviewFail(`d|${d.key}`, `exercice · ${d.title}`, `ex:${d.key.replace(/-\d+$/, "")}`);
  else if (accuracy >= 90) reviewPass(`d|${d.key}`);
  const p = loadProgress(); if (!p.days.includes(dayKey())) { p.days = [...p.days, dayKey()].sort().slice(-400); saveProgress(p); prog = p; }
 
  r.summary = true;
  const stars = accuracy >= 90 ? 3 : accuracy >= 70 ? 2 : 1;
  root.innerHTML = `<div class="cs-lesson cs-done" style="--c:${d.color}"><div class="cs-sum">
    <div class="cs-bigstars">${[1, 2, 3].map((i) => `<span class="${i <= stars ? "on" : ""}">★</span>`).join("")}</div>
    <h2>${esc(d.title)}</h2>
    <div class="cs-sumstats"><div><b>${accuracy} %</b><small>du premier coup</small></div><div><b>${all[d.key].best} %</b><small>record</small></div><div><b>${all[d.key].runs}</b><small>partie${all[d.key].runs > 1 ? "s" : ""}</small></div></div>
    <div class="cs-sumbtns"><button class="sf-btn pri" data-drillagain>Encore une partie</button><button class="sf-btn" data-leave>${esc(drillBack)}</button></div></div></div>`;
}

// ───────────────────────────── routage ─────────────────────────────
function render() {
  if (!run) { renderPath(); return; }
  if (run.summary) { run = null; renderPath(); return; }
  renderLesson();
}
export function openCourse() { active = true; prog = loadProgress(); prefs = loadPrefs(); if (run?.drill) run = null; if (!run) exitTo = null; render(); }
/** L'utilisateur choisit lui-même l'onglet Parcours : on oublie le retour vers la séance du jour. */
export function clearLessonExit() { exitTo = null; }
export function closeCourse() { active = false; clearRhythm(); focus(false); }
export const courseActive = () => active;
/** État courant (tests de bout en bout : page ouverte avec ?debug). */
export const _state = () => (run && !run.summary ? { q: run.q, resolved: run.resolved, outcome: run.outcome, done: run.session.done, retry: run.session.isRetry } : null);
export function courseMidi(pitch: number, vel: number, on: boolean) {
  midiSeen = true;
  if (!active || !run || run.summary) return;
  if (on) onKey(pitch, true, vel); else keyUp(pitch);
}
/** Pédale de sustain (CC64) du clavier MIDI. */
export function coursePedal(down: boolean) {
  midiSeen = true;
  const r = run; if (!active || !r || r.summary || r.resolved || r.q.k !== "pedal") return;
  r.pedal!.push({ t: performance.now(), down });
  const ind = root.querySelector("#csPedal") as HTMLElement | null;
  if (ind) { ind.textContent = down ? "pédale EN BAS : le son est tenu" : "pédale en haut : le son s'arrête au lâcher des touches"; ind.classList.toggle("down", down); }
}
/** Ce qui s'est passé, dessiné : les accords (traits) et la pédale enfoncée (bande), avec la zone où il fallait la renfoncer. */
function pedalTimeline(onsets: number[], pedal: { t: number; down: boolean }[]): string {
  if (!onsets.length) return "";
  const t0 = onsets[0] - 400, t1 = Math.max(onsets[onsets.length - 1] + 1700, ...pedal.map((p) => p.t + 200)), W = 520, x = (t: number) => Math.round(((t - t0) / (t1 - t0)) * W);
  const bands: string[] = []; let downAt: number | null = null;
  for (const p of pedal) { if (p.down && downAt === null) downAt = p.t; else if (!p.down && downAt !== null) { bands.push(`<rect x="${x(downAt)}" y="46" width="${Math.max(2, x(p.t) - x(downAt))}" height="16" rx="3" fill="#16a34a"/>`); downAt = null; } }
  if (downAt !== null) bands.push(`<rect x="${x(downAt)}" y="46" width="${Math.max(2, W - x(downAt))}" height="16" rx="3" fill="#16a34a"/>`);
  const ideal = onsets.map((t, i) => `<rect x="${x(t)}" y="66" width="${Math.max(2, x(Math.min(onsets[i + 1] ?? t + 1600, t + 1600)) - x(t))}" height="6" rx="2" fill="#86efac"/>`);
  const chords = onsets.map((t, i) => `<line x1="${x(t)}" x2="${x(t)}" y1="8" y2="40" stroke="#2563eb" stroke-width="3"/><text x="${x(t) + 4}" y="20" fill="#1d4ed8" font-size="11">accord ${i + 1}</text>`);
  return `<svg viewBox="0 0 ${W} 80" width="100%" style="max-width:${W}px;display:block;margin:8px auto 0"><text x="0" y="40" fill="#94a3b8" font-size="10">mains</text><text x="0" y="58" fill="#94a3b8" font-size="10">pied</text>${chords.join("")}${bands.join("")}${ideal.join("")}</svg>
    <small style="display:block;text-align:center;color:#64748b">bleu : tes accords · vert : ta pédale enfoncée · vert clair : où elle devait être (un trou juste à chaque accord)</small>`;
}
export function initCourse(rootEl: HTMLElement, h: CourseHost) {
  host = h; root = rootEl;
  root.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const q = <T extends HTMLElement>(sel: string) => t.closest(sel) as T | null;
    const start = q("[data-start]"); if (start) { startLesson(start.dataset.start!); return; }
    const again = q("[data-again]"); if (again) { startLesson(again.dataset.again!); return; }
    const lessonBtn = q(".cs-node"); if (lessonBtn) { const l = lessonById(lessonBtn.dataset.lesson!); if (l) openSheet(l); return; }
    if (q("[data-close]") || (t.id === "csSheet")) { root.querySelector("#csSheet")?.classList.add("hidden"); return; }
    const test = q("[data-test]"); if (test) { const u = UNITS.find((x) => x.id === test.dataset.test); if (u) openTestSheet(u); return; }
    const runT = q("[data-runtest]"); if (runT) { const u = UNITS.find((x) => x.id === runT.dataset.runtest); if (u) runTest(u); return; }
    const unit = q("[data-unit]"); if (unit) { root.querySelector(`#unit-${unit.dataset.unit}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    if (q("[data-leave]")) { if (!run || run.summary || run.drill || confirm("Quitter la leçon ? Ta progression dans cette leçon sera perdue.")) leaveLesson(); return; }
    if (q("[data-next]")) { const r = run; if (!r) return; if (r.q.k === "info") { settle(true); return; } if (r.resolved) settle(r.outcome); return; }
    if (q("[data-skip]")) { if (run && !run.resolved) { run.resolved = true; settle(false); } return; }
    if (q("[data-coursereset]")) { if (confirm("Recommencer le parcours depuis la première leçon ? Les leçons réussies seront effacées.")) { resetCourse(); prog = loadProgress(); renderPath(); } return; }
    if (q("[data-hintbtn]")) { onHint(); return; }
    if (q("[data-replay]")) { const au = run && audioOf(run.q); if (au) playAudio(au); return; }
    if (q("[data-nomidi]")) { const r = run; if (r && !r.resolved) { r.resolved = true; const nx = r.session.skip(); if (!nx) finishLesson(); else renderLesson(); } return; }
    if (q("[data-drillagain]")) { const d = run?.drill; if (d) startDrill(d); return; }
    const opt = q("[data-opt]"); if (opt) { onChoice(Number(opt.dataset.opt)); return; }
    if (q("[data-openpiece]")) { openPiece(); return; }
    if (q("[data-rlisten]")) { startRhythm(true); return; }
    if (q("[data-rstart]")) { startRhythm(false); return; }
    if (q("[data-improv]")) { startImprov(); return; }
  });
  root.addEventListener("pointerdown", (e) => { if ((e.target as HTMLElement).closest("[data-tap]")) { e.preventDefault(); tapRhythm(); } });
  root.addEventListener("change", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id === "csFree") { prefs.unlockAll = t.checked; savePrefs(); renderPath(); }
    if (t.id === "csNames") { prefs.names = t.checked; savePrefs(); kbd?.showNames(prefs.names); }
  });
  window.addEventListener("keydown", (e) => {
    if (!active || e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement)?.tagName === "INPUT") return;
    if ((e.key === "Enter" || e.key === " ") && run && !run.summary) {
      if (run.q.k === "rhythm" && e.key === " " && !run.resolved) { e.preventDefault(); tapRhythm(); return; }
      const b = root.querySelector("[data-next]") as HTMLElement | null; if (b) { e.preventDefault(); b.click(); }
    }
  });
}
