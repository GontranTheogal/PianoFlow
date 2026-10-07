/** Niveau 1 du répertoire : les premiers vrais morceaux, après le parcours de base (deux mains, 3/4, croches, une altération à la clé).
 *  Notes vérifiées contre une édition de référence (voir `source`) ; doigtés écrits pour les deux mains. */
import type { Tok } from "../course/build";
import { s, de, e, q, dq, h, dh, w, spec, rep, type RepPiece } from "./common";

// ───────── Petzold, Menuet en Sol majeur (BWV Anh. 114), complet ─────────
const MENUET_A: Tok[] = [
  ["D5", q, 5], ["G4", e, 1], ["A4", e, 2], ["B4", e, 3], ["C5", e, 4],
  ["D5", q, 5], ["G4", q, 1], ["G4", q, 1],
  ["E5", q, 3], ["C5", e, 1], ["D5", e, 2], ["E5", e, 3], ["F#5", e, 4],
  ["G5", q, 5], ["G4", q, 1], ["G4", q, 1],
];
const MENUET_R: Tok[] = [
  ...MENUET_A,
  ["C5", q, 4], ["D5", e, 5], ["C5", e, 4], ["B4", e, 3], ["A4", e, 2],
  ["B4", q, 4], ["C5", e, 5], ["B4", e, 4], ["A4", e, 3], ["G4", e, 2],
  ["F#4", q, 1], ["G4", e, 2], ["A4", e, 3], ["B4", e, 4], ["G4", e, 2],
  ["A4", dh, 3],
  ...MENUET_A,
  ["C5", q, 4], ["D5", e, 5], ["C5", e, 4], ["B4", e, 3], ["A4", e, 2],
  ["B4", q, 4], ["C5", e, 5], ["B4", e, 4], ["A4", e, 3], ["G4", e, 2],
  ["A4", q, 3], ["B4", e, 4], ["A4", e, 3], ["G4", e, 2], ["F#4", e, 1],
  ["G4", dh, 2],
  // seconde partie
  ["B5", q, 5], ["G5", e, 3], ["A5", e, 4], ["B5", e, 5], ["G5", e, 3],
  ["A5", q, 4], ["D5", e, 1], ["E5", e, 2], ["F#5", e, 3], ["D5", e, 1],
  ["G5", q, 5], ["E5", e, 3], ["F#5", e, 4], ["G5", e, 5], ["D5", e, 4],
  ["C#5", q, 3], ["B4", e, 2], ["C#5", e, 3], ["A4", q, 1],
  ["A4", e, 1], ["B4", e, 2], ["C#5", e, 3], ["D5", e, 1], ["E5", e, 2], ["F#5", e, 3],
  ["G5", q, 4], ["F#5", q, 3], ["E5", q, 2],
  ["F#5", q, 3], ["A4", q, 1], ["C#5", q, 2],
  ["D5", dh, 3],
  ["D5", q, 5], ["G4", e, 2], ["F#4", e, 1], ["G4", q, 2],
  ["E5", q, 5], ["G4", e, 2], ["F#4", e, 1], ["G4", q, 2],
  ["D5", q, 5], ["C5", q, 4], ["B4", q, 3],
  ["A4", e, 3], ["G4", e, 2], ["F#4", e, 1], ["G4", e, 2], ["A4", q, 3],
  ["D4", e, 1], ["E4", e, 2], ["F#4", e, 3], ["G4", e, 1], ["A4", e, 2], ["B4", e, 3],
  ["C5", q, 4], ["B4", q, 3], ["A4", q, 2],
  ["B4", e, 3], ["D5", e, 5], ["G4", q, 2], ["F#4", q, 1],
  ["B3+D4+G4", dh, "125"],
];
const MENUET_L: Tok[] = [
  ["G3+B3+D4", h, "531"], ["A3", q, 4],
  ["B3", dh, 3], ["C4", dh, 2], ["B3", dh, 3], ["A3", dh, 4], ["G3", dh, 5],
  ["D4", q, 1], ["B3", q, 3], ["G3", q, 5],
  ["D4", q, 1], ["D3", e, 5], ["C4", e, 1], ["B3", e, 2], ["A3", e, 3],
  ["B3", h, 2], ["A3", q, 3],
  ["G3", q, 4], ["B3", q, 2], ["G3", q, 4],
  ["C4", dh, 1],
  ["B3", q, 2], ["C4", e, 1], ["B3", e, 2], ["A3", e, 3], ["G3", e, 4],
  ["A3", h, 3], ["F#3", q, 5],
  ["G3", h, 4], ["B3", q, 2],
  ["C4", q, 2], ["D4", q, 1], ["D3", q, 5],
  ["G3", h, 1], ["G2", q, 5],
  // seconde partie
  ["G3", dh, 1], ["F#3", dh, 2],
  ["E3", q, 3], ["G3", q, 1], ["E3", q, 3],
  ["A3", h, 1], ["A2", q, 5],
  ["A3", dh, 1],
  ["B3", q, 3], ["D4", q, 1], ["C#4", q, 2],
  ["D4", q, 1], ["F#3", q, 4], ["A3", q, 2],
  ["D4", q, 1], ["D3", q, 5], ["C4", q, 1],
  ["B3", h, 2], ["B3", q, 2],
  ["C4", h, 2], ["C4", q, 2],
  ["B3", q, 3], ["A3", q, 4], ["G3", q, 5],
  ["D4", h, 1], ["R", q],
  ["D3", dh, 5],
  ["E3", q, 4], ["G3", q, 2], ["F#3", q, 3],
  ["G3", q, 1], ["B2", q, 5], ["D3", q, 3],
  ["G3", q, 1], ["D3", q, 3], ["G2", q, 5],
];
/** Voix intérieure de la main gauche (mesures 25, 26, 29) : la note tenue au-dessus de la basse. */
const MENUET_L2: Tok[] = [
  ...rep(24, [["H", dh]]),
  ["R", q], ["D4", h, 1],
  ["R", q], ["E4", h, 1],
  ["H", dh], ["H", dh],
  ["R", q], ["R", q], ["F#3", q, 2],
  ["H", dh], ["H", dh], ["H", dh],
];


