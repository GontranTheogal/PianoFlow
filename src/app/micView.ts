/** Piano acoustique, écouté au micro : section « Mon piano » des réglages (entrée, piano, sensibilité), assistant pour ajouter et
 *  calibrer un piano (chaque touche jouée plusieurs fois), bilan de son accord, et test de la reconnaissance. */
import { analyzeTake, combineTakes, expectFor, type TakeResult } from "../mic/calibrate";
import { WINDOW_S, type Take } from "../mic/detector";
import { MicInput, type MicNote } from "../mic/input";
import { centsFrom } from "../mic/model";
import * as P from "../mic/pianos";
import { MiniKeyboard } from "../miniKeyboard";
import { noteName } from "../names";
import { esc } from "../html";
import { icon } from "../icons";
import { $, store } from "./dom";

export type InputMode = "midi" | "mic";
export interface MicHost {
  /** notes reconnues, vers le jeu */
  onNote: MicNote;
  /** l'entrée choisie, le piano ou l'état du micro ont changé (bandeau du haut) */
  onChange: () => void;
}
export const inputMode = (): InputMode => (store.get("input", "midi") === "mic" ? "mic" : "midi");
const sensitivity = () => Math.max(0, Math.min(2, Number(store.get("mic-sens", "1")) || 0));
const activePiano = () => P.getPiano(P.activePianoId());

const fr = (m: number) => noteName(m).replace("#", "♯");
const signed = (c: number) => (c > 0 ? "+" : c < 0 ? "−" : "") + Math.abs(Math.round(c));
const RANGES = [
  { lo: 21, hi: 108, label: "Toutes les touches (88 : La0 → Do8)" },
  { lo: 36, hi: 96, label: "61 touches (Do2 → Do7)" },
  { lo: 48, hi: 84, label: "Le médium (Do3 → Do6, 37 touches)" },
];

let mic: MicInput, host: MicHost;

export function initMic(h: MicHost): MicInput {
  host = h;
  mic = new MicInput(P.modelsFor(null));
  applyPiano();
  mic.setSensitivity(sensitivity());
  mic.sink = h.onNote;
  mic.onStatus = () => { renderSection(); host.onChange(); if (mic.open) startMeter(); };
  $("inputSeg").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("[data-input]") as HTMLElement | null; if (!b) return;
    store.set("input", b.dataset.input!);
    if (inputMode() === "mic") void mic.start(); else mic.stop();
    renderSection(); host.onChange();
  });
  $("pianoSel").addEventListener("change", (e) => { P.setActivePiano((e.target as HTMLSelectElement).value); applyPiano(); renderSection(); host.onChange(); });
  $("pianoAdd").addEventListener("click", () => openWizard("new"));
  $("pianoManage").addEventListener("click", () => { const p = activePiano(); if (p) openWizard("manage", p); });
  $("micTest").addEventListener("click", () => openWizard("test", activePiano()));
  $("micRetry").addEventListener("click", () => void mic.start());
  $("micSens").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("[data-sens]") as HTMLElement | null; if (!b) return;
    store.set("mic-sens", b.dataset.sens!); mic.setSensitivity(sensitivity()); renderSection();
  });
  $("micWizard").addEventListener("click", onWizardClick);
  $("micWizard").addEventListener("change", onWizardChange);
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && wiz) { e.preventDefault(); if (wiz.page === "key") toManage(); else closeWizard(); } });
  renderSection();
  if (inputMode() === "mic") autoStart();
  return mic;
}

/** Gabarits du piano choisi (ou d'un piano moyen bien accordé). */
function applyPiano() { const p = activePiano(); mic.setModels(P.modelsFor(p), P.isCalibrated(p)); }

