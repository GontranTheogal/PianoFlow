/** Grands thèmes du répertoire classique (tous du domaine public), arrangés pour les niveaux 1 et 2 : la mélodie
 *  que tout le monde connaît, une main gauche à la portée du niveau, doigtés écrits pour les deux mains.
 *  Tonalités choisies pour rester lisibles (on transpose quand l'original a beaucoup d'altérations, et on le dit). */
import type { Tok } from "../course/build";
import { s, de, e, q, dq, h, dh, w, spec, rep, type RepPiece } from "./common";

const src = (what: string) => `arrangement PianoFlow d'après ${what} (domaine public)`;

// ───────── Grieg, Dans l'antre du roi de la montagne (Peer Gynt, op. 46 n° 4) : le thème, en la mineur ─────────
const MK_1: Tok[] = [["A4", e, 1], ["B4", e, 2], ["C5", e, 3], ["D5", e, 4], ["E5", e, 5], ["C5", e, 3], ["E5", q, 5]];
const MK_2: Tok[] = [["D#5", e, 4], ["B4", e, 2], ["D#5", q, 4], ["D5", e, 4], ["Bb4", e, 2], ["D5", q, 4]];
const MK_3: Tok[] = [["A4", e, 1], ["B4", e, 2], ["C5", e, 3], ["D5", e, 1], ["E5", e, 2], ["C5", e, 1], ["E5", e, 2], ["A5", e, 5]];
const MK_4: Tok[] = [["G5", e, 4], ["E5", e, 2], ["C5", e, 1], ["E5", e, 2], ["G5", h, 4]];
const mark = (t: Tok[], mk: string): Tok[] => [[t[0][0], t[0][1], t[0][2], mk], ...t.slice(1)];
const MK_R: Tok[] = [
  ...mark(MK_1, "p"), ...MK_2, ...MK_3, ...MK_4,
  ...mark(MK_1, "mf"), ...MK_2, ...MK_3, ...MK_4,
  // le même motif sur la dominante (mi majeur, avec sol♯), comme chez Grieg
  ["E5", e, 1, "cresc"], ["F#5", e, 2], ["G#5", e, 3], ["A5", e, 4], ["B5", e, 5], ["G#5", e, 3], ["B5", q, 5],
  ["C6", e, 5], ["G#5", e, 2], ["C6", q, 5], ["B5", e, 4], ["G#5", e, 2], ["B5", q, 4],
  ["E5", e, 1], ["F#5", e, 2], ["G#5", e, 3], ["A5", e, 4], ["B5", e, 5], ["G#5", e, 3], ["B5", q, 5],
  ["C6", e, 5], ["G#5", e, 2], ["C6", q, 5], ["B5", h, 4],
  ...mark(MK_1, "f"), ...MK_2, ...MK_3, ["A4+C5+E5", w, "135"],
];
const fifths = (lo: string, hi: string): Tok[] => [[lo, q, 5], [hi, q, 1], [lo, q, 5], [hi, q, 1]];
const MK_LA = fifths("A2", "E3"), MK_L2: Tok[] = [["B2", q, 5], ["F#3", q, 1], ["Bb2", q, 5], ["F3", q, 1]], MK_LC = fifths("C3", "G3");
const MK_LE: Tok[] = [["C2", q, 5], ["G#2", q, 1], ["E2", q, 5], ["B2", q, 1]];
const MK_L: Tok[] = [
  ...MK_LA, ...MK_L2, ...MK_LA, ...MK_LC, ...MK_LA, ...MK_L2, ...MK_LA, ...MK_LC,
  ...fifths("E2", "B2"), ...MK_LE, ...fifths("E2", "B2"), ...MK_LE,
  ...MK_LA, ...MK_L2, ...MK_LA, ["A2+E3", w, "51"],
];

