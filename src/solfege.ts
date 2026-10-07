import { StaffView } from "./staffSvg";
import * as C from "./solfegeCore";
import { MiniKeyboard } from "./miniKeyboard";
import { markDone } from "./daily";
import { record as recordSkill } from "./skills";

/** Mode solfège : apprendre la clé de Sol et la clé de Fa, avec ou sans piano.
 *  Notes aléatoires (toute la portée, lignes supplémentaires comprises), par manche de 10 ou en continu.
 *  Les notes sont posées sur la portée, qui défile. Réponses par boutons (sans piano) ou au clavier (écran / MIDI). */
export interface SolfegeHost { play(pitch: number, ms?: number): void; soundOnPress(): boolean; }

// ───────────── état ─────────────
type Pace = "wait" | "slow" | "mid" | "fast";
interface UiPrefs { clef: C.ClefMode; input: "screen" | "piano"; run: "round" | "endless"; pace: Pace; }
const PREF_KEY = "pianoflow-solfege-ui";
const SPEED: Record<Pace, number> = { wait: 0, slow: 0.28, mid: 0.5, fast: 0.85 }; // notes par seconde
function loadPrefs(): UiPrefs {
  const d: UiPrefs = { clef: "G", input: "screen", run: "round", pace: "wait" };
  try { return { ...d, ...JSON.parse(localStorage.getItem(PREF_KEY) || "{}") }; } catch { return d; }
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
export const PC_FR = ["Do", "Do♯", "Ré", "Ré♯", "Mi", "Fa", "Fa♯", "Sol", "Sol♯", "La", "La♯", "Si"];
const NAMES7 = ["Do", "Ré", "Mi", "Fa", "Sol", "La", "Si"];

let host: SolfegeHost, root: HTMLElement, body: HTMLElement, kbdBox: HTMLElement, kbd: MiniKeyboard;
let prefs = loadPrefs(), prog = C.loadProgress();
let active = false;
const playNote = (p: number) => host.play(p, 900);
const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* ignore */ } };
const pitchRange = (pitches: number[]): [number, number] => {
  const lo = Math.floor(Math.min(...pitches) / 12) * 12; let hi = Math.floor(Math.max(...pitches) / 12) * 12 + 12;
  if (hi - lo < 24) hi = lo + 24;
  return [lo, hi];
};
const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const raf = (f: (t: number) => void) => (typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame(f) : (setTimeout(() => f(nowMs()), 16) as unknown as number));

function attach(holder: HTMLElement, v: StaffView) { holder.innerHTML = ""; holder.appendChild(v.el); v.setWindow(holder.clientWidth || 1100, holder.clientHeight || 380); }
let ro: ResizeObserver | null = null;
function watchSize(holder: HTMLElement, get: () => StaffView | null) {
  ro?.disconnect(); ro = null;
  if (typeof ResizeObserver === "undefined") return;
  ro = new ResizeObserver(() => { const v = get(); if (v && holder.clientWidth) v.setWindow(holder.clientWidth, holder.clientHeight); });
  ro.observe(holder);
}

