/** Niveau 2 du répertoire : de vrais classiques complets (ou de longs extraits cohérents), deux mains indépendantes, pédale.
 *  Notes vérifiées contre une édition de référence (voir `source`) ; doigtés écrits pour les deux mains. */
import type { Tok } from "../course/build";
import { s, de, e, q, dq, h, dh, w, spec, rep, type RepPiece } from "./common";
const ddq = 3.5;   // noire doublement pointée

// ───────── Beethoven, Lettre à Élise (WoO 59) : partie A, épisode, retour de A ─────────
const EL_1: Tok[] = [["E5", s, 5], ["D#5", s, 4], ["E5", s, 5], ["B4", s, 2], ["D5", s, 4], ["C5", s, 3]];
const EL_2: Tok[] = [["A4", e, 1], ["R", s], ["C4", s, 1], ["E4", s, 2], ["A4", s, 3]];
const EL_3: Tok[] = [["B4", e, 4], ["R", s], ["E4", s, 1], ["G#4", s, 3], ["B4", s, 4]];
const EL_4: Tok[] = [["C5", e, 5], ["R", s], ["E4", s, 1], ["E5", s, 5], ["D#5", s, 4]];
const EL_7: Tok[] = [["B4", e, 4], ["R", s], ["E4", s, 1], ["C5", s, 3], ["B4", s, 2]];
const EL_A7: Tok[] = [...EL_1, ...EL_2, ...EL_3, ...EL_4, ...EL_1, ...EL_2, ...EL_7];
const ELISE_R: Tok[] = [
  ["E5", s, 5, "pp"], ["D#5", s, 4],
  ...EL_A7, ["A4", q, 1], ["E5", s, 5], ["D#5", s, 4],
  ...EL_A7, ["A4", e, 1], ["R", s], ["B4", s, 2], ["C5", s, 3], ["D5", s, 4],
  ["E5", de, 5, "("], ["G4", s, 1], ["F5", s, 5], ["E5", s, 4],
  ["D5", de, 4], ["F4", s, 1], ["E5", s, 5], ["D5", s, 4],
  ["C5", de, 3], ["E4", s, 1], ["D5", s, 4], ["C5", s, 3],
  ["B4", e, 2, ")"], ["R", s], ["E4", s, 1], ["E5", s, 5], ["R", s],
  ["R", s], ["E5", s, 1], ["E6", s, 5], ["R", s], ["R", s], ["D#5", s, 4],
  ["E5", e, 5], ["R", s], ["D#5", s, 4], ["E5", s, 5], ["D#5", s, 4],
  ...EL_A7, ["A4", dq, 1],
];
const AR_A: Tok[] = [["A2", s, 5, "P"], ["E3", s, 2], ["A3", s, 1], ["R", s], ["R", e, undefined, "P*"]];
const AR_E: Tok[] = [["E2", s, 5, "P"], ["E3", s, 2], ["G#3", s, 1], ["R", s], ["R", e, undefined, "P*"]];
const EL_LA7: Tok[] = [["R", dq], ...AR_A, ...AR_E, ...AR_A, ["R", dq], ...AR_A, ...AR_E];
const ELISE_L: Tok[] = [
  ["R", e],
  ...EL_LA7, ...AR_A,
  ...EL_LA7, ...AR_A,
  ["C3", s, 5, "P"], ["G3", s, 2], ["C4", s, 1], ["R", s], ["R", e, undefined, "P*"],
  ["G2", s, 5, "P"], ["G3", s, 2], ["B3", s, 1], ["R", s], ["R", e, undefined, "P*"],
  ["A2", s, 5, "P"], ["E3", s, 2], ["A3", s, 1], ["R", s], ["R", e, undefined, "P*"],
  ["E2", s, 5], ["E3", s, 1], ["E4", s, 1, "clef:G"], ["R", s], ["R", s], ["E4", s, 5],
  ["E5", s, 1], ["R", s], ["R", s], ["D#5", s, 2], ["E5", s, 1], ["R", s],
  ["R", s], ["D#5", s, 2], ["E5", s, 1], ["R", s], ["R", s], ["R", s],
  ["R", dq, undefined, "clef:F"], ...AR_A, ...AR_E, ...AR_A, ["R", dq], ...AR_A, ...AR_E,
  ["A2", s, 5, "P"], ["E3", s, 2], ["A3", q, 1, "P*"],
];

