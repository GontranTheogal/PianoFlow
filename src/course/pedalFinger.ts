/** Deux unités demandées parce qu'elles bloquent beaucoup d'élèves :
 *  - la pédale de sustain : ce qu'elle fait, le geste « haut-bas » (pédale syncopée), avec un retour visuel de ce que le pied a fait ;
 *  - trouver ses doigtés : comment un pianiste choisit ses doigts quand rien n'est écrit (position, pouce, croisements).
 *  Et les générateurs des exercices correspondants (onglet Exercices). */
import { P, M, info, seqQ, staffShow, kbFor, pick, shuffle, mulberry32, type Rng } from "./build";
import { chordPitches, voiceLead, midiOf, type Quality } from "./theory";
import { mc } from "./foundations";
import type { Lesson, Q, Unit, KbdRange } from "./types";

const L = (id: string, title: string, goals: string[], build: (rng: Rng) => Q[]): Lesson => ({ id, title, goals, build });

// ───────────────────────── la pédale ─────────────────────────
const DEG: [number, Quality][] = [[0, "maj"], [1, "min"], [2, "min"], [3, "maj"], [4, "maj"], [5, "min"]];   // I ii iii IV V vi (Do majeur)
const TRI = (d: number) => chordPitches({ li: DEG[d][0], alter: 0 }, 4, DEG[d][1]);
/** Une suite d'accords de Do majeur enchaînés au plus près (main droite), en hauteurs MIDI. */
function chordRun(degs: number[]): number[][] { return voiceLead(degs.map(TRI), 57, 76).map((c) => c.map(midiOf)); }
/** Avec la basse à la main gauche : la note grave puis l'accord (on change la pédale sur la basse). */
const withBass = (degs: number[]) => chordRun(degs).map((c, i) => [midiOf({ li: DEG[degs[i]][0], alter: 0, oct: 3 }), ...c]);
const KB: KbdRange = [45, 79];
const pedalQ = (prompt: string, chords: number[][], hint: string): Q => ({ k: "pedal", prompt, chords, kbd: chords.flat().length ? kbFor(chords.flat(), 3) : KB, hint });
const GRIDS = [[0, 3, 4, 0], [0, 5, 3, 4], [0, 4, 5, 3], [5, 3, 0, 4], [0, 1, 4, 0], [3, 4, 2, 5]];

const pedalWhat = L("upd-l1", "À quoi sert la pédale ?", ["Comprendre ce que fait la pédale de droite", "Faire durer un son en lâchant la touche"], (rng) => [
  info("Le son et l'étouffoir", "Chaque corde du piano a un étouffoir, un petit feutre posé dessus. Quand tu enfonces une touche, il se soulève et la corde vibre ; quand tu lâches la touche, il retombe et le son s'arrête. La pédale de DROITE (pédale forte, ou « de sustain ») soulève tous les étouffoirs d'un coup : tant que le pied est en bas, rien ne s'arrête, même si tu lâches les touches. Le pied reste posé dessus, talon au sol ; c'est la pointe qui appuie.", undefined),
  info("Sans pédale, avec pédale", "Sans pédale :  doigt ▇▇▇▇▁▁▁▁  →  son ▇▇▇▇▁▁▁▁ (il s'arrête avec le doigt).\nAvec pédale :  doigt ▇▇▁▁▁▁▁▁  +  pied ▁▇▇▇▇▇▇▁  →  son ▇▇▇▇▇▇▇▁ (il s'arrête quand le PIED remonte).\nDonc : les doigts peuvent partir préparer la suite, le pied garde le son.", undefined),
  mc(rng, "Pédale enfoncée, tu lâches la touche : que fait le son ?", "il continue", ["il s'arrête", "il devient plus fort"], "La pédale garde les étouffoirs levés : le son dure jusqu'à ce que le pied remonte."),
  pedalQ("Joue un Do, enfonce la pédale, puis lâche le Do : écoute, il sonne encore", [[60]], "D'abord la touche, ensuite le pied. Garde le pied en bas et lâche le doigt."),
  mc(rng, "Pour arrêter le son, il faut…", "relever la pédale", ["appuyer plus fort sur la pédale", "rejouer la note"], "Le son s'éteint quand les étouffoirs retombent : quand le pied remonte (et que les doigts ont lâché)."),
  pedalQ("Joue l'accord de Do, pédale, et lâche les doigts : l'accord continue de sonner", [[60, 64, 67]], "Accord, puis pied en bas, puis mains en l'air."),
  mc(rng, "À quoi sert surtout la pédale ?", "relier des sons que les doigts ne peuvent pas lier", ["jouer plus fort", "jouer plus vite"], "Elle lie les notes trop éloignées pour les doigts (basse grave et accord aigu, par exemple) et enrichit le son."),
]);

