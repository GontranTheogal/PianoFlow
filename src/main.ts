import { initMidi } from "./midi";
import { loadScore, annotateHands, flatten, type Step, type Note, type Meter } from "./score";
import { RhythmJudge, type TimedNote, type RhythmSummary } from "./rhythm";
import * as Coach from "./coach";
import { repXml, repFileName, repById, repOfLevel, REPERTOIRE, SONGS, type RepPiece } from "./repertoire";
const repByFile = (name: string) => REPERTOIRE.find((p) => repFileName(p) === name);
import { parseExplicitFingering, assignFingering, fingerKey, type ExplicitFingering } from "./fingering";
import * as FE from "./fingerEdits";
import { markKeyFingerings } from "./fingerMarks";
import { loadHand, saveHand } from "./hand";
import { Follower, type Hand } from "./follower";
import { Player } from "./player";
import { Piano } from "./piano";
import { FallingNotes } from "./falling";
import { Synth } from "./audio";
import { noteName } from "./names";
import { getStats, getAll, recordPlay } from "./stats";
import { listLibrary, addToLibrary, toggleFavorite, removeFromLibrary, renameSong } from "./library";
import { rateDifficulty, pieceFromSteps, LEVEL_LABEL } from "./difficulty";
import { xmlDifficulty } from "./difficultyXml";
import { exportBackup, importBackup, LEGACY_KEYS } from "./backup";
import * as Review from "./review";
import { pedalMarks, judgePedalMarks, type PedalMark } from "./pedalJudge";
import { initSolfege, openSolfege, closeSolfege, solfegeMidi, solfegeActive } from "./solfege";
import { initTech, openTech, closeTech, techMidi, techActive } from "./tech";
import { initCourse, openCourse, closeCourse, courseMidi, coursePedal, courseActive, startDrill, startLessonById, clearLessonExit, recallDrill, _state as courseState, type Drill } from "./course/ui";
import { initExercises, openExercises, launch as launchExercise } from "./exercisesView";
import { initToday, openToday, resetTodayView, repLevel } from "./today";
import * as Daily from "./daily";
import * as Skills from "./skills";
import { LESSONS } from "./course/curriculum";
import * as X from "./exercises";
import * as T from "./techCore";
import { setKeyboardRange, rangeForNotes, WHITE_COUNT } from "./keyboardLayout";
import { esc } from "./html";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const store = {
  get: (k: string, d: string) => { try { return localStorage.getItem("pianoflow-" + k) ?? d; } catch { return d; } },
  set: (k: string, v: string) => { try { localStorage.setItem("pianoflow-" + k, v); } catch { /* ignore */ } },
};
const cssVar = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

const piano = new Piano($("piano"));
const falling = new FallingNotes($<HTMLCanvasElement>("falling"));
const synth = new Synth();
falling.setColors(cssVar("--hand-r"), cssVar("--hand-l"), cssVar("--ok"));

// ───────────── état ─────────────
type AppMode = "step" | "rhythm";  // Pas à pas (le morceau attend tes touches) / En rythme (le morceau avance, noté sur le temps)
type View = "flow" | "fall";       // Partition qui défile (Flowkey) / Notes qui tombent (Synthesia)
type FingerMode = "auto" | "all" | "off";
let steps: Step[] = [], allNotes: Note[] = [], sortedNotes: Note[] = [];
let measureStarts: { id: string; t: number }[] = [];
let songName = "", songDuration = 1;
let appMode: AppMode = "step";
let meter: Meter = { tempo: 120, beats: 4, beatType: 4 };
let listening = false;             // Apprendre : démo en cours (▶)
let view: View = store.get("view", "flow") === "fall" ? "fall" : "flow";
let showScoreInFall = store.get("scoreInFall", "1") === "1";
let fingerMode: FingerMode = (["auto", "all", "off"].includes(store.get("fingers", "auto")) ? store.get("fingers", "auto") : "auto") as FingerMode;
let hasExplicitFingering = false;
let lastExplicit: ExplicitFingering | null = null;      // doigtés écrits dans la partition ouverte (pour recalculer si on change de main)
/** Résultat d'un passage complet (fin du morceau ou de la boucle). */
export interface PassResult { mode: AppMode; score: number; accuracy: number; timing?: number; speed: number; hand: Hand; summary?: RhythmSummary; loop: { a: number; b: number } | null; /** pédale jugée sur les indications de la partition */ pedal?: { ok: number; total: number; late: number; missing: number } }
/** Exercice du parcours en cours : reçoit le score d'un passage dans le mode demandé, à la vitesse demandée. */
let pieceHook: { pass: number; mode: AppMode; minSpeed: number; hands: Hand; cb: (acc: number) => void } | null = null;
/** Coach de morceau (et autres auditeurs) : chaque passage leur est transmis. */
const passListeners: ((r: PassResult) => void)[] = [];
let soundOnPress = store.get("keySound", "1") === "1";   // activé par défaut : en Jouer à deux mains, c'est le seul son que tu entends
let hits = 0, misses = 0, learnFinished = false;
let loopRestart: number | undefined;   // relance automatique d'une boucle en rythme (voir showLoopNote)
let toastTimer: number | undefined;
const noteEls = new Map<string, Element>();
const scoreEl = $("score");

const isShown = (n: { hand: "R" | "L" }) => follower.hand === "both" || n.hand === follower.hand;
const loopStartIndex = () => (follower.loop ? follower.findIndexAtOrAfter(follower.loop.start) : 0);
const cleanName = (n: string) => n.replace(/\.(xml|musicxml|mxl)$/i, "");
/** La partition (SVG de Verovio, tiré d'un fichier importé) : insérée sans script, sans gestionnaire on…, sans lien externe. */
function setScoreSvg(el: HTMLElement, svg: string) {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml"), root = doc.documentElement;
  if (root.nodeName !== "svg") { el.replaceChildren(); return; }
  root.querySelectorAll("script, foreignObject, iframe, object, embed").forEach((n) => n.remove());
  for (const n of [root, ...Array.from(root.querySelectorAll("*"))]) for (const at of Array.from(n.attributes)) {
    if (/^on/i.test(at.name) || (/href$/i.test(at.name) && !at.value.startsWith("#"))) n.removeAttribute(at.name);
  }
  el.replaceChildren(document.importNode(root, true));
}

function toast(msg: string, ms = 1800) {
  const el = $("toast"); el.textContent = msg; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => el.classList.remove("show"), ms);
}

// ───────────── lecture ─────────────
const follower = new Follower({
  onStep: () => {
    learnFinished = false; detached = false;
    player.syncToStep();
    if (player.mode === "wait" && follower.hand !== "both") {          // l'appli joue l'autre main pendant qu'on travaille une main
      const step = steps[follower.index];
      if (step) for (const n of step.notes) if (!isShown(n)) synth.playNote(n.pitch, 500);
    }
    refresh();
  },
  onEnd: () => { refresh(); finishLearn(); },
  onLoopComplete: () => { if (appMode === "step" && !listening) finishLearn(true); },   // un tour de boucle réussi = un passage
});

const player = new Player(follower, () => renderFrame(), (step) => {
  refresh();
  // démo ▶ : tout le morceau ; en rythme : seulement la main qu'on ne travaille pas (accompagnement)
  for (const n of step.notes) if (!run || !isShown(n)) synth.playNote(n.pitch, Math.min(900, n.offTime - n.onTime + 150));
});

player.onFinished = () => {                 // fin de la démo ▶ : on reprend en mode attente
  listening = false; player.once = false; player.setMode("wait"); follower.goTo(loopStartIndex());
  updatePlayBtn();
};


/** Fin d'un passage en Pas à pas (fin du morceau ou de la boucle). */
function finishLearn(loopPass = false) {
  if (learnFinished || listening || run || !steps.length || appMode !== "step") return;
  learnFinished = true;
  const total = hits + misses, acc = total ? Math.round((hits / total) * 100) : 100;
  hits = 0; misses = 0;
  if (total < 2) return;
  const r: PassResult = { mode: "step", score: acc, accuracy: acc, speed, hand: follower.hand, loop: loopM ? { ...loopM } : null };
  if (loopPass && !coach && !pieceHook) { for (const l of passListeners) l(r); toast(`Tour de boucle : ${acc} %`, 1400); return; }
  reportPass(r);
  setTimeout(() => { if (follower.index >= steps.length) follower.goTo(loopStartIndex()); }, 1200);
}

/** Un passage terminé : carte de résultat, record, parcours, coach. */
function reportPass(r: PassResult) {
  for (const l of passListeners) l(r);
  // révision espacée : les mesures ratées reviennent ; une boucle réussie les fait avancer (hors exercices du parcours)
  if (!pieceHook && songName && r.mode === "rhythm" && r.summary) {
    Review.recordRhythmRun(r.summary);
    const title = cleanName(songName);
    for (const m of r.summary.weak) Review.reviewFail(Review.measureKey(songName, m), `mesure ${m + 1} · ${title}`, `loop:${songName}|${m}`);
    if (r.score >= 90 && r.loop) for (let m = r.loop.a; m < r.loop.b; m++) Review.reviewPass(Review.measureKey(songName, m));
  }
  if (dailyTag) Daily.markDone(dailyTag);
  // compétences : déchiffrage et échauffement d'après leur étape, le jeu en rythme d'après les morceaux (hors leçons)
  if (!pieceHook && (dailyTag === "sight" || dailyTag === "warmup")) Skills.record(dailyTag, r.score);
  else if (!pieceHook && songName && r.mode === "rhythm" && !loopM && r.speed >= 70) Skills.record("play", r.score);
  if (!pieceHook && r.pedal && r.pedal.total >= 4) Skills.record("pedal", Math.round((r.pedal.ok / r.pedal.total) * 100));
  const h = pieceHook;
  const counts = !!h && r.mode === h.mode && r.speed >= h.minSpeed && (h.hands !== "both" || r.hand === "both");
  if (h && counts) h.cb(r.score);
  else if (!h && songName && !loopM && follower.hand === "both") recordPlay(songName, r.score, r.mode === "rhythm" && r.speed >= 100);
  const coachNote = coachPassNote(r);
  // un tour de boucle sans objectif atteint : les commentaires restent affichés sans bloquer, et la boucle repart seule
  const milestone = coachNote?.passed || (!!h && counts && r.score >= h.pass);
  if (r.loop && !milestone) { showLoopNote(r, coachNote); return; }
  showResult(r, h ? { pass: h.pass, counts, need: h.mode, minSpeed: h.minSpeed } : null, coachNote);
}

// ───────────── doigtés ─────────────
function fingerVisible(n: Note): boolean {
  if (fEdit) return true;
  if (fingerMode === "off") return false;
  if (fingerMode === "all") return true;
  return hasExplicitFingering ? true : n.showFinger === true;
}
function refreshFingerHint() {
  $("fingerHint").textContent = !steps.length
    ? "Auto : tous les doigtés si la partition en contient, sinon seulement les repères (début de phrase, changement de position)."
    : hasExplicitFingering
      ? "Cette partition contient des doigtés écrits par l'éditeur : ils sont fiables."
      : "Cette partition n'a pas de doigtés : ceux affichés sont calculés par l'appli, une aide indicative. Auto n'en montre que les repères.";
}

// ───────────── affichage : notes, clavier, partition ─────────────
let doneUpTo = 0;
let currentEls: Element[] = [];
let pianoSig = "";

function resetDone() { scoreEl.querySelectorAll(".done").forEach((e) => e.classList.remove("done")); doneUpTo = 0; }
function applyMuted() { for (const n of allNotes) noteEls.get(n.id)?.classList.toggle("muted", follower.hand !== "both" && n.hand !== follower.hand); }

