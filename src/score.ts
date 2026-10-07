import createVerovioModule from "verovio/wasm";
import { VerovioToolkit } from "verovio/esm";
import { unzipSync, strFromU8 } from "fflate";
import localforage from "localforage";

export interface Note { id: string; pitch: number; hand: "R" | "L"; finger?: number; showFinger?: boolean; onTime: number; offTime: number; /** position en noires depuis le début (sert à retrouver les doigtés écrits) */ q?: number; /** n° de mesure (à partir de 0) */ measure?: number; }
export interface Step { time: number; notes: Note[]; }
export interface MeasureStart { id: string; t: number; }

let tk: VerovioToolkit | null = null;
const svgCache = localforage.createInstance({ name: "pianoflow-svg" });
/** Empreinte rapide d'un texte (FNV-1a). */
function hash(s: string): string { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36) + s.length.toString(36); }
async function storeSvg(key: string, svg: string) {
  try {
    await svgCache.setItem(key, svg);
    const idx = ((await svgCache.getItem<string[]>("_index")) ?? []).filter((k) => k !== key); idx.push(key);
    while (idx.length > 25) await svgCache.removeItem(idx.shift()!);   // les 25 derniers morceaux ouverts
    await svgCache.setItem("_index", idx);
  } catch { /* cache plein : tant pis */ }
}
async function getToolkit() {
  if (!tk) tk = new VerovioToolkit(await createVerovioModule());
  return tk;
}

export interface Meter { tempo: number; beats: number; beatType: number; }

/** Liaisons de prolongation : note d'arrivée → note de départ. La « timemap » de Verovio compte la note d'arrivée
 *  comme une nouvelle attaque ; elle ne doit pas être rejouée, seulement prolonger la première. */
export function tieEnds(toolkit: VerovioToolkit): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of toolkit.getMEI({}).matchAll(/<tie\b[^>]*>/g)) {
    const st = /startid="#([^"]+)"/.exec(m[0])?.[1], en = /endid="#([^"]+)"/.exec(m[0])?.[1];
    if (st && en) out.set(en, st);
  }
  return out;
}
export async function loadScore(file: File): Promise<{ svg: string; steps: Step[]; rawFile: ArrayBuffer; measureStarts: MeasureStart[]; xmlText: string; meter: Meter }> {
  const toolkit = await getToolkit();
  toolkit.resetOptions(); // le solfège partage ce moteur : on repart d'options propres
  
  // NOUVELLES OPTIONS : Rognage parfait, pas d'espaces blancs, centrage automatique
  toolkit.setOptions({ 
    scale: 45, 
    pageWidth: 60000, 
    pageHeight: 2500, // Assez grand pour ne rien couper en bas
    adjustPageWidth: true, 
    adjustPageHeight: true, // Demande à Verovio de rogner exactement à la taille de la musique
    breaks: "none", 
    header: "none", 
    footer: "none",
    pageMarginTop: 0, // Supprime le blanc inutile en haut
    pageMarginBottom: 10,
    mnumInterval: 1, // numéro de chaque mesure (repère pour les boucles)
    xmlIdSeed: 1, // identifiants stables : la partition dessinée peut être mise en cache et réutilisée
  });

  const isMxl = file.name.toLowerCase().endsWith(".mxl");
  const rawFile = await file.arrayBuffer(); // On sauvegarde le binaire brut pour la bibliothèque !
  
  let xmlText = "";
  if (isMxl) { try { xmlText = mxlToXml(rawFile); } catch { xmlText = ""; } }
  else xmlText = new TextDecoder().decode(rawFile);
  if (xmlText) {
    // le nom de l'instrument (« Piano ») prend de la place à gauche de la portée et ne sert à rien ici
    toolkit.loadData(xmlText.replace(/<part-name[^>]*>[^<]*<\/part-name>/g, '<part-name print-object="no"/>').replace(/<part-abbreviation[^>]*>[^<]*<\/part-abbreviation>/g, ""));
  } else toolkit.loadZipDataBuffer(rawFile);
  
  // dessiner une longue partition coûte (1 à 3 s sur iPad) : le dessin est gardé en cache, par contenu
  const cacheKey = xmlText ? `v1:${hash(xmlText)}` : "";
  let svg = cacheKey ? await svgCache.getItem<string>(cacheKey).catch(() => null) : null;
  if (!svg) { svg = toolkit.renderToSVG(1); if (cacheKey) void storeSvg(cacheKey, svg); }
  const timemap = toolkit.renderToTimemap({ includeMeasures: true }) as { tstamp: number; qstamp?: number; tempo?: number; on?: string[]; off?: string[]; measureOn?: string }[];
  const measureStarts: MeasureStart[] = [];
  const onTimes = new Map<string, number>();
  const steps: Step[] = [];
  const noteById = new Map<string, Note>();
  
  const ties = tieEnds(toolkit);
  for (const entry of timemap) {
    if (entry.measureOn) measureStarts.push({ id: entry.measureOn, t: entry.tstamp });
    if (entry.on?.length) {
      const notes: Note[] = [];
      for (const id of entry.on) {
        // note liée : pas d'attaque, elle prolonge la note de départ (sa fin repoussera celle de la première)
        const from = ties.get(id), first = from ? noteById.get(from) : undefined;
        if (first) { noteById.set(id, first); continue; }
        const info = toolkit.getMIDIValuesForElement(id) as { pitch?: number };
        if (info?.pitch === undefined) continue;
        onTimes.set(id, entry.tstamp);
        const note: Note = { id, pitch: info.pitch, hand: "R", onTime: entry.tstamp, offTime: entry.tstamp + 500, q: entry.qstamp };
        notes.push(note); noteById.set(id, note);
      }
      if (notes.length) steps.push({ time: entry.tstamp, notes });
    }
    if (entry.off?.length) for (const id of entry.off) { const n = noteById.get(id); if (n) n.offTime = entry.tstamp; }
  }
  // n° de mesure de chaque note (boucles, mesures à revoir)
  const starts = measureStarts.map((m) => m.t);
  for (const st of steps) {
    let lo = 0, hi = starts.length - 1, m = 0;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (starts[mid] <= st.time + 1) { m = mid; lo = mid + 1; } else hi = mid - 1; }
    for (const n of st.notes) n.measure = m;
  }
  const tempo = timemap.find((e) => e.tempo)?.tempo;
  const ts = /<time[^>]*>\s*<beats>(\d+)<\/beats>\s*<beat-type>(\d+)<\/beat-type>/.exec(xmlText);
  const meter: Meter = { tempo: tempo && tempo > 0 ? tempo : 120, beats: ts ? parseInt(ts[1], 10) : 4, beatType: ts ? parseInt(ts[2], 10) : 4 };
  return { svg, steps, rawFile, measureStarts, xmlText, meter };
}