const pedalChange = L("upd-l2", "Changer la pédale : haut-bas", ["Changer de pédale entre deux accords sans mélanger les sons"], (rng) => [
  info("Le problème", "Si tu gardes le pied en bas en changeant d'accord, l'ancien accord continue de sonner avec le nouveau : c'est flou, « sale ». Il faut donc vider le son entre deux accords… sans faire de trou.", undefined),
  info("Le geste : le pied suit les mains", "1. Joue l'accord. 2. JUSTE APRÈS, pied en bas. 3. Accord suivant : au moment où tes doigts enfoncent les touches, le pied REMONTE. 4. Aussitôt après, il redescend. Compte à voix haute : « ac-cord – et – pied ». Le pied est toujours un petit peu EN RETARD sur les mains : c'est la « pédale syncopée ». L'erreur classique : appuyer en même temps que l'accord (ou avant) — l'ancien son se mélange au nouveau.", undefined),
  mc(rng, "Au moment où tu joues le nouvel accord, le pied…", "remonte, puis redescend juste après", ["reste en bas", "descend en même temps"], "Pied en haut au moment de l'accord (ça efface l'ancien), pied en bas juste après (ça garde le nouveau)."),
  mc(rng, "Dans quel ordre ?", "accord → pied en bas → (accord suivant + pied en haut) → pied en bas", ["pied en bas → accord → pied en haut", "accord et pied en même temps"], "Les mains d'abord, le pied juste après : à chaque accord."),
  pedalQ("Deux accords : Do puis Sol. Change la pédale entre les deux", chordRun([0, 4]), "Do, pied en bas. Sol : pied en haut en jouant, en bas juste après."),
  pedalQ("Encore : Fa puis Do", chordRun([3, 0]), "« ac-cord – et – pied » : le pied arrive sur le « et »."),
  mc(rng, "Après ton passage, deux accords se mélangent. Que s'est-il passé ?", "le pied n'est pas remonté au changement d'accord", ["le pied est descendu trop tard", "les doigts ont lâché trop tôt"], "Si le pied reste en bas au changement, l'ancien accord continue : il faut le relever pile en jouant le nouveau."),
  pedalQ("Trois accords : Do – Fa – Sol, en changeant à chaque fois", chordRun([0, 3, 4]), "Lentement. Le pied fait « haut-bas » à chaque nouvel accord."),
]);

const pedalFlow = L("upd-l3", "Pédale régulière", ["Changer la pédale à chaque accord, en rythme, sans y penser"], (rng) => [
  info("En boucle", "Le geste doit devenir automatique : chaque accord déclenche « pied en haut – pied en bas ». Joue lentement, régulièrement ; écoute : chaque accord doit sonner propre (pas de mélange) et lié (pas de trou). Après chaque passage, l'appli dessine ce qu'a fait ton pied.", undefined),
  pedalQ("Do – Fa – Sol – Do", chordRun([0, 3, 4, 0]), "Un accord toutes les deux secondes environ ; le pied suit."),
  pedalQ("Do – La mineur – Fa – Sol", chordRun([0, 5, 3, 4]), "Même geste à chaque accord."),
  mc(rng, "Le son se coupe entre deux accords. Pourquoi ?", "le pied est remonté trop tôt, avant le nouvel accord", ["le pied est resté en bas", "les accords sont trop proches"], "Si le pied remonte avant que les doigts aient joué le nouvel accord, il y a un trou : il doit remonter EN MÊME TEMPS."),
  pedalQ("Avec la basse : basse + accord, la pédale change sur la basse", withBass([0, 3, 4, 0]), "La main gauche joue la basse en même temps que l'accord : c'est elle qui déclenche le changement."),
]);

