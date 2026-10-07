/** Répertoire intégré : des œuvres du domaine public, notes vérifiées contre une édition de référence et doigtés
 *  ÉCRITS pour les deux mains. Trois niveaux dans l'onglet Morceaux (src/pieces/level1-3.ts) ; le niveau 0 regroupe
 *  les petites pièces qui servent d'étapes dans le parcours (comptines, extraits) et n'apparaissent pas dans Morceaux. */
import { type Tok } from "./course/build";
import { buildXml } from "./course/xml";
import { s, e, q, dq, h, w, spec, type RepPiece } from "./pieces/common";
import { LEVEL1 } from "./pieces/level1";
import { LEVEL2 } from "./pieces/level2";
import { LEVEL3 } from "./pieces/level3";
import { SONGS } from "./pieces/songs";
import { TRANSITION } from "./pieces/transition";
import { THEMES } from "./pieces/themes";
import { MUTOPIA } from "./pieces/mutopia";
export type { RepPiece };

// ───────── niveau 0 : étapes du parcours ─────────
// « Ah ! vous dirai-je, maman » : extension du 4e doigt sur Sol puis 5 sur La, retour en position de Do
const TWINKLE_A: Tok[] = [["C4", q, 1], ["C4", q, 1], ["G4", q, 4], ["G4", q, 4], ["A4", q, 5], ["A4", q, 5], ["G4", h, 4], ["F4", q, 4], ["F4", q, 4], ["E4", q, 3], ["E4", q, 3], ["D4", q, 2], ["D4", q, 2], ["C4", h, 1]];
const TWINKLE_B: Tok[] = [["G4", q, 5], ["G4", q, 5], ["F4", q, 4], ["F4", q, 4], ["E4", q, 3], ["E4", q, 3], ["D4", h, 2]];
const TWINKLE_R: Tok[] = [...TWINKLE_A, ...TWINKLE_B, ...TWINKLE_B, ...TWINKLE_A];
const TWINKLE_LA: Tok[] = [["C3", w, 5], ["F3", h, 2], ["C3", h, 5], ["F3", h, 2], ["C3", h, 5], ["G3", h, 1], ["C3", h, 5]];
const TWINKLE_LB: Tok[] = [["C3", h, 5], ["G3", h, 1], ["C3", h, 5], ["G3", h, 1]];
const TWINKLE_L: Tok[] = [...TWINKLE_LA, ...TWINKLE_LB, ...TWINKLE_LB, ...TWINKLE_LA];

const ODE_R: Tok[] = [
  ["E4", q, 3], ["E4", q, 3], ["F4", q, 4], ["G4", q, 5], ["G4", q, 5], ["F4", q, 4], ["E4", q, 3], ["D4", q, 2],
  ["C4", q, 1], ["C4", q, 1], ["D4", q, 2], ["E4", q, 3], ["E4", dq, 3], ["D4", e, 2], ["D4", h, 2],
  ["E4", q, 3], ["E4", q, 3], ["F4", q, 4], ["G4", q, 5], ["G4", q, 5], ["F4", q, 4], ["E4", q, 3], ["D4", q, 2],
  ["C4", q, 1], ["C4", q, 1], ["D4", q, 2], ["E4", q, 3], ["D4", dq, 2], ["C4", e, 1], ["C4", h, 1],
];
const ODE_L: Tok[] = [["C3", w, 5], ["G3", w, 1], ["C3", w, 5], ["G3", w, 1], ["C3", w, 5], ["G3", w, 1], ["C3", w, 5], ["G3", h, 1], ["C3", h, 5]];

