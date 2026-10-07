/** Chansons avec grille d'accords (airs traditionnels ou du domaine public) : la mélodie à la main droite, doigtés écrits,
 *  les symboles d'accords au-dessus, et la main gauche qui suit la grille avec un motif (ce que fait l'unité
 *  « Accompagner une chanson »). Pour jouer « comme dans les applis de chansons », mais en lisant la grille. */
import type { Tok } from "../course/build";
import { gridSpec, type GridOpts } from "../course/accomp";
import { ODE } from "../course/pieces";
import { s, e, q, dq, h, dh, w, type RepPiece } from "./common";
const de = 1.5;

const FRERE: Tok[] = [
  ["C4", q, 1], ["D4", q, 2], ["E4", q, 3], ["C4", q, 1], ["C4", q, 1], ["D4", q, 2], ["E4", q, 3], ["C4", q, 1],
  ["E4", q, 3], ["F4", q, 4], ["G4", h, 5], ["E4", q, 3], ["F4", q, 4], ["G4", h, 5],
  ["G4", e, 4], ["A4", e, 5], ["G4", e, 4], ["F4", e, 3], ["E4", q, 2], ["C4", q, 1], ["G4", e, 4], ["A4", e, 5], ["G4", e, 4], ["F4", e, 3], ["E4", q, 2], ["C4", q, 1],
  ["C4", q, 2], ["G3", q, 1], ["C4", h, 2], ["C4", q, 2], ["G3", q, 1], ["C4", h, 2],
];
const CLAIR_A: Tok[] = [["C4", q, 1], ["C4", q, 1], ["C4", q, 1], ["D4", q, 2], ["E4", h, 3], ["D4", h, 2], ["C4", q, 1], ["E4", q, 3], ["D4", q, 2], ["D4", q, 2], ["C4", w, 1]];
const CLAIR: Tok[] = [...CLAIR_A, ...CLAIR_A,
  ["D4", q, 5], ["D4", q, 5], ["D4", q, 5], ["D4", q, 5], ["A3", h, 2], ["A3", h, 2], ["D4", q, 5], ["C4", q, 4], ["B3", q, 3], ["A3", q, 2], ["G3", w, 1],
  ...CLAIR_A];
const TW_A: Tok[] = [["C4", q, 1], ["C4", q, 1], ["G4", q, 4], ["G4", q, 4], ["A4", q, 5], ["A4", q, 5], ["G4", h, 4], ["F4", q, 4], ["F4", q, 4], ["E4", q, 3], ["E4", q, 3], ["D4", q, 2], ["D4", q, 2], ["C4", h, 1]];
const TW_B: Tok[] = [["G4", q, 5], ["G4", q, 5], ["F4", q, 4], ["F4", q, 4], ["E4", q, 3], ["E4", q, 3], ["D4", h, 2]];
const TWINKLE: Tok[] = [...TW_A, ...TW_B, ...TW_B, ...TW_A];
const JB_A: Tok[] = [["E4", q, 3], ["E4", q, 3], ["E4", h, 3], ["E4", q, 3], ["E4", q, 3], ["E4", h, 3], ["E4", q, 3], ["G4", q, 5], ["C4", q, 1], ["D4", q, 2], ["E4", w, 3],
  ["F4", q, 4], ["F4", q, 4], ["F4", q, 4], ["F4", q, 4], ["F4", q, 4], ["E4", q, 3], ["E4", q, 3], ["E4", e, 3], ["E4", e, 3]];