const pedalMusic = L("upd-l4", "La pédale dans un morceau", ["Savoir où changer la pédale dans une vraie partition"], (rng) => [
  info("Où changer ?", "Dans une partition, on change la pédale à chaque NOUVELLE HARMONIE (en général à chaque nouvelle basse), pas à chaque note de la mélodie : les notes d'un même accord peuvent se mélanger, c'est même joli. Les signes : « Ped. » (ou une ligne en dessous) = pied en bas ; « * » ou le crochet = pied en haut. Dans les morceaux de l'appli (Gymnopédie, Clair de lune, préludes de Chopin), le changement est écrit sous la portée.", undefined),
  mc(rng, "Une mesure = un seul accord arpégé (Do-Mi-Sol-Do…). La pédale…", "reste en bas toute la mesure, change à la mesure suivante", ["change à chaque note", "n'est pas utile"], "Toutes les notes appartiennent au même accord : elles peuvent sonner ensemble."),
  pedalQ("Accord arpégé : Do-Mi-Sol, puis Fa-La-Do, puis Sol-Si-Ré (une note après l'autre)", chordRun([0, 3, 4]), "Joue les trois notes de l'accord l'une après l'autre ; change la pédale sur la PREMIÈRE note du nouvel accord."),
  mc(rng, "« Ped. … * » sous la portée signifie…", "pied en bas au « Ped. », en haut à l'étoile", ["jouer plus fort", "jouer la note plus longtemps avec le doigt"], "C'est l'écriture classique de la pédale."),
  pedalQ("Basse et accord, quatre harmonies : Do – Sol – La mineur – Fa", withBass([0, 4, 5, 3]), "Change sur chaque basse."),
]);

export const PEDAL_UNIT: Unit = { id: "upd", title: "La pédale de sustain", sub: "Ce qu'elle fait, le geste haut-bas", icon: "footprints", color: "#4ade80", lessons: [pedalWhat, pedalChange, pedalFlow, pedalMusic] };

/** Exercices de pédale : 1 = un ou deux accords, 2 = enchaînements de quatre accords, 3 = basse + accord, quatre harmonies. */
export const PEDAL_LEVELS = ["Un, puis deux accords", "Quatre accords", "Basse + accord"];
export function pedalDrill(level: number, rng: Rng = Math.random): Q[] {
  const grids = shuffle(rng, GRIDS);
  if (level <= 1) return [
    pedalQ("Un accord : joue-le, pied en bas, lâche les doigts", chordRun([pick(rng, [0, 3, 4])]), "La touche d'abord, le pied ensuite."),
    ...grids.slice(0, 4).map((g) => pedalQ("Deux accords : change la pédale entre les deux", chordRun(g.slice(0, 2)), "Pied en haut en jouant le 2e accord, en bas juste après.")),
  ];
  if (level === 2) return grids.slice(0, 5).map((g) => pedalQ("Quatre accords, en changeant la pédale à chaque fois", chordRun(g), "« ac-cord – et – pied »"));
  return grids.slice(0, 5).map((g) => pedalQ("Basse + accord : change la pédale sur chaque basse", withBass(g), "La basse déclenche le changement."));
}