function refresh() {
  if (follower.index < doneUpTo) resetDone();
  for (; doneUpTo < follower.index && doneUpTo < steps.length; doneUpTo++)
    for (const n of follower.active(steps[doneUpTo])) noteEls.get(n.id)?.classList.add("done");
  for (const e of currentEls) e.classList.remove("current");
  currentEls = [];
  for (const n of follower.expected) { const e = noteEls.get(n.id); if (e) { e.classList.add("current"); currentEls.push(e); } }
  pianoSig = "";
  if (fEdit) { if (!fSel || !follower.expected.includes(fSel)) fSel = follower.expected[0] ?? fSel; renderFingerBar(); markFingerSel(); }
}

// ───────────── correcteur de doigtés : on impose un doigt, l'algorithme recalcule le reste autour ─────────────
let fEdit = false, fSel: Note | null = null;
const fnumEls = new Map<string, SVGTextElement>();
const keyOf = (n: Note) => (n.q === undefined ? "" : fingerKey(n.hand, n.pitch, n.q));
/** Les doigts écrits sur la partition (mode correction) : à gauche de chaque tête de note, verts quand ils sont corrigés à la main. */
function drawFingerNums() {
  for (const e of fnumEls.values()) e.remove();
  fnumEls.clear();
  scoreEl.classList.toggle("fedit", fEdit);
  if (!fEdit) return;
  const edits = FE.editsFor(songName);
  for (const n of allNotes) {
    const head = noteEls.get(n.id)?.querySelector(".notehead") as SVGGraphicsElement | null;
    if (!head || !n.finger) continue;
    let bb: DOMRect; try { bb = head.getBBox(); } catch { continue; }
    if (!bb.width) continue;
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("class", `fnum ${n.hand === "R" ? "r" : "l"}${edits.has(keyOf(n)) ? " ed" : ""}`);
    t.setAttribute("x", String(bb.x - bb.width * 0.25)); t.setAttribute("y", String(bb.y + bb.height * 0.95));
    t.setAttribute("font-size", String(Math.round(bb.height * 1.35))); t.setAttribute("text-anchor", "end");
    t.textContent = String(n.finger);
    head.parentNode!.appendChild(t); fnumEls.set(n.id, t);
  }
  markFingerSel();
}
function markFingerSel() { for (const [id, e] of fnumEls) e.classList.toggle("sel", id === fSel?.id); }
function renderFingerBar() {
  const bar = $("fingerBar");
  bar.classList.toggle("hidden", !fEdit); $("fingerEditBtn").classList.toggle("on", fEdit);
  if (!fEdit) return;
  const here = follower.expected;
  if (!fSel || !allNotes.includes(fSel)) fSel = here[0] ?? allNotes[0] ?? null;
  const edits = FE.editsFor(songName), edited = !!fSel && edits.has(keyOf(fSel));
  const chips = (here.includes(fSel!) ? here : fSel ? [fSel] : []).map((n) => `<button data-fn="${n.id}" class="fb-note ${n.hand === "R" ? "r" : "l"} ${n === fSel ? "on" : ""}">${noteName(n.pitch)} · ${n.hand === "R" ? "MD" : "MG"}</button>`).join("");
  bar.innerHTML = `<b>✍️ Doigtés</b><span class="fb-notes">${chips}</span>
    ${fSel ? `<span class="fb-f">${[1, 2, 3, 4, 5].map((f) => `<button data-ff="${f}" class="${fSel!.finger === f ? (edited ? "on ed" : "on") : ""}">${f}</button>`).join("")}${edited ? `<button data-ff="0" title="Rendre cette note à l'algorithme">Auto</button>` : ""}</span>` : ""}
    <button data-fnext class="fb-txt">Suivante →</button>
    <small>${edits.size ? `${edits.size} correction${edits.size > 1 ? "s" : ""} · vert = corrigé` : "Touche une note, choisis le doigt : le reste du passage s'adapte."}</small>
    <span class="sf-grow"></span>${edits.size ? `<button data-fclear class="fb-txt">Tout effacer</button>` : ""}<button data-fdone class="fb-txt pri">Terminé</button>`;
}
function setFingerEdit(on: boolean) {
  fEdit = on && steps.length > 0; fSel = null;
  if (fEdit && appMode === "rhythm") setAppMode("step");
  renderFingerBar(); drawFingerNums(); updateFallingNotes(); pianoSig = "";
}
$("fingerEditBtn").addEventListener("click", () => setFingerEdit(!fEdit));
$("fingerBar").addEventListener("click", (e) => {
  const t = e.target as HTMLElement, b = t.closest("button") as HTMLElement | null; if (!b) return;
  if (b.dataset.fn) { fSel = allNotes.find((n) => n.id === b.dataset.fn) ?? null; renderFingerBar(); markFingerSel(); return; }
  if (b.dataset.ff !== undefined && fSel) {
    const f = Number(b.dataset.ff), id = fSel.id;
    FE.setEdit(songName, keyOf(fSel), f || null); recomputeFingering();
    fSel = allNotes.find((n) => n.id === id) ?? null; renderFingerBar(); markFingerSel();
    return;
  }
  if (b.dataset.fnext !== undefined) { fSel = null; follower.seek(Math.min(steps.length - 1, follower.index + 1)); return; }
  if (b.dataset.fclear !== undefined) { if (confirm("Effacer toutes tes corrections de doigtés pour ce morceau ?")) { FE.clearEdits(songName); recomputeFingering(); renderFingerBar(); } return; }
  if (b.dataset.fdone !== undefined) setFingerEdit(false);
});

function soundingAt(t: number): Note[] {
  const out: Note[] = [];
  for (const n of sortedNotes) { if (n.onTime > t) break; if (n.offTime > t && isShown(n)) out.push(n); }
  return out;
}
function updateFallingNotes() {
  falling.setNotes(allNotes.filter(isShown).map((n) => ({ ...n, finger: fingerVisible(n) ? n.finger : undefined })));
}

let lastFrame = 0, viewTime = 0, scrubbing = false, scrubTime = 0, lastMeasure = -1;
let detached = false, detachedAt = 0, loopOut = false;   // detached : la partition reste où on l'a laissée tant qu'on ne rejoue pas
function renderFrame() {
  const now = performance.now(), dt = Math.min(100, now - (lastFrame || now)); lastFrame = now;
  rhythmTick();
  const wait = player.mode === "wait";

  // clavier
  const hitPitches = new Set(wait ? follower.hitNotes.map((n) => n.pitch) : []);
  const current = (wait ? follower.expected : soundingAt(player.playhead)).filter(isShown);
  const sig = current.map((n) => n.id + (hitPitches.has(n.pitch) ? "h" : "")).join("|") + fingerMode;
  if (sig !== pianoSig) {
    pianoSig = sig;
    piano.setExpected(current.map((n) => ({ pitch: n.pitch, finger: fingerVisible(n) ? n.finger : undefined, hand: n.hand, hit: hitPitches.has(n.pitch) })));
  }
  // notes qui tombent
  if (view === "fall") falling.render(player.playhead, player.mode, run ? run.hit : new Set(follower.hitNotes.map((n) => n.id)), new Set(wait ? current.map((n) => n.id) : []));

  // partition : elle glisse sous le curseur central (lissée en mode attente, exacte en lecture)
  if (steps.length && ensureLayout()) {
    if (handleDrag) handleTick(dt);
    if (detached && Math.abs(player.playhead - detachedAt) > 1) detached = false;   // on a rejoué : la partition suit de nouveau
    const free = scrubbing || detached;
    const target = free ? scrubTime : player.playhead;
    if (free || player.mode === "play") viewTime = target;
    else { viewTime += (target - viewTime) * (1 - Math.exp(-dt / 110)); if (Math.abs(target - viewTime) < 0.5) viewTime = target; }
    positionScore(viewTime);
    if (view === "fall") updateMeasureHL(viewTime);
  }
  const lp = follower.loop, out = !!lp && (player.playhead < lp.start || player.playhead >= lp.end);
  if (out !== loopOut) { loopOut = out; $("scoreBox").classList.toggle("loop-out", out); }   // boucle « en veille » : tu es hors de la zone
  updatePlayBtn();
}

// ───────────── géométrie de la partition (positions mesurées sur le SVG) ─────────────
interface MeasureBox { x0: number; x1: number; t0: number; t1: number; }
let stepX: number[] | null = null;
let measuresL: MeasureBox[] | null = null;
const stageEl = () => $("scoreStage");
const stageLeft = () => stageEl().getBoundingClientRect().left;

function ensureLayout(): boolean {
  if (stepX && measuresL) return true;
  const vp = $("scoreViewport");
  if (!steps.length || vp.clientWidth === 0 || vp.clientHeight === 0) return false;
  const left = stageLeft();
  let last = 0;
  stepX = steps.map((st) => {
    const el = st.notes[0] ? noteEls.get(st.notes[0].id) : null;
    const r = (el?.querySelector(".notehead") ?? el)?.getBoundingClientRect();
    if (r && (r.width || r.height)) last = r.left + r.width / 2 - left;
    return last;
  });
  const startOf = new Map<string, number>();
  for (const m of measureStarts) if (!startOf.has(m.id)) startOf.set(m.id, m.t);
  const noteTime = new Map<string, number>(); for (const n of allNotes) noteTime.set(n.id, n.onTime);
  const els = Array.from(scoreEl.querySelectorAll(".measure"));
  const boxes: MeasureBox[] = [];
  let prevT = 0;
  for (const m of els) {
    const line = m.querySelector(".staff > path");
    const r = (line ?? m).getBoundingClientRect();
    let t0 = startOf.get(m.id);
    if (t0 === undefined) { const id = m.querySelector(".note")?.id; t0 = id ? noteTime.get(id) : undefined; }
    t0 = Math.max(prevT, t0 ?? prevT); prevT = t0;
    boxes.push({ x0: r.left - left, x1: r.right - left, t0, t1: songDuration });
  }
  for (let i = 0; i + 1 < boxes.length; i++) boxes[i].t1 = boxes[i + 1].t0;
  measuresL = boxes;
  falling.setMeasureTimes(boxes.map((b) => b.t0));
  positionLoopUI();
  return true;
}
function invalidateLayout() { stepX = null; measuresL = null; lastMeasure = -1; }

function xAtTime(t: number): number {
  if (!stepX || !stepX.length) return 0;
  let lo = 0, hi = steps.length - 1, i = 0;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (steps[m].time <= t) { i = m; lo = m + 1; } else hi = m - 1; }
  let x = stepX[i];
  if (i + 1 < steps.length && steps[i + 1].time > steps[i].time) {
    const f = Math.min(1, Math.max(0, (t - steps[i].time) / (steps[i + 1].time - steps[i].time)));
    x += (stepX[i + 1] - x) * f;
  }
  return x;
}
function timeAtX(x: number): number {
  if (!stepX || !stepX.length) return 0;
  if (x <= stepX[0]) return steps[0].time;
  let lo = 0, hi = stepX.length - 1, i = 0;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (stepX[m] <= x) { i = m; lo = m + 1; } else hi = m - 1; }
  if (i >= stepX.length - 1) return steps[steps.length - 1].time;
  const dx = stepX[i + 1] - stepX[i];
  return steps[i].time + (dx > 0 ? (x - stepX[i]) / dx : 0) * (steps[i + 1].time - steps[i].time);
}
function positionScore(t: number) {
  const vp = $("scoreViewport");
  stageEl().style.transform = `translate3d(${(vp.clientWidth / 2 - xAtTime(t)).toFixed(2)}px,0,0)`;
}
function measureAtTime(t: number): number {
  if (!measuresL || !measuresL.length) return 0;
  let lo = 0, hi = measuresL.length - 1, i = 0;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (measuresL[m].t0 <= t) { i = m; lo = m + 1; } else hi = m - 1; }
  return i;
}
function updateMeasureHL(t: number) {
  if (!measuresL || !measuresL.length) return;
  const i = measureAtTime(t);
  if (i === lastMeasure) return;
  lastMeasure = i;
  const b = measuresL[i], hl = $("measureHL");
  hl.style.left = b.x0 + "px"; hl.style.width = Math.max(0, b.x1 - b.x0) + "px";
}