// ───────────── barre du haut ─────────────
function seg(k: string, opts: [string, string][], cur: string) {
  return `<div class="sf-seg" data-k="${k}">${opts.map(([v, l]) => `<button data-v="${v}" class="${v === cur ? "on" : ""}">${l}</button>`).join("")}</div>`;
}
function renderBar() {
  root.querySelector(".sf-bar")!.innerHTML = `<button class="sf-back" data-exback>← <span class="l-ex">Exercices</span><span class="l-td">Aujourd'hui</span></button>` +
    seg("clef", [["G", "Clé de Sol"], ["F", "Clé de Fa"], ["GF", "Sol + Fa"]], prefs.clef) +
    seg("input", [["screen", "Sans piano"], ["piano", "Avec piano"]], prefs.input) +
    seg("run", [["round", "Manche de 10"], ["endless", "∞ Infini"]], prefs.run) +
    (prefs.run === "endless" ? seg("pace", [["wait", "À ton rythme"], ["slow", "Lent"], ["mid", "Moyen"], ["fast", "Rapide"]], prefs.pace) : "") +
    `<span class="sf-grow"></span>` +
    (prefs.input === "piano" ? `<label class="sf-chk"><input type="checkbox" id="sfKbNames" ${kbd.namesOn ? "checked" : ""}/> Noms sur les touches</label>` : "");
}
function syncKeyboardBox() { kbdBox.classList.toggle("hidden", prefs.input !== "piano"); }
// ───────────── exercice : les notes sont posées sur la portée, qui défile ─────────────
interface Run {
  kind: "round" | "endless"; deck: C.Deck;
  seq: C.SNote[]; retry: boolean[]; res: ("ok" | "ko" | "")[]; hinted: boolean[];
  cur: number; P: number; flow: boolean; speed: number; paused: boolean;
  ok: number; counted: number; streak: number; best: number; times: number[]; missed: Map<string, number>;
  noteT0: number; ended: boolean; view: StaffView | null; building: boolean; dirty: boolean; last: number; rafId: number; hintShown: boolean;
}
let run: Run | null = null, clearTimer: number | undefined, endTimer: number | undefined;
const ROUND = 10;
const grand = () => prefs.clef === "GF";
const stageHost = () => body.querySelector(".sf-host") as HTMLElement | null;

function stopRun() {
  if (run) { run.ended = true; cancelAnimationFrame?.(run.rafId); }
  run = null; clearTimeout(clearTimer); clearTimeout(endTimer); ro?.disconnect(); ro = null;
}
function renderExercise() {
  stopRun();
  const pad = prefs.input === "screen"
    ? `<div class="sf-pad">${NAMES7.map((n, i) => `<button data-n="${i}"><b>${n}</b><small>${i + 1}</small></button>`).join("")}</div>`
    : `<p class="sf-tip">Joue la note surlignée sur le clavier ci-dessous (à l'écran ou avec ton piano MIDI). L'octave compte !</p>`;
  body.innerHTML = `<div class="sf-card sf-q">
      <div class="sf-hud"><span id="sfHud"></span><div class="sf-pbar ${prefs.run === "endless" ? "hidden" : ""}"><i id="sfBar"></i></div><span id="sfStreak"></span></div>
      <div class="sf-stage big ${grand() ? "gf" : ""}"><div class="sf-host"><span class="sf-loading">Chargement…</span></div></div>
      <div class="sf-prompt" id="sfPrompt">${prefs.input === "piano" ? "Joue la note surlignée" : "Quelle est la note surlignée ?"}</div>
      <div class="sf-fb" id="sfFb"></div>${pad}
      <div class="sf-actions"><button class="sf-btn" id="sfHint">💡 Indice</button>
        ${prefs.run === "endless" && prefs.pace !== "wait" ? `<button class="sf-btn" id="sfPause">⏸ Pause</button>` : ""}
        ${prefs.run === "endless" ? `<button class="sf-btn pri" id="sfStop">■ Terminer</button>` : ""}</div></div>`;
  if (prefs.input === "piano") { const pitches = C.itemsFor(prefs.clef).map(C.midiOf); const [lo, hi] = pitchRange(pitches); kbd.setRange(lo, hi); }
  syncKeyboardBox();
  void startRun();
}
const split = (items: C.SNote[]) => grand()
  ? { top: items.map((x) => (x.clef === "G" ? x : null)), bottom: items.map((x) => (x.clef === "F" ? x : null)) }
  : { top: items as (C.SNote | null)[], bottom: undefined as (C.SNote | null)[] | undefined };

async function startRun() {
  const items = C.itemsFor(prefs.clef);
  const deck = new C.Deck(items, Math.random, C.weightsFrom(prog));
  const endless = prefs.run === "endless", flow = endless && prefs.pace !== "wait";
  const r: Run = { kind: prefs.run, deck, seq: [], retry: [], res: [], hinted: [], cur: 0, P: flow ? -2.6 : -1.6, flow, speed: SPEED[prefs.pace], paused: false,
    ok: 0, counted: 0, streak: 0, best: 0, times: [], missed: new Map(), noteT0: nowMs(), ended: false, view: null, building: false, dirty: false, last: nowMs(), rafId: 0, hintShown: false };
  for (let i = 0; i < (endless ? 18 : ROUND); i++) pushNote(r, deck.next().item, false);
  run = r;
  await rebuild();
  if (run !== r) return;
  hud(); r.noteT0 = nowMs(); r.last = nowMs();
  r.rafId = raf(frame);
}
function pushNote(r: Run, it: C.SNote, retry: boolean, at = r.seq.length) {
  r.seq.splice(at, 0, it); r.retry.splice(at, 0, retry); r.res.splice(at, 0, ""); r.hinted.splice(at, 0, false);
}
const clefOpt = (): C.Clef => (prefs.clef === "F" ? "F" : "G");