/** Hanon n°1 (montée) : le même motif de huit notes, déplacé d'un degré à chaque mesure ; doigts 1-2-3-4-5-4-3-2 (MD), 5-4-3-2-1-2-3-4 (MG). */
function hanon(): { rh: Tok[]; lh: Tok[] } {
  const L = ["C", "D", "E", "F", "G", "A", "B"];
  const at = (deg: number, oct: number) => `${L[deg % 7]}${oct + Math.floor(deg / 7)}`;
  const rh: Tok[] = [], lh: Tok[] = [];
  const pat = [0, 2, 3, 4, 5, 4, 3, 2], fr = [1, 2, 3, 4, 5, 4, 3, 2], fl = [5, 4, 3, 2, 1, 2, 3, 4];
  for (let st = 0; st < 8; st++) pat.forEach((d, i) => { rh.push([at(st + d, 4), e, fr[i]]); lh.push([at(st + d, 3), e, fl[i]]); });
  rh.push(["C5", w, 1]); lh.push(["C4", w, 5]);
  return { rh, lh };
}

/** Beethoven, Lettre à Élise : le thème (8 mesures), 3/8, levée de deux doubles croches. */
const ELISE_R: Tok[] = [
  ["E5", s, 5], ["D#5", s, 4],
  ["E5", s, 5], ["D#5", s, 4], ["E5", s, 5], ["B4", s, 1], ["D5", s, 4], ["C5", s, 3],
  ["A4", e, 1], ["R", s], ["C4", s, 1], ["E4", s, 2], ["A4", s, 3],
  ["B4", e, 4], ["R", s], ["E4", s, 1], ["G#4", s, 3], ["B4", s, 4],
  ["C5", e, 5], ["R", s], ["E4", s, 1], ["E5", s, 5], ["D#5", s, 4],
  ["E5", s, 5], ["D#5", s, 4], ["E5", s, 5], ["B4", s, 1], ["D5", s, 4], ["C5", s, 3],
  ["A4", e, 1], ["R", s], ["C4", s, 1], ["E4", s, 2], ["A4", s, 3],
  ["B4", e, 4], ["R", s], ["E4", s, 1], ["C5", s, 4], ["B4", s, 3],
  ["A4", dq, 2],
];
const ARP_A: Tok[] = [["A2", s, 5], ["E3", s, 2], ["A3", s, 1], ["R", s], ["R", e]];
const ARP_E: Tok[] = [["E2", s, 5], ["E3", s, 2], ["G#3", s, 1], ["R", s], ["R", e]];
const ELISE_L: Tok[] = [["R", e], ["R", dq], ...ARP_A, ...ARP_E, ...ARP_A, ["R", dq], ...ARP_A, ...ARP_E, ["A2", s, 5], ["E3", s, 2], ["A3", s, 1], ["R", s], ["R", e]];

/** Bach, Prélude en Do majeur (BWV 846) : les 11 premières mesures et un accord final. Main gauche : les deux notes graves ; main droite : l'arpège. */
const PRELUDE_BARS: [string, string, string, string, string, number, number, string][] = [
  // basse, 2e note, arpège (3 notes), doigts MG (2), doigts MD
  ["C4", "E4", "G4", "C5", "E5", 3, 1, "135"],
  ["C4", "D4", "A4", "D5", "F5", 2, 1, "135"],
  ["B3", "D4", "G4", "D5", "F5", 3, 1, "145"],
  ["C4", "E4", "G4", "C5", "E5", 3, 1, "135"],
  ["C4", "E4", "A4", "E5", "A5", 3, 1, "135"],
  ["C4", "D4", "F#4", "A4", "D5", 2, 1, "235"],
  ["B3", "D4", "G4", "D5", "G5", 3, 1, "135"],
  ["B3", "C4", "E4", "G4", "C5", 2, 1, "124"],
  ["A3", "C4", "E4", "G4", "C5", 3, 1, "124"],
  ["D3", "A3", "D4", "F#4", "C5", 5, 1, "125"],
  ["G3", "B3", "D4", "G4", "B4", 3, 1, "135"],
];
function prelude(): { rh: Tok[]; lh: Tok[] } {
  const rh: Tok[] = [], lh: Tok[] = [];
  for (const [b1, b2, a, b, c, f1, f2, fr] of PRELUDE_BARS) for (let half = 0; half < 2; half++) {
    lh.push([b1, s, f1], [b2, s, f2], ["R", dq]);
    const [x, y, z] = fr.split("").map(Number);
    rh.push(["R", e], [a, s, x], [b, s, y], [c, s, z], [a, s, x], [b, s, y], [c, s, z]);
  }
  lh.push(["C3", w, 5]); rh.push(["E4+G4+C5", w, "125"]);
  return { rh, lh };
}