function seekTo(t: number) {
  const i = steps.findIndex((s) => s.time >= t - 1);
  follower.seek(i < 0 ? Math.max(0, steps.length - 1) : i);
}

// ───────────── glisser la partition = se déplacer dans le morceau ─────────────
{
  const vp = $("scoreViewport");
  let drag: { startX: number; startCenter: number; moved: boolean; wasPaused: boolean } | null = null;
  let justDragged = false;
  vp.addEventListener("pointerdown", (e) => {
    if (!steps.length || (e.target as Element).closest(".loop-handle") || !ensureLayout()) return;
    drag = { startX: e.clientX, startCenter: xAtTime(viewTime), moved: false, wasPaused: player.paused };
  });
  window.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    if (!drag.moved && Math.abs(dx) > 8) { drag.moved = true; scrubbing = true; player.paused = true; vp.style.cursor = "grabbing"; }
    if (drag.moved) scrubTime = timeAtX(drag.startCenter - dx);
  });
  const end = () => {
    if (!drag) return;
    if (drag.moved) {
      seekTo(scrubTime); viewTime = scrubTime;
      scrubbing = false; player.paused = drag.wasPaused; vp.style.cursor = "";
      justDragged = true; setTimeout(() => (justDragged = false), 80);
      pianoSig = "";
    }
    drag = null;
  };
  window.addEventListener("pointerup", end); window.addEventListener("pointercancel", end);
  // toucher une note (ou un endroit) : on s'y place
  vp.addEventListener("click", (e) => {
    if (justDragged || !steps.length || $("scoreViewport").dataset.noclick) return;
    const t = e.target as Element;
    if (t.closest(".loop-handle")) return;   // relâcher une poignée de boucle n'est pas un clic dans la partition
    const noteEl = t.closest(".note");
    if (noteEl) {
      const i = steps.findIndex((s) => s.notes.some((n) => n.id === noteEl.id));
      if (fEdit) fSel = allNotes.find((n) => n.id === noteEl.id) ?? fSel;
      if (i >= 0) follower.seek(i);
    }
    else if (ensureLayout()) seekTo(timeAtX(e.clientX - stageLeft()));
  });
}

// ───────────── boucle, façon Flowkey : on la règle directement sur la partition ─────────────
let loopM: { a: number; b: number } | null = null; // frontières de mesures : a ∈ [0, M-1], b ∈ [a+1, M]
const bx = (k: number) => (!measuresL || !measuresL.length ? 0 : k < measuresL.length ? measuresL[k].x0 : measuresL[measuresL.length - 1].x1);

function applyLoop() {
  const box = $("scoreBox");
  if (!loopM || !measuresL || !measuresL.length) {
    loopM = null; follower.loop = null; box.classList.remove("looping"); $("loopBtn").classList.remove("on"); hideLoopNote(); return;
  }
  const M = measuresL.length;
  loopM.a = Math.max(0, Math.min(M - 1, loopM.a)); loopM.b = Math.max(loopM.a + 1, Math.min(M, loopM.b));
  follower.loop = { start: measuresL[loopM.a].t0, end: loopM.b < M ? measuresL[loopM.b].t0 : songDuration };
  box.classList.add("looping"); $("loopBtn").classList.add("on");
  positionLoopUI();
}
function positionLoopUI() {
  if (!loopM || !measuresL) return;
  const xa = bx(loopM.a), xb = bx(loopM.b);
  $("loopA").style.left = xa + "px"; $("loopB").style.left = xb + "px";
  const band = $("loopBand"); band.style.left = xa + "px"; band.style.width = Math.max(0, xb - xa) + "px";
}
/** Boucle sur les mesures [a, b[ (index à partir de 0), et on s'y place. */
function setLoopMeasures(a: number, b: number) {
  if (!ensureLayout() || !measuresL || !measuresL.length) return;
  loopM = { a, b }; applyLoop();
  follower.seek(follower.findIndexAtOrAfter(measuresL[loopM.a].t0)); viewTime = player.playhead;
}
let handleDrag: { which: "a" | "b"; clientX: number; wasPaused: boolean } | null = null;

/** Appelé à chaque image pendant qu'on tire une poignée : près d'un bord, la partition défile toute seule,
 *  et la poignée reste sous le doigt. */
function handleTick(dt: number) {
  const d = handleDrag;
  if (!d || !loopM || !measuresL || !measuresL.length || !ensureLayout()) return;
  const vp = $("scoreViewport"), r = vp.getBoundingClientRect();
  const EDGE = 110;
  let v = 0;
  if (d.clientX > r.right - EDGE) v = Math.min(1, (d.clientX - (r.right - EDGE)) / EDGE);
  else if (d.clientX < r.left + EDGE) v = -Math.min(1, (r.left + EDGE - d.clientX) / EDGE);
  if (v) scrubTime = timeAtX(xAtTime(scrubTime) + Math.sign(v) * v * v * 1.3 * dt);   // jusqu'à ~1300 px/s, progressif
  const x = d.clientX - (r.left + vp.clientWidth / 2 - xAtTime(scrubTime));            // position du doigt dans la partition
  let best = 0, bd = Infinity;
  for (let k = 0; k <= measuresL.length; k++) { const dd = Math.abs(bx(k) - x); if (dd < bd) { bd = dd; best = k; } }
  if (d.which === "a") loopM.a = Math.min(best, loopM.b - 1); else loopM.b = Math.max(best, loopM.a + 1);
  applyLoop();
}
$("loopBtn").addEventListener("click", () => {
  if (loopM) { loopM = null; applyLoop(); return; }
  if (!steps.length || !ensureLayout() || !measuresL || !measuresL.length) { toast("Ouvre d'abord un morceau"); return; }
  const M = measuresL.length, cm = measureAtTime(player.playhead);
  // la mesure en cours et jusqu'à 3 suivantes, mais pas plus loin que la moitié droite de l'écran : les deux poignées restent atteignables
  const limit = xAtTime(player.playhead) + $("scoreViewport").clientWidth * 0.4;
  let b = cm + 1;
  while (b < M && b < cm + 4 && bx(b + 1) <= limit) b++;
  loopM = { a: cm, b: Math.min(M, b) };
  applyLoop();
});
for (const [id, which] of [["loopA", "a"], ["loopB", "b"]] as const) {
  const el = $(id);
  el.addEventListener("pointerdown", (e) => {
    e.stopPropagation(); e.preventDefault();
    if (!ensureLayout()) return;
    el.setPointerCapture(e.pointerId);
    handleDrag = { which, clientX: e.clientX, wasPaused: player.paused };
    scrubbing = true; scrubTime = viewTime; player.paused = true;
  });
  el.addEventListener("pointermove", (e) => { if (handleDrag && handleDrag.which === which) handleDrag.clientX = e.clientX; });
  const stop = () => {
    if (!handleDrag || handleDrag.which !== which) return;
    player.paused = handleDrag.wasPaused; handleDrag = null;
    scrubbing = false; detached = true; detachedAt = player.playhead;   // on reste où on est : aucun retour au début de la boucle
    $("scoreViewport").dataset.noclick = "1"; setTimeout(() => delete $("scoreViewport").dataset.noclick, 250);
  };
  el.addEventListener("pointerup", stop); el.addEventListener("pointercancel", stop);
}

// ───────────── commandes : mains, ▶, mode, vitesse, vue ─────────────
function setHand(h: Hand) {
  follower.setHand(h);
  resetDone(); applyMuted(); updateFallingNotes(); refresh();
  $("handL").classList.toggle("sel", h !== "R"); $("handR").classList.toggle("sel", h !== "L");
  $("handL").classList.toggle("dim", h === "R"); $("handR").classList.toggle("dim", h === "L");
}
$("handL").addEventListener("click", () => setHand(follower.hand === "L" ? "both" : "L"));
$("handR").addEventListener("click", () => setHand(follower.hand === "R" ? "both" : "R"));

function setAppMode(m: AppMode) {
  if (run) finishRhythm(true);
  if (m === "rhythm" && fEdit) setFingerEdit(false);
  appMode = m; listening = false; hits = 0; misses = 0; learnFinished = false;
  document.querySelectorAll<HTMLElement>("#modeSeg button").forEach((b) => b.classList.toggle("on", b.dataset.m === m));
  $("practiceView").classList.toggle("rhythm-mode", m === "rhythm");
  $("playBtn").title = m === "rhythm" ? "Démarrer (décompte d'une mesure) / arrêter" : "Écouter / pause";
  hideResult(); hideLoopNote();
  if (!steps.length) { updatePlayBtn(); return; }
  player.once = false;
  player.setMode("wait");
  if (follower.index >= steps.length) follower.goTo(loopStartIndex());
  updatePlayBtn();
}
document.querySelectorAll<HTMLElement>("#modeSeg button").forEach((b) => b.addEventListener("click", () => setAppMode(b.dataset.m as AppMode)));

const ICON_PLAY = "M7 4.5v15l13-7.5z", ICON_PAUSE = "M6 4h4.5v16H6zM13.5 4H18v16h-4.5z", ICON_STOP = "M6 6h12v12H6z";
let shownIcon = "";
function updatePlayBtn() {
  const ic = run ? ICON_STOP : listening ? ICON_PAUSE : ICON_PLAY;
  if (ic !== shownIcon) { shownIcon = ic; $("playIcon").querySelector("path")!.setAttribute("d", ic); }
  $("listenBtn").classList.toggle("on", listening);
}
/** ▶ : en Pas à pas = écouter à partir d'ici ; en rythme = démarrer (décompte) / arrêter. */
function onPlay() {
  if (!steps.length) return;
  if (appMode === "rhythm" && !listening) {
    if (loopRestart !== undefined) { hideLoopNote(); toast("Boucle arrêtée", 1200); return; }   // ▶ pendant la pause entre deux tours : on s'arrête
    if (run) { finishRhythm(true); hideLoopNote(); } else startRhythm();
    updatePlayBtn(); return;
  }
  toggleListen();
}
function toggleListen() {
  if (!steps.length) return;
  if (run) finishRhythm(true);
  hideResult();
  if (!listening) {
    if (follower.index >= steps.length) follower.goTo(loopStartIndex());
    listening = true; player.once = true; player.setMode("play");
  } else { listening = false; player.once = false; player.setMode("wait"); }
  updatePlayBtn();
}
$("playBtn").addEventListener("click", onPlay);
$("listenBtn").addEventListener("click", toggleListen);
window.addEventListener("keydown", (e) => {
  if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "SELECT") return;
  if ($("practiceView").classList.contains("hidden")) return;
  if (e.code === "Space") { e.preventDefault(); onPlay(); }
  if (player.mode === "wait") { if (e.key === "ArrowRight") follower.next(); if (e.key === "ArrowLeft") follower.prev(); }
});