/** (Re)grave la portée à partir de la séquence ; on garde 3 notes d'historique et on recale sans à-coup. */
async function rebuild() {
  const r = run; if (!r) return;
  if (r.building) { r.dirty = true; return; }
  r.building = true;
  try {
    do {
      r.dirty = false;
      const keep = r.kind === "endless" ? Math.max(0, r.cur - 3) : 0;
      const { top, bottom } = split(r.seq.slice(keep));
      const v = await StaffView.create(top, bottom, { kind: "quarter", clef: clefOpt(), scroll: true });
      if (run !== r) return;
      if (keep) { r.seq.splice(0, keep); r.retry.splice(0, keep); r.res.splice(0, keep); r.hinted.splice(0, keep); r.cur -= keep; r.P -= keep; }
      const h = stageHost(); if (!h) return;
      attach(h, v); r.view = v; watchSize(h, () => run?.view ?? null);
      for (let i = 0; i < v.n; i++) if (r.res[i]) paintResult(r, i);
      v.scrollTo(r.P); v.col(r.cur < v.n ? r.cur : null); v.showCursor(r.flow);
    } while (r.dirty);
  } catch (e) { console.warn("solfège : rendu impossible", e); }
  finally { r.building = false; }
}
function paintResult(r: Run, i: number) {
  const v = r.view; if (!v || i >= v.n) return;
  v.mark(i, r.res[i] === "ok" ? "sf-ok" : "sf-ko");
  v.tag(i, C.nameOf(r.seq[i], "fr"), r.res[i] === "ok" ? "ok" : "ko");
}
function frame(ts: number) {
  const r = run; if (!r || r.ended) return;
  const dt = Math.min(64, ts - r.last || 16); r.last = ts;
  if (r.flow) {
    if (!r.paused) r.P += (r.speed * dt) / 1000;
    if (!r.paused && r.cur < r.seq.length && r.P - r.cur > 0.62) resolve(false, true);   // la note est passée : manquée
  } else r.P += (r.cur - r.P) * (1 - Math.exp(-dt / 140));
  const v = r.view;
  if (v) { v.scrollTo(r.P); v.col(r.cur < v.n ? r.cur : null); }
  r.rafId = raf(frame);
}

function hud() {
  const r = run; if (!r) return;
  const hudEl = body.querySelector("#sfHud"), st = body.querySelector("#sfStreak");
  if (hudEl) hudEl.innerHTML = r.kind === "round"
    ? `Note <b>${Math.min(ROUND, r.counted + 1)}</b> / ${ROUND}`
    : `<b>${r.ok}</b>/${r.counted} · ${r.counted ? Math.round((r.ok / r.counted) * 100) : 100}% · record série <b>${r.best}</b>`;
  if (st) st.textContent = r.streak >= 2 ? "🔥 " + r.streak : "";
  const bar = body.querySelector("#sfBar") as HTMLElement | null; if (bar) bar.style.width = (r.counted / ROUND) * 100 + "%";
}