// ───────── Bach, Prélude en Do majeur (Clavier bien tempéré I, BWV 846), complet ─────────
/** [basse, 2e note, arpège (3 notes), doigts MG basse/2e note, doigts MD] — chaque mesure : deux fois le même dessin */
const PRE: [string, string, string, string, string, number, number, string][] = [
  ["C4", "E4", "G4", "C5", "E5", 3, 1, "135"], ["C4", "D4", "A4", "D5", "F5", 2, 1, "135"], ["B3", "D4", "G4", "D5", "F5", 3, 1, "135"], ["C4", "E4", "G4", "C5", "E5", 3, 1, "135"],
  ["C4", "E4", "A4", "E5", "A5", 3, 1, "135"], ["C4", "D4", "F#4", "A4", "D5", 2, 1, "125"], ["B3", "D4", "G4", "D5", "G5", 3, 1, "135"], ["B3", "C4", "E4", "G4", "C5", 2, 1, "125"],
  ["A3", "C4", "E4", "G4", "C5", 3, 1, "125"], ["D3", "A3", "D4", "F#4", "C5", 5, 1, "125"], ["G3", "B3", "D4", "G4", "B4", 3, 1, "135"], ["G3", "Bb3", "E4", "G4", "C#5", 3, 1, "125"],
  ["F3", "A3", "D4", "A4", "D5", 3, 1, "135"], ["F3", "Ab3", "D4", "F4", "B4", 3, 1, "125"], ["E3", "G3", "C4", "G4", "C5", 3, 1, "135"], ["E3", "F3", "A3", "C4", "F4", 2, 1, "125"],
  ["D3", "F3", "A3", "C4", "F4", 3, 1, "125"], ["G2", "D3", "G3", "B3", "F4", 5, 1, "125"], ["C3", "E3", "G3", "C4", "E4", 3, 1, "135"], ["C3", "G3", "Bb3", "C4", "E4", 5, 1, "124"],
  ["F2", "F3", "A3", "C4", "E4", 5, 1, "124"], ["F#2", "C3", "A3", "C4", "Eb4", 4, 1, "124"], ["Ab2", "F3", "B3", "C4", "D4", 5, 1, "123"], ["G2", "F3", "G3", "B3", "D4", 5, 1, "124"],
  ["G2", "E3", "G3", "C4", "E4", 5, 1, "135"], ["G2", "D3", "G3", "C4", "F4", 5, 1, "135"], ["G2", "D3", "G3", "B3", "F4", 5, 1, "125"], ["G2", "Eb3", "A3", "C4", "F#4", 5, 1, "125"],
  ["G2", "E3", "G3", "C4", "G4", 5, 1, "125"], ["G2", "D3", "G3", "C4", "F4", 5, 1, "135"], ["G2", "D3", "G3", "B3", "F4", 5, 1, "125"], ["C2", "C3", "G3", "Bb3", "E4", 5, 1, "125"],
];
function prelude(): { r: Tok[]; l1: Tok[]; l2: Tok[] } {
  const r: Tok[] = [], l1: Tok[] = [], l2: Tok[] = [];
  PRE.forEach(([b1, b2, a, b, c, f1, f2, fr], i) => {
    const [x, y, z] = fr.split("").map(Number);
    for (let half = 0; half < 2; half++) {
      l1.push([b1, h, f1, i === 0 && half === 0 ? "p" : undefined]);
      l2.push(["R", s], [b2 + "~", de, f2], [b2, q]);
      r.push(["R", e], [a, s, x], [b, s, y], [c, s, z], [a, s, x], [b, s, y], [c, s, z]);
    }
  });
  // mesures 33-34 : la basse de Do tenue, la main droite descend puis remonte ; accord final
  r.push(["R", e], ["F3", s, 1], ["A3", s, 2], ["C4", s, 3], ["F4", s, 5], ["C4", s, 3], ["A3", s, 2], ["C4", s, 4], ["A3", s, 3], ["F3", s, 2], ["A3", s, 3], ["F3", s, 2], ["D3", s, 1], ["F3", s, 2], ["D3", s, 1]);
  r.push(["R", e], ["G4", s, 1], ["B4", s, 2], ["D5", s, 3], ["F5", s, 5], ["D5", s, 3], ["B4", s, 2], ["D5", s, 4], ["B4", s, 3], ["G4", s, 1], ["B4", s, 3], ["D4", s, 1], ["F4", s, 3], ["E4", s, 2], ["D4", s, 1]);
  r.push(["E4+G4+C5", w, "125"]);
  l1.push(["C2", w, 5], ["C2", w, 5], ["C2+C3", w, "51"]);
  l2.push(["R", s], ["C3~", de, 1], ["C3~", q], ["C3", h], ["R", s], ["B2~", de, 2], ["B2~", q], ["B2", h], ["H", w]);
  return { r, l1, l2 };
}
const PRELUDE = prelude();