// ───────────── mode « En rythme » : la partition avance, chaque note est jugée sur le temps ─────────────
interface Run { judge: RhythmJudge; start: number; end: number; startIndex: number; beats: number[]; downbeats: Set<number>; beatIdx: number; countIn: number; notes: TimedNote[]; hit: Set<string>; savedLoop: typeof follower.loop; }
let run: Run | null = null;
let metroOn = store.get("metroRun", "1") === "1";
const beatMs = () => (60000 / meter.tempo) * (4 / meter.beatType);
function measureStartBefore(t: number): number {
  let best = 0; for (const m of measureStarts) { if (m.t <= t + 1) best = m.t; else break; } return best;
}
function startRhythm() {
  if (!steps.length) return;
  hideResult(); clearTimeout(loopRestart); loopRestart = undefined; listening = false; pedalEvents = [];
  const ln = $("loopNote").querySelector("small"); if (ln) ln.textContent = "Bilan du tour précédent · ▶ pour arrêter.";
  const lp = follower.loop, from = lp ? lp.start : measureStartBefore(follower.index >= steps.length ? 0 : steps[follower.index].time);
  const startIndex = follower.findIndexAtOrAfter(from), endLimit = lp ? lp.end : Infinity;
  const notes: TimedNote[] = allNotes.filter((n) => isShown(n) && n.onTime >= from - 1 && n.onTime < endLimit).map((n) => ({ id: n.id, pitch: n.pitch, onTime: n.onTime, measure: n.measure ?? 0 }));
  if (!notes.length) { toast("Aucune note à jouer ici"); return; }
  const b = beatMs(), lastOn = Math.max(...notes.map((n) => n.onTime));
  const end = lastOn + Math.max(700, b) * player.tempo;
  const count = Array.from({ length: meter.beats }, (_, k) => from - (meter.beats - k) * b);
  const grid: number[] = [], downs = new Set<number>([count[0]]);
  measureStarts.forEach((m, i) => {
    const t1 = i + 1 < measureStarts.length ? measureStarts[i + 1].t : songDuration;
    if (t1 <= from || m.t >= end) return;
    downs.add(m.t);
    for (let t = m.t; t < t1 - 1; t += b) if (t >= from - 1 && t < end) grid.push(t);
  });
  for (const n of allNotes) noteEls.get(n.id)?.classList.remove("r-ok", "r-off", "r-miss");
  run = { judge: new RhythmJudge(notes, player.tempo), start: from, end, startIndex, beats: [...count, ...grid], downbeats: downs, beatIdx: 0, countIn: count.length, notes, hit: new Set(), savedLoop: follower.loop };
  follower.loop = null;                         // la fin de passage est gérée ici (avec le temps de jouer la dernière note)
  follower.seek(startIndex);
  player.once = false; player.hold = true;
  player.setMode("play"); player.playhead = from - meter.beats * b;
  updatePlayBtn();
}
function rhythmTick() {
  const r = run; if (!r || player.mode !== "play") return;
  const ph = player.playhead;
  while (r.beatIdx < r.beats.length && r.beats[r.beatIdx] <= ph) {
    const i = r.beatIdx++;
    if (i < r.countIn || metroOn) synth.click(r.downbeats.has(r.beats[i]) || i === 0);
  }
  const ci = $("countIn");
  if (ph < r.start - 1) { ci.textContent = String(Math.max(1, Math.ceil((r.start - ph) / beatMs()))); ci.classList.remove("hidden"); }
  else ci.classList.add("hidden");
  for (const n of r.judge.advance(ph)) noteEls.get(n.id)?.classList.add("r-miss");
  if (ph >= r.end) finishRhythm();
}
function rhythmPress(pitch: number) {
  const r = run!;
  const res = r.judge.press(pitch, player.playhead);
  if (res.verdict === "wrong") { piano.press(pitch, "bad"); return; }
  const good = res.verdict === "perfect" || res.verdict === "good";
  piano.press(pitch, "ok");
  noteEls.get(res.note!.id)?.classList.add(good ? "r-ok" : "r-off");
  r.hit.add(res.note!.id);
  const n = allNotes.find((x) => x.id === res.note!.id); if (n) falling.burst(n);
  if (!good) { const el = $("timingHint"); el.textContent = res.verdict === "early" ? "en avance" : "en retard"; el.className = "show " + res.verdict; clearTimeout(timingTimer); timingTimer = window.setTimeout(() => (el.className = ""), 500); }
}
let timingTimer: number | undefined;
function finishRhythm(aborted = false) {
  const r = run; if (!r) return;
  run = null;
  const sum = r.judge.finish();
  // la pédale, si la partition l'indique et que le pied a été utilisé
  let pedal: PassResult["pedal"];
  if (pieceMarks.length && pedalEvents.length) {
    const qs = steps.filter((st) => st.notes[0]?.q !== undefined).map((st) => [st.notes[0].q!, st.time] as [number, number]);
    const at = (q: number) => { let best = qs[0]; for (const x of qs) { if (x[0] <= q + 1e-6) best = x; else break; } return best ? best[1] + (q - best[0]) * beatMs() / (4 / meter.beatType) : 0; };
    pedal = judgePedalMarks(pieceMarks, at, pedalEvents, beatMs(), r.notes[0]?.onTime ?? 0, (r.notes[r.notes.length - 1]?.onTime ?? Infinity) + 1);
    if (!pedal.total) pedal = undefined;
  }
  for (const n of r.notes) if (r.judge.verdict(n.id) === "miss") noteEls.get(n.id)?.classList.add("r-miss");
  follower.loop = r.savedLoop; player.hold = false;
  player.setMode("wait"); follower.seek(r.startIndex);
  $("countIn").classList.add("hidden");
  updatePlayBtn();
  if (aborted) return;
  reportPass({ mode: "rhythm", score: sum.score, accuracy: sum.accuracy, timing: sum.timing, speed, hand: follower.hand, summary: sum, loop: loopM ? { ...loopM } : null, pedal });
}
$("metroBtn").classList.toggle("off", !metroOn);
$("metroBtn").addEventListener("click", () => { metroOn = !metroOn; store.set("metroRun", metroOn ? "1" : "0"); $("metroBtn").classList.toggle("off", !metroOn); });

// ───────────── coach : apprendre le morceau section par section ─────────────
interface CoachRun { id: string; secs: Coach.Section[]; stages: Coach.CoachStage[]; parts: Coach.Part[]; partStages: Coach.CoachStage[]; full: Coach.CoachStage[]; prog: Coach.CoachProgress; target: Coach.CoachTarget; }
const coachNext = (c: CoachRun) => Coach.nextTarget(c.prog, c.secs, c.stages, c.full, c.parts, c.partStages);
const coachRatio = (c: CoachRun) => Coach.progressRatio(c.prog, c.secs, c.stages, c.full, c.parts, c.partStages);
/** Libellé court d'une étape du coach. */
function coachLabel(c: CoachRun, t: Coach.CoachTarget): string {
  if (t.kind === "done") return "Morceau appris 🎉";
  if (t.kind === "full") return t.stage.label;
  if (t.kind === "part") return `Partie ${t.index + 1}/${c.parts.length} · mes. ${t.section.a + 1}–${t.section.b} · ${t.stage.label}`;
  return `Section ${t.index + 1}/${c.secs.length} · mes. ${t.section.a + 1}–${t.section.b} · ${t.stage.label}`;
}
let coach: CoachRun | null = null;
let coachJustPassed = false;
function coachStart() {
  if (!steps.length || !ensureLayout() || !measuresL || !measuresL.length) { toast("Ouvre d'abord un morceau"); return; }
  const M = measuresL.length, per = new Array(M).fill(0);
  for (const n of allNotes) per[Math.min(M - 1, n.measure ?? 0)]++;
  const hasR = allNotes.some((n) => n.hand === "R"), hasL = allNotes.some((n) => n.hand === "L");
  const secs = Coach.sectionsFor(per), stages = Coach.stagesFor(hasR, hasL), full = Coach.fullStagesFor(hasR, hasL);
  const parts = Coach.partsFor(secs), partStages = Coach.partStagesFor(hasR, hasL);
  const prog = Coach.loadCoach(songName);
  coach = { id: songName, secs, stages, parts, partStages, full, prog, target: { kind: "done" } };
  coach.target = coachNext(coach);
  coachApply();
  if (!prog.pct) toast("🎧 Commence par écouter le morceau en entier (bouton 🎧 du coach) : savoir comment il doit sonner aide énormément.", 4200);
}
function coachStop() { coach = null; loopM = null; applyLoop(); renderCoach(); }
/** Met le moteur dans la configuration de l'étape visée (boucle, main, mode, vitesse). */
function coachApply() {
  const c = coach; if (!c) return;
  hideResult(); coachJustPassed = false;
  const t = c.target;
  if (t.kind === "done") { loopM = null; applyLoop(); setHand("both"); renderCoach(); toast("🎉 Morceau appris ! Rejoue-le en rythme pour le garder en mémoire.", 3500); return; }
  setHand(t.stage.hand); setAppMode(t.stage.mode); setSpeed(t.stage.speed);
  if (t.kind === "section" || t.kind === "part") setLoopMeasures(t.section.a, t.section.b);
  else { loopM = null; applyLoop(); follower.goTo(0); }
  renderCoach();
}
/** Écouter d'abord : tout le morceau (sans boucle), mains ensemble, à 75 %, en mode pas à pas (la démo joue). */
function coachListen() {
  if (!coach) return;
  loopM = null; applyLoop(); setHand("both"); setAppMode("step"); setSpeed(75); follower.goTo(0);
  if (!listening) toggleListen();
  toast("Écoute : la partition défile et les touches s'allument. ↺ pour revenir à l'étape.", 3000);
}
/** « Je sais déjà » : l'étape est validée sans la jouer (passage déjà connu). */
function coachSkip() {
  const c = coach; if (!c || c.target.kind === "done") return;
  c.prog = Coach.advance(c.prog, c.target); coachSave(c);
  c.target = coachNext(c); coachApply();
}
function coachSave(c: CoachRun) { c.prog.pct = Math.round(coachRatio(c) * 100); c.prog.at = Date.now(); Coach.saveCoach(c.id, c.prog); }
function coachChoose(v: string) {
  const c = coach; if (!c) return;
  if (v === "auto") c.target = coachNext(c);
  else if (v.startsWith("p")) { const i = Number(v.slice(1)), k = Math.min(c.partStages.length - 1, c.prog.part?.[String(i)] ?? 0); c.target = { kind: "part", index: i, section: c.parts[i], stage: c.partStages[k], stageIndex: k }; }
  else if (v === "full") { const k = Math.min(c.full.length - 1, c.prog.full); c.target = { kind: "full", stage: c.full[k], stageIndex: k }; }
  else { const i = Number(v), k = Math.min(c.stages.length - 1, c.prog.sec[String(i)] ?? 0); c.target = { kind: "section", index: i, section: c.secs[i], stage: c.stages[k], stageIndex: k }; }
  coachApply();
}
passListeners.push((r) => {
  const c = coach; if (!c) return;
  const t = c.target;
  coachJustPassed = Coach.passMatches(t, { mode: r.mode, score: r.score, speed: r.speed, hand: r.hand, loop: r.loop });
  if (!coachJustPassed) return;
  c.prog = Coach.advance(c.prog, t); coachSave(c);
  c.target = coachNext(c);
  renderCoach();
});
function coachPassNote(_r: PassResult): { passed: boolean; html: string } | null {
  const c = coach; if (!c) return null;
  const nxt = c.target.kind === "done" ? "morceau terminé 🎉" : coachLabel(c, c.target);
  return coachJustPassed ? { passed: true, html: `🎯 Étape validée ! Suivante : <b>${nxt}</b>` } : { passed: false, html: `🎯 Objectif de l'étape : <b>${c.target.kind === "done" ? "—" : c.target.stage.pass + " %"}</b> (${c.target.kind === "done" ? "" : c.target.stage.label}). Rejoue, ou ralentis.` };
}
function renderCoach() {
  const bar = $("coachBar"), c = coach;
  $("coachBtn").classList.toggle("on", !!c);
  if (!c) { bar.classList.add("hidden"); return; }
  const ratio = coachRatio(c), t = c.target;
  const label = coachLabel(c, t);
  const dots = (d: number, n: number) => "●".repeat(Math.min(n, d)) + "○".repeat(Math.max(0, n - d));
  const secOpt = (i: number) => { const sct = c.secs[i]; return `<option value="${i}" ${t.kind === "section" && t.index === i ? "selected" : ""}>Section ${i + 1} (mes. ${sct.a + 1}–${sct.b}) ${dots(c.prog.sec[String(i)] ?? 0, c.stages.length)}</option>`; };
  const groups = c.parts.length ? c.parts : [{ s0: 0, s1: c.secs.length, a: 0, b: 0 }];
  const opts = groups.map((g, gi) => Array.from({ length: g.s1 - g.s0 }, (_, k) => secOpt(g.s0 + k)).join("")
      + (c.parts.length ? `<option value="p${gi}" ${t.kind === "part" && t.index === gi ? "selected" : ""}>↳ Enchaîner la partie ${gi + 1} (mes. ${g.a + 1}–${g.b}) ${dots(c.prog.part?.[String(gi)] ?? 0, c.partStages.length)}</option>` : "")).join("")
    + `<option value="full" ${t.kind === "full" ? "selected" : ""}>Morceau entier ${dots(c.prog.full, c.full.length)}</option>`;
  bar.innerHTML = `<span class="cb-ic">🎯</span><div class="cb-main"><b>${label}</b>${t.kind === "done" ? "" : `<small>objectif ${t.stage.pass} % · ${t.stage.mode === "rhythm" ? "appuie sur ▶ pour le décompte" : "joue la section, elle recommence en boucle"}</small>`}
    <div class="cb-bar"><i style="width:${Math.round(ratio * 100)}%"></i></div></div>
    <select id="coachSel" title="Choisir une section"><option value="auto">Prochaine étape</option>${opts}</select>
    <button id="coachListen" title="Écouter le morceau en entier, lentement, avant de le travailler">🎧</button><button id="coachRe" title="Remettre la configuration de l'étape">↺</button>${t.kind === "done" ? "" : `<button id="coachSkip" title="Je sais déjà faire cette étape : la valider sans la jouer">⏭</button>`}<button id="coachOff" title="Quitter le coach">✕</button>`;
  bar.classList.remove("hidden");
  layoutPractice();
}
$("coachBtn").addEventListener("click", () => (coach ? coachStop() : coachStart()));
$("coachBar").addEventListener("click", (e) => { const t = e.target as HTMLElement; if (t.id === "coachRe") coachApply(); if (t.id === "coachSkip") coachSkip(); if (t.id === "coachListen") coachListen(); if (t.id === "coachOff") coachStop(); });
$("coachBar").addEventListener("change", (e) => { const t = e.target as HTMLSelectElement; if (t.id === "coachSel") coachChoose(t.value); });