/** Enregistre la réponse à la note courante (ou « manquée » en mode défilant). */
function resolve(good: boolean, missed = false, given = "") {
  const r = run; if (!r || r.ended || r.cur >= r.seq.length || r.res[r.cur]) return;
  const i = r.cur, it = r.seq[i], hinted = r.hinted[i], nm = C.nameOf(it, "fr"), counted = !r.retry[i];
  r.res[i] = good ? "ok" : "ko";
  const k = C.keyOf(it), st = prog.items[k] ?? { ok: 0, ko: 0 }; if (good) st.ok++; else st.ko++; prog.items[k] = st; C.saveProgress(prog);
  r.deck.record(it, good && !hinted);
  if (counted) { r.counted++; if (good && !hinted) r.ok++; }
  if (good && !hinted) { r.streak++; r.best = Math.max(r.best, r.streak); r.times.push(nowMs() - r.noteT0); }
  else if (!good) { r.streak = 0; if (counted) r.missed.set(nm, (r.missed.get(nm) ?? 0) + 1); }
  paintResult(r, i);
  const fb = body.querySelector("#sfFb") as HTMLElement | null;
  if (fb) {
    if (good) { fb.className = "sf-fb good"; fb.textContent = hinted ? `✓ ${nm} (avec indice : ne compte pas)` : `✓ ${nm}`; }
    else { fb.className = "sf-fb bad"; fb.innerHTML = `${missed ? "Trop tard" : given ? esc(given) + " ? Non" : "Non"} : c'était <b>${esc(nm)}</b> — ${esc(C.describePos(it.pos))}. <small>Elle revient dans un instant.</small>`; }
  }
  playNote(C.midiOf(it));
  if (prefs.input === "piano") { kbd.mark(C.midiOf(it), good ? "ok" : "target"); clearTimeout(clearTimer); clearTimer = window.setTimeout(() => kbd.clear(), 900); }
  r.cur++; r.noteT0 = nowMs(); r.hintShown = false;
  if (!good && !(r.kind === "round" && r.counted >= ROUND)) { pushNote(r, it, true, Math.min(r.seq.length, r.cur + 3)); void rebuild(); }
  hud();
  if (r.kind === "round" && r.counted >= ROUND) { clearTimeout(endTimer); endTimer = window.setTimeout(() => active && run === r && finishRun(), 1000); return; }
  if (r.kind === "endless" && r.seq.length - r.cur < 14) { for (let n = 0; n < 10; n++) pushNote(r, r.deck.next().item, false); void rebuild(); }
}
function answerName(li: number) {
  const r = run; if (!r || r.cur >= r.seq.length || r.res[r.cur]) return;
  const it = r.seq[r.cur];
  resolve(C.spell(it.clef, it.pos).li === li, false, NAMES7[li]);
}
function answerPitch(p: number) {
  const r = run; if (!r || r.cur >= r.seq.length || r.res[r.cur]) return;
  const good = p === C.midiOf(r.seq[r.cur]);
  if (!good && prefs.input === "piano") kbd.mark(p, "bad");
  resolve(good, false, PC_FR[p % 12]);
}
function hint() {
  const r = run; if (!r || r.cur >= r.seq.length) return;
  r.hinted[r.cur] = true;
  const it = r.seq[r.cur], fb = body.querySelector("#sfFb") as HTMLElement;
  const near = it.clef === "G" ? "Repère : la clé de Sol entoure la 2e ligne (Sol)." : "Repère : les deux points de la clé de Fa entourent la 4e ligne (Fa).";
  fb.className = "sf-fb hint"; fb.textContent = `💡 La note surlignée est ${C.describePos(it.pos)}${grand() ? ` (clé de ${it.clef === "G" ? "Sol" : "Fa"})` : ""}. ${near}`;
}
function finishRun() {
  const r = run; if (!r) return;
  r.ended = true; cancelAnimationFrame?.(r.rafId); ro?.disconnect(); ro = null;
  const pct = r.counted ? Math.round((r.ok / r.counted) * 100) : 0;
  const weak = [...r.missed.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([n]) => n);
  const avg = r.times.length ? (r.times.reduce((a, b) => a + b, 0) / r.times.length / 1000).toFixed(1) : "–";
  const rk = C.levelKey(prefs.clef, r.kind), p = prog.levels[rk] ?? { best: 0, rounds: 0 };
  const score = r.kind === "round" ? pct : r.best, record = score > p.best && p.rounds > 0;
  prog.levels[rk] = { best: Math.max(p.best, score), rounds: p.rounds + 1 }; C.saveProgress(prog);
  if (r.counted >= 5) { markDone("reading"); recordSkill("reading", pct); }
  const head = r.kind === "round"
    ? `<div class="sf-stars">${pct >= 90 ? "⭐⭐⭐" : pct >= 70 ? "⭐⭐" : "⭐"}</div><h2>${pct}% de réussite</h2>`
    : `<div class="sf-stars">∞</div><h2>${r.counted} notes lues</h2>`;
  const line = r.kind === "round"
    ? `${r.ok} bonnes réponses du premier coup sur ${ROUND}${record ? " 🏆 nouveau record !" : ""} · temps moyen <b>${avg} s</b>.`
    : `<b>${pct}%</b> de réussite · meilleure série <b>${r.best}</b>${record ? " 🏆 nouveau record !" : ""} · temps moyen <b>${avg} s</b> par bonne réponse.`;
  body.innerHTML = `<div class="sf-card sf-sum">${head}<p class="sf-text">${line}</p>
    ${weak.length ? `<p class="sf-text">À revoir : <b>${weak.map(esc).join(", ")}</b> (elles reviendront plus souvent).</p>` : ""}
    <div class="sf-actions"><button class="sf-btn pri" id="sfAgain">Rejouer</button></div></div>`;
  run = null;
  if (prefs.input === "piano") kbd.clear();
}