// ───────── Satie, Gymnopédie n° 1 : le premier énoncé complet (mesures 1 à 39) ─────────
// La main gauche joue la basse puis, sur le 2e temps, l'accord (écrit dans la portée du haut dans l'original).
const GY_G: Tok = ["B3+D4+F#4", h, "321"], GY_D: Tok = ["A3+C#4+F#4", h, "321"];
/** [basse, accord (null = l'accord de la mesure suivante du motif), doigts] mesure par mesure, de 1 à 36 */
const GY_BASS = ["G2", "D2", "G2", "D2", "G2", "D2", "G2", "D2", "G2", "D2", "G2", "D2", "G2", "D2", "G2", "D2", "F#2", "B1",
  "E2", "E2", "D2", "A1", "D2", "D2", "D2", "D2", "D2", "D2", "D2", "D2", "D2", "E2", "F#2", "B1", "E2", "E2"];
const GY_CH: Tok[] = [
  GY_G, GY_D, GY_G, GY_D, GY_G, GY_D, GY_G, GY_D,
  ["B3+D4", h, "21"], ["A3+C#4", h, "21"], ["B3+D4", h, "21"], ["A3+C#4", h, "21"],        // (le fa♯ est tenu par la mélodie)
  GY_G, GY_D, GY_G, GY_D, GY_D, GY_G,
  ["G3+B3", h, "21"], ["B3+D4+G4", h, "321"], ["F3+A3+D4", h, "321"], ["A3+C4+E4", h, "321"], ["G3+B3+E4", h, "321"], ["D3+G3+B3+E4", h, "5321"],
  ["C3+E3+A3+D4", h, "5321"], ["C3+F#3+A3+D4", h, "5321"], ["A3+C4+F4", h, "321"], ["A3+C4+E4", h, "321"], ["D3+G3+B3+E4", h, "5321"], ["C3+E3+A3+D4", h, "5321"],
  ["C3+F#3+A3+D4", h, "5321"], ["B3+E4+G4", h, "321"], ["A3+C#4+F#4", h, "321"], ["B3+D4+F#4", h, "321"], ["C#4+E4+A4", h, "321"], ["A3+C#4+F#4+A4", h, "5321"],
];
const GYMNO_L1: Tok[] = [...GY_BASS.map((b, i) => [b, dh, 5, i === 0 ? "pp P" : "P^"] as Tok), ["E2", dh, 5, "P^"], ["A2+G3", dh, "51", "P^"], ["D2+A2+D3", dh, "521", "P^"]];
const GYMNO_L2: Tok[] = [...GY_CH.flatMap((c) => [["R", q], c] as Tok[]), ["R", q], ["B2", q, 2], ["E3", q, 1], ["H", dh], ["H", dh]];
const GYMNO_R: Tok[] = [
  ...rep(4, [["R", dh]]),
  ["R", q], ["F#5", q, 3, "("], ["A5", q, 5],
  ["G5", q, 4], ["F#5", q, 3], ["C#5", q, 2],
  ["B4", q, 1], ["C#5", q, 2], ["D5", q, 3],
  ["A4", dh, 2],
  ["F#4~", dh, 1], ["F#4~", dh], ["F#4~", dh], ["F#4", dh, undefined, ")"],
  ["R", q], ["F#5", q, 3, "("], ["A5", q, 5],
  ["G5", q, 4], ["F#5", q, 3], ["C#5", q, 2],
  ["B4", q, 1], ["C#5", q, 2], ["D5", q, 3],
  ["A4", dh, 2], ["C#5", dh, 4], ["F#5", dh, 5],
  ["E4~", dh, 1], ["E4~", dh], ["E4", dh, undefined, ")"],
  ["A4", q, 1, "("], ["B4", q, 2], ["C5", q, 3],
  ["E5", q, 5], ["D5", q, 4], ["B4", q, 2],
  ["D5", q, 4], ["C5", q, 3], ["B4", q, 2],
  ["D5~", dh, 3], ["D5", h], ["D5", q, 1, ")"],
  ["E5", q, 2, "("], ["F5", q, 3], ["G5", q, 4],
  ["A5", q, 5], ["C5", q, 1], ["D5", q, 2],
  ["E5", q, 3], ["D5", q, 2], ["B4", q, 1],
  ["D5~", dh, 2], ["D5", h], ["D5", q, 2, ")"],
  ["G5", dh, 5, "("], ["F#5", dh, 4],
  ["B4", q, 2], ["A4", q, 1], ["B4", q, 2],
  ["C#5", q, 3], ["D5", q, 4], ["E5", q, 5],
  ["C#5", q, 3], ["D5", q, 4], ["E5", q, 5, ")"],
  ["F#4", dh, 3],
  ["C4+E4+A4+C5", dh, "1235"], ["D4+F#4+A4+D5", dh, "1235"],
];
/** voix intérieure de la main droite à la mesure 37 : deux accords sous le fa♯ tenu */
const GYMNO_R2: Tok[] = [...rep(36, [["H", dh]]), ["R", q], ["A3+D4", q, "12"], ["B3+D4+G4", q, "124"], ["H", dh], ["H", dh]];