// ───────── Schumann, Mélodie (Album pour la jeunesse, op. 68 n° 1) ─────────
const MEL_A_R: Tok[] = [
  ["E5", q, 5, "p ("], ["D5", q, 4], ["C5", q, 3], ["B4", q, 2],
  ["A4", e, 1], ["C5", e, 3], ["B4", e, 2], ["D5", e, 4], ["C5", q, 3], ["G4", q, 1, ")"],
  ["G5", q, 5, "("], ["F5", q, 4], ["E5", q, 3], ["C5", q, 1],
  ["B4", q, 1], ["F#4+A4", q, "23"], ["G4", q, 1, ")"], ["R", q],
];
const MEL_A_L: Tok[] = [
  ["C4", e, 5, "("], ["G4", e, 1], ["F4", e, 2], ["G4", e, 1], ["E4", e, 3], ["G4", e, 1], ["C4", e, 5], ["E4", e, 3],
  ["F4", e, 2], ["D4", e, 4], ["G4", e, 1], ["F4", e, 2], ["E4", e, 3], ["F4", e, 2], ["E4", e, 3], ["D4", e, 4, ")"],
  ["E4", e, 3, "("], ["G4", e, 1], ["D4", e, 4], ["G4", e, 1], ["C4", e, 5], ["G4", e, 1], ["E4", e, 3], ["G4", e, 1],
  ["D4", e, 2], ["G4", e, 1], ["C4", e, 3], ["D4", e, 2], ["B3", e, 4], ["D4", e, 2], ["G3", q, 5, ")"],
];
/** seconde partie (deux fois, avec deux fins différentes) */
const melB = (last: boolean): { r: Tok[]; r2: Tok[]; l: Tok[] } => ({
  r: [
    ["D5", q, 3, "("], ["C5", q, 2], ["B4", q, 1, ")"], ["R", q],
    ["F5", q, 3, "("], ["E5", q, 2], ["D5", q, 1, ")"], ["R", q],
    ["A5", q, 5, "cresc ("], ["G5", q, 4], ["F5", q, 3], ["E5", q, 2],
    ["D5", e, 1], ["F5", e, 3], ["E5", e, 2], ["G5", e, 5], ["F5", dq, 4], ["H", e],
    ["C5+E5", q, "35", "p"], ["D5", q, 4], ["C5", q, 3], ["B4", q, 2],
    ["A4", e, 1], ["C5", e, 3], ["B4", e, 2], ["D5", e, 4], ["C5", q, 3], ["G4", q, 1, ")"],
    ["A5", q, 5, "("], ["G5", q, 4], ["B4+F5", q, "15"], ["C5+E5", q, "24"],
    ["D5", e, 3], ["F5", e, 5], ["B4", e, 1], ["D5", e, 3], ["C5", q, 2, ")"], ["R", q],
  ],
  // voix intérieure de la mesure 4 de la phrase : la main tient le fa pendant que les doigts 1-2-3 continuent
  r2: [...rep(3, [["H", w]]), ["H", q], ["H", q], ["A4", e, 1], ["C5", e, 2], ["B4", e, 1], ["D5", e, 3], ...rep(4, [["H", w]])],
  l: [
    ["F4", e, 2, "("], ["G4", e, 1], ["E4", e, 3], ["G4", e, 1], ["D4", e, 4], ["G4", e, 1], ["F#4", e, 2], ["G4", e, 1, ")"],
    ["D4", e, 3, "("], ["G4", e, 1], ["C4", e, 4], ["G4", e, 1], ["B3", e, 5], ["G4", e, 1], ["F#4", e, 2], ["G4", e, 1, ")"],
    ["F4", e, 2, "("], ["G4", e, 1], ["E4", e, 3], ["G4", e, 1], ["D4", e, 4], ["G4", e, 1], ["C4", e, 5], ["G4", e, 1],
    ["B3", e, 5], ["G4", e, 1], ["C4", e, 4], ["C#4", e, 3], ["D4", q, 2], ["G4", q, 1, ")"],
    ["C4", e, 5, "("], ["G4", e, 1], ["F4", e, 2], ["G4", e, 1], ["E4", e, 3], ["G4", e, 1], ["C4", e, 5], ["E4", e, 3],
    ["F4", e, 2], ["D4", e, 4], ["G4", e, 1], ["F4", e, 2], ["E4", e, 3], ["F4", e, 2], ["E4", e, 3], ["C4", e, 5, ")"],
    ["F4", e, 4, "("], ["C5", e, 1], ["E4", e, 5], ["C5", e, 1], ["D4", e, 5], ["G4", e, 1], ["C4", e, 5], ["G4", e, 1],
    ["F4", e, 3], ["A4", e, 1], ["G4", e, 2], ["F4", e, 3], ["E4", e, 4], ["G4", e, 2], ...(last ? [["C4", q, 5, ")"]] as Tok[] : [["C4", e, 5], ["E4", e, 3, ")"]] as Tok[]),
  ],
});
const MB1 = melB(false), MB2 = melB(true);
const H8: Tok[] = rep(8, [["H", w]]);
const MELODIE_R: Tok[] = [...MEL_A_R, ...MEL_A_R, ...MB1.r, ...MB2.r];
const MELODIE_R2: Tok[] = [...H8, ...MB1.r2, ...MB2.r2];
const MELODIE_L: Tok[] = [...MEL_A_L, ...MEL_A_L, ...MB1.l, ...MB2.l];