const JINGLE: Tok[] = [...JB_A, ["E4", q, 3], ["D4", q, 2], ["D4", q, 2], ["E4", q, 3], ["D4", h, 2], ["G4", h, 5], ...JB_A, ["G4", q, 5], ["G4", q, 5], ["F4", q, 4], ["D4", q, 2], ["C4", w, 1]];
const NUIT: Tok[] = [
  ["G4", dq, 3], ["A4", e, 4], ["G4", q, 3], ["E4", dh, 1], ["G4", dq, 3], ["A4", e, 4], ["G4", q, 3], ["E4", dh, 1],
  ["D5", h, 5], ["D5", q, 5], ["B4", dh, 3], ["C5", h, 4], ["C5", q, 4], ["G4", dh, 1],
  ["A4", h, 3], ["A4", q, 3], ["C5", dq, 5], ["B4", e, 4], ["A4", q, 3], ["G4", dq, 2], ["A4", e, 3], ["G4", q, 2], ["E4", dh, 1],
  ["A4", h, 3], ["A4", q, 3], ["C5", dq, 5], ["B4", e, 4], ["A4", q, 3], ["G4", dq, 2], ["A4", e, 3], ["G4", q, 2], ["E4", dh, 1],
  ["D5", h, 4], ["D5", q, 4], ["F5", dq, 5], ["D5", e, 3], ["B4", q, 2], ["C5", dh, 3], ["E5", dh, 5],
  ["C5", q, 4], ["G4", q, 2], ["E4", q, 1], ["G4", dq, 3], ["F4", e, 2], ["D4", q, 1], ["C4~", dh, 1], ["C4", dh, 1],
];
const BIRTHDAY: Tok[] = [
  ["R", h], ["G4", de, 1], ["G4", s, 1],
  ["A4", q, 2], ["G4", q, 1], ["C5", q, 4], ["B4", h, 3], ["G4", de, 1], ["G4", s, 1],
  ["A4", q, 2], ["G4", q, 1], ["D5", q, 5], ["C5", h, 4], ["G4", de, 1], ["G4", s, 1],
  ["G5", q, 5], ["E5", q, 3], ["C5", q, 1], ["B4", q, 3], ["A4", q, 2], ["F5", de, 5], ["F5", s, 5],
  ["E5", q, 4], ["C5", q, 2], ["D5", q, 3], ["C5", dh, 2],
];
// ───────── chansons ajoutées : une grille simple chacune, de la plus facile (une seule note à gauche) à la valse avec levée ─────────
const MARY: Tok[] = [
  ["E4", q, 3], ["D4", q, 2], ["C4", q, 1], ["D4", q, 2], ["E4", q, 3], ["E4", q, 3], ["E4", h, 3],
  ["D4", q, 2], ["D4", q, 2], ["D4", h, 2], ["E4", q, 3], ["G4", q, 5], ["G4", h, 5],
  ["E4", q, 3], ["D4", q, 2], ["C4", q, 1], ["D4", q, 2], ["E4", q, 3], ["E4", q, 3], ["E4", q, 3], ["E4", q, 3],
  ["D4", q, 2], ["D4", q, 2], ["E4", q, 3], ["D4", q, 2], ["C4", w, 1],
];
const SAINTS_IN: Tok[] = [["R", q], ["C4", q, 1], ["E4", q, 3], ["F4", q, 4]];
const SAINTS: Tok[] = [
  ...SAINTS_IN, ["G4", w, 5], ...SAINTS_IN, ["G4", w, 5],
  ...SAINTS_IN, ["G4", h, 5], ["E4", h, 3], ["C4", h, 1], ["E4", h, 3], ["D4", w, 2],
  ["R", q], ["E4", q, 3], ["E4", q, 3], ["D4", q, 2], ["C4", w, 1], ["E4", h, 3], ["G4", h, 5], ["G4", q, 5], ["F4", dh, 4],
  ["R", h], ["E4", q, 3], ["F4", q, 4], ["G4", h, 5], ["E4", h, 3], ["C4", h, 1], ["D4", h, 2], ["C4", w, 1],
];
/** levée : la première mesure est une introduction de la main gauche, la mélodie entre sur le dernier temps */
const GRACE: Tok[] = [
  ["R", h], ["G4", q, 1],
  ["C5", h, 3], ["E5", e, 5], ["C5", e, 3], ["E5", h, 5], ["D5", q, 4], ["C5", h, 3], ["A4", q, 2], ["G4", h, 1], ["G4", q, 1],
  ["C5", h, 1], ["E5", e, 3], ["C5", e, 1], ["E5", h, 3], ["D5", q, 2], ["G5", dh, 5], ["G5", h, 5], ["E5", q, 3],
  ["G5", h, 5], ["E5", e, 3], ["C5", e, 1], ["E5", h, 5], ["D5", q, 4], ["C5", h, 3], ["A4", q, 2], ["G4", h, 1], ["G4", q, 1],
  ["C5", h, 3], ["E5", e, 5], ["C5", e, 3], ["E5", h, 5], ["D5", q, 4], ["C5", dh, 3], ["C5", dh, 3],
];
const ALS_A: Tok[] = [
  ["C5", dq, 3], ["C5", e, 3], ["C5", q, 3], ["E5", q, 5], ["D5", dq, 4], ["C5", e, 3], ["D5", q, 4], ["E5", q, 5],
  ["C5", dq, 1], ["C5", e, 1], ["E5", q, 2], ["G5", q, 3], ["A5", dh, 4], ["C6", q, 5],
];
const ALS_B: Tok[] = [
  ["G5", dq, 4], ["E5", e, 2], ["E5", q, 2], ["C5", q, 1], ["D5", dq, 2], ["C5", e, 1], ["D5", q, 2], ["E5", q, 3],
  ["C5", dq, 3], ["A4", e, 2], ["A4", q, 2], ["G4", q, 1],
];
const AULD: Tok[] = [
  ["R", dh], ["G4", q, 1],
  ...ALS_A, ...ALS_B, ["C5", dh, 3], ["A5", q, 5],
  ["G5", dq, 4], ["E5", e, 2], ["E5", q, 2], ["C5", q, 1], ["D5", dq, 2], ["C5", e, 1], ["D5", q, 2], ["A5", q, 5],
  ["G5", dq, 4], ["E5", e, 2], ["E5", q, 2], ["G5", q, 3], ["A5", dh, 4], ["C6", q, 5],
  ...ALS_B, ["C5", dh, 3], ["R", q],
];
const XMAS_V = (end: Tok[]): Tok[] => [
  ["C5", q, 4], ["C5", e, 4], ["D5", e, 5], ["C5", e, 4], ["B4", e, 3], ["A4", q, 2], ["A4", q, 2], ["A4", q, 2],
  ["D5", q, 2], ["D5", e, 2], ["E5", e, 3], ["D5", e, 2], ["C5", e, 1], ["B4", q, 3], ["G4", q, 1], ["G4", q, 1],
  ["E5", q, 3], ["E5", e, 3], ["F5", e, 4], ["E5", e, 3], ["D5", e, 2], ["C5", q, 1], ["A4", q, 3], ["G4", e, 2], ["G4", e, 1],
  ["A4", q, 2], ["D5", q, 5], ["B4", q, 3], ...end,
];
const XMAS: Tok[] = [["R", h], ["G4", q, 1], ...XMAS_V([["C5", h, 4], ["G4", q, 1]]), ...XMAS_V([["C5", dh, 4]])];
const g = (...bars: (string | string[])[]) => bars.map((b) => (Array.isArray(b) ? b : [b]));
const ODE_GRID = g("C", "G", "C", "G", "C", "G", "C", ["G", "C"], "C", "G", "C", "G", "C", "G", "C", ["G", "C"]);