// ───────────── carte de résultat ─────────────
let resultTimer: number | undefined;
function hideResult() { $("resultCard").classList.add("hidden"); clearTimeout(resultTimer); }
function adviceFor(r: PassResult): string {
  const s = r.summary;
  if (s) {
    if (s.accuracy < 80) return "Beaucoup de notes manquées : travaille ce passage en Pas à pas, ou ralentis.";
    if (s.timing < 70) return s.early > s.late ? "Tu joues souvent en avance : laisse-toi porter par le métronome." : "Tu joues souvent en retard : regarde une note plus loin pour préparer tes doigts.";
    if (r.score >= 90 && r.speed < 100) return `Très propre ! Essaie à ${Math.min(100, r.speed + 10)} %.`;
    if (r.score >= 90) return "Excellent : c'est en place.";
    return "";
  }
  return r.score >= 95 ? "Les notes sont sûres : passe « En rythme » pour travailler le temps." : "Reprends lentement les endroits où tu hésites.";
}

// ───────────── tour de boucle : le bilan reste en haut, la boucle repart seule ─────────────
function hideLoopNote() { $("loopNote").classList.add("hidden"); clearTimeout(loopRestart); loopRestart = undefined; }
function showLoopNote(r: PassResult, coachNote: { passed: boolean; html: string } | null) {
  const s = r.summary, advice = adviceFor(r);
  // en rythme, la boucle ne repart que si on a joué : sans aucune note, on s'est sans doute levé du piano
  const played = !s || s.perfect + s.good + s.early + s.late + s.wrong > 0;
  const again = r.mode === "rhythm" && played;
  $("loopNote").innerHTML = `<div class="ln-top"><b>${r.score} %</b>${s ? `<span class="ok">✓ ${s.perfect + s.good}</span>${s.early ? `<span class="off">↶ ${s.early}</span>` : ""}${s.late ? `<span class="off">↷ ${s.late}</span>` : ""}${s.miss + s.wrong ? `<span class="bad">✗ ${s.miss + s.wrong}</span>` : ""}` : ""}<button data-ln="close" title="Fermer">✕</button></div>
    ${advice ? `<p>${advice}</p>` : ""}${coachNote ? `<p class="ln-coach">${coachNote.html}</p>` : ""}
    ${s && s.weak.length ? `<p class="ln-weak">À retravailler : ${s.weak.map((m) => `<button data-weak="${m}">mesure ${m + 1}</button>`).join(" ")}</p>` : ""}
    ${r.mode === "rhythm" ? `<small>${again ? "La boucle repart… ▶ pour arrêter." : "Aucune note jouée : la boucle attend, ▶ pour reprendre."}</small>` : ""}`;
  $("loopNote").classList.remove("hidden");
  clearTimeout(loopRestart); loopRestart = undefined;
  if (again) loopRestart = window.setTimeout(() => {
    loopRestart = undefined;
    if (!run && appMode === "rhythm" && loopM && !$("practiceView").classList.contains("hidden") && $("resultCard").classList.contains("hidden")) startRhythm();
  }, 1200);
}
$("loopNote").addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  const weak = t.closest("[data-weak]") as HTMLElement | null;
  if (weak) { hideLoopNote(); if (run) finishRhythm(true); setLoopMeasures(Number(weak.dataset.weak), Number(weak.dataset.weak) + 1); return; }
  if (t.closest("[data-ln]")) hideLoopNote();
});
function showResult(r: PassResult, hook: { pass: number; counts: boolean; need: AppMode; minSpeed: number } | null, coachNote: { passed: boolean; html: string } | null = null) {
  const s = r.summary, stars = r.score >= 90 ? 3 : r.score >= 75 ? 2 : 1;
  const passed = !!hook && hook.counts && r.score >= hook.pass;
  const advice = adviceFor(r);
  const need = hook && !hook.counts ? `<p class="rc-note">Pour valider l'exercice : mode « ${hook.need === "rhythm" ? "En rythme" : "Pas à pas"} »${pieceHook?.hands === "both" ? ", mains ensemble" : ""}${hook.minSpeed > 40 ? `, vitesse ≥ ${hook.minSpeed} %` : ""}.</p>` : "";
  $("rcBox").innerHTML = `<div class="rc-stars">${[1, 2, 3].map((i) => `<span class="${i <= stars ? "on" : ""}">★</span>`).join("")}</div>
    <h3>${r.score} %${passed ? " · objectif atteint ✓" : hook && hook.counts ? ` · il faut ${hook.pass} %` : ""}</h3>
    <p class="rc-sub">${r.mode === "rhythm" ? `En rythme · ${r.speed} %` : "Pas à pas"}${r.hand !== "both" ? ` · main ${r.hand === "R" ? "droite" : "gauche"}` : ""}${r.loop ? ` · mesures ${r.loop.a + 1}–${r.loop.b}` : ""}</p>
    ${s ? `<div class="rc-chips"><span class="ok">✓ ${s.perfect + s.good} dans le temps</span><span class="off">↶ ${s.early} en avance</span><span class="off">↷ ${s.late} en retard</span><span class="bad">✗ ${s.miss} manquées</span><span class="bad">${s.wrong} fausses</span></div>` : ""}
    ${s && s.weak.length ? `<p class="rc-weak">À retravailler : ${s.weak.map((m) => `<button data-weak="${m}">mesure ${m + 1}</button>`).join(" ")}</p>` : ""}
    ${r.pedal ? `<p class="rc-pedal">🦶 Pédale : <b>${r.pedal.ok}/${r.pedal.total}</b> indications respectées${r.pedal.late ? ` · ${r.pedal.late} en retard` : ""}${r.pedal.missing ? ` · ${r.pedal.missing} oubliée${r.pedal.missing > 1 ? "s" : ""}` : ""}${r.pedal.ok < r.pedal.total ? " — au signe « Ped. », le pied remonte en jouant et redescend juste après." : ""}</p>` : pieceMarks.length && r.mode === "rhythm" ? `<p class="rc-pedal">🦶 Ce morceau indique la pédale : branche-la, l'appli notera aussi ton pied.</p>` : ""}
    <p class="rc-advice">${advice}</p>${need}${coachNote ? `<div class="rc-coach ${coachNote.passed ? "ok" : ""}">${coachNote.html}</div>` : ""}
    <div class="rc-btns">${passed ? `<button class="pri" data-rc="back">Retour à la leçon</button>` : ""}${coachNote?.passed ? `<button class="pri" data-rc="next">Étape suivante</button>` : ""}${returnTo === "today" && !coachNote?.passed ? `<button class="pri" data-rc="today">Séance du jour →</button>` : ""}<button class="${passed || coachNote?.passed || returnTo === "today" ? "" : "pri"}" data-rc="again">Rejouer</button>${r.mode === "rhythm" ? `<button data-rc="${r.score >= 90 && r.speed < 100 ? "faster" : "slower"}">${r.score >= 90 && r.speed < 100 ? "Plus vite" : "Plus lent"}</button>` : ""}<button data-rc="close">Fermer</button></div>`;
  $("resultCard").classList.remove("hidden");
  if (passed && !coach) resultTimer = window.setTimeout(() => { if (pieceHook) showTab("course"); }, 2600);
}
$("resultCard").addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  const weak = t.closest("[data-weak]") as HTMLElement | null;
  if (weak) { const m = Number(weak.dataset.weak); hideResult(); setLoopMeasures(m, m + 1); return; }
  const a = (t.closest("[data-rc]") as HTMLElement | null)?.dataset.rc;
  if (!a) { if (t.id === "resultCard") hideResult(); return; }
  hideResult();
  if (a === "back") { showTab("course"); return; }
  if (a === "today") { showTab("today"); return; }
  if (a === "next") { coachApply(); return; }
  if (a === "slower") setSpeed(speed - 10);
  if (a === "faster") setSpeed(speed + 10);
  if (a === "again" || a === "slower" || a === "faster") { if (appMode === "rhythm") startRhythm(); else { follower.goTo(loopStartIndex()); learnFinished = false; } }
});

let speed = 100;
function setSpeed(v: number) { speed = Math.max(40, Math.min(150, v)); player.setTempo(speed / 100); $("spdVal").textContent = speed + "%"; }
$("spdDown").addEventListener("click", () => setSpeed(speed - 10));
$("spdUp").addEventListener("click", () => setSpeed(speed + 10));

function setView(v: View) {
  view = v; store.set("view", v);
  const pv = $("practiceView");
  pv.classList.toggle("mode-flow", v === "flow"); pv.classList.toggle("mode-fall", v === "fall");
  document.querySelectorAll<HTMLElement>("#viewSeg button").forEach((b) => b.classList.toggle("on", b.dataset.v === v));
  layoutPractice();
  requestAnimationFrame(() => { layoutPractice(); pianoSig = ""; });
}
document.querySelectorAll<HTMLElement>("#viewSeg button").forEach((b) => b.addEventListener("click", () => setView(b.dataset.v as View)));
$("scoreToggle").addEventListener("click", () => {
  showScoreInFall = !showScoreInFall; store.set("scoreInFall", showScoreInFall ? "1" : "0");
  layoutPractice(); requestAnimationFrame(layoutPractice);
});

/** Hauteurs calculées : le clavier garde les proportions d'un vrai piano, le reste s'adapte à l'écran. */
function layoutPractice() {
  const pv = $("practiceView");
  if (pv.classList.contains("hidden")) return;
  const H = pv.clientHeight, W = pv.clientWidth;
  const keyW = W / WHITE_COUNT;
  const natural = keyW * 5.6;
  const pianoPx = view === "flow" ? Math.min(natural, H * 0.36) : Math.min(natural * 0.8, H * 0.27);
  $("piano").style.height = Math.max(90, Math.round(pianoPx)) + "px";
  const box = $("scoreBox");
  if (view === "fall") {
    box.classList.toggle("hidden", !showScoreInFall);
    box.style.flex = `0 0 ${Math.round(Math.max(120, Math.min(230, H * 0.24)))}px`;
  } else { box.classList.remove("hidden"); box.style.flex = ""; }
  $("scoreToggle").classList.toggle("off", !showScoreInFall);
  invalidateLayout();
  piano.layout(); falling.resize();
}
window.addEventListener("resize", () => { syncHeaderHeight(); layoutPractice(); });
function syncHeaderHeight() {
  const h = document.querySelector("header")?.getBoundingClientRect().height;
  if (h) document.documentElement.style.setProperty("--header-h", Math.round(h) + "px");
}

/** Clavier limité aux notes du morceau : touches plus grandes et plus lisibles. */
function fitKeyboard() {
  if (!allNotes.length) return;
  const [lo, hi] = rangeForNotes(Math.min(...allNotes.map((n) => n.pitch)), Math.max(...allNotes.map((n) => n.pitch)));
  setKeyboardRange(lo, hi);
  piano.rebuild();
  piano.setShowNames(($("names") as HTMLInputElement).checked);
}

// ───────────── ouverture d'un morceau ─────────────
let returnTo: ViewName | null = null;
let dailyTag: string | null = null;
interface OpenOpts { /** tâche de la séance du jour que ce morceau accomplit */ tag?: string; /** démarrer le coach */ coach?: boolean; library?: boolean; back?: ViewName; hands?: "R" | "L" | "both"; mode?: AppMode; speed?: number; hook?: { pass: number; mode: AppMode; minSpeed: number; hands: Hand; cb: (acc: number) => void }; }
async function openFile(file: File, opts: OpenOpts = {}) {
  returnTo = opts.back ?? null; pieceHook = opts.hook ?? null; dailyTag = opts.tag ?? null;
  coach = null; renderCoach(); hideResult(); fEdit = false; fSel = null; fnumEls.clear(); renderFingerBar();
  showPractice();
  scoreEl.innerHTML = "<div style='padding:40px;color:#667'>Chargement du morceau…</div>";
  songName = file.name; $("songTitle").textContent = cleanName(file.name);
  try {
    const res = await loadScore(file);
    setScoreSvg(scoreEl, res.svg);
    steps = res.steps; measureStarts = res.measureStarts; meter = res.meter;
    annotateHands(steps);
    pieceMarks = res.xmlText ? pedalMarks(res.xmlText) : [];
    lastExplicit = res.xmlText.includes("<fingering") ? parseExplicitFingering(res.xmlText) : null;
    hasExplicitFingering = assignFingering(steps, lastExplicit ?? { R: [], L: [] }, loadHand(), FE.editsFor(songName));
    markKeyFingerings(steps);
    allNotes = flatten(steps);
    sortedNotes = [...allNotes].sort((a, b) => a.onTime - b.onTime);
    songDuration = Math.max(1, ...allNotes.map((n) => n.offTime));
    noteEls.clear();
    for (const n of allNotes) { const e = document.getElementById(n.id); if (e) { noteEls.set(n.id, e); e.classList.add(n.hand === "R" ? "hand-r" : "hand-l"); } }

    loopM = null; follower.loop = null; applyLoop();
    doneUpTo = 0; currentEls = []; pianoSig = ""; viewTime = 0; lastMeasure = -1; invalidateLayout();
    fitKeyboard(); refreshFingerHint();
    follower.load(steps);
    setHand(opts.hands && opts.hands !== "both" ? opts.hands : "both"); setSpeed(opts.speed ?? 100); setAppMode(opts.mode ?? opts.hook?.mode ?? "step");
    layoutPractice(); requestAnimationFrame(layoutPractice);
    if (opts.coach) requestAnimationFrame(() => requestAnimationFrame(coachStart));
    const fifths = Number(/<fifths>(-?\d+)<\/fifths>/.exec(res.xmlText)?.[1] ?? 0);
    const dif = rateDifficulty({ ...pieceFromSteps(steps, meter.tempo, fifths), beats: meter.beats, beatType: meter.beatType });
    $("songTitle").title = `Difficulté ${dif.level}/5 · ${dif.label}${dif.reasons.length ? " — " + dif.reasons.join(", ") : ""}`;
    if (opts.library !== false) await addToLibrary(songName, res.rawFile, dif.level, { why: dif.reasons });
  } catch (err) {
    console.error(err);
    alert("Impossible d'ouvrir ce morceau : " + err);
    showTab("library");
  }
}
/** Les mesures de la main ont changé : on recalcule les doigtés du morceau ouvert. */
function recomputeFingering() {
  if (!steps.length) return;
  hasExplicitFingering = assignFingering(steps, lastExplicit ?? { R: [], L: [] }, loadHand(), FE.editsFor(songName));
  for (const n of allNotes) n.showFinger = undefined;
  markKeyFingerings(steps);
  refreshFingerHint(); updateFallingNotes(); pianoSig = ""; refresh(); drawFingerNums();
}

// ───────────── navigation : quatre onglets (+ les vues qu'ils ouvrent) et le jeu ─────────────
type Tab = "today" | "course" | "library" | "exercises";
type ViewName = Tab | "tech" | "solfege" | "drill";
const TABS: Tab[] = ["today", "course", "library", "exercises"];
const VIEW_ID: Record<ViewName, string> = { today: "todayView", course: "courseView", library: "libraryHomeView", exercises: "exercisesView", tech: "techView", solfege: "solfegeView", drill: "courseView" };
const TAB_OF: Record<ViewName, Tab> = { today: "today", course: "course", library: "library", exercises: "exercises", tech: "exercises", solfege: "exercises", drill: "exercises" };
const BACK_LABEL: Record<ViewName, string> = { today: "← Aujourd'hui", course: "← Leçon", library: "← Morceaux", exercises: "← Exercices", tech: "← Gammes & accords", solfege: "← Lecture", drill: "← Exercices" };
let currentView: ViewName = (TABS.includes(store.get("tab", "today") as Tab) ? store.get("tab", "today") : "today") as ViewName;
let drillReturn: ViewName = "exercises";
/** D'où un exercice a été lancé (onglet Exercices ou séance du jour) : on y revient à la fin. */
let exBack: ViewName = "exercises";

function hideAllViews() { for (const id of new Set(Object.values(VIEW_ID))) $(id).classList.add("hidden"); $("practiceView").classList.add("hidden"); }
function stopModules() {
  closeCourse(); closeSolfege(); closeTech();
  if (run) finishRhythm(true);
  listening = false; if (steps.length) { player.once = false; player.setMode("wait"); }
}
function setChrome(inPractice: boolean) {
  $("homeBtn").classList.toggle("hidden", !inPractice);
  $("songTitle").classList.toggle("hidden", !inPractice);
  $("tabs").classList.toggle("hidden", inPractice);
  $("homeBtnBrand").classList.toggle("hidden", inPractice);
  document.body.classList.toggle("in-practice", inPractice);
  syncHeaderHeight();
}
function highlight(t: Tab) { document.querySelectorAll<HTMLElement>("#tabs .tab").forEach((b) => b.classList.toggle("on", b.dataset.tab === t)); }
function showTab(v: ViewName) {
  if (v === "drill") v = "exercises";
  stopModules(); hideAllViews();
  currentView = v; if ((TABS as string[]).includes(v)) store.set("tab", v);
  if (v === "exercises") exBack = "exercises";
  document.body.dataset.exfrom = exBack;
  returnTo = null; pieceHook = null;
  $(VIEW_ID[v]).classList.remove("hidden"); setChrome(false); highlight(TAB_OF[v]);
  if (v === "course") openCourse(); else if (v === "library") renderLibraryHome(); else if (v === "tech") openTech(); else if (v === "solfege") openSolfege();
  else if (v === "exercises") openExercises(); else openToday();
  requestAnimationFrame(syncHeaderHeight);
}
/** Lance un exercice libre (oreille, rythme…) dans le déroulé des leçons ; à la fin, retour à `from`. */
function showDrill(d: Drill, from: ViewName) {
  stopModules(); hideAllViews();
  drillReturn = from; currentView = "drill";
  $("courseView").classList.remove("hidden"); setChrome(false); highlight(TAB_OF[from]);
  startDrill(d, from === "today" ? "Retour à la séance du jour" : "Retour aux exercices");
}
function showPractice() {
  stopModules(); hideAllViews();
  $("practiceView").classList.remove("hidden"); setChrome(true);
  $("homeBtn").textContent = BACK_LABEL[returnTo ?? "library"];
  setView(view);
}
// barre de jeu : les réglages secondaires dans un menu « ⋯ », pour garder l'essentiel en vue
{
  const btn = $("moreBtn"), menu = $("moreMenu");
  const set = (open: boolean) => { menu.classList.toggle("hidden", !open); btn.setAttribute("aria-expanded", String(open)); btn.classList.toggle("on", open); };
  btn.addEventListener("click", (e) => { e.stopPropagation(); set(menu.classList.contains("hidden")); });
  document.addEventListener("click", (e) => { if (!menu.classList.contains("hidden") && !(e.target as HTMLElement).closest("#moreMenu")) set(false); });
  menu.addEventListener("click", (e) => { if ((e.target as HTMLElement).closest("#listenBtn, #fingerEditBtn")) set(false); });
}
$("tabs").addEventListener("click", (e) => { const b = (e.target as HTMLElement).closest("[data-tab]") as HTMLElement | null; if (b) { clearLessonExit(); if (b.dataset.tab === "today") resetTodayView(); showTab(b.dataset.tab as Tab); } });
$("homeBtn").addEventListener("click", () => { const to = returnTo; showTab(to ?? "library"); });
$("homeBtnBrand").addEventListener("click", () => showTab("today"));
document.addEventListener("click", (e) => { if ((e.target as HTMLElement).closest("[data-exback]")) showTab(exBack); });

initTech($("techView"), {
  play: (p, ms) => { void synth.playNote(p, ms ?? 700); }, soundOnPress: () => soundOnPress,
  openPractice: (file) => { void openFile(file, { library: false, back: "tech", tag: "warmup" }); },
});
initSolfege($("solfegeView"), { play: (p, ms) => { void synth.playNote(p, ms ?? 900); }, soundOnPress: () => soundOnPress });
initCourse($("courseView"), {
  play: (p, ms) => { void synth.playNote(p, ms ?? 700); }, click: (accent) => synth.click(accent), soundOnPress: () => soundOnPress,
  openPiece: (xml, title, o) => { void openFile(new File([xml], title + ".musicxml", { type: "application/xml" }), { library: false, back: "course", hands: o.hands, speed: o.mode === "rhythm" ? o.minSpeed : 100, hook: { pass: o.pass, mode: o.mode, minSpeed: o.minSpeed, hands: o.hands, cb: o.onResult } }); },
  onDrillExit: () => showTab(drillReturn),
});
initExercises($("exercisesView"), {
  startDrill: (d) => showDrill(d, exBack),
  openPiece: (xml, title, o) => { void openFile(new File([xml], title + ".musicxml", { type: "application/xml" }), { library: false, back: exBack, mode: o.mode, speed: o.speed, tag: o.tag }); },
  openSolfege: () => showTab("solfege"), openTech: () => showTab("tech"),
});
/** Séance du jour : chaque étape ouvre l'outil voulu, et on revient à la séance ensuite. */
initToday($("todayView"), {
  go: (a) => {
    const i = a.indexOf(":"), k = a.slice(0, i), v = a.slice(i + 1);
    const xmlFile = (xml: string, title: string) => new File([xml], title + ".musicxml", { type: "application/xml" });
    if (k === "tab") showTab(v as Tab);
    else if (k === "lesson") { showTab("course"); startLessonById(v, () => showTab("today")); }
    else if (k === "rep") openRepertoire(v, true, "today");
    else if (k === "loop") { const j = v.lastIndexOf("|"), name = v.slice(0, j), m = Number(v.slice(j + 1)); void openByName(name, { back: "today", tag: "review", mode: "rhythm", speed: 70 }).then((ok) => { if (ok) { setLoopMeasures(m, m + 1); toast(`Révision : mesure ${m + 1}, en rythme, jusqu'à 90 %`, 2600); } }); }
    else if (k === "lib") void listLibrary().then((list) => { const e = list.find((x) => x.name === v); if (e) void openFile(new File([e.fileData], e.name), { coach: true, back: "today", tag: "piece" }); else toast("Ce morceau n'est plus dans la bibliothèque"); });
    else if (k === "five") { const p = X.fiveFinger(T.MAJOR_KEYS[Number(v)] ?? T.MAJOR_KEYS[0]); void openFile(xmlFile(X.xmlOf(p.spec), p.title), { library: false, back: "today", mode: "step", tag: "warmup" }); }
    else if (k === "scale") {
      const pc: T.Piece = { type: "scale", key: T.MAJOR_KEYS[Number(v)] ?? T.MAJOR_KEYS[0], form: "major", octaves: 2, direction: "updown" };
      void openFile(xmlFile(T.buildPieceXml(pc, 72), `${T.pieceTitle(pc)} (2 octaves)`), { library: false, back: "today", mode: "step", tag: "warmup" });
    } else if (k === "ex") { exBack = "today"; document.body.dataset.exfrom = "today"; launchExercise(v); }
    else if (k === "recall") { const d = recallDrill(); if (d) showDrill(d, "today"); else toast("Rien à revoir aujourd'hui : tout est frais"); }
  },
});

