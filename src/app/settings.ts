/** Panneau Réglages (thème, sauvegarde, son, ma main) et ouverture d'un fichier. Les réglages qui pilotent la vue de jeu
 *  (noms des notes, doigtés, son des touches) restent dans main.ts, avec l'état qu'ils modifient. */
import type { Synth } from "../audio";
import { exportBackup, importBackup } from "../backup";
import { loadHand, saveHand } from "../hand";
import { readStr, writeStr } from "../storage";
import { $, toast } from "./dom";
import type { OpenFile } from "./types";

export function initSettings(host: { synth: Synth; openFile: OpenFile; recomputeFingering: () => void }) {
  $("toggleSettings").addEventListener("click", () => $("settingsPanel").classList.toggle("closed"));
  $("closeSettings").addEventListener("click", () => $("settingsPanel").classList.add("closed"));
  // thème : clair, sombre, ou celui de l'appareil (« Auto ») ; appliqué dès le chargement par le script en tête de page
  {
    const KEY = "pianoflow-theme", media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const t = readStr(KEY, "") || "auto";
      if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
      const dark = t === "dark" || (t === "auto" && media.matches);
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#1c1f26" : "#ffffff");
      document.querySelectorAll<HTMLElement>("#themeSeg button").forEach((b) => b.classList.toggle("on", b.dataset.theme === t));
    };
    $("themeSeg").addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("[data-theme]") as HTMLElement | null; if (!b) return;
      writeStr(KEY, b.dataset.theme!);
      apply();
    });
    media.addEventListener?.("change", apply);
    apply();
  }
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
  // ── son ──
  ($("volume") as HTMLInputElement).addEventListener("input", (e) => (host.synth.volume = Number((e.target as HTMLInputElement).value) / 100));
  const metroBox = $("metro") as HTMLInputElement, bpmBox = $("bpm") as HTMLInputElement;
  const applyMetro = () => { if (metroBox.checked) host.synth.startMetronome(Math.max(40, Math.min(220, Number(bpmBox.value) || 80))); else host.synth.stopMetronome(); };
  metroBox.addEventListener("change", applyMetro); bpmBox.addEventListener("change", applyMetro);
  // ── ouvrir une partition ──
  $("file").addEventListener("change", (e) => {
    const input = e.target as HTMLInputElement; const f = input.files?.[0]; input.value = "";
    if (!f) return;
    if (/\.(pdf|png|jpe?g)$/i.test(f.name)) { pdfHelp(); return; }
    if (/\.(mid|midi)$/i.test(f.name)) { alert("Un fichier MIDI ne contient pas la partition (portées, mesures, doigtés).\nOuvre-le dans MuseScore (gratuit), puis Fichier → Exporter → MusicXML, et importe ce fichier ici."); return; }
    void host.openFile(f);
  });
  /** Une partition en PDF ou en photo : comment la transformer en MusicXML. */
  function pdfHelp() {
    alert("PianoFlow lit les partitions MusicXML (.musicxml, .mxl), pas les PDF ni les photos.\n\nPour convertir un PDF :\n1. MuseScore 4 (gratuit) : Fichier → Importer un PDF (service gratuit musescore.com), puis Fichier → Exporter → MusicXML.\n2. Ou Audiveris (gratuit, hors ligne) : ouvre le PDF, puis Exporter en MusicXML.\n3. Vérifie la partition obtenue (la reconnaissance fait parfois des erreurs), puis importe le fichier .mxl ici.\n\nAstuce : beaucoup de partitions gratuites existent déjà en MusicXML sur musescore.com et sur le Mutopia Project.");
  }
  $("homeOpenBtn2").addEventListener("click", () => $("file").click());
  // ── ma main ──
  {
    const span = $("handSpan") as HTMLInputElement, thumb = $("handThumb") as HTMLInputElement;
    const paint = () => {
      const h = loadHand();
      span.value = String(h.span); thumb.value = h.thumbIndex ? String(h.thumbIndex) : "";
      document.querySelectorAll<HTMLElement>("#handPresets button").forEach((b) => b.classList.toggle("on", Number(b.dataset.span) === h.span && !h.thumbIndex));
    };
    const apply = () => {
      saveHand({ span: Number(span.value), thumbIndex: thumb.value ? Number(thumb.value) : undefined });
      paint(); host.recomputeFingering();
    };
    span.addEventListener("change", apply); thumb.addEventListener("change", apply);
    $("handPresets").addEventListener("click", (e) => { const b = (e.target as HTMLElement).closest("button"); if (b) { span.value = b.dataset.span!; thumb.value = ""; apply(); } });
    paint();
  }
}