// ───────── Dvořák, Symphonie « du Nouveau Monde », Largo : le thème du cor anglais, en Do ─────────
const LARGO_P = (mk: string): Tok[] => [
  ["E5", dq, 3, mk], ["G5", e, 5], ["G5", h, 5], ["E5", dq, 3], ["D5", e, 2], ["C5", h, 1],
  ["D5", dq, 2], ["E5", e, 3], ["G5", dq, 5], ["E5", e, 3], ["D5", w, 2],
  ["E5", dq, 3], ["G5", e, 5], ["G5", h, 5], ["E5", dq, 3], ["D5", e, 2], ["C5", h, 1],
  ["D5", q, 2], ["E5", q, 3], ["D5", dq, 2], ["C5", e, 1], ["C5", w, 1],
];
const ARP_C: Tok[] = [["C3", q, 5], ["G3", q, 2], ["C4", q, 1], ["G3", q, 2]], ARP_G: Tok[] = [["G2", q, 5], ["D3", q, 2], ["G3", q, 1], ["D3", q, 2]];
const LARGO_L: Tok[] = [
  ...ARP_C, ...ARP_C, ["G2", q, 5], ["D3", q, 2], ["C3", q, 5], ["G3", q, 2], ...ARP_G, ...ARP_C, ...ARP_C, ...ARP_G, ["C3+G3+C4", w, "521"],
  ["C3+G3", w, "51"], ["C3+G3", w, "51"], ["G2+D3", h, "51"], ["C3+G3", h, "51"], ["G2+D3", w, "51"],
  ["C3+G3", w, "51"], ["C3+G3", w, "51"], ["G2+D3", w, "51"], ["C3+G3+C4", w, "521"],
];

// ───────── Grieg, Au matin (Peer Gynt, op. 46 n° 1) : 6/8, en Do (original en Mi) ─────────
const MATIN_P = (mk: string): Tok[] => [
  ["G5", e, 5, mk], ["E5", e, 3], ["D5", e, 2], ["C5", e, 1], ["D5", e, 2], ["E5", e, 3],
  ["G5", e, 5], ["E5", e, 3], ["D5", e, 2], ["C5", e, 1], ["D5", s, 2], ["E5", s, 3], ["D5", s, 2], ["E5", s, 3],
  ["G5", e, 4], ["E5", e, 2], ["G5", e, 4], ["A5", e, 5], ["E5", e, 2], ["A5", e, 5],
  ["G5", e, 4], ["E5", e, 3], ["D5", e, 2], ["C5", dq, 1],
];
const MATIN_R: Tok[] = [
  ...MATIN_P("p"),
  ["E4+G4+C5", dh, "125"], ["E4+G4+C5", dh, "125"], ["E4+A4+C5", dh, "125"], ["E4+G4+C5", dh, "125"],
  ...MATIN_P("mf"), ["C5+E5+G5", dh, "135"],
];
const MATIN_L: Tok[] = [
  ...rep(4, [["C3+G3", dh, "51"]]),
  // la mélodie passe à la main gauche
  ["G3", e, 2, "p"], ["E3", e, 3], ["D3", e, 4], ["C3", e, 5], ["D3", e, 4], ["E3", e, 3],
  ["G3", e, 2], ["E3", e, 3], ["D3", e, 4], ["C3", e, 5], ["D3", s, 4], ["E3", s, 3], ["D3", s, 4], ["E3", s, 3],
  ["G3", e, 2], ["E3", e, 3], ["G3", e, 2], ["A3", e, 1], ["E3", e, 3], ["A3", e, 1],
  ["G3", e, 2], ["E3", e, 3], ["D3", e, 4], ["C3", dq, 5],
  ...rep(4, [["C3", dq, 5], ["G3+C4", dq, "21"]]), ["C3+G3+C4", dh, "521"],
];

// ───────── Chopin, Marche funèbre (Sonate op. 35, 3e mouvement) : le thème, en la mineur (original en si♭ mineur) ─────────
// la gauche balance sans arrêt entre deux accords : la – mi, puis do – fa
const FUN_OST: Tok[] = [["A2+E3", q, "51"], ["C3+F3", q, "41"], ["A2+E3", q, "51"], ["C3+F3", q, "41"]];
const FUN_A: Tok[] = [
  ["A4", q, 1], ["A4", de, 1], ["A4", s, 1], ["A4", q, 1], ["C5", de, 3], ["B4", s, 2],
  ["B4", de, 2], ["A4", s, 1], ["A4", de, 1], ["A4", s, 1], ["A4", h, 1],
];
const FUN_C: Tok[] = [["A5", de, 5], ["G5", s, 4], ["F5", de, 3], ["E5", s, 2], ["E5", q, 2], ["C5", q, 1]];
const FUN_P = (mk: string): Tok[] => [
  [FUN_A[0][0], FUN_A[0][1], FUN_A[0][2], mk], ...FUN_A.slice(1),
  ["C5", q, 3], ["C5", de, 3], ["C5", s, 3], ["C5", q, 3], ["E5", de, 5], ["D5", s, 4],
  ["D5", de, 4], ["C5", s, 3], ["C5", de, 3], ["C5", s, 3], ["C5", h, 3],
  ...FUN_C, ...FUN_C, ...FUN_A,
];
const FUN_R: Tok[] = [["R", w], ["R", w], ...FUN_P("p"), ...FUN_P("pp"), ["C4+E4+A4", w, "125"]];
const FUN_L: Tok[] = [...rep(18, FUN_OST), ["A2+E3", w, "51"]];