// ───────────────────────── trouver ses doigtés ─────────────────────────
const WHITE = ["C", "D", "E", "F", "G", "A", "B"];
const nameAt = (deg: number, oct: number) => `${WHITE[((deg % 7) + 7) % 7]}${oct + Math.floor(deg / 7)}`;
const FRN = ["Do", "Ré", "Mi", "Fa", "Sol", "La", "Si"];
/** Une petite phrase qui tient dans une position de cinq doigts (la plus grave et la plus aiguë sont jouées : la position est imposée). */
function fivePhrase(rng: Rng, hand: "R" | "L"): { names: string[]; degs: number[]; low: number } {
  const low = hand === "R" ? Math.floor(rng() * 5) : Math.floor(rng() * 5) - 7;   // MD : Do4 à Sol4 ; MG : Do3 à Sol3
  for (;;) {
    const n = 5 + Math.floor(rng() * 3), degs: number[] = [];
    let d = Math.floor(rng() * 5);
    for (let i = 0; i < n; i++) { degs.push(d); d = Math.max(0, Math.min(4, d + pick(rng, [-2, -1, -1, 1, 1, 2]))); }
    if (degs.includes(0) && degs.includes(4) && degs[0] !== degs[1]) return { names: degs.map((x) => nameAt(low + x, 4)), degs, low };
  }
}
const fingerOf = (hand: "R" | "L", deg: number) => (hand === "R" ? deg + 1 : 5 - deg);
/** « Quel doigt sur la première note ? » puis « joue-la avec ce doigté ». */
function positionQs(rng: Rng, hand: "R" | "L"): Q[] {
  const ph = fivePhrase(rng, hand), fingers = ph.degs.map((d) => fingerOf(hand, d));
  const lowName = FRN[((ph.low % 7) + 7) % 7], highName = FRN[(((ph.low + 4) % 7) + 7) % 7];
  const ps = ph.names.map(P);
  return [
    mc(rng, `Main ${hand === "R" ? "droite" : "gauche"} : avec quel doigt commencer cette phrase ?`, `le ${fingers[0]}`,
      shuffle(rng, [1, 2, 3, 4, 5].filter((f) => f !== fingers[0])).slice(0, 2).map((f) => `le ${f}`),
      `La phrase va de ${lowName} (la plus grave) à ${highName} (la plus aiguë) : cinq notes, une par doigt. ${hand === "R" ? `Le pouce sur ${lowName}, le 5 sur ${highName}` : `Le 5 sur ${lowName}, le pouce sur ${highName}`} : la première note se joue donc avec le ${fingers[0]}.`,
      staffShow(hand === "R" ? "G" : "F", ps)),
    seqQ("Joue-la avec ce doigté, sans bouger la main", hand, ph.names, fingers, kbFor(ps.map(midiOf), 3), "Pose d'abord les cinq doigts sur leurs cinq touches, puis joue."),
  ];
}
const thumbQs = (rng: Rng): Q[] => {
  const cases: { names: string[]; fingers: number[]; ask: string; answer: string; wrong: string[]; why: string }[] = [
    { names: ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"], fingers: [1, 2, 3, 1, 2, 3, 4, 5], ask: "Gamme de Do en montant (main droite) : sur quelle note le pouce passe-t-il sous la main ?", answer: "Fa", wrong: ["Mi", "Sol"], why: "Do-Ré-Mi avec 1-2-3, puis le pouce passe sous le 3 et prend Fa : il reste 5 notes, une par doigt (Fa-Sol-La-Si-Do = 1-2-3-4-5)." },
    { names: ["C5", "B4", "A4", "G4", "F4", "E4", "D4", "C4"], fingers: [5, 4, 3, 2, 1, 3, 2, 1], ask: "En descendant (main droite), après le pouce sur Fa, quel doigt passe PAR-DESSUS pour jouer Mi ?", answer: "le 3", wrong: ["le 2", "le 5"], why: "En descendant, c'est le 3 (ou le 4) qui enjambe le pouce : Fa (1), Mi (3), Ré (2), Do (1)." },
    { names: ["G4", "A4", "B4", "C5", "D5", "E5", "F#5", "G5"], fingers: [1, 2, 3, 1, 2, 3, 4, 5], ask: "Gamme de Sol en montant : où passe le pouce ?", answer: "Do", wrong: ["Si", "Ré"], why: "Même dessin que Do majeur : 1-2-3, pouce, 1-2-3-4-5. Le pouce passe sur la 4e note, Do." },
    { names: ["C3", "D3", "E3", "F3", "G3", "A3", "B3", "C4"], fingers: [5, 4, 3, 2, 1, 3, 2, 1], ask: "Main gauche, gamme de Do en montant : après le pouce sur Sol, quel doigt enjambe pour La ?", answer: "le 3", wrong: ["le 4", "le 2"], why: "À la main gauche, c'est en MONTANT qu'on croise : 5-4-3-2-1 puis le 3 passe par-dessus le pouce (La-Si-Do = 3-2-1)." },
  ];
  const c = pick(rng, cases), hand = c.names[0].endsWith("3") ? "L" : "R";
  const ps = c.names.map(P);
  return [
    mc(rng, c.ask, c.answer, c.wrong, c.why, staffShow(hand === "R" ? "G" : "F", ps)),
    seqQ("Joue-la avec ce doigté", hand as "R" | "L", c.names, c.fingers, kbFor(ps.map(midiOf), 3), "Le pouce glisse sous la main sans que le poignet se torde."),
  ];
};

const fingerHow = L("udg-l1", "Comment font les pianistes ?", ["Connaître les règles qui permettent de trouver un doigté seul"], (rng) => [
  info("Personne n'invente au hasard", "Sur la plupart des partitions, très peu de doigts sont écrits : les pianistes les trouvent avec quelques règles, toujours les mêmes, et les notent au crayon quand un passage est délicat. Un bon doigté, c'est celui qui permet de jouer TOUT le passage lié, sans sauter, et toujours de la même façon.", undefined),
  info("Les règles", "1. Regarde d'abord la phrase entière : sa note la plus grave et la plus aiguë. Si elle tient dans cinq notes, pose une position de cinq doigts qui la couvre — et ne bouge plus.\n2. Notes voisines = doigts voisins.\n3. Plus de cinq notes : en montant (main droite), le pouce passe SOUS le 3 ou le 4 ; en descendant, le 3 ou le 4 passe PAR-DESSUS le pouce (l'inverse à la main gauche).\n4. Évite le pouce et le 5 sur les touches noires, sauf dans un accord.\n5. Une note répétée vite : change de doigt (3-2-1) ; lentement, garde le même.\n6. Un saut : change de position pendant une note longue ou un silence.\n7. Les gammes et les arpèges (les notes d'un accord jouées une par une, unité suivante) ont des doigtés « standard » : apprends-les une fois, tu les retrouves partout.", undefined),
  mc(rng, "Une phrase va de Ré à La (cinq notes) à la main droite. Où poses-tu la main ?", "pouce sur Ré, 5 sur La", ["pouce sur Do, 5 sur Sol", "là où tombe la première note avec le 3"], "La position de cinq doigts couvre la plus grave (pouce) à la plus aiguë (5) : plus besoin de bouger."),
  mc(rng, "Main droite, en montant au-delà de cinq notes :", "le pouce passe sous le 3 ou le 4", ["le 5 passe par-dessus le pouce", "on saute avec toute la main"], "C'est le passage du pouce, la base de toutes les gammes."),
  mc(rng, "La même note répétée très vite :", "on change de doigt (par exemple 3-2-1)", ["toujours le même doigt", "toujours le pouce"], "Changer de doigt laisse à la touche le temps de remonter et donne des notes égales."),
  mc(rng, "Un doigté qui marche mais change à chaque fois que tu joues :", "il faut en choisir un et toujours le même", ["c'est mieux, plus souple", "aucune importance"], "La mémoire des doigts ne retient que ce qui est toujours fait pareil."),
]);
const fingerPos = L("udg-l2", "Trouver la position de la main", ["Choisir le doigt de départ d'une phrase à partir de son étendue"], (rng) => [
  info("La méthode", "Pour chaque phrase : 1) trouve la note la plus grave et la plus aiguë ; 2) si elles sont à cinq notes l'une de l'autre, la main droite met le pouce sur la plus grave (la main gauche, le 5) ; 3) chaque doigt reste au-dessus de sa touche. Le doigt de la première note en découle tout seul.", undefined),
  ...positionQs(rng, "R"), ...positionQs(rng, "R"), ...positionQs(rng, "L"), ...positionQs(rng, "R"),
]);
const fingerThumb = L("udg-l3", "Plus de cinq notes : le pouce", ["Placer le passage du pouce et les croisements"], (rng) => [
  info("Passer le pouce", "Dès qu'une phrase dépasse cinq notes conjointes, une position ne suffit plus. En montant à la main droite, joue 1-2-3, puis glisse le pouce SOUS le 3 vers la note suivante : la main se retrouve dans une nouvelle position. En descendant, c'est le 3 (ou le 4) qui passe PAR-DESSUS le pouce. À la main gauche, c'est exactement l'inverse (on croise en montant, le pouce passe en descendant).", undefined),
  ...thumbQs(rng), ...thumbQs(rng), ...thumbQs(rng),
]);
const fingerWrite = L("udg-l4", "Tes doigtés dans tes partitions", ["Préparer le doigté d'une partition importée"], (rng) => [
  info("Dans l'appli", "Sur une partition sans doigtés, l'appli en calcule pour ta main (Réglages → Ma main). Mais le mieux est de vérifier et d'écrire les tiens : en jeu, le bouton permet de toucher une note et d'imposer un doigt — le reste du passage se recalcule autour, et ta correction est gardée et synchronisée. Méthode : lis la phrase, choisis la position, écris seulement les doigts aux changements de position (comme sur les partitions imprimées), puis joue lentement en gardant TOUJOURS ce doigté.", undefined),
  mc(rng, "Sur une partition imprimée, quels doigts écrit-on ?", "seulement ceux des changements de position", ["tous", "aucun"], "Le reste découle de la position : on n'écrit que ce qui change."),
  mc(rng, "Tu bloques toujours au même endroit d'un morceau. Premier réflexe :", "vérifier le doigté de ce passage", ["jouer plus vite", "sauter ce passage"], "La plupart des accrocs viennent d'un doigté qui oblige la main à sauter."),
  ...positionQs(rng, "L"),
]);

export const FINGER_UNIT: Unit = { id: "udg", title: "Trouver ses doigtés", sub: "Jouer quand rien n'est écrit", icon: "hand", color: "#fbbf24", lessons: [fingerHow, fingerPos, fingerThumb, fingerWrite] };

export const FINGER_LEVELS = ["Position de cinq doigts", "Passages du pouce"];
export function fingerDrill(level: number, rng: Rng = Math.random): Q[] {
  if (level <= 1) return [...positionQs(rng, "R"), ...positionQs(rng, "L"), ...positionQs(rng, "R"), ...positionQs(rng, "L")];
  return [...thumbQs(rng), ...thumbQs(rng), ...positionQs(rng, pick(rng, ["R", "L"] as const)), ...thumbQs(rng)];
}
void M; void mulberry32;