// ───────── Pachelbel, Canon en Ré : arrangement (basse arpégée, puis les trois premières entrées, la dernière en tierces) ─────────
const CANON_CHORDS = [["D3", "A3", "D4"], ["A2", "E3", "A3"], ["B2", "F#3", "B3"], ["F#2", "C#3", "F#3"], ["G2", "D3", "G3"], ["D3", "A3", "D4"], ["G2", "D3", "G3"], ["A2", "E3", "A3"]];
/** une harmonie = 4 croches : fondamentale, quinte, octave, quinte (doigts 5-2-1-2) */
const canonBass = (): Tok[] => CANON_CHORDS.flatMap(([r, f, o]) => [[r, e, 5], [f, e, 2], [o, e, 1], [f, e, 2]] as Tok[]);
const CANON_R: Tok[] = [
  ["R", w], ["R", w], ["R", w], ["R", w],                                             // la basse seule : écoute la grille
  ["F#5", h, 5, "p"], ["E5", h, 4], ["D5", h, 3], ["C#5", h, 2], ["B4", h, 2], ["A4", h, 1], ["B4", h, 2], ["C#5", h, 3],
  ["D5", h, 4], ["C#5", h, 3], ["B4", h, 2], ["A4", h, 1], ["G4", h, 3], ["F#4", h, 2], ["G4", h, 3], ["E4", h, 1],
  ["D4", q, 1, "mf"], ["F#4", q, 3], ["A4", q, 5], ["G4", q, 4], ["F#4", q, 3], ["D4", q, 1], ["F#4", q, 3], ["E4", q, 2],
  ["D4", q, 2], ["B3", q, 1], ["D4", q, 2], ["A4", q, 5], ["G4", q, 3], ["B4", q, 5], ["A4", q, 4], ["G4", q, 3],
  ["D5+F#5", h, "35", "f"], ["C#5+E5", h, "24"], ["B4+D5", h, "35"], ["A4+C#5", h, "24"], ["G4+B4", h, "35"], ["F#4+A4", h, "24"], ["G4+B4", h, "13"], ["A4+C#5", h, "24"],
  ["D4+F#4+A4+D5", w, "1235"],
];
const CANON_L: Tok[] = [...rep(5, canonBass()), ["D2+D3", w, "51"]];