// ───────── Schumann, Le gai laboureur (Fröhlicher Landmann, op. 68 n° 10) ─────────
// La mélodie est d'abord à la main gauche (sous des accords à contretemps), puis reprise à la main droite.
const LAB_CH: Tok[] = [   // mesures 1-8 : accords de la main droite à contretemps
  ["R", e], ["C4+F4+A4", e, "124", "f"], ["C4+F4+A4", e, "124"], ["R", e], ["R", e], ["F4+A4+C5", e, "135"], ["F4+A4+C5", e, "135"], ["R", e],
  ["R", e], ["F4+Bb4+D5", e, "124"], ["Bb4+D5", e, "24"], ["R", e], ["R", e], ["F4+A4+C5", e, "135"], ["F4+A4+C5", e, "135"], ["R", e],
];
const labA = (third: Tok): Tok[] => [
  ...LAB_CH,
  ["R", e], third, [third[0], q, third[2]], ["R", e], ["C4+F4+A4", e, "124"], ["C4+F4+A4", q, "124"],
  ["R", e], ["C4+G4", e, "14"], ["R", e], ["F4+G4+B4", e, "124"], ["R", e], ["E4+G4+C5", e, "125"],
];
/** mesures 9-12 : la mélodie à la main droite (voix 1) au-dessus des accords (voix 2) */
const LAB_MEL: Tok[] = [
  ["Bb4", dq, 5], ["A4", e, 4], ["G4", dq, 3], ["C4", e, 1],
  ["Bb4", e, 5], ["A4", e, 4, "."], ["G4", e, 3, "."], ["F4", e, 2, "."], ["G4", dq, 3, ")"], ["C4", e, 1, "("],
  ["F4", dq, 3, ")"], ["A4", e, 4, "("], ["C5", dq, 5, ")"], ["F4", e, 1, "("],
  ["Bb4", e, 2], ["D5", e, 4], ["F5", e, 5], ["D5", e, 4], ["C5", dq, 3, ")"], ["R", e],
];
const LAB_ACC: Tok[] = [
  ["R", e], ["C4+E4", e, "12"], ["C4+E4", e, "12"], ["R", e], ["R", e], ["Bb3+C4", e, "12"], ["Bb3+C4", e, "12"], ["R", e],
  ["R", e], ["C4", e, 1], ["C4", e, 1], ["B3", e, 1], ["R", e], ["C4", e, 1], ["C4", e, 1], ["R", e],
  ["R", e], ["A3+C4", e, "12"], ["A3+C4", e, "12"], ["R", e], ["R", e], ["F4+A4", e, "13"], ["F4+A4", e, "13"], ["R", e],
  ["R", e], ["F4+Bb4", e, "12"], ["R", e], ["F4+Bb4", e, "12"], ["R", e], ["F4+A4", e, "12"], ["F4+A4", e, "12"], ["R", e],
];
const labEnd = (last: boolean): Tok[] => [
  ["R", e], ["E4+Bb4+C5", e, "145"], ["E4+Bb4+C5", q, "145"], ["R", e], ["C4+F4+A4", e, "124"], ["C4+F4+A4", e, "124"], ["C4+F4+A4", e, "124"],
  ["R", e], ["D4+G4", e, "14"], ["R", e], ["Bb3+C4", e, "12"], ["R", e], ["A3+C4+F4", e, "124"], ["A3+C4+F4", e, "124"], last ? ["R", e] : ["C4", e, 1, "f ("],
];
const H8 = rep(4, [["H", w]] as Tok[]);
const LAB_R1: Tok[] = [["R", e], ...labA(["Bb3+C4+E4", e, "124"]), ["E4+G4+C5", q, "125"], ...labA(["E4+Bb4+C5", e, "145"]), ["E4+G4+C5", e, "125"], ["C4", e, 1, "f ("],
  ...LAB_MEL, ...labEnd(false), ...LAB_MEL, ...labEnd(true)];