const song = (id: string, title: string, composer: string, skills: string, tip: string, o: Omit<GridOpts, "title" | "composer">): RepPiece =>
  ({ id, title, composer, level: 1, song: true, skills, tip, source: "air traditionnel / domaine public ; grille et doigtés PianoFlow", spec: () => gridSpec({ ...o, title, composer }) });

export const SONGS: RepPiece[] = [
  song("s-mary", "Marie avait un petit agneau", "Traditionnel américain", "Trois notes et une seule basse par mesure : la toute première chanson", "La main gauche ne joue qu'une note longue par mesure, la lettre écrite au-dessus : C = Do, G = Sol. La droite ne quitte jamais la position de Do.",
    { bpm: 96, rh: MARY, lh: "root", grid: g("C", "C", "G", "C", "C", "C", "G", "C") }),
  song("s-frere", "Frère Jacques", "Traditionnel", "Mélodie en position de Do, main gauche en arpège 1-5", "La main gauche ne change presque jamais d'accord : regarde la mélodie, la gauche tourne toute seule.",
    { bpm: 92, rh: FRERE, lh: "arp", grid: g("C", "C", "C", "C", ["G", "C"], ["G", "C"], "C", "C") }),
  song("s-clair", "Au clair de la lune", "Traditionnel", "Grille C – G, basse puis quinte, une phrase en Ré mineur", "Les lettres changent à la demi-mesure : la main gauche suit les lettres, pas les notes de la mélodie.",
    { bpm: 80, rh: CLAIR, lh: "root5", grid: g("C", ["C", "G"], ["C", "G"], "C", "C", ["C", "G"], ["C", "G"], "C", "G", "Dm", "G", "G", "C", ["C", "G"], ["C", "G"], "C") }),
  song("s-twinkle", "Ah ! vous dirai-je, maman", "Traditionnel (Mozart en a fait des variations)", "Grille C – F – G, deux accords par mesure", "Chaque demi-mesure a son accord : C, F, G suffisent pour toute la chanson.",
    { bpm: 84, rh: TWINKLE, lh: "root5", grid: g("C", ["F", "C"], ["F", "C"], ["G", "C"], ["C", "F"], ["C", "G"], ["C", "F"], ["C", "G"], "C", ["F", "C"], ["F", "C"], ["G", "C"]) }),
  song("s-ode", "Ode à la joie (avec accords)", "L. van Beethoven", "Mélodie conjointe, main gauche en arpège", "Garde la main droite en position de Do ; la gauche déroule l'arpège de chaque lettre.",
    { bpm: 84, rh: ODE, lh: "arp", grid: ODE_GRID.slice(0, 8) }),
  song("s-jingle", "Jingle Bells (refrain)", "J. L. Pierpont", "« Boum-tchak » à la main gauche, notes répétées à droite", "La main gauche fait basse – accord – basse – accord : c'est elle qui donne l'élan.",
    { bpm: 104, rh: JINGLE, lh: "oompah", grid: g("C", "C", "C", "C", "F", "C", "G", "G", "C", "C", "C", "C", "F", "C", "G", "C") }),
  song("s-nuit", "Douce nuit", "F. X. Gruber", "Mesure à 6/8 (deux temps de trois croches), basse puis quinte", "Compte « 1-2-3-4-5-6 » en appuyant le 1 et le 4 : la main gauche joue exactement sur ces deux temps.",
    { bpm: 72, rh: NUIT, lh: "root5", beats: 6, beatType: 8, grid: g("C", "C", "C", "C", "G", "G", "C", "C", "F", "F", "C", "C", "F", "F", "C", "C", "G", "G", "C", "C", "C", "G", "C", "C") }),
  song("s-birthday", "Joyeux anniversaire", "M. et P. Hill", "Valse à 3 temps (basse – accord – accord), levée", "La première mesure est une introduction de la main gauche : la mélodie entre sur la fin, « Joy-eux ».",
    { bpm: 96, rh: BIRTHDAY, lh: "waltz", beats: 3, grid: g("C", "C", "G", "G", "C", "C", "F", "C", "C") }),
  song("s-saints", "When the Saints Go Marching In", "Spiritual afro-américain (traditionnel)", "Démarrer après un silence, « boum-tchak » à la main gauche, une septième (C7)", "Chaque phrase commence sur un silence : compte « 1 » dans ta tête, et la main droite entre sur « 2 » (sur « 3 » pour la dernière phrase). C7, c'est l'accord de Do avec un si♭ en plus : il donne envie d'aller vers Fa.",
    { bpm: 100, rh: SAINTS, lh: "oompah", grid: g("C", "C", "C", "C", "C", "C", "C", "G", "C", "C", "C7", "F", "F", "C", ["F", "G"], "C") }),
  song("s-grace", "Amazing Grace", "Air traditionnel américain", "Valse lente à 3 temps, levée, main qui se déplace d'une position à l'autre", "La mélodie commence par une levée (une note avant la première vraie mesure). Sur « ma-zing », la main passe d'une position à l'autre pendant la note longue : prépare le déplacement en avance.",
    { bpm: 76, rh: GRACE, lh: "waltz", beats: 3, grid: g("C", "C", "C", "F", "C", "C", "Am", "G", "G", "C", "C", "F", "C", "C", "G", "C", "C") }),
  song("s-auld", "Ce n'est qu'un au revoir", "Air traditionnel écossais (Auld Lang Syne)", "Rythme pointé (longue – courte), levée, saut de sixte vers le la aigu", "Chaque mesure commence par « longue – courte » : une noire pointée puis une croche, comme « taaa-ta ». Le grand saut vers le la aigu arrive toujours après une note longue : tu as le temps.",
    { bpm: 84, rh: AULD, lh: "root5", grid: g("C", "C", "G", "C", "F", "C", "G", ["F", "G"], "C", "C", "G", "C", "F", "C", "G", ["F", "G"], "C") }),
  song("s-xmas", "We Wish You a Merry Christmas", "Chant traditionnel anglais", "Valse à 3 temps, croches, accords de septième (D7, E7)", "D7 et E7 sont des accords « qui attirent » : chacun pousse vers l'accord suivant (D7 vers G, E7 vers Am). Les croches de la main droite vont deux par temps : « 1-et ».",
    { bpm: 100, rh: XMAS, lh: "waltz", beats: 3, grid: g("C", "C", "F", "D7", "G", "E7", "Am", "G", "C", "C", "F", "D7", "G", "E7", "Am", "G", "C") }),
];
void dq;