// ───────── Schumann, Marche militaire (Soldatenmarsch, op. 68 n° 2) ─────────
const MAR_A_R = (end: Tok[]): Tok[] => [
  ["G4+B4", de, "13", "f"], ["G4+C5", s, "14"], ["G4+D5", e, "15", "."], ["R", e],
  ["G4+E5", e, "15", "."], ["R", e], ["G4+D5", e, "14", "."], ["R", e],
  ["F#4+C5", e, "14", "."], ["R", e], ["G4+B4", e, "13", "."], ["R", e],
  ["F#4+A4", e, "13", "."], ["R", e], ["G4", e, 2, "."], ["R", e],
  ["G4+B4", de, "13"], ["G4+C5", s, "14"], ["G4+D5", e, "15", "."], ["R", e],
  ["G4+E5", e, "15", "."], ["R", e], ["G4+D5", e, "14", "."], ["R", e],
  ...end,
];
const MAR_END1: Tok[] = [["E5+G5", e, "35", "."], ["R", e], ["D5+F#5", e, "24", "."], ["R", e], ["C#5+E5", e, "13", "."], ["R", e], ["D5", e, 2, "."], ["R", e]];
const MAR_A_L: Tok[] = [
  ["G3", de, 3], ["A3", s, 2], ["B3", e, 1, "."], ["R", e],
  ["C4", e, 1, "."], ["R", e], ["B3", e, 2, "."], ["R", e],
  ["A3", e, 3, "."], ["R", e], ["G3", e, 4, "."], ["R", e],
  ["D3+C4", e, "51", "."], ["R", e], ["G3+B3", e, "31", "."], ["R", e],
  ["G3", de, 3], ["A3", s, 2], ["B3", e, 1, "."], ["R", e],
  ["C4", e, 1, "."], ["R", e], ["B3", e, 2, "."], ["R", e],
  ["C#4", e, 2, "."], ["R", e], ["D4", e, 1, "."], ["R", e],
  ["A3+G4", e, "51", ". clef:G"], ["R", e], ["D4+F#4", e, "31", "."], ["R", e],
];
const MARCHE_R: Tok[] = [
  ...MAR_A_R(MAR_END1), ...MAR_A_R(MAR_END1),
  ["D4", de, 1, "p"], ["E4", s, 2], ["F#4", q, 3], ["E4", q, 2], ["D4", q, 1],
  ["F#4+E5", e, "15", "."], ["R", e], ["G4+D5", e, "14", "."], ["R", e], ["A4+C5", e, "24", "."], ["R", e], ["G4+B4", e, "13", "."], ["R", e],
  ["D4+F#4+A4", de, "135"], ["E4", s, 2], ["F#4", q, 3], ["E4", q, 2], ["D4", q, 1],
  ["A4+C5", e, "24", "."], ["R", e], ["G4+B4", e, "13", "."], ["R", e], ["F#4+A4", e, "13", "."], ["R", e], ["G4+B4", e, "24", "."], ["R", e],
  ["G4+B4", de, "13", "f"], ["G4+C5", s, "14"], ["G4+D5", e, "15", "."], ["R", e],
  ["G4+E5", e, "15", "."], ["R", e], ["G4+D5", e, "14", "."], ["R", e],
  ["F#4+C5", e, "14", "."], ["R", e], ["G4+B4", e, "13", "."], ["R", e],
  ["F#4+A4", e, "13", "."], ["R", e], ["G4", e, 2, "."], ["R", e],
  ["C4", de, 1], ["D4", s, 2], ["E4", q, 3], ["D4", q, 2], ["C4", q, 1],
  ["D4", q, 1], ["A4+D5+F#5", e, "125", "."], ["R", e], ["B4+D5+G5", e, "125", "."], ["R", e], ["R", q],
];
const MARCHE_L: Tok[] = [
  ...MAR_A_L, ["G3", de, 3, "clef:F"], ["A3", s, 2], ["B3", e, 1, "."], ["R", e], ...MAR_A_L.slice(4),
  ["D3", de, 3, "clef:F"], ["E3", s, 2], ["F#3", q, 1], ["E3", q, 2], ["D3", q, 3],
  ["C4", e, 1, "."], ["R", e], ["B3", e, 2, "."], ["R", e], ["F#3+D4", e, "41", "."], ["R", e], ["G3+D4", e, "31", "."], ["R", e],
  ["D3", de, 3], ["E3", s, 2], ["F#3", q, 1], ["E3", q, 2], ["D3", q, 3],
  ["F#3+D4", e, "41", "."], ["R", e], ["G3+D4", e, "31", "."], ["R", e], ["D3+D4", e, "51", "."], ["R", e], ["G3+D4", e, "31", "."], ["R", e],
  ["G3", de, 3], ["A3", s, 2], ["B3", e, 1, "."], ["R", e],
  ["C4", e, 1, "."], ["R", e], ["B3", e, 2, "."], ["R", e],
  ["A3", e, 3, "."], ["R", e], ["G3", e, 4, "."], ["R", e],
  ["D3+C4", e, "51", "."], ["R", e], ["G3+B3", e, "31", "."], ["R", e],
  ["C3", de, 3], ["D3", s, 2], ["E3", q, 1], ["D3", q, 2], ["C3", q, 3],
  ["D3", q, 5], ["D4", e, 1, "."], ["R", e], ["G3", e, 2, "."], ["R", e], ["R", q],
];

