/** Onglet Morceaux : le répertoire intégré, par groupe, et les partitions de l'utilisateur. */
import * as Coach from "../coach";
import { repXml, repFileName, repById, repOfLevel, REPERTOIRE, SONGS, type RepPiece } from "../repertoire";
import { getStats, getAll } from "../stats";
import { listLibrary, toggleFavorite, removeFromLibrary, renameSong } from "../library";
import { LEVEL_LABEL } from "../difficulty";
import { xmlDifficulty } from "../difficultyXml";
import { repLevel } from "../today";
import { LESSONS } from "../course/curriculum";
import { esc } from "../html";
import { icon } from "../icons";
import { $, toast, cleanName } from "./dom";
import type { OpenFile, OpenOpts, ViewName } from "./types";

const app: { openFile: OpenFile } = { openFile: async () => {} };
const repByFile = (name: string) => REPERTOIRE.find((p) => repFileName(p) === name);

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
export async function openByName(name: string, o: OpenOpts): Promise<boolean> {
  const p = repByFile(name);
  if (p) { await app.openFile(new File([repXml(p)], repFileName(p), { type: "application/xml" }), { library: false, ...o }); return true; }
  const e = (await listLibrary()).find((x) => x.name === name);
  if (!e) { toast("Ce morceau n'est plus dans la bibliothèque"); return false; }
  await app.openFile(new File([e.fileData], e.name), o); return true;
}
export function openRepertoire(id: string, withCoach: boolean, back: ViewName = "library") {
  const p = repById(id); if (!p) return;
  void app.openFile(new File([repXml(p)], repFileName(p), { type: "application/xml" }), { library: false, coach: withCoach, back, tag: "piece" });
}
export async function renderLibraryHome() {
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
      <div class="rep-btns"><button class="btn clay primary" data-rep="${p.id}" data-coach="1" title="${esc(p.tip)}">${icon("target")} Apprendre</button><button class="btn clay" data-rep="${p.id}">▶ Jouer</button></div></div>`;
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
          <span style="display:flex;gap:6px;flex:none;margin-left:8px"><button class="mini-btn edit-btn" title="Renommer" aria-label="Renommer">${icon("pencil")}</button><button class="mini-btn danger song-del" title="Supprimer" aria-label="Supprimer">${icon("trash-2")}</button></span>
        </div>
        <div class="song-meta">${diffChip(Math.min(5, Math.max(1, e.difficulty || 1)), e.why)}</div>
        <div class="rep-bar"><i style="width:${Math.max(cpct, (st?.bestRhythm ?? 0) >= 90 ? 100 : 0)}%"></i></div>
        ${(st?.bestRhythm ?? 0) >= 90 ? `<span class="rep-ok">✓ maîtrisé (${st!.bestRhythm} %)</span>` : cpct ? `<span class="rep-prog">coach ${cpct} %</span>` : `<span class="rep-prog muted">pas encore commencé</span>`}
        <div class="rep-btns"><button class="btn clay primary coach-btn" title="Apprendre avec le coach : section par section, mains séparées puis ensemble, puis en rythme">${icon("target")} Apprendre</button><button class="btn clay play-btn">▶ Jouer</button></div>
      </div>`;
    const open = (coach = false) => app.openFile(new File([e.fileData || (e as any).xml], e.name), { coach, tag: "piece" });
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

export function initLibraryView(h: { openFile: OpenFile }) {
  app.openFile = h.openFile;
  $("libSeg").addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest("[data-lib]") as HTMLElement | null;
    if (b) { libGroup = b.dataset.lib as LibGroup; void renderLibraryHome(); }
  });
  $("repGrid").addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest("[data-rep]") as HTMLElement | null;
    if (b) openRepertoire(b.dataset.rep!, b.dataset.coach === "1");
  });
}
