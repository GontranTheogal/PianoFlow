/** Générateur de partitions MusicXML (exercices du parcours, répertoire intégré) : deux mains, plusieurs voix par main,
 *  accords, triolets, liaisons, doigtés écrits, nuances et pédale. Logique pure : la sortie est lue par le moteur
 *  d'entraînement comme n'importe quel morceau. */
import { keySigAlter } from "../solfegeCore";
import type { Pitch } from "./theory";
import { esc } from "../html";

/** Durées en croches : 0.25 = triple croche, 0.5 = double, 1 = croche, 2 = noire, 4 = blanche, 8 = ronde ;
 *  × 1,5 = pointée (1.5, 3, 6…), × 1,75 = double pointée ; × 2/3 = triolet (2/3 = croche de triolet, 1/3 = double croche de triolet, 4/3 = noire de triolet). */
export type Dur = number;
export type Dyn = "pp" | "p" | "mp" | "mf" | "f" | "ff" | "cresc" | "dim";
export interface Ev {
  notes: { p: Pitch; finger?: number; /** liaison de prolongation propre à cette note (accord dont une seule note est tenue) */ tie?: "start" | "stop" | "both" }[]; dur: Dur;
  /** silence invisible (remplissage) */ hidden?: boolean;
  /** liaison de prolongation vers / depuis l'événement voisin */ tie?: "start" | "stop" | "both";
  /** nuance écrite sous la note */ dyn?: Dyn;
  /** pédale : enfoncer, relever, changer */ ped?: "start" | "stop" | "change";
  /** symbole d'accord écrit au-dessus de la portée (grille : C, G, Am, F…) */ harm?: string;
  /** liaison d'expression */ slur?: "start" | "stop";
  staccato?: boolean;
  /** changement de clé pour cette portée à partir de cette note */ clef?: "G" | "F";
}   // notes vides = silence
/** Une main : une voix, ou plusieurs voix superposées (mélodie tenue au-dessus d'un accompagnement…). */
export type Hand = Ev[] | Ev[][];
export interface PieceSpec {
  title: string; bpm: number; fifths: number; beats?: number; beatType?: number; rh: Hand | null; lh: Hand | null;
  /** levée (anacrouse) : durée de la première mesure incomplète, en croches */ pickup?: number;
  composer?: string;
  /** clés de départ des deux portées (main gauche en clé de Sol, par exemple) */ clefs?: ["G" | "F", "G" | "F"];
}

const STEP = ["C", "D", "E", "F", "G", "A", "B"];
const ACC: Record<string, string> = { "-2": "flat-flat", "-1": "flat", "0": "natural", "1": "sharp", "2": "double-sharp" };
const BASES: [number, string][] = [[8, "whole"], [4, "half"], [2, "quarter"], [1, "eighth"], [0.5, "16th"], [0.25, "32nd"]];
const DIV = 24;                                  // divisions par noire : triolets et triples croches tombent juste
const xmlDur = (d: number) => Math.round(d * (DIV / 2));
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

/** Figure de note d'une durée : type, points, triolet. */
export function durType(d: number): { type: string; dots: number; tup: boolean; base: number } {
  for (const [b, type] of BASES) {
    if (near(d, b)) return { type, dots: 0, tup: false, base: b };
    if (near(d, b * 1.5)) return { type, dots: 1, tup: false, base: b };
    if (near(d, b * 1.75)) return { type, dots: 2, tup: false, base: b };
  }
  for (const [b, type] of BASES) {
    if (near(d, (b * 2) / 3)) return { type, dots: 0, tup: true, base: b };
    if (near(d, b)) break;
  }
  for (const [b, type] of BASES) if (near(d, b)) return { type, dots: 0, tup: false, base: b };
  throw new Error(`durée non représentable : ${d} croche(s)`);
}

export const note = (p: Pitch, dur: Dur, finger?: number): Ev => ({ notes: [{ p, finger }], dur });
export const chord = (ps: Pitch[], dur: Dur, fingers?: number[]): Ev => ({ notes: ps.map((p, i) => ({ p, finger: fingers?.[i] })), dur });
export const rest = (dur: Dur): Ev => ({ notes: [], dur });

export function measureLength(spec: Pick<PieceSpec, "beats" | "beatType">): number {
  return ((spec.beats ?? 4) * 8) / (spec.beatType ?? 4);    // en croches : 4/4 → 8, 3/4 → 6, 2/4 → 4, 6/8 → 6, 3/8 → 3
}
const voicesOf = (h: Hand | null): Ev[][] => (!h ? [] : h.length && Array.isArray(h[0]) ? (h as Ev[][]) : [h as Ev[]]);