// ───────── Brahms, Berceuse (Wiegenlied, op. 49 n° 4) : arrangement en Fa majeur, accompagnement de valse ─────────
/** accompagnement balancé, en croches : fondamentale, puis la quinte et la tierce qui alternent */
const F_: Tok[] = [["F3", e, 5], ["C4", e, 1], ["A3", e, 2], ["C4", e, 1], ["A3", e, 2], ["C4", e, 1]];
const C7_: Tok[] = [["C3", e, 5], ["G3", e, 2], ["Bb3", e, 1], ["G3", e, 2], ["Bb3", e, 1], ["G3", e, 2]];
const Bb_: Tok[] = [["Bb2", e, 5], ["F3", e, 1], ["D3", e, 3], ["F3", e, 1], ["D3", e, 3], ["F3", e, 1]];
const BERCEUSE_R: Tok[] = [
  ["A4", e, 2, "p"], ["A4", e, 2],
  ["C5", dq, 4, "("], ["A4", e, 2], ["A4", q, 2, ")"],
  ["C5", q, 4], ["R", q], ["A4", e, 1, "("], ["C5", e, 2],
  ["F5", q, 5], ["E5", dq, 4], ["D5", e, 3],
  ["D5", q, 3], ["C5", q, 2, ")"], ["G4", e, 1, "("], ["A4", e, 2],
  ["Bb4", q, 3], ["G4", q, 1], ["G4", e, 1], ["A4", e, 2],
  ["Bb4", q, 3, ")"], ["R", q], ["G4", e, 1, "("], ["Bb4", e, 3],
  ["E5", e, 4], ["D5", e, 3], ["C5", q, 2], ["E5", q, 4],
  ["F5", q, 5, ")"], ["R", q], ["F4", e, 1], ["F4", e, 1],
  ["F5", h, 5, "mf ("], ["D5", e, 4], ["Bb4", e, 2],
  ["C5", h, 3, ")"], ["A4", e, 2, "("], ["F4", e, 1],
  ["Bb4", q, 3], ["C5", q, 4], ["D5", q, 5],
  ["C5", h, 4, ")"], ["F4", e, 1, "p"], ["F4", e, 1],
  ["F5", h, 5, "("], ["D5", e, 4], ["Bb4", e, 2],
  ["C5", h, 3, ")"], ["A4", e, 2, "("], ["F4", e, 1],
  ["Bb4", q, 4], ["A4", q, 3], ["G4", q, 2],
  ["F4", h, 1, ")"], ["R", q],
];
const BERCEUSE_L: Tok[] = [
  ["R", q],
  ...F_, ...F_, ...F_, ...C7_, ...C7_, ...C7_, ...C7_, ...F_,
  ...Bb_, ...F_, ...C7_, ...F_, ...Bb_, ...F_, ...C7_,
  ["F2+C3+F3", h, "521"], ["R", q],
];