// ───────── Tchaïkovski, Le lac des cygnes : le thème du hautbois, en la mineur (original en si mineur) ─────────
const SWAN = (oct: boolean, mk: string): Tok[] => {
  const n = (p: string, d: number, f: number, m?: string): Tok => {
    const t: Tok = oct ? [`${p}+${p.slice(0, -1)}${+p.slice(-1) + 1}`, d, "15"] : [p, d, f];
    return m ? [t[0], t[1], t[2], m] : t;
  };
  return [
    n("E5", w, 5, mk), n("A4", q, 1), n("B4", q, 2), n("C5", q, 3), n("D5", q, 4),
    n("E5", dh, 5), n("C5", q, 3), n("E5", dh, 5), n("C5", q, 3), n("E5", dh, 5), n("A4", q, 1),
    n("C5", q, 4), n("A4", q, 2), n("F4", q, 1), n("C5", q, 4), n("A4", w, 2),
  ];
};
const SWAN_R: Tok[] = [...SWAN(false, "p"), ...SWAN(true, "f")];
const arp8 = (a: string, b: string, c: string, f = "521"): Tok[] => rep(2, [[a, e, +f[0]], [b, e, +f[1]], [c, e, +f[2]], [b, e, +f[1]]]);
const SWAN_L: Tok[] = [
  ["A2+E3", w, "51"], ["A2+E3", w, "51"], ["A2+E3", w, "51"], ["C3+E3+A3", w, "531"], ["A2+E3", w, "51"], ["F2+C3", w, "51"], ["A2+E3", w, "51"],
  ...arp8("A2", "E3", "A3"), ...arp8("A2", "E3", "A3"), ...arp8("A2", "E3", "A3"), ...arp8("C3", "E3", "A3", "531"),
  ...arp8("A2", "E3", "A3"), ...arp8("F2", "C3", "F3"), ["A2+E3+A3", w, "521"],
];

// ───────── Bach, Toccata en ré mineur (BWV 565) : l'introduction, écrite pour orgue ─────────
const TOC_R: Tok[] = [
  ["A5", s, 5, "f"], ["G5", s, 4], ["A5", dq, 5], ["R", e], ["G5", s, 4], ["F5", s, 3], ["E5", s, 2], ["D5", s, 1], ["C#5", e, 3],
  ["D5", h, 4], ["R", h],
  ["A4", s, 5], ["G4", s, 4], ["A4", dq, 5], ["R", e], ["E4", e, 2], ["F4", e, 3], ["C#4", e, 1],
  ["D4", h, 2], ["R", h],
  ["R", w], ["R", w],
  ["C#4", e, 1], ["E4", e, 2], ["G4", e, 3], ["Bb4", e, 5], ["C#4+E4+G4+Bb4", h, "1235"],
  ["D4+F4+A4+D5", w, "1235"],
];
const TOC_L: Tok[] = [
  ["A3", s, 1], ["G3", s, 2], ["A3", dq, 1], ["R", e], ["G3", s, 1], ["F3", s, 2], ["E3", s, 3], ["D3", s, 4], ["C#3", e, 5],
  ["D3", h, 4], ["R", h],
  ["A3", s, 1], ["G3", s, 2], ["A3", dq, 1], ["R", e], ["E3", e, 3], ["F3", e, 2], ["C#3", e, 5],
  ["D3", h, 4], ["R", h],
  ["A2", s, 1], ["G2", s, 2], ["A2", dq, 1], ["R", e], ["G2", s, 1], ["F2", s, 2], ["E2", s, 3], ["D2", s, 4], ["C#2", e, 5],
  ["D2", h, 4], ["R", h],
  ["D2", w, 5],
  ["D2+D3", w, "51"],
];