const LAB_R2: Tok[] = [["H", e], ...rep(8, [["H", w]] as Tok[]), ...LAB_ACC, ...rep(2, [["H", w]] as Tok[]), ...LAB_ACC, ...rep(2, [["H", w]] as Tok[])];
const LAB_LA: Tok[] = [
  ["F3", dq, 3], ["A3", e, 2], ["C4", dq, 1], ["F3", e, 5],
  ["Bb3", e, 3], ["D4", e, 2], ["F4", e, 1], ["D4", e, 3], ["C4", dq, 4], ["A3", e, 5, ")"],
  ["Bb3", e, 1, "("], ["G3", e, 2], ["C3", e, 5], ["Bb3", e, 1], ["A3", e, 2], ["F3", e, 3], ["C3", e, 5], ["A3", e, 1],
  ["E3", q, 2], ["D3", q, 3], ["C3", q, 4, ")"], ["R", e], ["C3", e, 5, "("],
];
const LAB_LB: Tok[] = [
  ["G3", dq, 1, ")"], ["F3", e, 2], ["E3", dq, 3], ["C3", e, 5, "("],
  ["G3", e, 1], ["F3", e, 2, "."], ["E3", e, 3, "."], ["D3", e, 4, "."], ["E3", dq, 3, ")"], ["C3", e, 5, "("],
  ["F3", dq, 3, ")"], ["A3", e, 2, "("], ["C4", dq, 1, ")"], ["F3", e, 5, "("],
  ["Bb3", e, 3], ["D4", e, 2], ["F4", e, 1], ["D4", e, 3], ["C4", dq, 4, ")"], ["A3", e, 5, "("],
  ["Bb3", e, 1], ["G3", e, 2], ["C3", e, 5], ["Bb3", e, 1], ["A3", e, 2], ["F3", e, 3], ["C3", e, 5], ["A3", e, 1],
];
const LAB_L: Tok[] = [["C3", e, 5, "("], ...LAB_LA, ...LAB_LA, ...LAB_LB, ["Bb2+G3", q, "52"], ["C3+E3", q, "42"], ["F3", q, 1, ")"], ["R", e], ["C3", e, 3, "("],
  ...LAB_LB, ["Bb2+G3", q, "52"], ["C3+E3", q, "42"], ["F3", q, 1, ")"], ["R", q]];

