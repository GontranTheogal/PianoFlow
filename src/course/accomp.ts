/** Unité « Accompagner une chanson » : lire une grille d'accords (C, G, Am, F…), la jouer en renversements,
 *  avec des motifs de main gauche (basse, basse-quinte, arpège, « boum-tchak », Alberti), puis sous une mélodie.
 *  C'est ce que les applis orientées chansons (Flowkey, Simply Piano) font travailler en premier ; ici, après les
 *  accords et leurs renversements, pour que les enchaînements soient compris et pas seulement copiés. */
import { info, chordEv, note, evs, type Tok, type Ev, type Rng } from "./build";
import { buildXml, type PieceSpec } from "./xml";
import { chordPitches, voiceLead, invert, midiOf, type Pitch, type Quality } from "./theory";
import { chordQ, rhChordFingers, ODE } from "./pieces";
import { mc } from "./foundations";
import type { Lesson, Q, Unit } from "./types";

const LI: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
const FR: Record<string, string> = { C: "Do", D: "Ré", E: "Mi", F: "Fa", G: "Sol", A: "La", B: "Si" };
/** « Am » → racine La, mineur ; « G7 » → Sol, septième de dominante ; « F#m », « Bb »… */
export function parseSym(sym: string): { root: { li: number; alter: number }; q: Quality; fr: string } {
  const m = /^([A-G])([#b]?)(m?)(7?)$/.exec(sym);
  if (!m) throw new Error("accord inconnu : " + sym);
  const q: Quality = m[3] ? (m[4] ? "min7" : "min") : m[4] ? "dom7" : "maj";
  const alt = m[2] === "#" ? "♯" : m[2] === "b" ? "♭" : "";
  return { root: { li: LI[m[1]], alter: m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0 }, q, fr: `${FR[m[1]]}${alt} ${q === "min" || q === "min7" ? "mineur" : "majeur"}${m[4] ? " (septième)" : ""}` };
}

export type LhPattern = "root" | "root5" | "arp" | "oompah" | "alberti" | "waltz";
/** Basse de l'accord dans la zone Fa2–Mi3 (sous la main droite, pas trop grave). */
function bassOf(sym: string): Pitch {
  const { root } = parseSym(sym);
  for (let oct = 2; oct <= 3; oct++) { const p = { ...root, oct }; const m = midiOf(p); if (m >= 41 && m <= 52) return p; }
  return { ...root, oct: 3 };
}
/** La quinte au-dessus de la basse, bien orthographiée (prise dans l'accord). */
function fifthOf(sym: string, b: Pitch): Pitch {
  const { root, q } = parseSym(sym), five = chordPitches(root, b.oct, q)[2];
  return midiOf(five) > midiOf(b) ? five : { ...five, oct: five.oct + 1 };
}
const plus8 = (p: Pitch): Pitch => ({ ...p, oct: p.oct + 1 });
/** Motif de main gauche sur un accord, pour une durée de 4 ou 8 croches, doigtés écrits. */
function lhBar(sym: string, d: number, pat: LhPattern): Ev[] {
  const b = bassOf(sym), f = fifthOf(sym, b), { root, q } = parseSym(sym);
  const third = chordPitches(root, b.oct, q)[1];
  const n = (p: Pitch, dur: number, fi: number) => note(p, dur, fi);
  if (pat === "root") return [n(b, d, 5)];
  if (pat === "root5") return [n(b, d / 2, 5), n(f, d / 2, 1)];
  if (pat === "arp") { const seq: [Pitch, number][] = [[b, 5], [f, 2], [plus8(b), 1], [f, 2]]; return seq.slice(0, d / 2).map(([p, fi]) => n(p, 2, fi)); }
  if (pat === "alberti") { const seq: [Pitch, number][] = [[b, 5], [f, 1], [third, 3], [f, 1]]; return Array.from({ length: d }, (_, i) => n(seq[i % 4][0], 1, seq[i % 4][1])); }
  // « boum-tchak » : la basse, puis l'accord serré au-dessus (renversement qui commence une quarte à une sixte plus haut)
  const base = chordPitches(root, b.oct, q).slice(0, 3);
  let tri = base;
  for (let i = 0; i < 3; i++) {   // le renversement dont la note grave est une quarte à une sixte au-dessus de la basse
    let c = invert(base, i); while (midiOf(c[0]) - midiOf(b) < 5) c = c.map(plus8);
    if (midiOf(c[0]) - midiOf(b) <= 9) { tri = c; break; }
  }
  const g1 = midiOf(tri[1]) - midiOf(tri[0]), fch = g1 <= 4 ? [4, 2, 1] : [5, 2, 1];
  const chordE = (dur: number) => chordEv(tri, dur, fch);
  // valse (3/4) : la basse puis l'accord deux fois
  if (pat === "waltz") return [n(b, 2, 5), chordE(2), chordE(2)].slice(0, Math.max(1, d / 2));
  // basse alternée : la quinte en dessous (si le clavier le permet), comme au ragtime
  const alt = midiOf(f) - 12 >= 36 ? { ...f, oct: f.oct - 1 } : f;
  return d === 8 ? [n(b, 2, 5), chordE(2), n(alt, 2, 5), chordE(2)] : [n(b, 2, 5), chordE(2)];
}

export interface GridOpts {
  title: string; bpm: number; fifths?: number;
  /** une case par mesure : un accord, ou deux (une demi-mesure chacun) */ grid: string[][];
  lh: LhPattern;
  /** main droite : accords enchaînés (rondes ou noires), une mélodie (jetons), ou rien */ rh: "chords" | "chords4" | Tok[] | null;
  /** mesure (4/4 par défaut) */ beats?: number; beatType?: number; composer?: string;
}
/** Une grille d'accords jouée : symboles au-dessus de la portée, accords de la main droite enchaînés au plus près. */
export function gridXml(o: GridOpts): string { return buildXml(gridSpec(o)); }
export function gridSpec(o: GridOpts): PieceSpec {
  const barLen = ((o.beats ?? 4) * 8) / (o.beatType ?? 4);
  const flat = o.grid.flatMap((bar) => bar.map((s) => ({ s, d: barLen / bar.length })));
  const lh: Ev[] = flat.flatMap(({ s, d }) => lhBar(s, d, o.lh));
  let rh: Ev[] | null = null;
  if (o.rh === "chords" || o.rh === "chords4") {
    const voiced = voiceLead(flat.map(({ s }) => { const { root, q } = parseSym(s); return chordPitches(root, 4, q).slice(0, 3); }), 57, 76);
    rh = flat.flatMap(({ d }, i) => {
      const f = rhChordFingers(voiced[i]);
      return o.rh === "chords4" ? Array.from({ length: d / 2 }, () => chordEv(voiced[i], 2, f)) : [chordEv(voiced[i], d, f)];
    });
  } else if (o.rh) rh = evs(o.rh);
  // symboles d'accord : sur l'événement de la main droite qui commence à chaque changement (sinon sur la main gauche)
  const host = rh ?? lh;
  let t = 0, k = 0, pos = 0;
  const starts = flat.map(({ d }) => { const at = t; t += d; return at; });
  for (const ev of host) {
    while (k < starts.length && starts[k] < pos - 1e-6) k++;
    if (k < starts.length && Math.abs(starts[k] - pos) < 1e-6) { ev.harm = flat[k].s; k++; }
    pos += ev.dur;
  }
  return { title: o.title, composer: o.composer, bpm: o.bpm, fifths: o.fifths ?? 0, beats: o.beats, beatType: o.beatType, rh, lh };
}

const L = (id: string, title: string, goals: string[], build: (rng: Rng) => Q[]): Lesson => ({ id, title, goals, build });
const piece = (title: string, goal: string, o: Omit<GridOpts, "title">, pass: number, mode: "step" | "rhythm" = "step", speed?: number, hands: "R" | "L" | "both" = "both"): Q =>
  ({ k: "piece", title, goal, xml: gridXml({ ...o, title }), pass, hands, mode, speed });

const POP: string[][] = [["C"], ["G"], ["Am"], ["F"]];
const twice = (g: string[][]) => [...g, ...g];
/** Ode à la joie : une grille (deux accords dans la dernière mesure de chaque phrase). */
const ODE_GRID: string[][] = [["C"], ["G"], ["C"], ["G"], ["C"], ["G"], ["C"], ["G", "C"]];

const symbols = L("uacc-l1", "Les symboles d'accords", ["Lire C, G, Am, F… au-dessus d'une mélodie", "Trouver l'accord au clavier"], (rng) => [
  info("Les lettres au-dessus des chansons", "Sur les partitions de chansons, au-dessus de la mélodie, on lit des lettres : C, G, Am, F… C'est le nom de l'accord, en notation anglaise : A = La, B = Si, C = Do, D = Ré, E = Mi, F = Fa, G = Sol. Une lettre seule : accord majeur. Un « m » : mineur (Am = La mineur). Un « 7 » (G7) : un accord de quatre notes, la « septième », que tu apprendras plus loin dans le parcours ; en attendant, joue simplement l'accord sans le 7. Il suffit de ces symboles pour accompagner n'importe quelle chanson.", undefined),
  mc(rng, "« G » au-dessus d'une mélodie, c'est…", "l'accord de Sol majeur", ["l'accord de La majeur", "la note Sol seule"], "G = Sol ; une lettre seule = accord majeur (Sol – Si – Ré)."),
  mc(rng, "« Am », c'est…", "La mineur", ["La majeur", "La septième"], "A = La, « m » = mineur : La – Do – Mi."),
  chordQ(parseSym("C").root, "maj", "R", "Joue l'accord C (Do majeur)"),
  chordQ(parseSym("G").root, "maj", "R", "Joue l'accord G (Sol majeur)"),
  chordQ(parseSym("Am").root, "min", "R", "Joue l'accord Am (La mineur)"),
  chordQ(parseSym("F").root, "maj", "R", "Joue l'accord F (Fa majeur)"),
  mc(rng, "« Dm », c'est…", "Ré mineur", ["Ré majeur", "Do mineur"], "D = Ré, « m » = mineur : Ré – Fa – La."),
  chordQ(parseSym("Dm").root, "min", "R", "Joue l'accord Dm (Ré mineur)"),
]);
const pop = L("uacc-l2", "La grille des tubes : C – G – Am – F", ["Enchaîner quatre accords sans sauter, grâce aux renversements"], (rng) => [
  info("Quatre accords, des centaines de chansons", "C – G – Am – F (en chiffres : I – V – vi – IV) accompagne Let It Be, No Woman No Cry, With or Without You, Someone Like You et des centaines d'autres. Le secret pour l'enchaîner : ne pas déplacer la main en bloc, mais choisir le renversement le plus proche. Ici, les doigts ne bougent presque pas d'un accord à l'autre ; la main gauche joue la basse (la lettre de l'accord).", undefined),
  mc(rng, "Dans C – G – Am – F, quel accord est le « V » ?", "G", ["Am", "F"], "En Do majeur : I = C (Do), IV = F (Fa), V = G (Sol), vi = Am (La mineur)."),
  piece("C – G – Am – F", "Mains ensemble, pas à pas : la main droite reste au même endroit, seuls un ou deux doigts bougent.", { bpm: 66, grid: twice(POP), lh: "root", rh: "chords" }, 85),
  piece("C – G – Am – F (en rythme)", "En rythme : change d'accord exactement sur le premier temps.", { bpm: 66, grid: twice(POP), lh: "root", rh: "chords4" }, 75, "rhythm", 70),
]);
const patterns = L("uacc-l3", "Motifs de main gauche", ["Accompagner avec basse-quinte, arpège, « boum-tchak » et Alberti"], (rng) => [
  info("Faire vivre la main gauche", "Une grille ne se joue pas qu'en accords plaqués. Quatre motifs de main gauche suffisent pour presque tout : basse puis quinte (ballade), arpège 1-5-8-5 (pop, folk), « boum-tchak » (basse puis accord : valse, ragtime, chanson), Alberti (classique). Dans « 1-5-8-5 », les chiffres ne sont PAS des doigts : ce sont les notes de l'accord comptées depuis la basse (1 = la basse, 5 = sa quinte, 8 = son octave). La basse d'Alberti porte le nom d'un compositeur italien du XVIIIe siècle, Domenico Alberti : basse, quinte, tierce, quinte, en croches. On les apprend d'abord main gauche seule, sur la même grille.", undefined),
  piece("Arpège 1-5-8-5", "Main gauche seule : la basse, la quinte, l'octave, la quinte. Doigts 5 – 2 – 1 – 2.", { bpm: 72, grid: twice(POP), lh: "arp", rh: null }, 85, "step", undefined, "L"),
  piece("« Boum-tchak »", "Main gauche seule : la basse, puis l'accord serré (ses trois notes collées) juste au-dessus. Le poignet saute, les doigts se préparent en l'air.", { bpm: 72, grid: twice(POP), lh: "oompah", rh: null }, 80, "step", undefined, "L"),
  piece("Alberti", "Main gauche seule, en croches régulières : basse, quinte, tierce, quinte.", { bpm: 72, grid: twice(POP), lh: "alberti", rh: null }, 85, "step", undefined, "L"),
  mc(rng, "Pour une ballade calme, quel motif de main gauche choisir ?", "l'arpège 1-5-8-5", ["le « boum-tchak »", "des accords plaqués très forts"], "L'arpège fait sonner l'accord sans le marteler ; le « boum-tchak » est plus dansant."),
  piece("Arpège + accords", "Mains ensemble : la droite tient l'accord, la gauche déroule l'arpège.", { bpm: 66, grid: twice(POP), lh: "arp", rh: "chords" }, 80),
]);
const melody = L("uacc-l4", "Mélodie et accords", ["Jouer une mélodie en suivant la grille écrite au-dessus"], (rng) => [
  info("La mélodie à droite, la grille à gauche", "Sur une partition de chanson, la main droite joue la mélodie et la main gauche suit les symboles d'accords avec un motif. On commence par le plus simple (la basse, puis basse-quinte), en regardant les lettres plutôt que les notes de la main gauche.", undefined),
  info("Trouver l'accord soi-même", "Pas de lettres sur la partition ? Regarde les notes de la mélodie sur les temps forts de chaque mesure, et cherche lequel de C, F, G (ou Am, Dm) les contient. Exemple : une mesure Mi – Sol – Mi – Do, ce sont des notes de C. Puis vérifie à l'oreille : si ça « frotte », essaie l'accord voisin.\n\nC'est la même règle que pour les lettres écrites : la mélodie et l'accord partagent leurs notes principales. Les notes de passage (entre deux notes de l'accord, sur un temps faible) n'ont pas besoin d'y être.", undefined),
  mc(rng, "Une mesure de mélodie : Fa – La – Do – La. Quel accord ?", "F", ["C", "G"], "Fa, La, Do : ce sont exactement les notes de F (Fa majeur)."),
  mc(rng, "Une mesure de mélodie : Si – Ré – Sol – Ré. Quel accord ?", "G", ["C", "Am"], "Sol, Si, Ré : les notes de G (Sol majeur)."),
  mc(rng, "La lettre change au milieu d'une mesure (« G  C ») : que fait la main gauche ?", "elle change de basse à la moitié de la mesure", ["elle garde le premier accord toute la mesure", "elle s'arrête"], "Chaque symbole vaut jusqu'au suivant : deux symboles dans une mesure, deux demi-mesures."),
  piece("Ode à la joie · basse-quinte", "Pas à pas : la mélodie à droite, basse puis quinte à gauche.", { bpm: 80, grid: ODE_GRID, lh: "root5", rh: ODE }, 85),
  piece("Ode à la joie · arpège", "Pas à pas : maintenant l'arpège 1-5-8-5 sous la mélodie.", { bpm: 76, grid: ODE_GRID, lh: "arp", rh: ODE }, 80),
  piece("Ode à la joie · en rythme", "En rythme, basse-quinte : la mélodie chante, la gauche reste discrète.", { bpm: 80, grid: ODE_GRID, lh: "root5", rh: ODE }, 75, "rhythm", 70),
]);
const keys = L("uacc-l5", "D'autres grilles, d'autres tonalités", ["Jouer les grilles les plus courantes en Do et en Sol"], (rng) => [
  info("Les grilles qui reviennent partout", "La même grille se transpose, c'est-à-dire se joue à partir d'une autre maison. En Sol majeur (sa gamme a un Fa♯ au lieu du Fa : l'accord D = Ré – Fa♯ – La ; tu étudieras cette tonalité en détail plus loin), I – V – vi – IV devient G – D – Em – C. Et quelques autres reviennent sans cesse : Am – F – C – G (vi – IV – I – V, plus mélancolique), C – Am – F – G (I – vi – IV – V, les « années 50 »). Reconnaître une grille, c'est pouvoir accompagner une chanson qu'on entend.", undefined),
  mc(rng, "En Sol majeur, la grille I – V – vi – IV s'écrit…", "G – D – Em – C", ["G – C – D – Em", "C – G – Am – F"], "Sol (I), Ré (V), Mi mineur (vi), Do (IV)."),
  piece("G – D – Em – C", "Pas à pas, arpège à gauche, accords à droite.", { bpm: 66, fifths: 1, grid: twice([["G"], ["D"], ["Em"], ["C"]]), lh: "arp", rh: "chords" }, 80),
  piece("Am – F – C – G", "Pas à pas, basse-quinte à gauche.", { bpm: 66, grid: twice([["Am"], ["F"], ["C"], ["G"]]), lh: "root5", rh: "chords" }, 80),
  piece("C – Am – F – G · « boum-tchak »", "En rythme, la main gauche seule : basse, accord, quinte, accord.", { bpm: 80, grid: twice([["C"], ["Am"], ["F"], ["G"]]), lh: "oompah", rh: null }, 75, "rhythm", 70, "L"),
]);

/** Improvisation sur une grille : l'appli joue basse + accord, on improvise avec une gamme pentatonique. */
export function improvQ(prompt: string, syms: string[], scale: number[], scaleName: string, bpm = 76, rounds = 2, hint?: string): Q {
  const voiced = voiceLead(syms.map((sy) => { const { root, q } = parseSym(sy); return chordPitches(root, 3, q).slice(0, 3); }), 50, 64);
  const grid = syms.map((sy, i) => [midiOf(bassOf(sy)) - 12, ...voiced[i].map(midiOf)]);
  return { k: "improv", prompt, grid, names: syms, bpm, scale, scaleName, rounds, kbd: [60, 84], hint };
}
const PENTA_C = [0, 2, 4, 7, 9], PENTA_G = [7, 9, 11, 2, 4], BLUES_C = [0, 3, 5, 6, 7, 10];
const improv = L("uacc-l6", "Improviser sur la grille", ["Inventer une mélodie sur un accompagnement, avec une gamme pentatonique"], (rng) => [
  info("Pas de fausse note", "Improviser, c'est inventer sur une grille. Le secret des débutants : la gamme PENTATONIQUE (cinq notes). En Do : Do, Ré, Mi, Sol, La — les touches allumées. Avec elle, sur C – G – Am – F, toutes les notes sonnent bien. Commence simple : des notes longues, une petite phrase de 3-4 notes que tu répètes, puis que tu varies. Laisse des silences : ils font partie de la musique.", undefined),
  improvQ("Improvise sur C – G – Am – F avec la pentatonique de Do", ["C", "G", "Am", "F"], PENTA_C, "Pentatonique de Do (Do Ré Mi Sol La)", 72, 2, "Commence par des blanches ou des rondes, puis ose des noires."),
  mc(rng, "Pourquoi la pentatonique « marche » toujours sur cette grille ?", "elle n'a pas les notes qui frottent (Fa et Si)", ["elle a plus de notes", "elle est plus aiguë"], "Sans Fa ni Si, aucune note ne crée de frottement fort avec C, G, Am ou F."),
  improvQ("Encore, plus libre : une phrase, une réponse", ["C", "G", "Am", "F"], PENTA_C, "Pentatonique de Do", 80, 3, "Joue une petite phrase sur 2 mesures, puis « réponds-lui » sur les 2 suivantes."),
  mc(rng, "Pourquoi la pentatonique de Sol, et pas celle de Do, sur G – D – Em – C ?", "la maison est Sol : on prend les notes de sa gamme", ["elle est plus facile", "il n'y a pas de différence"], "Sol La Si Ré Mi : les cinq notes « sûres » de Sol majeur, sans Do ni Fa♯ qui frottent."),
  improvQ("En Sol : G – D – Em – C, pentatonique de Sol", ["G", "D", "Em", "C"], PENTA_G, "Pentatonique de Sol (Sol La Si Ré Mi)", 76, 2),
]);
/** Le blues : après l'accord de septième de dominante (unité Septièmes), pas avant. */
export const bluesLesson = L("k-7-6", "Improviser sur un blues", ["Savoir ce qu'est un blues et sa gamme", "Improviser sur C7 – F7 – C7 – G7"], (rng) => [
  info("Le blues : trois accords « septième »", "Le blues est né chez les Afro-Américains du sud des États-Unis, au début du XXe siècle ; le jazz, le rock et la pop en descendent. Sa grille prend les trois accords de base, I, IV et V, mais leur ajoute à TOUS une septième de dominante : C7 (Do Mi Sol Si♭), F7 (Fa La Do Mi♭), G7 (Sol Si Ré Fa). Une tension qui, ailleurs, demande à se résoudre devient ici la couleur même du style : ça « grince » un peu, exprès.", undefined),
  info("La gamme blues", "Pour improviser dessus, on prend cinq notes, Do Mi♭ Fa Sol Si♭, et on ajoute une note de passage, Fa♯. Mi♭, Si♭ et Fa♯ sont les « notes bleues » : un peu fausses par rapport à Do majeur, elles frottent contre l'accord, et c'est ce frottement plaintif qui fait le blues. Le geste typique : glisser du Mi♭ vers le Mi, ou du Fa♯ vers le Sol.", undefined),
  mc(rng, "Sur un accord de Do, pourquoi le Mi♭ sonne-t-il « blues » ?", "il frotte contre le Mi de l'accord avant de s'y poser", ["il fait partie de l'accord de Do majeur", "c'est une fausse note à éviter"], "Mi♭ contre Mi : un demi-ton d'écart qui grince ; glisse vers le Mi et la tension se défait."),
  improvQ("Un blues en Do : C7 – F7 – C7 – G7, gamme blues", ["C7", "F7", "C7", "G7"], BLUES_C, "Gamme blues de Do (Do Mi♭ Fa Fa♯ Sol Si♭)", 84, 2, "Le Mi♭ qui glisse vers le Mi (ou le Fa♯ vers le Sol) : c'est tout le son du blues."),
]);
/** Exercices d'improvisation (onglet Exercices). */
export const IMPROV_LEVELS = ["Pentatonique de Do", "Pentatonique de Sol", "Blues en Do"];
export function improvDrill(level: number): Q[] {
  if (level <= 1) return [improvQ("Improvise sur C – G – Am – F", ["C", "G", "Am", "F"], PENTA_C, "Pentatonique de Do", 76, 2), improvQ("Sur Am – F – C – G", ["Am", "F", "C", "G"], PENTA_C, "Pentatonique de Do (ou de La mineur)", 80, 2)];
  if (level === 2) return [improvQ("Improvise sur G – D – Em – C", ["G", "D", "Em", "C"], PENTA_G, "Pentatonique de Sol", 80, 2), improvQ("Sur G – Em – C – D", ["G", "Em", "C", "D"], PENTA_G, "Pentatonique de Sol", 84, 2)];
  return [improvQ("Blues en Do", ["C7", "F7", "C7", "G7"], BLUES_C, "Gamme blues de Do", 84, 3)];
}

export const ACCOMP_UNIT: Unit = { id: "uacc", title: "Accompagner une chanson", sub: "Grilles d'accords, main gauche pop", icon: "mic", color: "#f472b6", lessons: [symbols, pop, patterns, melody, keys, improv] };