/** Découpe une voix en mesures ; lève une erreur si un événement chevauche une barre de mesure ou si la voix est incomplète. */
export function splitMeasures(evs: Ev[], len: number, pickup = 0): Ev[][] {
  const out: Ev[][] = []; let cur: Ev[] = [], acc = 0;
  const lenOf = (i: number) => (i === 0 && pickup > 0 ? pickup : len);
  for (const e of evs) {
    const L = lenOf(out.length);
    if (acc + e.dur > L + 1e-6) throw new Error(`événement de ${+e.dur.toFixed(3)} croches à cheval sur la barre de mesure (mesure ${out.length + 1}, déjà ${+acc.toFixed(3)}/${L})`);
    cur.push(e); acc += e.dur;
    if (Math.abs(acc - L) < 1e-6) { out.push(cur); cur = []; acc = 0; }
  }
  if (acc > 1e-6) throw new Error(`dernière mesure incomplète (${+acc.toFixed(3)}/${lenOf(out.length)} croches)`);
  return out;
}

const DYN_XML: Record<string, string> = { pp: "<dynamics><pp/></dynamics>", p: "<dynamics><p/></dynamics>", mp: "<dynamics><mp/></dynamics>", mf: "<dynamics><mf/></dynamics>", f: "<dynamics><f/></dynamics>", ff: "<dynamics><ff/></dynamics>", cresc: '<words font-style="italic">cresc.</words>', dim: '<words font-style="italic">dim.</words>' };
const clefXml = (c: "G" | "F", n?: number) => `<clef${n ? ` number="${n}"` : ""}>${c === "G" ? "<sign>G</sign><line>2</line>" : "<sign>F</sign><line>4</line>"}</clef>`;

/** Une voix d'une mesure : notes, accords, silences, triolets (crochets regroupés automatiquement). */
/** sens d'écriture des accords qui terminent plusieurs liaisons (voir voiceXml), calculé sur toute la voix */
const TIE_DESC = new WeakMap<Ev, boolean>();
function markTieOrder(v: Ev[]): Ev[] {
  let prev = false;
  for (const ev of v) {
    const stops = ev.notes.filter((n) => ["stop", "both"].includes((n.tie ?? ev.tie) as string)).length;
    prev = stops >= 2 && !prev; TIE_DESC.set(ev, prev);
  }
  return v;
}
function voiceXml(evs: Ev[], staff: number, voice: number, fifths: number, st: Map<string, number>, staves: number, measureLen: number, fullMeasure = true): string {
  let out = "", tupAcc = 0, tupMin = Infinity, inTup = false;
  evs.forEach((ev, idx) => {
    const dt = durType(ev.dur);
    const dot = "<dot/>".repeat(dt.dots);
    let tupStart = false, tupStop = false;
    if (dt.tup) {
      if (!inTup) { inTup = true; tupStart = true; tupAcc = 0; tupMin = Infinity; }
      tupAcc += ev.dur; tupMin = Math.min(tupMin, dt.base);
      const unit = 2 * tupMin;
      if (near(tupAcc / unit, Math.round(tupAcc / unit)) || idx === evs.length - 1) { tupStop = true; inTup = false; }
    } else inTup = false;
    const tm = dt.tup ? "<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>" : "";
    const tupN = (tupStart ? '<tuplet type="start" bracket="yes"/>' : "") + (tupStop ? '<tuplet type="stop"/>' : "");
    if (ev.clef) out += `<attributes>${clefXml(ev.clef, staves === 2 ? staff : undefined)}</attributes>`;
    if (ev.dyn) out += `<direction placement="below"><direction-type>${DYN_XML[ev.dyn]}</direction-type>${staves === 2 ? `<staff>${staff}</staff>` : ""}</direction>`;
    if (ev.harm) out += `<direction placement="above"><direction-type><words font-weight="bold" font-size="13">${esc(ev.harm)}</words></direction-type>${staves === 2 ? `<staff>${staff}</staff>` : ""}</direction>`;
    if (ev.ped) out += `<direction placement="below"><direction-type><pedal type="${ev.ped}" line="no"/></direction-type>${staves === 2 ? `<staff>${staff}</staff>` : ""}</direction>`;
    if (!ev.notes.length) {
      const whole = fullMeasure && near(ev.dur, measureLen) && evs.length === 1;   // (jamais dans une levée : le lecteur compterait une mesure entière)
      out += `<note${ev.hidden ? ' print-object="no"' : ""}>${whole ? '<rest measure="yes"/>' : "<rest/>"}<duration>${xmlDur(ev.dur)}</duration><voice>${voice}</voice>${whole ? "" : `<type>${dt.type}</type>${dot}`}${tm}<staff>${staff}</staff>${tupN ? `<notations>${tupN}</notations>` : ""}</note>`;
      return;
    }
    // un accord s'écrit dans l'ordre de hauteur croissante… sauf l'accord qui termine plusieurs liaisons de prolongation :
    // Verovio (4.5) n'en referme qu'une si les deux accords sont écrits dans le même ordre, on alterne donc le sens
    const sorted = [...ev.notes].sort((a, b) => (a.p.oct * 7 + a.p.li) - (b.p.oct * 7 + b.p.li));
    if (TIE_DESC.get(ev)) sorted.reverse();
    out += sorted.map((n, i) => {
      const nt = n.tie ?? ev.tie;
      const tieStart = nt === "start" || nt === "both", tieStop = nt === "stop" || nt === "both";
      const ties = (tieStop ? '<tie type="stop"/>' : "") + (tieStart ? '<tie type="start"/>' : "");
      const tied = (tieStop ? '<tied type="stop"/>' : "") + (tieStart ? '<tied type="start"/>' : "");
      const key = `${n.p.li}:${n.p.oct}`;
      const cur = st.has(key) ? st.get(key)! : keySigAlter(fifths, n.p.li);
      const acc = n.p.alter !== cur ? `<accidental>${ACC[String(n.p.alter)]}</accidental>` : "";
      st.set(key, n.p.alter);
      const fing = n.finger && !tieStop ? `<fingering>${n.finger}</fingering>` : "";
      const art = i === 0 && ev.staccato ? "<articulations><staccato/></articulations>" : "";
      const slur = i === 0 && ev.slur ? `<slur type="${ev.slur}" number="${voice}"/>` : "";
      const tech = fing ? `<technical>${fing}</technical>` : "";
      const nots = tied + (i === 0 ? tupN : "") + slur + art + tech;
      return `<note>${i ? "<chord/>" : ""}<pitch><step>${STEP[n.p.li]}</step>${n.p.alter ? `<alter>${n.p.alter}</alter>` : ""}<octave>${n.p.oct}</octave></pitch><duration>${xmlDur(ev.dur)}</duration>${ties}<voice>${voice}</voice><type>${dt.type}</type>${dot}${acc}${tm}<staff>${staff}</staff>${nots ? `<notations>${nots}</notations>` : ""}</note>`;
    }).join("");
  });
  return out;
}