// ───────── Greensleeves (air traditionnel anglais) : arrangement en la mineur, accords arpégés ─────────
const ARP: Record<string, Tok[]> = {
  Am: [["A2", q, 5], ["C3", q, 3], ["E3", q, 1]], C: [["C3", q, 5], ["E3", q, 3], ["G3", q, 1]], G: [["G2", q, 5], ["B2", q, 3], ["D3", q, 1]],
  Em: [["E3", q, 5], ["G3", q, 3], ["B3", q, 1]], E: [["E3", q, 5], ["G#3", q, 3], ["B3", q, 1]],
};
const arps = (names: string): Tok[] => names.split(" ").flatMap((n) => ARP[n]);
/** au refrain, la main gauche passe en croches : fondamentale, quinte, octave, quinte, tierce, quinte */
const ARP8: Record<string, Tok[]> = {
  Am: [["A2", e, 5], ["E3", e, 2], ["A3", e, 1], ["E3", e, 2], ["C3", e, 4], ["E3", e, 2]], C: [["C3", e, 5], ["G3", e, 2], ["C4", e, 1], ["G3", e, 2], ["E3", e, 4], ["G3", e, 2]],
  G: [["G2", e, 5], ["D3", e, 2], ["G3", e, 1], ["D3", e, 2], ["B2", e, 4], ["D3", e, 2]], Em: [["E3", e, 5], ["B3", e, 2], ["E4", e, 1], ["B3", e, 2], ["G3", e, 4], ["B3", e, 2]],
  E: [["E3", e, 5], ["B3", e, 2], ["E4", e, 1], ["B3", e, 2], ["G#3", e, 4], ["B3", e, 2]],
};
const arps8 = (names: string): Tok[] => names.split(" ").flatMap((n) => ARP8[n]);
const GREEN_R: Tok[] = [
  ["A4", q, 1, "p"],
  ["C5", h, 2, "("], ["D5", q, 3], ["E5", dq, 4], ["F5", e, 5], ["E5", q, 4], ["D5", h, 4], ["B4", q, 2], ["G4", dq, 1], ["A4", e, 2], ["B4", q, 3],
  ["C5", h, 4], ["A4", q, 2], ["A4", dq, 2], ["G#4", e, 1], ["A4", q, 2], ["B4", h, 3], ["G#4", q, 1], ["E4", h, 1, ")"], ["A4", q, 1],
  ["C5", h, 2, "("], ["D5", q, 3], ["E5", dq, 4], ["F5", e, 5], ["E5", q, 4], ["D5", h, 4], ["B4", q, 2], ["G4", dq, 1], ["A4", e, 2], ["B4", q, 3],
  ["C5", dq, 5], ["B4", e, 4], ["A4", q, 3], ["G#4", dq, 2], ["F#4", e, 1], ["G#4", q, 2], ["A4", dh, 3, ")"], ["A4", dh, 3],
  // refrain
  ["G5", dh, 5, "mf ("], ["G5", dq, 5], ["F#5", e, 4], ["E5", q, 3], ["D5", h, 4], ["B4", q, 2], ["G4", dq, 1], ["A4", e, 2], ["B4", q, 3],
  ["C5", h, 4], ["A4", q, 2], ["A4", dq, 2], ["G#4", e, 1], ["A4", q, 2], ["B4", h, 3], ["G#4", q, 1], ["E4", dh, 1, ")"],
  ["G5", dh, 5, "("], ["G5", dq, 5], ["F#5", e, 4], ["E5", q, 3], ["D5", h, 4], ["B4", q, 2], ["G4", dq, 1], ["A4", e, 2], ["B4", q, 3],
  ["C5", dq, 5], ["B4", e, 4], ["A4", q, 3], ["G#4", dq, 2, "dim"], ["F#4", e, 1], ["G#4", q, 2], ["A4", dh, 3, ")"], ["A4", dh, 3],
];
const GREEN_L: Tok[] = [
  ["R", q],
  ...arps("Am C G Em Am E E Am Am C G Em Am E Am Am"),
  ...arps8("C Em G Em Am E E E C Em G Em Am E Am"), ["A2+E3+A3", dh, "521"],
];