const COURSE_PIECES: RepPiece[] = [
  { id: "twinkle", title: "Ah ! vous dirai-je, maman", composer: "Chanson traditionnelle", level: 0, skills: "Extension de la main, retour en position", tip: "Sur Sol–La, la main s'ouvre (doigts 4 et 5) puis revient en position de Do : regarde les doigtés.",
    spec: () => spec("Ah ! vous dirai-je, maman", "Traditionnel", 84, TWINKLE_R, TWINKLE_L) },
  { id: "ode", title: "Ode à la joie", composer: "L. van Beethoven", level: 0, skills: "Noire pointée, phrases, deux mains", tip: "« Longue – courte » : noire pointée puis croche. Compte « 1-2-et ».",
    spec: () => spec("Ode à la joie", "Ludwig van Beethoven", 88, ODE_R, ODE_L) },
  { id: "hanon1", title: "Hanon n°1 (montée)", composer: "C.-L. Hanon", level: 0, skills: "Indépendance et régularité des doigts", tip: "Lève bien chaque doigt, joue lentement et très régulier ; accélère seulement quand c'est égal.",
    spec: () => { const x = hanon(); return spec("Hanon n°1 (montée)", "Charles-Louis Hanon", 72, x.rh, x.lh); } },
  { id: "elise-theme", title: "Lettre à Élise (thème)", composer: "L. van Beethoven", level: 0, skills: "Doubles croches, arpèges partagés entre les mains, La mineur", tip: "Les deux mains se relaient : la gauche lance l'arpège, la droite le continue. Travaille d'abord très lentement.",
    spec: () => spec("Lettre à Élise (thème)", "Ludwig van Beethoven", 60, ELISE_R, ELISE_L, { beats: 3, beatType: 8, pickup: 1 }) },
  { id: "prelude-debut", title: "Prélude en Do majeur (début)", composer: "J. S. Bach (BWV 846)", level: 0, skills: "Arpèges réguliers, harmonie, endurance", tip: "Chaque mesure est un accord arpégé deux fois : repère l'accord, puis laisse les doigts dérouler.",
    spec: () => { const x = prelude(); return spec("Prélude en Do majeur (début)", "Johann Sebastian Bach", 66, x.rh, x.lh); } },
];

/** niveau 3, du plus abordable au plus exigeant (d'après la difficulté calculée) */
const L3_ORDER = ["clementi", "chopin20", "valse", "chopin4", "arabesque", "musette", "moonlight", "ballade", "entertainer"];
/** Tous les morceaux intégrés ; l'onglet Morceaux montre les niveaux 1 à 3. */
export const REPERTOIRE: RepPiece[] = [...COURSE_PIECES, ...SONGS, ...THEMES.filter((p) => p.level === 1), ...LEVEL1, ...TRANSITION.filter((p) => p.level === 1), ...MUTOPIA.filter((p) => p.level === 1), ...THEMES.filter((p) => p.level === 2), ...LEVEL2, ...TRANSITION.filter((p) => p.level === 2), ...MUTOPIA.filter((p) => p.level === 2), ...L3_ORDER.map((id) => [...LEVEL3, ...TRANSITION, ...MUTOPIA].find((p) => p.id === id)!)];
export { SONGS };
export const REP_LEVELS = [1, 2, 3] as const;
export const repOfLevel = (lv: number) => REPERTOIRE.filter((p) => p.level === lv && !p.song);

export const repXml = (p: RepPiece) => buildXml(p.spec());
export const repById = (id: string) => REPERTOIRE.find((p) => p.id === id);
/** Nom de fichier : sert de clé pour le coach et les records (même convention que les morceaux de la bibliothèque). */
export const repFileName = (p: RepPiece) => `${p.title}.musicxml`;