/** Au chargement, en mode micro : s'il est déjà autorisé, il démarre ; sinon on attend un premier geste (la demande arrive alors à propos). */
function autoStart() {
  const go = () => { if (inputMode() === "mic") void mic.start(); };
  const onGesture = () => { window.removeEventListener("pointerdown", onGesture, true); window.removeEventListener("keydown", onGesture, true); go(); };
  const wait = () => { window.addEventListener("pointerdown", onGesture, true); window.addEventListener("keydown", onGesture, true); };
  let q: Promise<PermissionStatus> | undefined;
  try { q = navigator.permissions?.query?.({ name: "microphone" as PermissionName }); } catch { /* nom de permission inconnu de ce navigateur */ }
  if (!q) { wait(); return; }
  q.then((s) => (s.state === "granted" ? go() : wait())).catch(wait);
}

/** Ce que le bandeau du haut affiche en mode micro (rien en mode MIDI). */
export function micBadge(): { ok: boolean; label: string; title: string } | null {
  if (inputMode() !== "mic") return null;
  const st = mic.status.state, p = activePiano();
  const label = st === "on" ? (p ? `Micro · ${p.name}` : "Micro") : st === "paused" ? "Micro en attente" : st === "starting" ? "Micro…"
    : st === "off" ? "Micro éteint" : st === "denied" ? "Micro refusé" : "Micro indisponible";
  return { ok: st === "on", label, title: mic.status.detail + (p ? ` · piano : ${p.name}` : " · piano standard (bien accordé), sans calibrage") };
}

// ───────────── section des réglages ─────────────
function renderSection() {
  const mode = inputMode(), st = mic.status.state;
  document.querySelectorAll<HTMLElement>("#inputSeg button").forEach((b) => b.classList.toggle("on", b.dataset.input === mode));
  $("micBox").classList.toggle("hidden", mode !== "mic");
  $("inputHint").textContent = mode === "mic"
    ? "L'appli écoute ton piano avec le micro de l'appareil : pose-le près du piano, dans une pièce calme. Piano désaccordé ? Ajoute-le : l'appli apprend le son de chaque touche."
    : "Piano numérique ou clavier relié en USB (MIDI), avec Chrome, Edge ou Firefox. Piano acoustique : choisis « Micro ».";
  const list = P.listPianos(), cur = P.activePianoId(), sel = $("pianoSel") as HTMLSelectElement;
  sel.innerHTML = `<option value="">Standard (bien accordé)</option>` + list.map((p) => {
    const n = Object.keys(p.keys).length, total = p.hi - p.lo + 1;
    return `<option value="${esc(p.id)}"${p.id === cur ? " selected" : ""}>${esc(p.name)}${n < total ? ` (${n}/${total})` : ""}</option>`;
  }).join("");
  ($("pianoManage") as HTMLButtonElement).disabled = !cur;
  const bad = st === "denied" || st === "error" || st === "nodevice" || st === "unsupported" || (st === "off" && mode === "mic");
  $("micState").textContent = mic.status.detail;
  $("micState").classList.toggle("bad", bad && st !== "off");
  $("micRetry").classList.toggle("hidden", !bad || st === "unsupported");
  document.querySelectorAll<HTMLElement>("#micSens button").forEach((b) => b.classList.toggle("on", Number(b.dataset.sens) === sensitivity()));
}