// ───────── Tchaïkovski, Vieille chanson française (Album pour enfants, op. 39 n° 16) ─────────
// Main gauche à deux voix : une voix intermédiaire qui chante, au-dessus d'une basse de sol tenue.
const CH_A: Tok[] = [
  ["G4", e, 1, "("], ["A4", e, 2], ["Bb4", e, 3], ["C5", e, 4],
  ["D5", dq, 5], ["D5", e, 2],
  ["C5", e, 1], ["D5", e, 2], ["Eb5", e, 3], ["C5", e, 1],
  ["D5", dq, 2], ["D5", e, 2],
  ["C5", e, 1], ["D5", e, 2], ["Eb5", e, 3], ["C5", e, 1],
  ["D5", e, 2], ["Eb5", s, 3], ["D5", s, 2], ["C5", e, 1], ["Bb4", e, 3],
];
const CHANSON_R: Tok[] = [
  ["D4", e, 1, "p"],
  ...CH_A, ["A4", ddq, 2], ["G4", s, 1, ")"], ["G4", dq, 1], ["D4", e, 1, "pp"],
  ...CH_A, ["A4", ddq, 2], ["G4", s, 1, ")"], ["G4", h, 1],
  ["G4", q, 1, "p ("], ["G4", e, 1], ["A4", e, 2], ["Bb4", dq, 3], ["Bb4", e, 3], ["C5", q, 4, "cresc"], ["C5", q, 4], ["A4", dq, 1], ["A4", e, 1],
  ["D5", dq, 2, "mf"], ["D5", e, 2], ["Eb5", e, 3], ["F5", s, 4], ["Eb5", s, 3], ["D5", e, 2], ["C5", e, 1, "dim"], ["Bb4", q, 3], ["A4", e, 2], ["G4", e, 1],
  ["F#4+A4", dq, "12", "p )"], ["D4", e, 1],
  ...CH_A, ["A4", ddq, 3], ["G4", s, 2, ")"], ["Bb3+G4", h, "15"],
];
const CHANSON_R2: Tok[] = [["H", e], ...rep(30, [["H", h]] as Tok[]), ["Eb4", q, 1], ["D4", q, 1], ["H", h]];
const CH_MID: Tok[] = [["Bb3", e, 3], ["C4", e, 2], ["D4", e, 1], ["C4", e, 2], ["Bb3", h, 3], ["Eb4", q, 1], ["C4", q, 2], ["Bb3", q, 3], ["H", q], ["Eb4", q, 1], ["C4", q, 2], ["Bb3", q, 3], ["H", q]];
const CH_BASS: Tok[] = [["G3~", h, 5], ["G3", q], ["G3~", q, 5], ["G3~", h], ["G3", q], ["G3~", q, 5], ["G3~", h], ["G3", q], ["G3", q, 5]];
const CHANSON_L1: Tok[] = [
  ["R", e],
  ...CH_MID, ["C4", h, 1], ["Bb3", q, 2], ["H", q],
  ...CH_MID, ["C4", h, 1], ["Bb3", h, 2],
  ["C3", e, 5, "."], ["G3", e, 3, "."], ["C4", e, 2, "."], ["Eb4", e, 1, "."],
  ["G2", e, 5, "."], ["G3", e, 3, "."], ["C4", e, 2, "."], ["Eb4", e, 1, "."],
  ["C3", e, 5, "."], ["G3", e, 3, "."], ["C4", e, 2, "."], ["Eb4", e, 1, "."],
  ["D3", e, 5, "."], ["A3", e, 3, "."], ["C4", e, 2, "."], ["F#4", e, 1, "."],
  ["G3+Bb3", e, "53", "("], ["D4", e, 2], ["G4", e, 1, ")"], ["R", e],
  ["C4+Eb4+G4", h, "531"], ["D4+G4", q, "31"], ["R", q], ["D4", q, 1], ["D3", q, 5],
  ...CH_MID, ["C3+G3", q, "52"], ["D3+F#3", q, "41"], ["G2+D3", h, "51"],
];
const CHANSON_L2: Tok[] = [
  ["H", e],
  ...CH_BASS, ["F#3", q, 4], ["D3", q, 5], ["G3", q, 3], ["G2", e, 5], ["R", e],
  ...CH_BASS, ["F#3", q, 4], ["D3", q, 5], ["G3", h, 3],
  ...rep(8, [["H", h]] as Tok[]),
  ...CH_BASS, ["H", h], ["H", h],
];