/** Les groupes de l'onglet Morceaux : un seul affiché à la fois (celui de ton niveau à l'ouverture), pour ne pas noyer le choix. */
type LibGroup = "songs" | "1" | "2" | "3" | "mine";
const LIB_GROUPS: { id: LibGroup; label: string; intro: string; after?: string }[] = [
  { id: "songs", label: "Chansons", intro: "La mélodie à la main droite, les accords à la main gauche : les lettres au-dessus de la portée disent lequel jouer." },
  { id: "1", label: "Niveau 1", intro: "Premiers vrais morceaux : deux mains, peu de déplacements.", after: "u6-l9" },
  { id: "2", label: "Niveau 2", intro: "Les grands classiques : arpèges, pédale, mains qui se relaient.", after: "ua-l5" },
  { id: "3", label: "Niveau 3", intro: "Pièces de concert : septièmes, tonalités variées, passages rapides.", after: "k-7-4" },
  { id: "mine", label: "Mes partitions", intro: "" },
];
const CHORD_LETTERS = `<details class="rep-more"><summary>Lire les lettres d'accords (C, G, Am…)</summary><p>C = Do, D = Ré, E = Mi, F = Fa, G = Sol, A = La, B = Si. Une lettre seule : accord majeur ; suivie de « m » : mineur (Am = La mineur). La main gauche joue cet accord avec un motif simple (basse, basse-quinte, arpège), jusqu'à la lettre suivante. Tout est expliqué dans l'unité « Accompagner une chanson » du parcours.</p></details>`;
let libGroup: LibGroup | null = null;
/** Pastille de difficulté (1 à 5) : le libellé, et ce qui rend le morceau difficile en infobulle. */
const diffChip = (level: number, why: string[] = []) => `<span class="diff d${level}" title="${esc(why.length ? "Ce qui est difficile : " + why.join(", ") : "")}">${"●".repeat(level)}${"○".repeat(5 - level)} ${LEVEL_LABEL[level as 1]}</span>`;
/** Ouvre un morceau d'après son nom de fichier : répertoire intégré, sinon bibliothèque. */
async function openByName(name: string, o: OpenOpts): Promise<boolean> {
  const p = repByFile(name);
  if (p) { await openFile(new File([repXml(p)], repFileName(p), { type: "application/xml" }), { library: false, ...o }); return true; }
  const e = (await listLibrary()).find((x) => x.name === name);
  if (!e) { toast("Ce morceau n'est plus dans la bibliothèque"); return false; }
  await openFile(new File([e.fileData], e.name), o); return true;
}
function openRepertoire(id: string, withCoach: boolean, back: ViewName = "library") {
  const p = repById(id); if (!p) return;
  void openFile(new File([repXml(p)], repFileName(p), { type: "application/xml" }), { library: false, coach: withCoach, back, tag: "piece" });
}
async function renderLibraryHome() {
  const list = await listLibrary(), lv = repLevel();
  const g = libGroup ?? (lv > 0 ? String(lv) as LibGroup : "songs");
  $("libSeg").innerHTML = LIB_GROUPS.map((x) => `<button data-lib="${x.id}" class="${x.id === g ? "on" : ""}">${x.label}${x.id === "mine" && list.length ? `<small>${list.length}</small>` : ""}</button>`).join("");
  $("myScores").classList.toggle("hidden", g !== "mine");
  // ── répertoire intégré ──
  const rep = $("repGrid");
  const stats = getAll(), coachAll = Coach.loadAll(), grp = LIB_GROUPS.find((x) => x.id === g)!;
  const pieces: RepPiece[] = g === "songs" ? SONGS : g === "mine" ? [] : repOfLevel(Number(g));
  const unitOf = (id?: string) => LESSONS.find((l) => l.id === id)?.unit.title;
  const level = g === "songs" || g === "mine" ? 0 : Number(g);
  const where = !level ? "" : level === lv ? " <b>À ton niveau.</b>" : level > lv && unitOf(grp.after) ? ` Conseillé après l'unité « ${esc(unitOf(grp.after)!)} » : tu peux essayer avant, très lentement.` : "";
  rep.innerHTML = g === "mine" ? "" : `<p class="rep-intro">${esc(grp.intro)}${where}</p>${g === "songs" ? CHORD_LETTERS : ""}<div class="rep-row">${pieces.map((p) => {
    const st = stats[repFileName(p)], pct = coachAll[repFileName(p)]?.pct ?? 0, best = st?.bestRhythm ?? 0;
    const status = best >= 90 ? `<span class="rep-ok">✓ maîtrisé (${best} %)</span>` : pct ? `<span class="rep-prog">coach ${pct} %</span>` : "";
    return `<div class="rep-card"><div class="rep-top"><b>${esc(p.title)}</b><small>${esc(p.composer)}</small></div>
      <span class="diff-slot" data-diff="${p.id}"></span><p class="rep-skills">${esc(p.skills)}</p><div class="rep-bar"><i style="width:${Math.max(pct, best >= 90 ? 100 : 0)}%"></i></div>${status}
      <div class="rep-btns"><button class="btn clay primary" data-rep="${p.id}" data-coach="1" title="${esc(p.tip)}">🎯 Apprendre</button><button class="btn clay" data-rep="${p.id}">▶ Jouer</button></div></div>`;
  }).join("")}</div>`;
  // difficultés calculées après l'affichage, une carte à la fois (mise en cache)
  const slots = Array.from(rep.querySelectorAll<HTMLElement>("[data-diff]"));
  const fill = () => { const el = slots.shift(); if (!el) return; const p = repById(el.dataset.diff!); if (p) { const d = xmlDifficulty(repXml(p), p.id); el.innerHTML = diffChip(d.level, d.reasons); } setTimeout(fill, 0); };
  setTimeout(fill, 30);
  // ── partitions de l'utilisateur ──
  const host = $("libraryGrid");
  host.innerHTML = "";
  $("libraryHomeEmpty").classList.toggle("hidden", list.length > 0);
  for (const e of list) {
    const st = getStats(e.name), pct = Math.max(st?.bestRhythm ?? 0, st?.bestAccuracy ?? 0), cpct = coachAll[e.name]?.pct ?? 0;
    const card = document.createElement("div");
    card.className = "song-card";
    let hash = 0; for (let i = 0; i < e.name.length; i++) hash = (hash << 5) - hash + e.name.charCodeAt(i);
    const hue = Math.abs(hash) % 360;
    const title = esc(cleanName(e.name));
    card.innerHTML = `
      <div class="song-cover" style="background:linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 60) % 360} 70% 45%))">
        <button class="fav-btn">${e.favorite ? "★" : "☆"}</button>
        <div class="ring"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16"></circle><circle cx="20" cy="20" r="16" style="stroke-dasharray:${Math.round(pct)} 100" pathLength="100"></circle></svg><span>${pct}%</span></div>
      </div>
      <div class="song-info">
        <div class="song-title" style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
          <span class="title-text" style="overflow:hidden;text-overflow:ellipsis;cursor:pointer;min-width:0;">${title}</span>
          <span style="display:flex;gap:6px;flex:none;margin-left:8px"><button class="mini-btn edit-btn" title="Renommer">✏️</button><button class="mini-btn danger song-del" title="Supprimer">🗑</button></span>
        </div>
        <div class="song-meta">${diffChip(Math.min(5, Math.max(1, e.difficulty || 1)), e.why)}</div>
        <div class="rep-bar"><i style="width:${Math.max(cpct, (st?.bestRhythm ?? 0) >= 90 ? 100 : 0)}%"></i></div>
        ${(st?.bestRhythm ?? 0) >= 90 ? `<span class="rep-ok">✓ maîtrisé (${st!.bestRhythm} %)</span>` : cpct ? `<span class="rep-prog">coach ${cpct} %</span>` : `<span class="rep-prog muted">pas encore commencé</span>`}
        <div class="rep-btns"><button class="btn clay primary coach-btn" title="Apprendre avec le coach : section par section, mains séparées puis ensemble, puis en rythme">🎯 Apprendre</button><button class="btn clay play-btn">▶ Jouer</button></div>
      </div>`;
    const open = (coach = false) => openFile(new File([e.fileData || (e as any).xml], e.name), { coach, tag: "piece" });
    card.querySelector(".song-cover")!.addEventListener("click", (ev) => { if ((ev.target as HTMLElement).closest(".fav-btn")) return; open(); });
    card.querySelector(".title-text")!.addEventListener("click", () => open());
    card.querySelector(".coach-btn")!.addEventListener("click", (ev) => { ev.stopPropagation(); open(true); });
    card.querySelector(".play-btn")!.addEventListener("click", (ev) => { ev.stopPropagation(); open(false); });
    card.querySelector(".fav-btn")!.addEventListener("click", async (ev) => { ev.stopPropagation(); await toggleFavorite(e.name); renderLibraryHome(); });
    card.querySelector(".song-del")!.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      if (confirm("Supprimer ce morceau ?")) { await removeFromLibrary(e.name); renderLibraryHome(); }
    });
    card.querySelector(".edit-btn")!.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const base = cleanName(e.name), ext = e.name.substring(base.length);
      const nn = prompt("Renommer le morceau :", base);
      if (nn && nn.trim() && nn !== base) { await renameSong(e.name, nn.trim() + ext); renderLibraryHome(); }
    });
    host.appendChild(card);
  }
}
$("libSeg").addEventListener("click", (ev) => {
  const b = (ev.target as HTMLElement).closest("[data-lib]") as HTMLElement | null;
  if (b) { libGroup = b.dataset.lib as LibGroup; void renderLibraryHome(); }
});
$("repGrid").addEventListener("click", (ev) => {
  const b = (ev.target as HTMLElement).closest("[data-rep]") as HTMLElement | null;
  if (b) openRepertoire(b.dataset.rep!, b.dataset.coach === "1");
});