export const THEMES: RepPiece[] = [
  { id: "largo", title: "Largo du Nouveau Monde", composer: "A. Dvořák (Symphonie n° 9), arrangement", level: 1, source: src("la Symphonie n° 9, 2e mouvement"),
    skills: "Mélodie lente en position de Do, noire pointée – croche, main gauche en arpège doux",
    tip: "« Longue – courte » : la noire pointée dure trois croches, la croche qui suit est légère, comme une respiration. La main droite ne quitte jamais la position de Do ; la seconde fois, la gauche tient de simples accords : joue encore plus doucement.",
    spec: () => spec("Largo du Nouveau Monde", "A. Dvořák", 60, [...LARGO_P("p"), ...LARGO_P("pp")], LARGO_L) },
  { id: "marche-funebre", title: "Marche funèbre", composer: "F. Chopin (Sonate op. 35), arrangement", level: 1, source: src("la Sonate op. 35, 3e mouvement, mesures 1 à 10"),
    skills: "Ostinato d'accords à la main gauche, rythme pointé serré (croche pointée – double croche), la mineur",
    tip: "Un ostinato, c'est un motif qui se répète sans arrêt : ici la main gauche balance entre deux accords, comme des pas lents. Apprends-la seule d'abord. Chopin l'a écrite en si♭ mineur (cinq bémols) ; on la joue en la mineur, sans aucune altération à la clé.",
    spec: () => spec("Marche funèbre", "F. Chopin", 56, FUN_R, FUN_L) },
  { id: "roi-montagne", title: "Dans l'antre du roi de la montagne", composer: "E. Grieg (Peer Gynt, op. 46 n° 4), arrangement", level: 1, source: src("Peer Gynt, suite n° 1"),
    skills: "La mineur, altérations accidentelles (ré♯, si♭, sol♯), passage du pouce, main gauche en quintes détachées",
    tip: "Une altération accidentelle (♯, ♭ ou ♮ devant une note) ne vaut que jusqu'à la fin de la mesure. Dans la 2e mesure, le motif glisse d'un demi-ton : ré♯ – si, puis ré – si♭. Commence lentement ; dans l'original, le thème accélère jusqu'à la fin.",
    spec: () => spec("Dans l'antre du roi de la montagne", "E. Grieg", 96, MK_R, MK_L) },
  { id: "matin", title: "Au matin", composer: "E. Grieg (Peer Gynt, op. 46 n° 1), arrangement", level: 1, source: src("Peer Gynt, suite n° 1"),
    skills: "Mesure à 6/8, la mélodie passe à la main gauche, doubles croches",
    tip: "6/8 : deux grands temps par mesure, chacun fait de trois croches (« 1-2-3, 4-5-6 »). La mélodie passe ensuite à la main gauche, une octave plus bas, pendant que la droite tient l'accord : fais-la chanter autant qu'à droite. Grieg l'a écrite en Mi ; ici en Do.",
    spec: () => spec("Au matin", "E. Grieg", 80, MATIN_R, MATIN_L, { beats: 6, beatType: 8 }) },
  { id: "lac-cygnes", title: "Le lac des cygnes", composer: "P. I. Tchaïkovski, arrangement", level: 2, source: src("Le lac des cygnes, op. 20 (scène finale de l'acte II)"),
    skills: "Mélodie en octaves à la main droite, arpèges en croches à la main gauche, la mineur",
    tip: "Une octave, c'est la même note huit notes plus haut : pouce et 5e doigt ensemble, la main ouverte et le poignet souple, c'est le 5e doigt qui chante. Joue d'abord le thème simple (la première fois), puis les octaves. Original en si mineur.",
    spec: () => spec("Le lac des cygnes", "P. I. Tchaïkovski", 72, SWAN_R, SWAN_L) },
  { id: "toccata", title: "Toccata en ré mineur (introduction)", composer: "J. S. Bach (BWV 565), arrangement", level: 2, source: src("BWV 565, pour orgue"),
    skills: "Ornement écrit (mordant), descente rapide en doubles croches, mains à l'octave, accord de septième diminuée",
    tip: "La – sol – la, très vite, c'est un mordant : un petit tremblement qui fait sonner la note. Les deux mains jouent la même chose à une ou deux octaves d'écart, puis la gauche descend seule dans le grave. Le dernier accord avant la fin (do♯ – mi – sol – si♭) est une septième diminuée : tendu, il se résout sur ré mineur.",
    spec: () => spec("Toccata en ré mineur", "J. S. Bach", 50, TOC_R, TOC_L, { fifths: -1 }) },
];