// ───────── Chopin, Prélude en La majeur (op. 28 n° 7) ─────────
const P7_R1: Tok[] = [
  ["E4", q, 1, "p"],
  ["C#5", de, 4, "("], ["D5", s, 5], ["D4+G#4+B4", q, "135"], ["D4+G#4+B4", q, "135"],
  ["D4+G#4+B4", h, "135"], ["D5+F#5", q, "35", ")"],
  ["B#4+D#5", de, "12", "("], ["C#5+E5", s, "12"], ["C#5+A5", q, "25"], ["C#5+A5", q, "25"],
  ["C#5+A5", h, "25"], ["E4+C#5", q, "15", ")"],
  ["A#4", de, 4, "("], ["B4", s, 5], ["F#4+D5", q, "25"], ["F#4+D5", q, "25"],
  ["F#4+D5", h, "25"], ["D4+G#4", q, "13", ")"],
  ["G#4", de, 4, "("], ["A4", s, 5], ["C#5", q, 5], ["C#4+C#5", q, "15"],
  ["C#4+C#5", h, "15"], ["E4~", q, 1, ")"],
  ["E4+G#4", q, "12", "("], ["D4+G#4+B4", q, "135"], ["D4+G#4+B4", q, "135"],
  ["D4+G#4+B4", h, "135"], ["D5+F#5", q, "35", ")"],
  ["B#4+D#5", de, "12", "cresc ("], ["C#5~+E5~", s, "12"], ["C#5+E5", h, "12"],
  ["A#4+C#5+E5+A#5+C#6", h, "12345", "f"], ["A#4+C#5", q, "12", ")"],
  ["A#4+C#5", de, "12", "dim ("], ["B4~+D5", s, "13"], ["B4+F#5", q, "15"], ["A4+F#5", q, "15"],
  ["G#4+F#5", h, "15"], ["D4+G#4", q, "13", ")"],
  ["D4+B4", de, "15", "p ("], ["C#4+A4", s, "14"], ["C#5+A5", q, "25"], ["C#5+A5", q, "25"],
  ["C#5+A5", h, "25", ")"], ["R", q],
];
const P7_R2: Tok[] = [
  ["H", q], ["H", dh], ["H", dh], ["H", dh], ["H", dh],
  ["C#4", de, 1], ["D4~", s, 1], ["D4~", h], ["D4", h], ["H", q],
  ["D4", de, 2], ["C#4~", s, 1], ["C#4", q], ["H", q], ["H", dh],
  ["C#5", de, 4], ["D5", s, 5], ["H", h], ["H", dh],
  ["H", de], ["H", s], ["A5+C#6", q, "45"], ["A5+C#6", q, "45"], ["H", dh], ["H", dh], ["H", dh],
  ["H", q], ["A4~", h, 1], ["A4", h], ["H", q],
];
const P7_L: Tok[] = [
  ["R", q],
  ["E2", q, 5, "P"], ["E3+E4", q, "51"], ["E3+E4", q, "51"], ["E3+E4", h, "51"], ["R", q, undefined, "P*"],
  ["A2", q, 5, "P"], ["A3+E4", q, "51"], ["A3+E4", q, "51"], ["A3+E4", h, "51"], ["R", q, undefined, "P*"],
  ["E2", q, 5, "P"], ["E3+B3", q, "51"], ["E3+B3", q, "51"], ["E3+B3", h, "51"], ["R", q, undefined, "P*"],
  ["A1", q, 5, "P"], ["E3+A3+E4", q, "531"], ["E3+A3+E4", q, "531"], ["E3+A3+E4", h, "531"], ["R", q, undefined, "P*"],
  ["E2", q, 5, "P"], ["E3+E4", q, "51"], ["E3+E4", q, "51"], ["E3+E4", h, "51"], ["R", q, undefined, "P*"],
  ["A2", q, 5, "P"], ["A3+E4+A4", q, "521"], ["A3+E4+A4", q, "521"], ["F#3+C#4+E4+F#4", h, "5321", "P^"], ["R", q, undefined, "P*"],
  ["B1", q, 5, "P"], ["F#3+D4", q, "51"], ["F#3+B3+D4", q, "531"], ["E3+B3+D4", h, "521", "P^"], ["R", q, undefined, "P*"],
  ["A1", q, 5, "P"], ["E3+A3+E4", q, "531"], ["E3+A3+E4", q, "531"], ["A3+E4", h, "51"], ["R", q, undefined, "P*"],
];