export function buildXml(spec: PieceSpec): string {
  const len = measureLength(spec), beats = spec.beats ?? 4, beatType = spec.beatType ?? 4, pk = spec.pickup ?? 0;
  const R = voicesOf(spec.rh).map((v) => splitMeasures(markTieOrder(v), len, pk)), L = voicesOf(spec.lh).map((v) => splitMeasures(markTieOrder(v), len, pk));
  if (!R.length && !L.length) throw new Error("aucune voix");
  const n = Math.max(0, ...[...R, ...L].map((v) => v.length));
  if ([...R, ...L].some((v) => v.length !== n)) throw new Error(`les voix n'ont pas le même nombre de mesures (${[...R, ...L].map((v) => v.length).join(", ")})`);
  const staves = L.length ? 2 : 1;
  let body = "";
  for (let m = 0; m < n; m++) {
    const stR = new Map<string, number>(), stL = new Map<string, number>();
    let attrs = "";
    if (m === 0) {
      attrs = `<attributes><divisions>${DIV}</divisions><key><fifths>${spec.fifths}</fifths></key><time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time>` +
        (staves === 2 ? `<staves>2</staves>${clefXml(spec.clefs?.[0] ?? "G", 1)}${clefXml(spec.clefs?.[1] ?? "F", 2)}` : clefXml(spec.clefs?.[0] ?? "G")) +
        `</attributes><direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${spec.bpm}</per-minute></metronome></direction-type><sound tempo="${spec.bpm}"/></direction>`;
    }
    const mLen = m === 0 && pk ? pk : len;
    const parts: string[] = [];
    const full = !(m === 0 && pk);
    if (R.length) R.forEach((v, i) => parts.push(voiceXml(v[m], 1, i + 1, spec.fifths, stR, staves, mLen, full)));
    else parts.push(voiceXml([{ notes: [], dur: mLen }], 1, 1, spec.fifths, stR, staves, mLen, full));
    L.forEach((v, i) => parts.push(voiceXml(v[m], 2, 5 + i, spec.fifths, stL, staves, mLen, full)));
    body += `<measure number="${pk ? m : m + 1}"${m === 0 && pk ? ' implicit="yes"' : ""}>${attrs}${parts.join(`<backup><duration>${xmlDur(mLen)}</duration></backup>`)}</measure>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="3.1"><work><work-title>${esc(spec.title)}</work-title></work>${spec.composer ? `<identification><creator type="composer">${esc(spec.composer)}</creator></identification>` : ""}<part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">${body}</part></score-partwise>`;
}

/** Une seule portée (pour montrer des notes ou un accord dans l'énoncé) : suite d'événements, clé de Sol ou de Fa. */
export function buildStaffXml(evs: Ev[], clef: "G" | "F", fifths: number, perMeasure = 0, time?: { beats: number; beatType: number }): string {
  const total = evs.reduce((s, e) => s + e.dur, 0), len = perMeasure || Math.max(8, total);
  const padded = [...evs]; let acc = total;
  while (acc % len !== 0) { padded.push({ notes: [], dur: 2, hidden: true }); acc += 2; }
  const body = splitMeasures(padded, len).map((m, i) => {
    const st = new Map<string, number>();
    const attrs = i === 0 ? `<attributes><divisions>${DIV}</divisions><key><fifths>${fifths}</fifths></key>${time ? `<time><beats>${time.beats}</beats><beat-type>${time.beatType}</beat-type></time>` : ""}${clefXml(clef)}</attributes>` : "";
    return `<measure number="${i + 1}">${attrs}${voiceXml(m, 1, 1, fifths, st, 1, len)}</measure>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="3.1"><part-list><score-part id="P1"><part-name print-object="no"/></score-part></part-list><part id="P1">${body}</part></score-partwise>`;
}