/** Vumètres (réglages, assistant) tant que le micro est ouvert. */
let metering = false;
function startMeter() {
  if (metering) return;
  metering = true;
  const tick = () => {
    if (!mic.open) { metering = false; for (const id of ["micLevel", "mwLevel"]) { const el = document.getElementById(id); if (el) el.style.width = "0"; } return; }
    const pct = Math.max(0, Math.min(100, ((mic.level + 66) / 56) * 100)).toFixed(1) + "%";
    for (const id of ["micLevel", "mwLevel"]) { const el = document.getElementById(id); if (el) el.style.width = pct; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ───────────── assistant : ajouter, calibrer, gérer, tester ─────────────
type Page = "new" | "noise" | "key" | "done" | "manage" | "pick" | "test";
interface Wiz {
  page: Page;
  piano: P.PianoProfile | null;
  /** touches qui restent à jouer, combien la série en comptait, et celle en cours */
  queue: number[]; total: number; key: number;
  /** frappes retenues pour la touche en cours, frappes qui sonnaient comme une autre note */
  takes: TakeResult[]; off: { take: Take; heard: number; cents: number }[];
  /** frappe la plus forte de la touche (les battements qui suivent sont bien plus faibles) */
  maxFlux: number;
  /** la touche en cours vient d'être réglée : les frappes en trop, le temps de passer à la suivante, sont ignorées */
  settled: boolean;
  /** « cette touche sonne ainsi » : on cherche autour de ce qu'on a entendu */
  force: { expect: number; search: number } | null;
  noiseDb: number;
  fb: string; fbCls: "" | "ok" | "bad" | "warn";
  kbd: MiniKeyboard | null;
  heard: number[]; heardAt: number;
  /** micro ouvert avant l'assistant (sinon on le referme en sortant) */
  wasOpen: boolean;
  timer: number | undefined;
  lastFocus: Element | null;
}
let wiz: Wiz | null = null;

function openWizard(page: Page, piano: P.PianoProfile | null = null) {
  wiz = { page, piano, queue: [], total: 0, key: 0, takes: [], off: [], maxFlux: 0, settled: false, force: null, noiseDb: -70, fb: "", fbCls: "", kbd: null, heard: [], heardAt: 0, wasOpen: mic.open, timer: undefined, lastFocus: document.activeElement };
  $("settingsPanel").classList.add("closed");
  $("micWizard").classList.remove("hidden");
  mic.sink = wizNote;
  go(page);
}
function closeWizard() {
  const w = wiz; if (!w) return;
  clearTimeout(w.timer);
  mic.setCapture(null);
  mic.sink = host.onNote;
  if (!w.wasOpen && inputMode() !== "mic") mic.stop();
  wiz = null;
  $("micWizard").classList.add("hidden");
  applyPiano(); renderSection(); host.onChange();
  (w.lastFocus as HTMLElement | null)?.focus?.();
}

function go(page: Page) {
  const w = wiz!; clearTimeout(w.timer);
  w.page = page;
  mic.setCapture(page === "key" ? onTake : null);
  if (page === "test") mic.setModels(P.modelsFor(w.piano), P.isCalibrated(w.piano));
  render();
  if (page === "noise") void measureNoise();
  if (page === "test" || page === "key") void mic.start().then(() => { startMeter(); render(); });
}

function render() {
  const w = wiz; if (!w) return;
  const box = $("mwBox");
  box.innerHTML = PAGES[w.page](w);
  w.kbd = null;
  const kb = box.querySelector("#mwKbd") as HTMLElement | null;
  if (kb) {
    w.kbd = new MiniKeyboard(kb, () => {});
    if (w.page === "key") { w.kbd.setRange(Math.max(21, w.key - 6), Math.min(108, w.key + 6)); w.kbd.showNames(true); w.kbd.mark(w.key, "target"); }
    else {
      // page de test : autant d'octaves que la largeur en laisse lisibles (sur un téléphone, le médium seulement)
      const width = kb.clientWidth, [lo, hi] = width < 520 ? [48, 84] : width < 800 ? [36, 96] : w.piano ? [w.piano.lo, w.piano.hi] : [21, 108];
      w.kbd.setRange(lo, hi, false); w.kbd.showNames(true);
    }
  }
  const first = box.querySelector<HTMLElement>("[autofocus]") ?? box.querySelector<HTMLElement>(".mw-btns .pri");
  first?.focus();
}
/** Nouvelle série de touches à calibrer (après la mesure du bruit). */
function startQueue(keys: number[]) { const w = wiz!; w.queue = keys; w.total = keys.length; w.key = 0; go("noise"); }

const head = (title: string, close = "close") => `<div class="mw-head"><h2 id="mwTitle">${title}</h2><button class="mw-x" data-mw="${close}" aria-label="Fermer">✕</button></div>`;
const micLine = () => (mic.listening ? "" : `<p class="mw-fb warn">${esc(mic.status.detail)}${mic.status.state === "denied" || mic.status.state === "error" || mic.status.state === "off" ? ` <button class="sf-btn" data-mw="retry">Réessayer</button>` : ""}</p>`);
const minutes = (keys: number, takes: number) => Math.max(1, Math.round((keys * (takes * 1.6 + 2)) / 60));
function where(m: number): string {
  if (m === 21) return "la touche la plus à gauche du piano";
  if (m === 108) return "la touche la plus à droite du piano";
  if (m === 60) return "le Do du milieu";
  return [1, 3, 6, 8, 10].includes(m % 12) ? "touche noire" : "touche blanche";
}

const PAGES: Record<Page, (w: Wiz) => string> = {
  new: () => {
    const n = P.listPianos().length;
    return `${head("Ajouter un piano")}
      <p class="mw-text">L'appli va écouter ton piano touche par touche pour apprendre le son exact de chacune. C'est indispensable s'il n'est pas accordé (ou accordé plus bas que le La 440), et la reconnaissance devient plus sûre sur n'importe quel piano.</p>
      <label class="mw-field">Nom<input type="text" id="mwName" maxlength="60" value="${n ? `Piano ${n + 1}` : "Mon piano"}" autofocus /></label>
      <label class="mw-field">Touches à calibrer<select id="mwRange">${RANGES.map((r, i) => `<option value="${i}">${r.label}</option>`).join("")}</select></label>
      <label class="mw-field">Frappes par touche<select id="mwTakes"><option value="2">2</option><option value="3" selected>3 (conseillé)</option><option value="5">5 (le plus précis)</option></select></label>
      <p class="mw-small"><span id="mwEta">Compte environ ${minutes(88, 3)} minutes.</span> Pose l'appareil près du piano, dans une pièce calme. Tu peux t'arrêter quand tu veux : chaque touche est gardée, tu reprendras plus tard.</p>
      <div class="mw-btns"><button class="sf-btn" data-mw="close">Annuler</button><button class="sf-btn pri" data-mw="create">Commencer</button></div>`;
  },
  noise: (w) => `${head("Un peu de silence", "manage")}
    <p class="mw-text">Ne joue rien pendant deux secondes : je mesure le bruit de la pièce.</p>
    <div class="mic-meter big"><i id="mwLevel"></i></div>
    <p class="mw-fb ${w.fbCls}">${w.fb}</p>${micLine()}`,
  key: (w) => {
    const p = w.piano!, total = Math.max(1, w.total), done = Math.max(0, total - w.queue.length - 1);
    return `<div class="mw-head"><div class="mw-prog"><b>${done + 1} / ${total}</b><div class="sf-pbar"><i style="width:${(done / total) * 100}%"></i></div></div><button class="mw-x" data-mw="pause" aria-label="Mettre en pause">✕</button></div>
      <div class="mw-key"><b>${fr(w.key)}</b><small>${where(w.key)}</small></div>
      <div class="mw-strip" aria-hidden="true"><i style="left:${((w.key - 21) / 87) * 100}%"></i></div>
      <p class="mw-text center">Joue-la <b>${p.takes} fois</b>, normalement, en la laissant sonner une seconde à chaque fois.</p>
      <div class="cs-dots" aria-label="${w.takes.length} frappe(s) sur ${p.takes}">${Array.from({ length: p.takes }, (_, i) => `<i class="${i < w.takes.length ? "ok" : ""}"></i>`).join("")}</div>
      <p class="mw-fb ${w.fbCls}" id="mwFb" aria-live="polite">${w.fb}</p>${micLine()}
      <div class="mic-meter"><i id="mwLevel"></i></div>
      <div class="sf-kbd mw-kbd" id="mwKbd"></div>
      <div class="mw-btns"><button class="sf-btn" data-mw="skip" title="Touche cassée ou muette : on n'en tiendra pas compte">Passer</button><button class="sf-btn" data-mw="redo" title="Oublier les frappes de cette touche et recommencer">Recommencer</button><button class="sf-btn" data-mw="pause">Pause</button></div>`;
  },
  done: (w) => {
    const p = w.piano!, n = Object.keys(p.keys).length, todo = P.keysToDo(p).length;
    return `${head(todo ? "Calibrage en pause" : "Ton piano est prêt")}
      <p class="mw-text">${n} touche${n > 1 ? "s" : ""} réglée${n > 1 ? "s" : ""}${p.skipped.length ? `, ${p.skipped.length} passée${p.skipped.length > 1 ? "s" : ""}` : ""}${todo ? `, ${todo} à faire` : ""}. ${tuningText(p)}</p>
      ${chart(p)}
      <p class="mw-small">Chaque barre montre l'écart d'une touche au diapason (La 440 Hz). Un accordeur les ramènerait toutes à zéro ; l'appli, elle, reconnaît ton piano tel qu'il est.</p>
      <div class="mw-btns"><button class="sf-btn" data-mw="test">Tester la reconnaissance</button><button class="sf-btn pri" data-mw="close">Terminer</button></div>`;
  },
  manage: (w) => {
    const p = w.piano!, n = Object.keys(p.keys).length, total = p.hi - p.lo + 1, todo = P.keysToDo(p).length;
    return `${head("Réglages du piano")}
      <label class="mw-field">Nom<input type="text" id="mwRename" maxlength="60" value="${esc(p.name)}" /></label>
      <p class="mw-text">${fr(p.lo)} → ${fr(p.hi)} : ${n}/${total} touches réglées${p.skipped.length ? `, ${p.skipped.length} passée${p.skipped.length > 1 ? "s" : ""}` : ""}. ${tuningText(p)}</p>
      ${chart(p)}
      <div class="mw-btns col">
        ${todo ? `<button class="sf-btn pri" data-mw="resume">Continuer le calibrage (${todo} touche${todo > 1 ? "s" : ""}, ~${minutes(todo, p.takes)} min)</button>` : ""}
        <button class="sf-btn" data-mw="pick">Recalibrer une touche</button>
        <button class="sf-btn" data-mw="all">Tout recalibrer</button>
        <button class="sf-btn" data-mw="test">Tester la reconnaissance</button>
        <button class="sf-btn danger" data-mw="delete">Supprimer ce piano</button>
      </div>`;
  },
  pick: (w) => {
    const p = w.piano!, cents = P.centsMap(p), opts: string[] = [];
    for (let m = p.lo; m <= p.hi; m++) opts.push(`<option value="${m}"${m === (w.key || 60) ? " selected" : ""}>${fr(m)} — ${cents.has(m) ? `${signed(cents.get(m)!)} cents` : p.skipped.includes(m) ? "passée" : "pas encore réglée"}</option>`);
    return `${head("Recalibrer une touche", "manage")}
      <p class="mw-text">Une touche mal reconnue, ou que l'accordeur vient de retoucher ? Choisis-la, puis joue-la ${p.takes} fois.</p>
      <label class="mw-field">Touche<select id="mwPick" autofocus>${opts.join("")}</select></label>
      <div class="mw-btns"><button class="sf-btn" data-mw="manage">Retour</button><button class="sf-btn pri" data-mw="pickgo">Recalibrer</button></div>`;
  },
  test: (w) => `${head("Tester la reconnaissance", w.piano && w.piano.id !== P.activePianoId() ? "manage" : "close")}
    <p class="mw-text">Joue des notes, puis des accords : ce que l'appli entend s'allume. Piano : <b>${w.piano ? esc(w.piano.name) : "standard (bien accordé)"}</b>.</p>
    <div class="mw-heard" id="mwHeard" aria-live="polite">${w.heard.length ? w.heard.map(fr).join(" · ") : "…"}</div>${micLine()}
    <div class="mic-meter"><i id="mwLevel"></i></div>
    <div class="sf-kbd mw-kbd tall" id="mwKbd"></div>
    <div class="mw-btns"><button class="sf-btn pri" data-mw="close">Fermer</button></div>`,
};

function tuningText(p: P.PianoProfile): string {
  const t = P.tuningSummary(p);
  if (!t.n) return "";
  const mean = Math.round(t.mean), avg = Math.abs(mean) < 6 ? "Il est bien accordé par rapport au diapason (La 440)." : `En moyenne, il est ${Math.abs(mean)} cents plus ${mean < 0 ? "bas" : "haut"} que le diapason (La 440).`;
  let worst = "";
  if (Math.abs(t.worst - t.mean) >= 15) for (const [m, c] of P.centsMap(p)) if (c === t.worst) worst = ` La touche la plus éloignée : ${fr(m)} (${signed(c)} cents).`;
  return avg + worst;
}

/** Écart au diapason de chaque touche réglée, en barres (±100 cents = un demi-ton). */
function chart(p: P.PianoProfile): string {
  const cs = P.centsMap(p); if (!cs.size) return "";
  const W = 880, H = 150, mid = H / 2, x = (m: number) => 34 + ((m - 21) / 87) * (W - 44), y = (c: number) => (Math.max(-100, Math.min(100, c)) / 100) * (mid - 14);
  const bars = [...cs].map(([m, c]) => {
    const a = Math.abs(c), cls = a <= 10 ? "ok" : a <= 30 ? "mid" : "bad", h = Math.max(1.5, Math.abs(y(c)));
    return `<rect class="${cls}" x="${(x(m) - 3.5).toFixed(1)}" y="${(c >= 0 ? mid - h : mid).toFixed(1)}" width="7" height="${h.toFixed(1)}" rx="1.5"><title>${fr(m)} : ${signed(c)} cents</title></rect>`;
  }).join("");
  const lab = [21, 48, 60, 72, 108].map((m) => `<text x="${x(m).toFixed(1)}" y="${H - 1}" text-anchor="middle">${fr(m)}</text>`).join("");
  return `<svg class="mw-chart" viewBox="0 0 ${W} ${H + 12}" role="img" aria-label="Écart de chaque touche au diapason, en cents">
    <line x1="30" x2="${W - 6}" y1="${mid}" y2="${mid}" /><text x="0" y="16">+100</text><text x="0" y="${mid + 4}">0</text><text x="0" y="${H - 14}">−100</text>${bars}${lab}</svg>`;
}

function feedback(html: string, cls: Wiz["fbCls"]) {
  const w = wiz; if (!w) return;
  w.fb = html; w.fbCls = cls;
  const el = document.getElementById("mwFb");
  if (el) { el.innerHTML = html; el.className = "mw-fb " + cls; }
}

/** Bruit de la pièce : niveau médian du micro pendant deux secondes de silence. */
async function measureNoise() {
  const w = wiz!;
  if (!(await mic.start())) { render(); return; }
  startMeter();
  if (!mic.listening) { feedback("Touche l'écran pour que le micro démarre.", "warn"); await new Promise<void>((r) => { const t = setInterval(() => { if (mic.listening || wiz !== w) { clearInterval(t); r(); } }, 100); }); }
  const levels: number[] = [];
  await new Promise<void>((r) => { const t = setInterval(() => { if (wiz !== w || w.page !== "noise") { clearInterval(t); r(); return; } levels.push(mic.level); if (levels.length >= 20) { clearInterval(t); r(); } }, 100); });
  if (wiz !== w || w.page !== "noise") return;
  levels.sort((a, b) => a - b);
  w.noiseDb = levels[levels.length >> 1] ?? -70;
  if (w.noiseDb > -42) {
    feedback(`La pièce est bruyante (ou le micro très sensible) : le calibrage sera moins précis. Éloigne les bruits, ou continue quand même. <button class="sf-btn" data-mw="noise">Mesurer à nouveau</button> <button class="sf-btn pri" data-mw="next">Continuer</button>`, "warn");
    return;
  }
  feedback(`${icon("check")} Pièce calme.`, "ok");
  w.timer = window.setTimeout(nextKey, 600);
}

/** Touche suivante à calibrer (ou le bilan quand il n'y en a plus). */
function nextKey() {
  const w = wiz; if (!w || !w.piano) return;
  const p = w.piano, m = w.queue.shift();
  if (m === undefined) { P.setActivePiano(p.id); go("done"); return; }
  Object.assign(w, { key: m, takes: [], off: [], force: null, maxFlux: 0, settled: false, fb: "", fbCls: "" });
  go("key");
}
function toManage() { const w = wiz!; if (w.piano) go("manage"); else closeWizard(); }

/** Une frappe brute pendant le calibrage d'une touche. */
function onTake(t: Take) {
  const w = wiz; if (!w || w.page !== "key" || !w.piano || w.settled) return;
  if (t.flux < w.maxFlux * 0.3) return;                     // battement ou résonance qui suit une frappe : pas une nouvelle frappe
  const m = w.key, ex = w.force ?? expectFor(m, P.centsMap(w.piano));
  const r = analyzeTake(t.samples, t.sr, m, { ...ex, window: WINDOW_S, noiseDb: w.noiseDb });
  if (r.ok) { w.maxFlux = Math.max(w.maxFlux, t.flux); accept([r]); return; }
  if (r.reason === "faint") { if (t.level > w.noiseDb + 10) feedback("Un peu faible : joue la touche normalement, et laisse-la sonner.", "warn"); return; }
  if (r.reason === "unclear") { feedback("Son pas assez net : rejoue-la, sans toucher aux autres touches.", "warn"); return; }
  w.off.push({ take: t, heard: r.heard!, cents: r.heardCents ?? 0 }); if (w.off.length > 4) w.off.shift();
  const same = w.off.length >= 2 && w.off[w.off.length - 2].heard === r.heard;
  feedback(`J'entends plutôt un <b>${fr(r.heard!)}</b> : vérifie que tu joues bien le ${fr(m)}.`
    + (same ? `<br><button class="sf-btn" data-mw="keepoff">C'est bien le ${fr(m)} : il sonne ainsi, le garder</button>` : ""), "bad");
}
/** Frappes valides : la touche est réglée dès qu'il y en a assez qui concordent. */
function accept(rs: TakeResult[]) {
  const w = wiz!, p = w.piano!, m = w.key, before = w.takes.length;
  const c = combineTakes([...w.takes, ...rs], p.takes);
  w.takes = c.keep;
  if (c.done) {
    w.settled = true;
    P.setKey(p, m, c.done); P.savePiano(p);
    const cents = centsFrom(m, c.done.f0);
    w.takes = Array.from({ length: p.takes }, () => rs[0]);
    render();
    feedback(`${icon("check")} ${fr(m)} : c'est noté${Math.abs(cents) >= 5 ? ` (${signed(cents)} cents)` : ""}.`, "ok");
    w.timer = window.setTimeout(nextKey, 700);
    return;
  }
  render();
  if (c.keep.length < before + rs.length) feedback("Une frappe ne ressemble pas aux autres : encore une fois, s'il te plaît.", "warn");
  else feedback(`${icon("check")} ${c.keep.length} / ${p.takes}`, "ok");
}

function wizNote(pitch: number, _vel: number, on: boolean) {
  const w = wiz; if (!w || w.page !== "test" || !w.kbd) return;
  if (!on) { w.kbd.unmark(pitch); return; }
  const now = performance.now();
  if (now - w.heardAt > 160) w.heard = [];
  w.heardAt = now;
  if (!w.heard.includes(pitch)) w.heard.push(pitch);
  w.heard.sort((a, b) => a - b);
  w.kbd.mark(pitch, "ok");
  const el = document.getElementById("mwHeard"); if (el) el.textContent = w.heard.map(fr).join(" · ");
}

function onWizardChange(e: Event) {
  const w = wiz, t = e.target as HTMLElement; if (!w) return;
  if (t.id === "mwRename" && w.piano) {
    w.piano.name = (t as HTMLInputElement).value.trim().slice(0, 60) || w.piano.name;
    P.savePiano(w.piano); renderSection(); host.onChange();
  }
  if (t.id === "mwRange" || t.id === "mwTakes") {
    const r = RANGES[Number(($("mwRange") as HTMLSelectElement).value)] ?? RANGES[0], k = Number(($("mwTakes") as HTMLSelectElement).value) || 3;
    const eta = document.getElementById("mwEta");
    if (eta) eta.textContent = `Compte environ ${minutes(r.hi - r.lo + 1, k)} minutes.`;
  }
}

function onWizardClick(e: Event) {
  const w = wiz; if (!w) return;
  const b = (e.target as HTMLElement).closest("[data-mw]") as HTMLElement | null; if (!b) return;
  const a = b.dataset.mw!, p = w.piano;
  switch (a) {
    case "close": closeWizard(); break;
    case "retry": void mic.start().then(() => { startMeter(); render(); if (w.page === "noise") void measureNoise(); }); break;
    case "create": {
      const name = ($("mwName") as HTMLInputElement).value, r = RANGES[Number(($("mwRange") as HTMLSelectElement).value)] ?? RANGES[0];
      const piano = P.newPiano(name, r.lo, r.hi, Number(($("mwTakes") as HTMLSelectElement).value) || 3);
      P.savePiano(piano); P.setActivePiano(piano.id);
      w.piano = piano;
      renderSection(); host.onChange();
      startQueue(P.keysToDo(piano));
      break;
    }
    case "noise": go("noise"); break;
    case "next": nextKey(); break;
    case "manage": go("manage"); break;
    case "pause": toManage(); break;
    // touche cassée ou muette : on ne la redemandera plus (une touche déjà réglée, qu'on recalibrait, garde son réglage)
    case "skip": if (p && !w.settled) { if (!p.keys[w.key] && !p.skipped.includes(w.key)) { p.skipped.push(w.key); P.savePiano(p); } nextKey(); } break;
    case "redo": if (!w.settled) { Object.assign(w, { takes: [], off: [], force: null, maxFlux: 0, fb: "", fbCls: "" }); render(); } break;
    case "keepoff": {
      const last = w.off[w.off.length - 1]; if (!last) break;
      w.force = { expect: last.cents, search: 40 };            // on cherche autour de ce qu'on a entendu
      const rs = w.off.map((o) => analyzeTake(o.take.samples, o.take.sr, w.key, { ...w.force!, window: WINDOW_S, noiseDb: w.noiseDb })).filter((r) => r.ok);
      w.off = [];
      if (rs.length) accept(rs); else feedback("D'accord : joue-la encore, je l'écoute telle qu'elle sonne.", "warn");
      break;
    }
    case "resume": if (p) startQueue(P.keysToDo(p)); break;
    case "all": if (p && confirm(`Recalibrer les ${p.hi - p.lo + 1} touches de « ${p.name} » ? Les réglages actuels seront remplacés au fur et à mesure.`)) {
      p.skipped = []; P.savePiano(p);
      startQueue(Array.from({ length: p.hi - p.lo + 1 }, (_, i) => p.lo + i));
    } break;
    case "pick": go("pick"); break;
    case "pickgo": if (p) startQueue([Number(($("mwPick") as HTMLSelectElement).value)]); break;
    case "test": go("test"); break;
    case "delete": if (p && confirm(`Supprimer « ${p.name} » et tout son calibrage ?`)) { P.deletePiano(p.id); closeWizard(); } break;
  }
}