// ───────────── routage ─────────────
function render() {
  stopRun();
  renderBar(); syncKeyboardBox(); renderExercise();
}

/** Appelé par main.ts pour les notes d'un clavier MIDI. */
export function solfegeMidi(pitch: number, _velocity: number, on: boolean) {
  if (!active || !on) return;
  if (host.soundOnPress()) host.play(pitch, 700);
  if (prefs.input !== "piano") return;
  answerPitch(pitch);
}
export const solfegeActive = () => active;
export const _debugCurrent = () => {
  const r = run; if (!r || r.cur >= r.seq.length) return null;
  const it = r.seq[r.cur];
  return { pitch: C.midiOf(it), li: C.spell(it.clef, it.pos).li, alter: it.alter, done: !!r.res[r.cur], retry: r.retry[r.cur], cur: r.cur, n: r.seq.length, counted: r.counted, ended: r.ended, flow: r.flow };
};
export function openSolfege() { active = true; prog = C.loadProgress(); render(); }
export function closeSolfege() { active = false; stopRun(); }

export function initSolfege(rootEl: HTMLElement, h: SolfegeHost) {
  host = h; root = rootEl;
  root.innerHTML = `<div class="sf-bar"></div><div class="sf-body" id="sfBody"></div><div class="sf-kbd hidden" id="sfKbd"></div>`;
  body = root.querySelector("#sfBody")!; kbdBox = root.querySelector("#sfKbd")!;
  kbd = new MiniKeyboard(kbdBox, (p) => {
    host.play(p, 800);
    answerPitch(p);
  });
  kbd.setRange(48, 72);

  root.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const segBtn = t.closest(".sf-seg button") as HTMLElement | null;
    if (segBtn) {
      const k = (segBtn.parentElement as HTMLElement).dataset.k!, v = segBtn.dataset.v!;
      if (k === "clef") prefs.clef = v as C.ClefMode;
      else if (k === "input") prefs.input = v as UiPrefs["input"];
      else if (k === "run") prefs.run = v as UiPrefs["run"];
      else if (k === "pace") prefs.pace = v as Pace;
      savePrefs(); render(); return;
    }
    const nb = t.closest("[data-n]") as HTMLElement | null; if (nb) { answerName(Number(nb.dataset.n)); return; }
    if (t.closest("#sfHint")) { hint(); return; }
    if (t.closest("#sfPause")) { if (run) { run.paused = !run.paused; (t.closest("#sfPause") as HTMLElement).textContent = run.paused ? "▶ Reprendre" : "⏸ Pause"; } return; }
    if (t.closest("#sfStop")) { finishRun(); return; }
    if (t.closest("#sfAgain")) { renderExercise(); return; }
  });
  root.addEventListener("change", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id === "sfKbNames") kbd.showNames(t.checked);
  });
  window.addEventListener("keydown", (e) => {
    if (!active || e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement)?.tagName === "INPUT") return;
    if (e.key === " " && run?.flow) { e.preventDefault(); (root.querySelector("#sfPause") as HTMLElement | null)?.click(); return; }
    if (prefs.input === "screen" && /^[1-7]$/.test(e.key)) answerName(Number(e.key) - 1);
  });
}