/** .mxl = zip ; META-INF/container.xml désigne le fichier MusicXML principal. */
function mxlToXml(buf: ArrayBuffer): string {
  const files = unzipSync(new Uint8Array(buf));
  const container = files["META-INF/container.xml"];
  let root = container ? /full-path="([^"]+)"/.exec(strFromU8(container))?.[1] : undefined;
  if (!root || !files[root]) root = Object.keys(files).find((k) => /\.(xml|musicxml)$/i.test(k) && !k.startsWith("META-INF"));
  return root ? strFromU8(files[root]) : "";
}

export function annotateHands(steps: Step[]) {
  for (const s of steps) for (const n of s.notes) {
    const staff = document.getElementById(n.id)?.closest(".staff");
    const measure = staff?.parentElement;
    if (!staff || !measure) continue;
    const staves = Array.from(measure.children).filter((c) => c.classList.contains("staff"));
    n.hand = staves.indexOf(staff) === 0 ? "R" : "L";
  }
}

export function flatten(steps: Step[]): Note[] { return steps.flatMap((s) => s.notes); }
/** Grave un extrait MusicXML (solfège). Le SVG est en viewBox : taille pilotée par le CSS, géométrie lisible dans les données. */
export async function renderXml(xml: string, o: { spacing?: number } = {}): Promise<string> {
  const toolkit = await getToolkit();
  toolkit.resetOptions();
  toolkit.setOptions({ scale: 100, pageWidth: 30000, pageHeight: 4000, adjustPageWidth: true, adjustPageHeight: true, breaks: "none", header: "none", footer: "none",
    pageMarginTop: 10, pageMarginBottom: 10, pageMarginLeft: 10, pageMarginRight: 10, mnumInterval: 0, svgViewBox: true,
    spacingLinear: o.spacing ?? 0.2, spacingNonLinear: 0.5 });
  toolkit.loadData(xml);
  return toolkit.renderToSVG(1);
}