export const LEVEL2: RepPiece[] = [
  { id: "elise", title: "Lettre à Élise", composer: "L. van Beethoven (WoO 59)", level: 2,
    skills: "Doubles croches, arpèges partagés entre les mains, pédale, La mineur ; partie A, épisode, retour de A", source: "Mutopia (WoO 59), domaine public",
    tip: "Les deux mains se relaient : la gauche lance l'arpège, la droite le continue, sans trou. Le mi – ré♯ du début se joue 5-4, poignet souple. Travaille l'épisode (mesures 17-22) à part.",
    spec: () => spec("Lettre à Élise", "L. van Beethoven", 66, ELISE_R, ELISE_L, { beats: 3, beatType: 8, pickup: 1 }) },
  { id: "prelude", title: "Prélude en Do majeur", composer: "J. S. Bach (Clavier bien tempéré I, BWV 846)", level: 2,
    skills: "Accords brisés réguliers, basse tenue (deux voix à la main gauche), harmonie, endurance", source: "When in Rome / OpenScore (BWV 846), vérifié note à note",
    tip: "Chaque mesure est un seul accord, déroulé deux fois : plaque d'abord l'accord (les 5 notes ensemble) pour le mettre dans la main, puis déroule-le. La basse se tient pendant toute la demi-mesure.",
    spec: () => spec("Prélude en Do majeur", "J. S. Bach", 66, PRELUDE.r, [PRELUDE.l1, PRELUDE.l2]) },
  { id: "gymnopedie", title: "Gymnopédie n° 1", composer: "E. Satie", level: 2,
    skills: "Main gauche : basse puis accord (grands déplacements), pédale à chaque mesure, mélodie lente et tenue", source: "Mutopia (Gymnopédie n° 1), domaine public — premier énoncé, mesures 1 à 39",
    tip: "« Lent et douloureux ». La main gauche saute de la basse à l'accord : regarde le clavier pendant la basse, l'accord se prépare pendant qu'elle sonne. Change la pédale juste après chaque basse.",
    spec: () => spec("Gymnopédie n° 1", "E. Satie", 72, [GYMNO_R, GYMNO_R2], [GYMNO_L1, GYMNO_L2], { fifths: 2, beats: 3 }) },
  { id: "laboureur", title: "Le gai laboureur", composer: "R. Schumann (Album pour la jeunesse, op. 68 n° 10)", level: 2,
    skills: "Mélodie à la main gauche, accords à contretemps à la main droite, puis mélodie et accompagnement dans la même main", source: "Mutopia (op. 68 n° 10), CC BY-SA 2.5",
    tip: "« Frais et gaillard ». D'abord la main gauche seule : elle chante, bien liée. Les accords de la main droite sont légers, en rebond, entre les notes de la mélodie.",
    spec: () => spec("Le gai laboureur", "R. Schumann", 104, [LAB_R1, LAB_R2], LAB_L, { fifths: -1, pickup: 1 }) },
  { id: "chanson", title: "Vieille chanson française", composer: "P. I. Tchaïkovski (Album pour enfants, op. 39 n° 16)", level: 2,
    skills: "Sol mineur, mélodie expressive, main gauche à deux voix (une note tenue sous une voix qui bouge), rythmes pointés", source: "Mutopia (op. 39 n° 16), domaine public",
    tip: "La main gauche tient le sol grave avec le 5e doigt pendant que les autres doigts chantent la voix du milieu : ne le relâche pas. La mélodie, elle, respire à chaque fin de phrase.",
    spec: () => spec("Vieille chanson française", "P. I. Tchaïkovski", 72, [CHANSON_R, CHANSON_R2], [CHANSON_L1, CHANSON_L2], { fifths: -2, beats: 2, pickup: 1 }) },
  { id: "chopin7", title: "Prélude en La majeur", composer: "F. Chopin (op. 28 n° 7)", level: 2,
    skills: "Accords à la main droite avec la mélodie au-dessus, rythme pointé, pédale à chaque basse, un grand accord à la mesure 12", source: "KernScores / craigsapp (op. 28 n° 7), vérifié note à note",
    tip: "Andantino : chaque phrase de deux mesures est une respiration. Fais chanter la note du haut de chaque accord. L'accord de la mesure 12 est très large : si ta main n'y arrive pas, roule-le légèrement (de bas en haut).",
    spec: () => spec("Prélude en La majeur", "F. Chopin", 72, [P7_R1, P7_R2], P7_L, { fifths: 3, beats: 3, pickup: 2 }) },
];