export const LEVEL1: RepPiece[] = [
  { id: "menuet", title: "Menuet en Sol majeur", composer: "C. Petzold (Cahier d'Anna Magdalena Bach)", level: 1,
    skills: "Mesure à 3 temps, déplacements de main, deux voix à la main gauche, Sol majeur", source: "Mutopia (BWV Anh. 114), domaine public",
    tip: "Trois temps par mesure, le premier un peu appuyé. Travaille d'abord la seconde partie, plus difficile (Ré majeur passager, do♯).",
    spec: () => spec("Menuet en Sol majeur", "C. Petzold", 104, MENUET_R, [MENUET_L, MENUET_L2], { fifths: 1, beats: 3 }) },
  { id: "melodie", title: "Mélodie", composer: "R. Schumann (Album pour la jeunesse, op. 68 n° 1)", level: 1,
    skills: "Chanter la mélodie au-dessus d'une main gauche en croches continues, lié", source: "Mutopia (op. 68 n° 1), CC BY-SA 2.5",
    tip: "La main gauche, en clé de Sol, joue des croches régulières et douces : la mélodie de la main droite doit chanter au-dessus. Travaille la main gauche seule jusqu'à ce qu'elle soit automatique.",
    spec: () => spec("Mélodie", "R. Schumann", 72, [MELODIE_R, MELODIE_R2], MELODIE_L, { clefs: ["G", "G"] }) },
  { id: "canon", title: "Canon en Ré", composer: "J. Pachelbel (arrangement)", level: 1,
    skills: "Main gauche en arpèges réguliers, mélodie en valeurs longues puis en tierces, Ré majeur",
    tip: "La main gauche répète la même grille de huit accords : apprends-la d'abord seule, par cœur. La main droite entre ensuite, de plus en plus active.",
    spec: () => spec("Canon en Ré", "J. Pachelbel", 66, CANON_R, CANON_L, { fifths: 2 }) },
  { id: "marche", title: "Marche militaire", composer: "R. Schumann (Album pour la jeunesse, op. 68 n° 2)", level: 1,
    skills: "Rythme pointé, accords détachés (staccato) aux deux mains, nuances forte / piano", source: "Mutopia (op. 68 n° 2), CC BY-SA 2.5",
    tip: "Joyeux et bien carré : croche pointée – double croche, puis des accords courts comme un tambour. Le pouce droit reste sur le sol pendant que le dessus monte 3-4-5.",
    spec: () => spec("Marche militaire", "R. Schumann", 100, MARCHE_R, MARCHE_L, { fifths: 1, beats: 2 }) },
  { id: "berceuse", title: "Berceuse", composer: "J. Brahms (op. 49 n° 4), arrangement", level: 1,
    skills: "Levée, mélodie liée et chantante, accompagnement de valse (basse + accord), Fa majeur", source: "mélodie : Mutopia (Wiegenlied), domaine public",
    tip: "Très doux, sans à-coups : la basse sur le premier temps, les deux accords plus légers. La mélodie commence sur le troisième temps (levée).",
    spec: () => spec("Berceuse", "J. Brahms", 72, BERCEUSE_R, BERCEUSE_L, { fifths: -1, beats: 3, pickup: 2 }) },
  { id: "greensleeves", title: "Greensleeves", composer: "Air traditionnel anglais, arrangement", level: 1,
    skills: "La mineur et sa sensible (sol♯), rythme pointé à 3 temps, accords arpégés à la main gauche",
    tip: "Le refrain monte au sol aigu : prépare le saut pendant la note longue d'avant. Main gauche : toujours 5-3-1, sans bouger le poignet.",
    spec: () => spec("Greensleeves", "Traditionnel", 100, GREEN_R, GREEN_L, { beats: 3, pickup: 2 }) },
];