// ───────────── réglages ─────────────
$("toggleSettings").addEventListener("click", () => $("settingsPanel").classList.toggle("closed"));
$("closeSettings").addEventListener("click", () => $("settingsPanel").classList.add("closed"));
// thème : clair, sombre, ou celui de l'appareil (« Auto ») ; appliqué dès le chargement par le script en tête de page
{
  const KEY = "pianoflow-theme", media = matchMedia("(prefers-color-scheme: dark)");
  const apply = () => {
    let t = "auto"; try { t = localStorage.getItem(KEY) || "auto"; } catch { /* ignore */ }
    if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
    const dark = t === "dark" || (t === "auto" && media.matches);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#1c1f26" : "#ffffff");
    document.querySelectorAll<HTMLElement>("#themeSeg button").forEach((b) => b.classList.toggle("on", b.dataset.theme === t));
  };
  $("themeSeg").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("[data-theme]") as HTMLElement | null; if (!b) return;
    try { localStorage.setItem(KEY, b.dataset.theme!); } catch { /* ignore */ }
    apply();
  });
  media.addEventListener?.("change", apply);
  apply();
}
const namesBox = $("names") as HTMLInputElement;
namesBox.checked = store.get("names", "1") === "1";
const applyNames = () => { piano.setShowNames(namesBox.checked); falling.setShowNames(namesBox.checked); };
namesBox.addEventListener("change", () => { store.set("names", namesBox.checked ? "1" : "0"); applyNames(); });
applyNames();
const fingerSel = $("fingerMode") as HTMLSelectElement;
fingerSel.value = fingerMode;
function setFingerMode(m: FingerMode) {
  fingerMode = m; fingerSel.value = m; store.set("fingers", m); updateFallingNotes(); pianoSig = ""; drawFingerNums(); refreshFingerToggle();
// ── sauvegarde ──
$("backupExport").addEventListener("click", async () => {
  const blob = await exportBackup(), a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `pianoflow-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});
$("backupImport").addEventListener("click", () => ($("backupFile") as HTMLInputElement).click());
$("backupFile").addEventListener("change", async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
  try { const r = await importBackup(await f.text()); toast(`Sauvegarde importée : ${r.keys} éléments, ${r.pieces} partition(s)`, 3500); setTimeout(() => location.reload(), 1200); }
  catch (err) { alert("Import impossible : " + (err as Error).message); }
});
}
function refreshFingerToggle() {
  const b = $("fingerToggleBtn"); b.classList.toggle("off", fingerMode === "off");
  b.title = fingerMode === "off" ? "Doigtés masqués (entraînement à jouer sans) — cliquer pour les afficher" : fingerMode === "all" ? "Tous les doigtés affichés — cliquer pour les masquer" : "Doigtés : repères seulement — cliquer pour les masquer";
}
fingerSel.addEventListener("change", () => setFingerMode(fingerSel.value as FingerMode));
$("fingerToggleBtn").addEventListener("click", () => { if (fingerMode !== "off") store.set("fingersBack", fingerMode); setFingerMode(fingerMode === "off" ? (store.get("fingersBack", "auto") as FingerMode) : "off"); toast(fingerMode === "off" ? "Doigtés masqués : à toi de les trouver" : "Doigtés affichés"); });
refreshFingerToggle();
($("volume") as HTMLInputElement).addEventListener("input", (e) => (synth.volume = Number((e.target as HTMLInputElement).value) / 100));
const soundBox = $("soundOnPress") as HTMLInputElement;
soundBox.checked = soundOnPress;
soundBox.addEventListener("change", () => { soundOnPress = soundBox.checked; store.set("keySound", soundOnPress ? "1" : "0"); });
const metroBox = $("metro") as HTMLInputElement, bpmBox = $("bpm") as HTMLInputElement;
const applyMetro = () => { if (metroBox.checked) synth.startMetronome(Math.max(40, Math.min(220, Number(bpmBox.value) || 80))); else synth.stopMetronome(); };
metroBox.addEventListener("change", applyMetro); bpmBox.addEventListener("change", applyMetro);

$("file").addEventListener("change", (e) => {
  const input = e.target as HTMLInputElement; const f = input.files?.[0]; input.value = "";
  if (!f) return;
  if (/\.(pdf|png|jpe?g)$/i.test(f.name)) { pdfHelp(); return; }
  if (/\.(mid|midi)$/i.test(f.name)) { alert("Un fichier MIDI ne contient pas la partition (portées, mesures, doigtés).\nOuvre-le dans MuseScore (gratuit), puis Fichier → Exporter → MusicXML, et importe ce fichier ici."); return; }
  void openFile(f);
});
/** Une partition en PDF ou en photo : comment la transformer en MusicXML. */
function pdfHelp() {
  alert("PianoFlow lit les partitions MusicXML (.musicxml, .mxl), pas les PDF ni les photos.\n\nPour convertir un PDF :\n1. MuseScore 4 (gratuit) : Fichier → Importer un PDF (service gratuit musescore.com), puis Fichier → Exporter → MusicXML.\n2. Ou Audiveris (gratuit, hors ligne) : ouvre le PDF, puis Exporter en MusicXML.\n3. Vérifie la partition obtenue (la reconnaissance fait parfois des erreurs), puis importe le fichier .mxl ici.\n\nAstuce : beaucoup de partitions gratuites existent déjà en MusicXML sur musescore.com et sur le Mutopia Project.");
}
$("homeOpenBtn2").addEventListener("click", () => $("file").click());

// ───────────── clavier MIDI ─────────────
function onKey(pitch: number, velocity: number, on: boolean) {
  if (on) Daily.activity();
  if (courseActive()) { courseMidi(pitch, velocity, on); return; }
  if (solfegeActive()) { solfegeMidi(pitch, velocity, on); return; }
  if (techActive()) { techMidi(pitch, velocity, on); return; }
  if (!on) { piano.release(pitch); return; }
  if (soundOnPress) synth.playNote(pitch, sustain ? 2600 : 700, Math.max(0.25, Math.min(1, velocity / 127)));
  if (!steps.length || $("practiceView").classList.contains("hidden")) { piano.press(pitch, "ok"); return; }
  if (run) { if (player.mode === "play") rhythmPress(pitch); return; }
  if (appMode === "rhythm" && !listening) { piano.press(pitch, "ok"); return; }
  if (player.mode === "wait") {
    const exp = follower.expected.find((n) => n.pitch === pitch);
    const ok = follower.noteOn(pitch);
    if (ok) { hits++; if (exp) falling.burst(exp); piano.press(pitch, "ok"); }
    else { misses++; piano.press(pitch, "bad"); toast("❌ " + noteName(pitch), 700); }
    pianoSig = "";
  } else piano.press(pitch, "ok");                            // pendant la démo ▶ : simple retour visuel
}
let sustain = false;
/** pédale pendant le jeu en rythme (temps de la partition) et indications de pédale du morceau ouvert */
let pedalEvents: { t: number; down: boolean }[] = [], pieceMarks: PedalMark[] = [];
initMidi(onKey, (s) => {
  // le nom du clavier plutôt qu'un « connecté » générique : on voit tout de suite si c'est bien le sien
  const el = $("midiStatus"), label = s.state === "ok" ? s.names[0] : s.state === "error" ? "MIDI indisponible" : "Pas de clavier";
  el.innerHTML = `<span>🎹</span> <b>${esc(label)}</b>`; el.title = s.detail; el.classList.toggle("ok", s.state === "ok");
},
  (cc, v) => { if (cc !== 64) return; const was = sustain; sustain = v >= 64; coursePedal(sustain); if (run && was !== sustain) pedalEvents.push({ t: player.playhead, down: sustain }); });

// ───────────── ma main ─────────────
(() => {
  const span = $("handSpan") as HTMLInputElement, thumb = $("handThumb") as HTMLInputElement;
  const paint = () => {
    const h = loadHand();
    span.value = String(h.span); thumb.value = h.thumbIndex ? String(h.thumbIndex) : "";
    document.querySelectorAll<HTMLElement>("#handPresets button").forEach((b) => b.classList.toggle("on", Number(b.dataset.span) === h.span && !h.thumbIndex));
  };
  const apply = () => {
    saveHand({ span: Number(span.value), thumbIndex: thumb.value ? Number(thumb.value) : undefined });
    paint(); recomputeFingering();
  };
  span.addEventListener("change", apply); thumb.addEventListener("change", apply);
  $("handPresets").addEventListener("click", (e) => { const b = (e.target as HTMLElement).closest("button"); if (b) { span.value = b.dataset.span!; thumb.value = ""; apply(); } });
  paint();
  return paint;
})();

// ───────────── démarrage ─────────────
try { LEGACY_KEYS.forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
Daily.startTracking();
syncHeaderHeight();
player.restart();
setView(view);
showTab(currentView);
if (location.search.includes("debug")) (window as any).__pf = { course: courseState, showTab, midi: (p: number) => onKey(p, 100, true), expected: () => follower.expected.map((n) => n.pitch), mode: () => appMode, setMode: (m: AppMode) => setAppMode(m), start: () => onPlay(), playhead: () => player.playhead, running: () => !!run, runNotes: () => (run ? run.notes.map((n) => [n.pitch, n.onTime]) : []), fingers: () => allNotes.map((n) => [n.hand, n.pitch, n.finger]), lessons: () => LESSONS.map((l) => ({ id: l.id, unit: l.unit.id })), notes: () => allNotes.map((n) => ({ id: n.id, hand: n.hand, pitch: n.pitch, finger: n.finger })), repXml: (id: string) => repXml(repById(id)!), lesson: (id: string) => { showTab("course"); startLessonById(id); }, key: (p: number, v: number, on: boolean) => onKey(p, v, on), pedal: (down: boolean) => { sustain = down; coursePedal(down); } };
// iPad : le sélecteur de fichiers iOS grise parfois .mxl / .musicxml quand "accept" les liste → on le retire.
if (/iPad|iPhone|Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1) $("file").removeAttribute("accept");
// Demande au navigateur de ne pas purger la bibliothèque (IndexedDB) quand l'espace manque.
navigator.storage?.persist?.().catch(() => {});
/** Bandeau « nouvelle version » : la page affichée est encore l'ancienne, on propose de recharger. */
function showUpdateBanner() {
  if (document.getElementById("updBanner")) return;
  const b = document.createElement("div");
  b.id = "updBanner"; b.className = "upd-banner";
  b.innerHTML = `<span>✨ Nouvelle version de PianoFlow disponible</span><button>Recharger</button>`;
  b.querySelector("button")!.addEventListener("click", () => location.reload());
  document.body.appendChild(b);
}
// Service worker (hors-ligne) : uniquement en contexte sécurisé (https ou localhost).
if ("serviceWorker" in navigator && window.isSecureContext) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("./sw.js").then((reg) => {
    // vérifier régulièrement s'il y a une nouvelle version (au retour sur l'appli, et toutes les 30 min)
    const check = () => { reg.update().catch(() => {}); };
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
    setInterval(check, 30 * 60 * 1000);
  }).catch(() => {});
  // une nouvelle version a pris la main : on propose de recharger (la page affichée est encore l'ancienne)
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController) showUpdateBanner();
  });
}
