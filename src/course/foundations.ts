/** Unités 1 à 8 du parcours : du clavier à la gamme de Do — lecture, rythme, intervalles, accords. Chaque leçon n'exige que ce qui précède. */
import { P, M, pick, shuffle, drawN, kb, piece, seqFromPiece, pieceFrom, chordEv as cEv, info, choice, pressPc, pressMidi, seqQ, readSet, pieceQ, chordShow, markKeys, KB_RH, KB_LH, KB_ALL, evs, note, dur, type Rng, type Tok } from "./build";
import { POS_UP_DOWN, AU_CLAIR, MARY, ODE, ODE_LH, AU_CLAIR_LH, MARY_LH, rh, lh, progression, chordQ } from "./pieces";
import { MAJOR_KEYS, buildPieceXml } from "../techCore";
import { midiOf, chordPitches, invert, nameOf, type Pitch } from "./theory";
import type { Q, Lesson, Unit, Show } from "./types";

/** Question à choix : les réponses sont mélangées, la bonne est retrouvée. */
export function mc(rng: Rng, prompt: string, correct: string, wrong: string[], explain: string, show?: Show): Q {
  const options = shuffle(rng, [correct, ...wrong]);
  return choice(prompt, options, options.indexOf(correct), explain, show);
}
const L = (id: string, title: string, goals: string[], build: (rng: Rng) => Q[]): Lesson => ({ id, title, goals, build });
const NAMES7 = ["Do", "Ré", "Mi", "Fa", "Sol", "La", "Si"], PC7 = [0, 2, 4, 5, 7, 9, 11];
const pressName = (rng: Rng, idx: number[], n: number): Q[] => drawN(rng, idx, n).map((i) => pressPc(`Joue un ${NAMES7[i]}`, [PC7[i]], KB_ALL, `${NAMES7[i]} : cherche-le par rapport aux groupes de touches noires.`));

// ───────────────────────── 1. Le clavier ─────────────────────────
const u1: Unit = {
  id: "u1", title: "Le clavier", sub: "Se repérer sans jamais se perdre", icon: "piano", color: "#f472b6", lessons: [
    L("u1-l1", "Touches blanches et noires", ["Reconnaître les groupes de 2 et de 3 touches noires"], (rng) => [
      info("Un motif qui se répète", "Les touches noires vont par groupes : deux, puis trois, puis deux, puis trois… Ce dessin se répète sur tout le piano. C'est ton repère pour ne jamais te perdre.", { marks: [...markKeys([61, 63], "sel"), ...markKeys([66, 68, 70], "target")] }, kb(60, 72)),
      ...drawN(rng, [0, 1, 0, 1, 0, 1], 6).map((g) => g === 0
        ? pressPc("Joue une touche noire du groupe de DEUX", [1, 3], KB_ALL, "Le groupe de deux est le plus petit : Do♯ et Ré♯.")
        : pressPc("Joue une touche noire du groupe de TROIS", [6, 8, 10], KB_ALL, "Le groupe de trois : Fa♯, Sol♯ et La♯.")),
      mc(rng, "Combien de touches noires dans le petit groupe ?", "2", ["3", "5"], "Deux, puis trois : le petit groupe est toujours celui de 2."),
    ]),
    L("u1-l2", "Do et Fa : tes deux repères", ["Trouver tous les Do et tous les Fa du clavier"], (rng) => [
      info("Do et Fa", "Le DO est la touche blanche juste à gauche du groupe de deux noires. Le FA est la touche blanche juste à gauche du groupe de trois noires.", { marks: [{ m: 60, c: "sel" }, { m: 65, c: "target" }] }, kb(60, 72)),
      ...pressName(rng, [0, 0, 0], 3), ...pressName(rng, [3, 3, 3], 3),
      ...drawN(rng, [0, 3], 4).map((i) => pressPc(`Joue un ${NAMES7[i]}`, [PC7[i]], KB_ALL, i === 0 ? "À gauche du groupe de DEUX noires." : "À gauche du groupe de TROIS noires.")),
    ]),
    L("u1-l3", "Do, Ré, Mi", ["Nommer et jouer Do, Ré et Mi"], (rng) => [
      info("Do – Ré – Mi", "En montant vers la droite : Do, puis Ré (la blanche coincée entre les deux noires), puis Mi (juste après le groupe de deux).", { marks: [{ m: 60, c: "sel" }, { m: 62, c: "sel" }, { m: 64, c: "sel" }] }, kb(60, 72)),
      ...pressName(rng, [0, 1, 2], 6),
      seqQ("Joue Do – Ré – Mi", "R", ["C4", "D4", "E4"], undefined, KB_RH),
      seqQ("Redescends : Mi – Ré – Do", "R", ["E4", "D4", "C4"], undefined, KB_RH),
    ]),
    L("u1-l4", "Fa, Sol, La, Si", ["Nommer et jouer Fa, Sol, La et Si"], (rng) => [
      info("Fa – Sol – La – Si", "Autour du groupe de trois noires : Fa à gauche du groupe, Sol entre la 1re et la 2e noire, La entre la 2e et la 3e, Si juste après le groupe.", { marks: [{ m: 65, c: "sel" }, { m: 67, c: "sel" }, { m: 69, c: "sel" }, { m: 71, c: "sel" }] }, kb(60, 72)),
      ...pressName(rng, [3, 4, 5, 6], 7),
      seqQ("Joue Fa – Sol – La – Si", "R", ["F4", "G4", "A4", "B4"], undefined, KB_RH),
      seqQ("Redescends : Si – La – Sol – Fa", "R", ["B4", "A4", "G4", "F4"], undefined, KB_RH),
    ]),
    L("u1-l5", "Les sept notes", ["Réciter l'alphabet musical dans les deux sens", "Situer le Do central"], (rng) => [
      info("Sept notes, puis on recommence", "Do Ré Mi Fa Sol La Si… puis un nouveau Do, plus aigu : même nom, même couleur de son. De Do à Do, on appelle ça une octave. Le Do central (Do4) est celui du milieu du piano. Le chiffre numérote les octaves en partant du grave : Do3 est le Do juste en dessous, Do5 celui juste au-dessus.", { marks: [{ m: 60, c: "sel" }, { m: 72, c: "target" }] }, kb(60, 72)),
      ...pressName(rng, [0, 1, 2, 3, 4, 5, 6], 8),
      seqQ("Joue les huit notes : Do Ré Mi Fa Sol La Si Do", "R", ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"], undefined, KB_RH),
      mc(rng, "Après Si, quelle note revient ?", "Do", ["Ré", "La"], "Après Si on repart de Do, une octave plus haut."),
      mc(rng, "Combien de noms de notes différents existe-t-il ?", "7", ["5", "12"], "Sept : Do Ré Mi Fa Sol La Si. (Avec les touches noires on en fabriquera d'autres, plus tard.)"),
      pressMidi("Trouve le Do central (Do4)", M("C4"), KB_ALL, "Le Do à gauche du groupe de deux noires, le plus proche du milieu du clavier."),
    ]),
  ],
};

// ───────────────────────── 2. Main droite ─────────────────────────
const u2: Unit = {
  id: "u2", title: "Main droite", sub: "Cinq doigts, cinq notes", icon: "hand", color: "#fb923c", lessons: [
    L("u2-l1", "Numérote tes doigts", ["Associer chaque doigt à son numéro"], (rng) => {
      const fingers: [string, number][] = [["le pouce", 1], ["l'index", 2], ["le majeur", 3], ["l'annulaire", 4], ["l'auriculaire (petit doigt)", 5]];
      return [
        info("Un numéro par doigt", "Pouce = 1 · index = 2 · majeur = 3 · annulaire = 4 · auriculaire = 5. C'est le même numérotage pour les deux mains : les chiffres écrits sur la partition te disent quel doigt utiliser.", undefined),
        ...shuffle(rng, fingers).slice(0, 4).map(([name, n]) => mc(rng, `Quel numéro porte ${name} ?`, String(n), [1, 2, 3, 4, 5].filter((x) => x !== n).map(String).slice(0, 2), `${name} porte le numéro ${n}.`)),
        ...shuffle(rng, fingers).slice(0, 2).map(([name, n]) => mc(rng, `Le doigt n° ${n}, c'est…`, name, fingers.filter((f) => f[1] !== n).map((f) => f[0]).slice(0, 2), `Le ${n} est ${name}.`)),
        pressMidi("Pose ton pouce droit sur le Do central et joue-le", M("C4"), KB_RH, "Do4 : à gauche du groupe de deux noires, au milieu."),
      ];
    }),
    L("u2-l2", "Position de Do, main droite", ["Poser la main droite sur Do Ré Mi Fa Sol", "Jouer avec le bon doigt sur chaque touche"], (rng) => [
      info("La position de Do", "Pouce (1) sur Do, puis un doigt par touche blanche : 1-Do · 2-Ré · 3-Mi · 4-Fa · 5-Sol. Garde la main arrondie, comme si tu tenais une balle : les doigts tombent d'eux-mêmes sur les touches.",
        { badges: [1, 2, 3, 4, 5].map((f) => ({ m: 59 + [1, 3, 5, 6, 8][f - 1], t: String(f), hand: "R" as const })) }, kb(59, 72)),
      seqQ("Monte avec les doigts 1 2 3 4 5", "R", ["C4", "D4", "E4", "F4", "G4"], [1, 2, 3, 4, 5], KB_RH),
      seqQ("Redescends avec les doigts 5 4 3 2 1", "R", ["G4", "F4", "E4", "D4", "C4"], [5, 4, 3, 2, 1], KB_RH),
      mc(rng, "Quel doigt joue le Mi ?", "3", ["2", "4"], "Pouce sur Do (1), Ré (2), Mi (3)."),
      mc(rng, "Quel doigt joue le Sol ?", "5", ["4", "3"], "Le petit doigt, le 5, joue le Sol."),
      pieceQ({ title: "Montée et descente (main droite)", goal: "Joue l'exercice en suivant les doigtés.", bpm: 66, rh: rh(POS_UP_DOWN), hands: "R" }),
    ]),
    L("u2-l3", "Premières mélodies", ["Jouer deux mélodies simples à la main droite"], () => [
      info("Tes premiers morceaux", "Deux airs que tout le monde connaît. Le morceau t'attend à chaque note : prends ton temps, regarde le doigté sur la touche, et vise la régularité plutôt que la vitesse.", undefined),
      pieceQ({ title: "Au clair de la lune", goal: "Mélodie de Do, Ré, Mi : pouce, index, majeur.", bpm: 72, rh: rh(AU_CLAIR), hands: "R" }),
      pieceQ({ title: "Mary avait un petit agneau", goal: "Pense à bien garder la main en position.", bpm: 72, rh: rh(MARY), hands: "R" }),
    ]),
    L("u2-l4", "L'Ode à la joie", ["Jouer l'Ode à la joie en entier à la main droite", "Reconnaître la noire pointée"], (rng) => [
      info("La noire pointée", "La musique avance sur des battements réguliers, comme un tic-tac : les « temps ». Une noire (la note la plus courante) dure un temps, une croche un demi-temps ; tu verras tout ça en détail dans l'unité Le rythme. Un point après une note ajoute la moitié de sa durée : une noire pointée dure un temps et demi. Dans l'Ode à la joie, elle est suivie d'une croche : « longue – courte ».", undefined),
      mc(rng, "Un point après une note…", "ajoute la moitié de sa durée", ["la raccourcit de moitié", "double sa durée"], "Noire pointée = 1 temps + ½ temps = 1 temps et demi."),
      pieceQ({ title: "Ode à la joie (main droite)", goal: "Beethoven, 9e symphonie. Les doigts 1 à 5, sans bouger la main.", bpm: 80, rh: rh(ODE), hands: "R" }),
    ]),
  ],
};

// ───────────────────────── 3. Main gauche ─────────────────────────
const u3: Unit = {
  id: "u3", title: "Main gauche", sub: "La main qu'on néglige à tort", icon: "hand", color: "#facc15", lessons: [
    L("u3-l1", "Position de Do, main gauche", ["Poser la main gauche sur Do Ré Mi Fa Sol graves"], (rng) => [
      info("La main gauche en miroir", "À gauche, tout est inversé : le petit doigt (5) joue le Do grave, et le pouce (1) le Sol. Les numéros montent donc quand tu descends vers les graves : 5-Do · 4-Ré · 3-Mi · 2-Fa · 1-Sol.",
        { badges: [5, 4, 3, 2, 1].map((f, i) => ({ m: 48 + [0, 2, 4, 5, 7][i], t: String(f), hand: "L" as const })) }, kb(46, 62)),
      seqQ("Monte avec les doigts 5 4 3 2 1", "L", ["C3", "D3", "E3", "F3", "G3"], [5, 4, 3, 2, 1], KB_LH),
      seqQ("Redescends avec les doigts 1 2 3 4 5", "L", ["G3", "F3", "E3", "D3", "C3"], [1, 2, 3, 4, 5], KB_LH),
      mc(rng, "Quel doigt de la main gauche joue le Do grave ?", "5", ["1", "3"], "À gauche, le petit doigt (5) est du côté des graves."),
      pieceQ({ title: "Montée et descente (main gauche)", goal: "Même exercice, une octave plus bas.", bpm: 66, lh: lh(POS_UP_DOWN), hands: "L" }),
    ]),
    L("u3-l2", "Mélodies à la main gauche", ["Jouer une mélodie à la main gauche"], () => [
      info("Même airs, côté grave", "Tu connais déjà ces mélodies : joue-les maintenant avec la main gauche. Les notes sont les mêmes, une octave plus bas, et les doigtés sont inversés.", undefined),
      pieceQ({ title: "Au clair de la lune (main gauche)", goal: "Doigts 5-4-3 pour Do-Ré-Mi.", bpm: 72, lh: lh(AU_CLAIR), hands: "L" }),
      pieceQ({ title: "Mary avait un petit agneau (main gauche)", goal: "Garde le pouce près de Sol.", bpm: 72, lh: lh(MARY), hands: "L" }),
    ]),
    L("u3-l3", "Deux mains ensemble", ["Jouer les deux mains à l'octave"], (rng) => [
      info("Mains parallèles", "Les deux mains jouent les mêmes notes à une octave d'écart. La droite monte quand la gauche monte : regarde la partition (deux portées) et laisse tes mains faire les mêmes gestes.", undefined),
      mc(rng, "Quand les deux mains jouent à l'octave, elles jouent…", "les mêmes notes, une octave d'écart", ["des notes différentes", "exactement les mêmes touches"], "Même nom de note, huit notes plus haut (Do Ré Mi Fa Sol La Si Do) : une octave."),
      pieceQ({ title: "Montée et descente (deux mains)", goal: "Les deux mains ensemble, doigts 1-2-3-4-5 à droite, 5-4-3-2-1 à gauche.", bpm: 60, rh: rh(POS_UP_DOWN), lh: lh(POS_UP_DOWN) }),
      pieceQ({ title: "Au clair de la lune à l'octave", goal: "La même mélodie aux deux mains, une octave d'écart.", bpm: 66, rh: rh(AU_CLAIR), lh: lh(AU_CLAIR) }),
    ]),
    L("u3-l4", "Mélodie et accompagnement", ["Jouer une mélodie à droite avec des basses à gauche"], (rng) => [
      info("Chanter et accompagner", "La main droite chante la mélodie ; la main gauche tient des notes de basse (Do, puis Sol) qui donnent l'harmonie. Écoute comme les deux mains se complètent.", undefined),
      mc(rng, "Quelle main joue la mélodie ici ?", "La main droite", ["La main gauche", "Les deux"], "La mélodie est dans la portée du haut (clé de Sol) : main droite."),
      pieceQ({ title: "Au clair de la lune (deux mains)", goal: "Mélodie à droite, basses Do et Sol à gauche.", bpm: 66, rh: rh(AU_CLAIR), lh: evs(AU_CLAIR_LH) }),
      pieceQ({ title: "Mary avait un petit agneau (deux mains)", goal: "La basse change de note en milieu de morceau.", bpm: 66, rh: rh(MARY), lh: evs(MARY_LH) }),
      pieceQ({ title: "Ode à la joie (deux mains)", goal: "Beethoven : mélodie à droite, basses à gauche.", bpm: 76, rh: rh(ODE), lh: evs(ODE_LH) }),
    ]),
  ],
};

// ───────────────────────── 4. Clé de Sol ─────────────────────────
const u4: Unit = {
  id: "u4", title: "Lire en clé de Sol", sub: "La portée de la main droite", icon: "music-4", color: "#34d399", lessons: [
    L("u4-l1", "La portée et la clé de Sol", ["Compter les lignes et les interlignes", "Lire Do Ré Mi Fa Sol"], (rng) => [
      info("La portée", "Cinq lignes, quatre interlignes, qu'on compte du bas vers le haut. La clé de Sol s'enroule autour de la 2e ligne : c'est la ligne du Sol. Plus la note est haute sur la portée, plus elle est aiguë sur le clavier.", { staff: { clef: "G", evs: [note(P("G4"), 8)] } }, KB_RH),
      info("Le Do central", "Le Do central s'écrit sous la portée, sur une petite ligne en plus (« ligne supplémentaire »). Ensuite Ré dans l'espace sous la 1re ligne, Mi sur la 1re ligne, Fa dans le 1er interligne, Sol sur la 2e ligne.", { staff: { clef: "G", evs: ["C4", "D4", "E4", "F4", "G4"].map((n) => note(P(n), 2)), labels: ["Do", "Ré", "Mi", "Fa", "Sol"] } }, KB_RH),
      ...readSet(rng, "G", [-2, -1, 0, 1, 2], 9),
    ]),
    L("u4-l2", "Les lignes : Mi Sol Si Ré Fa", ["Lire les notes posées sur les lignes"], (rng) => [
      info("Les cinq lignes", "De bas en haut, les lignes portent : Mi – Sol – Si – Ré – Fa. Retiens cette suite : en sautant une note sur deux, tu retombes toujours sur une ligne.", { staff: { clef: "G", evs: ["E4", "G4", "B4", "D5", "F5"].map((n) => note(P(n), 2)), labels: ["Mi", "Sol", "Si", "Ré", "Fa"] } }, kb(60, 79)),
      ...readSet(rng, "G", [0, 2, 4, 6, 8], 10),
    ]),
    L("u4-l3", "Les interlignes : Fa La Do Mi", ["Lire les notes posées dans les interlignes"], (rng) => [
      info("Les quatre interlignes", "De bas en haut, les interlignes portent : Fa – La – Do – Mi. Ensemble, ils épellent FA-LA-DO-MI… « FACE » en anglais : une petite phrase facile à retenir.", { staff: { clef: "G", evs: ["F4", "A4", "C5", "E5"].map((n) => note(P(n), 2)), labels: ["Fa", "La", "Do", "Mi"] } }, kb(60, 79)),
      ...readSet(rng, "G", [1, 3, 5, 7], 10),
    ]),
    L("u4-l4", "Toute la clé de Sol", ["Lire n'importe quelle note de Do4 à La5"], (rng) => [
      info("Tout ensemble", "Mélange maintenant lignes, interlignes et lignes supplémentaires : de Do4 (sous la portée) à La5 (au-dessus). Pas d'indice cette fois : lis, ne compte plus.", undefined),
      ...readSet(rng, "G", [-2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 14),
    ]),
  ],
};

// ───────────────────────── 5. Clé de Fa ─────────────────────────
const u5: Unit = {
  id: "u5", title: "Lire en clé de Fa", sub: "La portée de la main gauche", icon: "music-2", color: "#38bdf8", lessons: [
    L("u5-l1", "La clé de Fa", ["Reconnaître la clé de Fa", "Lire Do Ré Mi Fa Sol graves"], (rng) => [
      info("La clé de Fa", "Les deux points de la clé de Fa entourent la 4e ligne : c'est la ligne du Fa. Cette clé sert aux notes graves, jouées par la main gauche. La position de Do de ta main gauche (Do3 à Sol3) se lit dans le haut de la portée.", { staff: { clef: "F", evs: [note(P("F3"), 8)] } }, KB_LH),
      info("Do Ré Mi Fa Sol graves", "Do3 se trouve dans le 2e interligne (en comptant depuis le bas), juste sous la 3e ligne. Les cinq notes de ta position : Do – Ré – Mi – Fa – Sol.", { staff: { clef: "F", evs: ["C3", "D3", "E3", "F3", "G3"].map((n) => note(P(n), 2)), labels: ["Do", "Ré", "Mi", "Fa", "Sol"] } }, KB_LH),
      ...readSet(rng, "F", [3, 4, 5, 6, 7], 9),
    ]),
    L("u5-l2", "Les lignes : Sol Si Ré Fa La", ["Lire les lignes de la clé de Fa"], (rng) => [
      info("Les cinq lignes", "En clé de Fa, les lignes portent de bas en haut : Sol – Si – Ré – Fa – La. Attention : ce n'est pas la même suite qu'en clé de Sol ! Les notes sont décalées de deux lignes-et-interlignes.", { staff: { clef: "F", evs: ["G2", "B2", "D3", "F3", "A3"].map((n) => note(P(n), 2)), labels: ["Sol", "Si", "Ré", "Fa", "La"] } }, kb(40, 64)),
      ...readSet(rng, "F", [0, 2, 4, 6, 8], 10),
    ]),
    L("u5-l3", "Les interlignes : La Do Mi Sol", ["Lire les interlignes de la clé de Fa"], (rng) => [
      info("Les quatre interlignes", "De bas en haut : La – Do – Mi – Sol. Comme pour les lignes, c'est une note sur deux : on retombe toujours sur la suite La – Do – Mi – Sol.", { staff: { clef: "F", evs: ["A2", "C3", "E3", "G3"].map((n) => note(P(n), 2)), labels: ["La", "Do", "Mi", "Sol"] } }, kb(40, 64)),
      ...readSet(rng, "F", [1, 3, 5, 7], 10),
    ]),
    L("u5-l4", "Toute la clé de Fa", ["Lire n'importe quelle note de Mi2 à Do4"], (rng) => [
      info("Tout ensemble", "Du Mi2 (sous la portée) au Do4 (au-dessus) : le Do central est ici sur la 1re ligne supplémentaire au-dessus de la portée.", undefined),
      ...readSet(rng, "F", [-2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 14),
    ]),
    L("u5-l5", "Les deux clés", ["Passer de la clé de Sol à la clé de Fa sans hésiter"], (rng) => [
      info("Grande portée", "Au piano on lit les deux clés ensemble : Sol en haut (main droite), Fa en bas (main gauche). Le Do central est la note charnière : sous la clé de Sol, au-dessus de la clé de Fa.", undefined),
      ...[...readSet(rng, "G", [-2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8], 6), ...readSet(rng, "F", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 6)].sort(() => rng() - 0.5),
    ]),
  ],
};

// ───────────────────────── 6. Rythme ─────────────────────────
const rhythm = (prompt: string, pattern: number[], bpm: number, hint?: string): Q => ({ k: "rhythm", prompt, pattern, bpm, hint });
const u6: Unit = {
  id: "u6", title: "Le rythme", sub: "Durer le bon temps", icon: "drum", color: "#a78bfa", lessons: [
    L("u6-l1", "La pulsation et la noire", ["Sentir la pulsation", "Jouer des noires régulières"], (rng) => [
      info("La pulsation", "Sous toute musique bat un pouls régulier : la pulsation, ou « temps ». La noire est la note qui dure un temps. Écoute le métronome : tu auras quatre clics de préparation, puis tape (n'importe quelle touche, la barre espace, ou touche le bouton) à chaque noire.", undefined),
      rhythm("Tape quatre noires", [2, 2, 2, 2], 66),
      rhythm("Tape huit noires", [2, 2, 2, 2, 2, 2, 2, 2], 72),
      mc(rng, "Combien de temps dure une noire ?", "1 temps", ["2 temps", "½ temps"], "La noire vaut un temps."),
    ]),
    L("u6-l2", "Blanche et ronde", ["Compter 2 temps (blanche) et 4 temps (ronde)"], (rng) => [
      info("Les notes longues", "La blanche dure 2 temps, la ronde 4 temps. Tape seulement au début de la note, puis laisse-la durer en comptant dans ta tête : « 1 – 2 », « 1 – 2 – 3 – 4 ».", undefined),
      mc(rng, "Combien de temps dure une blanche ?", "2 temps", ["1 temps", "4 temps"], "Blanche = 2 temps."),
      mc(rng, "Combien de temps dure une ronde ?", "4 temps", ["2 temps", "3 temps"], "Ronde = 4 temps : on compte « 1 – 2 – 3 – 4 » avant la note suivante."),
      rhythm("Tape : blanche, blanche", [4, 4], 66),
      rhythm("Tape : noire, noire, blanche", [2, 2, 4], 66),
      rhythm("Tape : blanche, noire, noire", [4, 2, 2], 66),
      rhythm("Tape : une ronde, puis quatre noires", [8, 2, 2, 2, 2], 66),
    ]),
    L("u6-l3", "Les silences", ["Reconnaître et compter les silences"], (rng) => [
      info("Se taire, c'est de la musique", "Un silence dure aussi longtemps que la note qui porte le même nom : le soupir (1 temps) répond à la noire, la demi-pause (2 temps) à la blanche, la pause (4 temps) à la ronde. Ne tape rien pendant un silence, mais continue à compter.", undefined),
      mc(rng, "Un soupir dure…", "1 temps", ["2 temps", "4 temps"], "Le soupir = la noire du silence : 1 temps."),
      rhythm("Tape : noire, soupir, noire, soupir", [2, -2, 2, -2], 66, "Compte 1 – (silence) – 3 – (silence)"),
      rhythm("Tape : blanche, demi-pause", [4, -4], 66),
      rhythm("Tape : noire, noire, soupir, noire", [2, 2, -2, 2], 66),
      rhythm("Tape : noire, demi-pause, noire", [2, -4, 2], 66),
    ]),
    L("u6-l4", "Les croches", ["Jouer deux croches par temps"], (rng) => [
      info("Deux fois plus vite", "Deux croches égalent une noire : elles se jouent deux par temps, « et-un et-deux ». Tape-les régulièrement, sans courir.", undefined),
      mc(rng, "Deux croches durent autant que…", "une noire", ["une blanche", "un soupir"], "2 croches = 1 noire = 1 temps."),
      rhythm("Tape : deux croches, deux croches, noire, noire", [1, 1, 1, 1, 2, 2], 60),
      rhythm("Tape : noire, deux croches, noire, deux croches", [2, 1, 1, 2, 1, 1], 60),
      rhythm("Tape : quatre croches, blanche", [1, 1, 1, 1, 4], 60),
    ]),
    L("u6-l5", "La noire pointée", ["Jouer « longue – courte » (noire pointée + croche)"], (rng) => [
      info("Longue – courte", "Noire pointée (1 temps et demi) + croche (½ temps) = 2 temps. C'est le rythme de l'Ode à la joie : « Tâ-a-ti ». Écoute la pulsation et place la croche juste avant le temps suivant.", undefined),
      mc(rng, "Noire pointée + croche, ça fait…", "2 temps", ["1 temps", "3 temps"], "1½ + ½ = 2 temps."),
      rhythm("Tape : noire pointée, croche, blanche", [3, 1, 4], 60),
      rhythm("Tape : noire pointée, croche, noire pointée, croche", [3, 1, 3, 1], 60),
    ]),
  ],
};


// ───────────────────────── Dièses et bémols ─────────────────────────
const flatSharpPress = (rng: Rng, items: string[], n: number): Q[] => drawN(rng, items, n).map((nm) => {
  const p = P(nm + "4"), m = midiOf(p);
  return pressPc(`Joue ${NAMES7[p.li]}${p.alter > 0 ? "♯" : "♭"}`, [m % 12], KB_ALL, p.alter > 0 ? `${NAMES7[p.li]}♯ : la touche noire juste À DROITE de ${NAMES7[p.li]}.` : `${NAMES7[p.li]}♭ : la touche noire juste À GAUCHE de ${NAMES7[p.li]}.`);
});
/** Lire une note avec dièse ou bémol sur la portée (clé de Sol). */
const readAcc = (rng: Rng, names: string[], n: number): Q[] => drawN(rng, names, n).map((nm) => {
  const p = P(nm), m = midiOf(p);
  return { k: "press", prompt: "Joue cette note", target: { midi: m }, show: { staff: { clef: "G", evs: [note(p, 8)] } }, kbd: kb(57, 83), hint: `${NAMES7[p.li]}${p.alter > 0 ? "♯ : touche noire à droite" : "♭ : touche noire à gauche"} de ${NAMES7[p.li]}.`, ok: `${NAMES7[p.li]}${p.alter > 0 ? "♯" : "♭"}` } as Q;
});
const ub: Unit = {
  id: "ub", title: "Dièses et bémols", sub: "Les touches noires ont un nom", icon: "♯", color: "#f59e0b", lessons: [
    L("ub-l1", "Dièse, bémol, bécarre", ["Nommer les touches noires", "Savoir ce que font ♯, ♭ et ♮"], (rng) => [
      info("Un signe devant la note", "Une touche noire n'a pas de nom à elle : elle emprunte celui de sa voisine blanche, avec un signe. Le DIÈSE (♯) monte la note d'un demi-ton : Do♯ est la noire juste à droite de Do. Le BÉMOL (♭) la descend d'un demi-ton : Ré♭ est la noire juste à gauche de Ré. Le BÉCARRE (♮) annule l'altération.", { marks: [{ m: 60, c: "sel" }, { m: 61, c: "target" }, { m: 62, c: "sel" }, { m: 63, c: "target" }] }, kb(60, 72)),
      mc(rng, "Quel signe fait monter une note d'un demi-ton ?", "le dièse ♯", ["le bémol ♭", "le bécarre ♮"], "Dièse = plus aigu d'un demi-ton ; bémol = plus grave ; bécarre = on revient à la note naturelle."),
      mc(rng, "Fa♯ est…", "la noire juste à droite de Fa", ["la noire juste à gauche de Fa", "la blanche après Fa"], "Un dièse monte : on va vers la droite."),
      ...flatSharpPress(rng, ["F#", "C#", "G#", "Bb", "Eb", "Ab", "Db"], 8),
    ]),
    L("ub-l2", "Une touche, deux noms", ["Savoir que Do♯ et Ré♭ sont la même touche", "Lire des notes altérées sur la portée"], (rng) => [
      info("Deux noms pour la même touche", "Do♯ et Ré♭ désignent la même touche noire : c'est ce qu'on appelle des notes « enharmoniques ». On choisit le nom selon la tonalité (on y viendra). Autre règle : sur la portée, une altération écrite devant une note vaut pour toute la mesure, sauf si un bécarre l'annule.", { marks: [{ m: 61, c: "sel" }, { m: 63, c: "target" }, { m: 66, c: "sel" }] }, kb(60, 72)),
      mc(rng, "Do♯ est la même touche que…", "Ré♭", ["Ré♯", "Do♭"], "Do♯ (un demi-ton au-dessus de Do) et Ré♭ (un demi-ton sous Ré) sont la même touche."),
      mc(rng, "Mi♭ est la même touche que…", "Ré♯", ["Mi♯", "Fa♭"], "Mi♭ = un demi-ton sous Mi = un demi-ton au-dessus de Ré."),
      mc(rng, "Sol♭ est la même touche que…", "Fa♯", ["Sol♯", "Fa♭"], "Sol♭ et Fa♯ : la noire entre Fa et Sol."),
      ...readAcc(rng, ["F#4", "Bb4", "C#5", "Eb4", "G#4", "Ab4", "D#4"], 7),
    ]),
    L("ub-l3", "Tons, demi-tons et gamme chromatique", ["Distinguer ton et demi-ton", "Jouer la gamme chromatique"], (rng) => {
      const names = ["C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4"];
      // 12 noires = 3 mesures de 4 temps, puis la tonique en ronde : la partition tombe juste sur des mesures complètes
      const bars: Tok[] = [...names.map((n) => [n, dur.q] as Tok), ["C5", dur.w]];
      return [
        info("Le plus petit pas", "Un demi-ton est la plus petite distance du piano : d'une touche à sa voisine, noire ou blanche. Un ton, c'est deux demi-tons. Mi→Fa et Si→Do n'ont pas de noire entre elles : ce sont des demi-tons « naturels ». La gamme chromatique monte par demi-tons, sur toutes les touches. Astuce de doigté : pouce sur les blanches, majeur sur les noires (et l'index pour Mi–Fa et Si–Do).", { marks: [{ m: 64, c: "sel" }, { m: 65, c: "sel" }] }, kb(60, 72)),
        mc(rng, "De Do à Do♯, il y a…", "un demi-ton", ["un ton", "deux tons"], "Deux touches voisines : un demi-ton."),
        mc(rng, "De Do à Ré, il y a…", "un ton", ["un demi-ton", "trois demi-tons"], "Do → Do♯ → Ré : deux demi-tons = un ton."),
        mc(rng, "Entre Mi et Fa, il y a…", "un demi-ton", ["un ton", "un ton et demi"], "Pas de touche noire entre Mi et Fa : demi-ton."),
        seqQ("Joue la gamme chromatique : douze demi-tons de Do à Do", "R", [...names, "C5"], undefined, kb(59, 74), "Pouce sur les blanches, majeur sur les noires."),
        pieceQ({ title: "Gamme chromatique de Do", goal: "Treize notes, toutes les touches de Do à Do.", bpm: 60, rh: evs(bars), hands: "R" }),
      ];
    }),
  ],
};

// ───────────────────────── 7. Intervalles ─────────────────────────
const IV_NAME: Record<number, string> = { 2: "seconde", 3: "tierce", 4: "quarte", 5: "quinte", 6: "sixte", 7: "septième", 8: "octave" };
const IV_ALL = Object.values(IV_NAME);
/** Intervalle formé par deux touches blanches : distance en notes, en comptant la première. */
function ivQs(rng: Rng, sizes: number[], n: number, play: number): Q[] {
  const out: Q[] = [];
  const roots = ["C4", "D4", "E4", "F4", "G4", "A4"].map(P);
  for (let i = 0; i < n; i++) {
    const size = sizes[i % sizes.length], lo = pick(rng, roots), liHi = (lo.li + size - 1) % 7, octHi = lo.oct + Math.floor((lo.li + size - 1) / 7), hi: Pitch = { li: liHi, alter: 0, oct: octHi };
    out.push(mc(rng, "Quel est cet intervalle ?", IV_NAME[size], IV_ALL.filter((x) => x !== IV_NAME[size] && sizes.concat([2, 3, 4, 5]).some((s) => IV_NAME[s] === x)).slice(0, 2), `De ${nameOf(lo)} à ${nameOf(hi)} : ${size} notes en comptant la première, c'est une ${IV_NAME[size]}.`, chordShow("G", [lo, hi])));
  }
  for (let i = 0; i < play; i++) {
    const size = sizes[(i + 1) % sizes.length], lo = pick(rng, roots), liHi = (lo.li + size - 1) % 7, hi: Pitch = { li: liHi, alter: 0, oct: lo.oct + Math.floor((lo.li + size - 1) / 7) };
    const pcs = [midiOf(lo) % 12, midiOf(hi) % 12];
    out.push({ k: "chord", prompt: `Joue une ${IV_NAME[size]} au-dessus de ${nameOf(lo)} : les deux touches ensemble`, pcs, bass: pcs[0], name: `${nameOf(lo)}–${nameOf(hi)}`, kbd: kb(57, 84), hint: `${nameOf(lo)} (1), … jusqu'à ${nameOf(hi)} (${size}) : ${size} notes en comptant la première.` });
  }
  return shuffle(rng, out);
}
const u7: Unit = {
  id: "u7", title: "Les intervalles", sub: "La distance entre deux notes", icon: "↔️", color: "#f87171", lessons: [
    L("u7-l1", "Seconde et tierce", ["Compter un intervalle", "Reconnaître et jouer une seconde et une tierce"], (rng) => [
      info("Pourquoi les intervalles ?", "Lire note par note, en nommant chacune, c'est lent. Les bons lecteurs lisent l'ÉCART avec la note précédente : « une tierce plus haut », et la main y va sans même nommer la note. Les intervalles servent aussi à construire les accords (on empile des tierces), à trouver ses doigtés (une quinte = l'écart de la main) et à reconnaître une mélodie à l'oreille.", undefined),
      info("Compter les notes", "Un intervalle est la distance entre deux notes. On le compte en notes, en comptant la première : Do→Ré = 2 notes, une seconde ; Do→Mi = 3 notes (Do Ré Mi), une tierce. Sur la portée : deux notes voisines = seconde ; une ligne ou un interligne sauté(e) = tierce.", chordShow("G", [P("C4"), P("E4")]), KB_RH),
      ...ivQs(rng, [2, 3], 5, 2),
    ]),
    L("u7-l2", "Quarte, quinte, octave", ["Reconnaître et jouer une quarte, une quinte et une octave"], (rng) => [
      info("Plus larges", "Quarte = 4 notes (Do→Fa), quinte = 5 notes (Do→Sol : l'écart de tes 5 doigts !), octave = 8 notes (Do→Do). Les notes d'une quinte ou d'une octave tombent toutes les deux sur des lignes (ou toutes les deux dans des interlignes).", chordShow("G", [P("C4"), P("G4")]), KB_RH),
      ...ivQs(rng, [4, 5, 8], 6, 3),
    ]),
    L("u7-l3", "Sixte et septième", ["Reconnaître et jouer une sixte et une septième"], (rng) => [
      info("Les grands écarts", "Sixte = 6 notes (Do→La), septième = 7 notes (Do→Si). Une astuce : une septième est une octave moins une seconde (juste sous l'octave) ; une sixte est une octave moins une tierce.", chordShow("G", [P("C4"), P("A4")]), KB_RH),
      ...ivQs(rng, [6, 7, 5, 3], 6, 3),
    ]),
  ],
};

// ───────────────────────── 8. Accords ─────────────────────────
const C = (k: string) => ({ li: "CDEFGAB".indexOf(k[0]), alter: k[1] === "b" ? -1 : k[1] === "#" ? 1 : 0 });
const qualityPcs = (root: { li: number; alter: number }, q: "maj" | "min") => chordPitches(root, 4, q);
const u8: Unit = {
  id: "u8", title: "Les accords", sub: "Plusieurs notes à la fois", icon: "piano", color: "#fb7185", lessons: [
    L("u8-l1", "Qu'est-ce qu'un accord ?", ["Savoir ce qu'est une triade", "Jouer Do–Mi–Sol ensemble"], (rng) => [
      info("Empiler des tierces", "Un accord, ce sont plusieurs notes jouées en même temps. Le plus courant, la triade, empile trois notes séparées chacune d'une tierce : Do – Mi – Sol. Elle s'écrit sur trois lignes consécutives (ou trois interlignes).", { ...chordShow("G", qualityPcs(C("C"), "maj")), marks: markKeys([60, 64, 67], "sel") }, KB_RH),
      info("À quoi sert un accord ?", "La mélodie, c'est ce qu'on chante ; l'accord, c'est le décor sur lequel elle se pose. La même mélodie sonne joyeuse sur un accord majeur, triste sur un mineur, tendue sur une septième : changer d'accord, c'est changer l'émotion sans toucher à l'air.\n\nLa règle d'or : les notes importantes de la mélodie (celles des temps forts, celles qu'on tient longtemps) font presque toujours partie de l'accord du moment. C'est ce qui permet de choisir un accord pour accompagner une chanson : on y revient dans les leçons suivantes.", undefined),
      mc(rng, "Dans une chanson, l'accord sert surtout à…", "colorer la mélodie (le décor, l'émotion)", ["remplacer la mélodie", "marquer le tempo, rien de plus"], "La mélodie reste la même ; l'accord dessous décide si elle sonne joyeuse, triste ou tendue."),
      mc(rng, "Combien de notes dans une triade ?", "3", ["2", "4"], "Tri-ade : trois notes."),
      chordQ(C("C"), "maj", "R"),
      mc(rng, "Entre chaque note d'une triade, il y a…", "une tierce", ["une seconde", "une quinte"], "On empile des tierces : Do–Mi, puis Mi–Sol."),
      chordQ(C("C"), "maj", "R", "Rejoue l'accord de Do majeur : trois touches enfoncées ensemble"),
    ]),
    L("u8-l2", "Les doigts d'un accord", ["Jouer Do majeur 1-3-5 à droite et 5-3-1 à gauche"], (rng) => [
      info("Un doigt sur deux", "Une triade se joue avec les doigts 1 – 3 – 5 à la main droite, et 5 – 3 – 1 à la gauche : un doigt sur deux, la main reste arrondie et détendue. Descends tous les doigts en même temps, sans les écraser.",
        { badges: [{ m: 60, t: "1", hand: "R" }, { m: 64, t: "3", hand: "R" }, { m: 67, t: "5", hand: "R" }] }, KB_RH),
      chordQ(C("C"), "maj", "R", "Main droite, doigts 1-3-5 : joue Do majeur"),
      chordQ(C("C"), "maj", "L", "Main gauche, doigts 5-3-1 : joue Do majeur grave"),
      mc(rng, "Quels doigts jouent une triade à la main droite ?", "1 – 3 – 5", ["1 – 2 – 3", "2 – 3 – 4"], "Un doigt sur deux : 1-3-5."),
      pieceQ({ title: "Do majeur en accords", goal: "Joue l'accord de Do majeur à deux mains, quatre fois.", bpm: 60, rh: [1, 2, 3, 4].map(() => ({ notes: chordPitches(C("C"), 4, "maj").map((p, i) => ({ p, finger: [1, 3, 5][i] })), dur: dur.w })), lh: [1, 2, 3, 4].map(() => ({ notes: chordPitches(C("C"), 3, "maj").map((p, i) => ({ p, finger: [5, 3, 1][i] })), dur: dur.w })) }),
    ]),
    L("u8-l3", "Majeur ou mineur ?", ["Distinguer un accord majeur d'un accord mineur", "Jouer Do mineur"], (rng) => {
      const items: [string, "maj" | "min"][] = [["C", "maj"], ["C", "min"], ["D", "min"], ["F", "maj"], ["G", "maj"], ["A", "min"], ["E", "min"], ["D", "maj"]];
      return [
        info("La couleur de l'accord", "Dans une triade, c'est la tierce du bas (Do–Mi) qui décide : 4 demi-tons = accord MAJEUR (lumineux), 3 demi-tons = accord MINEUR (sombre). Pour passer de Do majeur à Do mineur, on abaisse Mi d'un demi-ton : Mi♭ (la touche noire à gauche).", { ...chordShow("G", chordPitches(C("C"), 4, "min")), marks: markKeys([60, 63, 67], "sel") }, KB_RH),
        chordQ(C("C"), "maj", "R"), chordQ(C("C"), "min", "R"),
        ...shuffle(rng, items).slice(0, 4).map(([r, qu]) => mc(rng, "Cet accord est…", qu === "maj" ? "majeur" : "mineur", [qu === "maj" ? "mineur" : "majeur"], `${nameOf(C(r))} ${qu === "maj" ? "majeur" : "mineur"} : la tierce du bas fait ${qu === "maj" ? 4 : 3} demi-tons.`, chordShow("G", qualityPcs(C(r), qu)))),
        chordQ(C("D"), "min", "R"),
      ];
    }),
    L("u8-l4", "Do, Fa, Sol : les trois accords de base", ["Jouer les accords de Do, Fa et Sol majeurs", "Enchaîner Do – Fa – Sol – Do"], (rng) => {
      const key = MAJOR_KEYS[0];
      const prog = progression(key, [{ d: 1 }, { d: 4 }, { d: 5 }, { d: 1 }], { bpm: 56, title: "Do – Fa – Sol – Do (accords)" });
      return [
        info("I, IV, V", "Une chanson tourne autour d'une note « maison », où elle se pose à la fin : la TONIQUE. Ici, c'est Do. On numérote les notes à partir d'elle : Do = 1, Ré = 2, Mi = 3, Fa = 4, Sol = 5, La = 6, Si = 7. Ce numéro s'appelle le DEGRÉ, et l'accord bâti sur un degré prend son numéro en chiffres romains.\n\nAvec trois accords – celui de la tonique (Do, le I), celui du 4e degré, la sous-dominante (Fa, le IV), et celui du 5e degré, la dominante (Sol, le V) – on accompagne des centaines de chansons : I – IV – V.", undefined),
        chordQ(C("F"), "maj", "R"), chordQ(C("G"), "maj", "R"),
        info("Maison, voyage, retour", "Chaque accord a un rôle. Le I (Do) : la maison, le repos ; une chanson finit presque toujours dessus. Le IV (Fa) : on s'éloigne, ça s'ouvre. Le V (Sol) : la tension, l'envie de rentrer ; il contient Si, la note juste sous Do, qui « tire » vers lui.\n\nEt ce qui rend ces trois accords si utiles : à eux trois, ils contiennent les 7 notes de Do majeur, Do Ré Mi Fa Sol La Si (Do-Mi-Sol, Fa-La-Do, Sol-Si-Ré). N'importe quelle note de la mélodie trouve donc sa place dans l'un d'eux : pour accompagner, on prend celui qui contient la note chantée.", { staff: { clef: "G", evs: (["C", "F", "G"] as const).map((r) => cEv(qualityPcs(C(r), "maj"), 2)), labels: ["I · Do", "IV · Fa", "V · Sol"] } }, KB_RH),
        mc(rng, "La mélodie tient longtemps un Mi. Quel accord choisir ?", "Do (Do – Mi – Sol)", ["Fa (Fa – La – Do)", "Sol (Sol – Si – Ré)"], "Mi fait partie de l'accord de Do : c'est lui qui va avec."),
        mc(rng, "La mélodie tient un Ré. Quel accord choisir ?", "Sol (Sol – Si – Ré)", ["Do (Do – Mi – Sol)", "Fa (Fa – La – Do)"], "Ré n'est que dans l'accord de Sol."),
        mc(rng, "La mélodie tient un La. Quel accord choisir ?", "Fa (Fa – La – Do)", ["Do (Do – Mi – Sol)", "Sol (Sol – Si – Ré)"], "La n'est que dans l'accord de Fa."),
        mc(rng, "Pourquoi une chanson finit-elle presque toujours sur le I ?", "c'est l'accord du repos, la « maison »", ["c'est le plus facile à jouer", "c'est une règle d'écriture obligatoire"], "Finir sur le V laisse en suspens ; le I donne la sensation d'être arrivé."),
        ...drawN(rng, [["C", "maj"], ["F", "maj"], ["G", "maj"]] as [string, "maj"][], 3).map(([r, qq]) => chordQ(C(r), qq, "R")),
        { k: "piece", title: prog.title, goal: "Accords à droite, note de basse à gauche. Écoute : Fa ouvre, Sol tend, Do repose.", xml: prog.xml, pass: 70, hands: "both" },
      ];
    }),
    L("u8-l5", "Les accords mineurs : La, Ré, Mi", ["Jouer La, Ré et Mi mineurs", "Enchaîner Do – La mineur – Fa – Sol"], (rng) => {
      const key = MAJOR_KEYS[0];
      const prog = progression(key, [{ d: 1 }, { d: 6 }, { d: 4 }, { d: 5 }], { bpm: 56, rounds: 2, title: "Do – La mineur – Fa – Sol (I – vi – IV – V)" });
      return [
        info("Les accords mineurs de Do majeur", "Un morceau « en Do majeur » (on dit : dans la TONALITÉ de Do majeur) utilise surtout les sept touches blanches, avec Do pour maison. Parmi ses accords, trois sont mineurs : La mineur (vi), Ré mineur (ii) et Mi mineur (iii). Convention : chiffre romain en MAJUSCULES pour un accord majeur (I, IV, V), en minuscules pour un accord mineur (ii, iii, vi). La suite I – vi – IV – V est l'une des plus utilisées de toute la musique populaire.", undefined),
        chordQ(C("A"), "min", "R"), chordQ(C("D"), "min", "R"), chordQ(C("E"), "min", "R"),
        info("D'où viennent ces accords ?", "Empile des tierces sur chaque note de la gamme de Do, en ne prenant que des touches blanches : tu obtiens les 7 accords de la tonalité. Do, Fa et Sol tombent majeurs ; Ré, Mi et La tombent mineurs (Si donne un accord « diminué », plus rare). Une chanson en Do utilise ces accords-là parce qu'ils sont faits des notes de sa gamme.\n\nLa mineur est le « cousin triste » de Do : ils ont deux notes en commun (Do et Mi). On peut souvent remplacer l'un par l'autre sous la même mélodie : même place, autre couleur. C'est tout l'effet de I – vi – IV – V : on part de la maison, on passe par son ombre.", chordShow("G", qualityPcs(C("A"), "min")), KB_RH),
        mc(rng, "La mineur (La – Do – Mi) et Do majeur (Do – Mi – Sol) ont combien de notes en commun ?", "2 (Do et Mi)", ["1", "aucune"], "Deux notes communes : c'est pour ça que La mineur peut remplacer Do, en plus sombre."),
        mc(rng, "Pourquoi Ré mineur, et pas Ré majeur, dans une chanson en Do majeur ?", "Ré majeur demande un Fa♯, qui n'est pas dans la gamme de Do", ["Ré majeur n'existe pas", "Ré mineur est plus facile à jouer"], "Ré – Fa – La n'utilise que des touches blanches : il appartient à Do majeur."),
        mc(rng, "Dans la tonalité de Do majeur, l'accord de La est…", "mineur", ["majeur", "diminué"], "La – Do – Mi : tierce La–Do = 3 demi-tons, donc mineur."),
        { k: "piece", title: prog.title, goal: "Huit accords : Do, La mineur, Fa, Sol, deux fois.", xml: prog.xml, pass: 70, hands: "both" },
      ];
    }),
  ],
};

// ───────────────────────── 9. Gamme de Do ─────────────────────────
const scaleXml = (key: typeof MAJOR_KEYS[number], oct: 1 | 2, dir: "up" | "updown") => buildPieceXml({ type: "scale", key, form: "major", octaves: oct, direction: dir }, 66);
const u9: Unit = {
  id: "u9", title: "La gamme de Do majeur", sub: "Passer le pouce, enfin", icon: "trending-up", color: "#4ade80", lessons: [
    L("u9-l1", "La recette d'une gamme", ["Connaître la suite ton–ton–demi-ton", "Jouer Do–Do avec une seule main sans doigtés imposés"], (rng) => [
      info("Une gamme, à quoi ça sert ?", "Une gamme, ce sont les notes d'une tonalité rangées dans l'ordre, de la tonique (la note « maison ») jusqu'à son octave. Un morceau en Do majeur utilise presque uniquement ces 7 notes : la gamme est sa palette.\n\nOn la travaille pour trois raisons : les doigts apprennent les chemins qu'on retrouve dans tous les morceaux (montées, descentes, passages du pouce) ; l'oreille apprend où est la maison ; et on lit plus vite, parce qu'on reconnaît des bouts de gamme dans les partitions au lieu de lire chaque note.", undefined),
      info("Ton et demi-ton", "Une gamme majeure suit toujours la recette : Ton – Ton – ½ ton – Ton – Ton – Ton – ½ ton. Un demi-ton, ce sont deux touches voisines (blanches ou noires) sans rien entre elles ; un ton en vaut deux. Dans Do majeur, les demi-tons sont entre Mi–Fa et Si–Do.", { staff: { clef: "G", evs: ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"].map((n) => note(P(n), 2)), labels: ["1", "2", "3", "4", "5", "6", "7", "8"] } }, KB_RH),
      mc(rng, "Entre Mi et Fa, il y a…", "un demi-ton", ["un ton", "une tierce"], "Mi et Fa sont deux touches blanches voisines : pas de noire entre elles."),
      mc(rng, "Entre Do et Ré, il y a…", "un ton", ["un demi-ton", "deux tons"], "Il y a la touche noire Do♯ entre eux : un ton."),
      mc(rng, "Entre Si et Do, il y a…", "un demi-ton", ["un ton", "un ton et demi"], "Si et Do sont voisins sans touche noire entre eux."),
      seqQ("Joue la gamme : Do Ré Mi Fa Sol La Si Do", "R", ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"], undefined, KB_RH),
    ]),
    L("u9-l2", "Le passage du pouce (main droite)", ["Faire passer le pouce sous la main sans à-coup"], (rng) => [
      info("Le pouce passe dessous", "Avec 5 doigts on ne peut jouer que 5 notes. Pour continuer, le pouce passe SOUS la main pendant que les autres doigts jouent, et se place sur la note suivante : 1-2-3, puis le pouce passe pour 1-2-3-4-5. Garde le poignet souple et le coude libre.", { badges: [1, 2, 3, 1, 2, 3, 4, 5].map((f, i) => ({ m: [60, 62, 64, 65, 67, 69, 71, 72][i], t: String(f), hand: "R" as const })) }, KB_RH),
      seqQ("Monte la gamme avec les bons doigts", "R", ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"], [1, 2, 3, 1, 2, 3, 4, 5], KB_RH, "Le pouce passe sous le majeur entre Mi et Fa."),
      mc(rng, "Sur quelle note le pouce droit repasse-t-il (montée) ?", "Fa", ["Sol", "La"], "1-2-3 sur Do-Ré-Mi, puis le pouce sur Fa."),
      pieceQ({ title: "Gamme de Do majeur, main droite", goal: "Une octave, doigtés 1 2 3 1 2 3 4 5.", bpm: 66, xml: scaleXml(MAJOR_KEYS[0], 1, "updown"), hands: "R" }),
    ]),
    L("u9-l3", "Main gauche", ["Jouer la gamme de Do à la main gauche"], (rng) => [
      info("Miroir à gauche", "À la main gauche, les doigts se suivent dans l'autre sens : 5-4-3-2-1 puis le majeur passe PAR-DESSUS le pouce (3-2-1). Retiens : le pouce gauche tombe sur Sol, puis Do.", { badges: [5, 4, 3, 2, 1, 3, 2, 1].map((f, i) => ({ m: [48, 50, 52, 53, 55, 57, 59, 60][i], t: String(f), hand: "L" as const })) }, KB_LH),
      seqQ("Monte la gamme à la main gauche", "L", ["C3", "D3", "E3", "F3", "G3", "A3", "B3", "C4"], [5, 4, 3, 2, 1, 3, 2, 1], KB_LH),
      mc(rng, "À la main gauche, quel doigt passe par-dessus le pouce ?", "Le 3 (majeur)", ["Le 2 (index)", "Le 5 (petit doigt)"], "On passe le 3 par-dessus le pouce, comme dans la montée 5-4-3-2-1-3-2-1."),
      pieceQ({ title: "Gamme de Do majeur, main gauche", goal: "Une octave, montée et descente.", bpm: 66, xml: scaleXml(MAJOR_KEYS[0], 1, "updown"), hands: "L" }),
    ]),
    L("u9-l4", "Deux mains, deux octaves", ["Jouer la gamme de Do sur deux octaves, mains ensemble"], (rng) => [
      info("Tout mettre ensemble", "Joue la gamme à deux mains, une octave d'écart, sur deux octaves. Les passages ne tombent pas en même temps : à droite, le pouce passe sous la main sur Fa puis Do ; à gauche, un doigt passe par-dessus le pouce sur La, Ré puis La. Commence lentement, régulièrement ; la vitesse viendra.", undefined),
      mc(rng, "Sur quelles notes passe le pouce droit en montant sur deux octaves ?", "Fa et Do", ["Mi et La", "Sol et Si"], "À chaque octave : sur Fa puis sur Do."),
      pieceQ({ title: "Gamme de Do majeur, deux octaves", goal: "Mains ensemble, montée puis descente.", bpm: 72, xml: scaleXml(MAJOR_KEYS[0], 2, "updown") }),
    ]),
  ],
};

// ───────────────────────── 10. Arpège de Do et renversements ─────────────────────────
const C0 = MAJOR_KEYS[0];
const cmaj = chordPitches({ li: 0, alter: 0 }, 4, "maj");
const INV_LABEL = ["position fondamentale", "1er renversement", "2e renversement"];
const ua: Unit = {
  id: "ua", title: "Arpège de Do et renversements", sub: "Les notes de l'accord, dans tous les sens", icon: "waves", color: "#14b8a6", lessons: [
    L("ua-l1", "L'arpège de Do", ["Jouer l'arpège de Do majeur sur une puis deux octaves"], (rng) => [
      info("Pourquoi des arpèges ?", "Plaquer un accord, c'est un bloc de son. Le dérouler note par note, c'est ce que font la plupart des accompagnements : le Prélude en Do de Bach, la Lettre à Élise, la main gauche des ballades pop, la Sonate « Clair de lune »… Travailler l'arpège apprend à la main à s'ouvrir sur l'accord et à passer le pouce par-dessus de grands écarts, sans à-coups.", undefined),
      info("Un accord qui se déroule", "L'arpège, c'est l'accord joué note par note : Do – Mi – Sol – Do. Main droite : doigts 1 – 2 – 3 – 5 ; main gauche : 5 – 3 – 2 – 1. Sur deux octaves, le pouce passe sous la main comme dans la gamme, mais les sauts sont plus grands : garde le poignet souple et laisse la main accompagner chaque note.", { staff: { clef: "G", evs: ["C4", "E4", "G4", "C5"].map((n) => note(P(n), 2)), labels: ["Do", "Mi", "Sol", "Do"] } }, KB_RH),
      seqFromPiece("Main droite : l'arpège de Do", piece(C0, "arpeggio", "major", 1, "up"), "R"),
      seqFromPiece("Main gauche : l'arpège de Do", piece(C0, "arpeggio", "major", 1, "up"), "L"),
      mc(rng, "L'arpège de Do majeur contient…", "Do – Mi – Sol", ["Do – Ré – Mi", "Do – Fa – Sol"], "Les trois notes de l'accord de Do majeur, puis l'octave."),
      pieceFrom(piece(C0, "arpeggio", "major", 1, "updown"), "Une octave, mains ensemble, montée et descente.", 66),
      pieceFrom(piece(C0, "arpeggio", "major", 2, "updown"), "Deux octaves : le pouce passe sous la main au 2e Do.", 66),
    ]),
    L("ua-l2", "Les renversements", ["Reconnaître et jouer les trois positions d'un accord"], (rng) => [
      info("Mêmes notes, autre ordre", "On peut jouer les mêmes trois notes en changeant celle du bas : on déplace la note grave une octave plus haut. Do–Mi–Sol est la position fondamentale (la fondamentale, Do, est en bas). Mi–Sol–Do est le 1er renversement (Mi en bas). Sol–Do–Mi est le 2e renversement (Sol en bas). À quoi ça sert ? À enchaîner les accords sans sauter (leçon suivante), et à reconnaître les accords dans les partitions, où ils sont très souvent renversés.",
        { staff: { clef: "G", evs: [0, 1, 2].map((i) => cEv(invert(cmaj, i), 2)), labels: INV_LABEL.map((l) => l.replace("position fondamentale", "fondamental")) } }, KB_RH),
      chordQ({ li: 0, alter: 0 }, "maj", "R", "Do majeur au 1er renversement : Mi en bas", 4, 1),
      chordQ({ li: 0, alter: 0 }, "maj", "R", "Do majeur au 2e renversement : Sol en bas", 7, 2),
      ...[0, 1, 2, 1, 2, 0].map((i) => mc(rng, "Quel est ce renversement ?", INV_LABEL[i], INV_LABEL.filter((_, k) => k !== i), `La note la plus grave est ${nameOf(invert(cmaj, i)[0])} : ${INV_LABEL[i]}.`, chordShow("G", invert(cmaj, i)))),
      chordQ({ li: 0, alter: 0 }, "maj", "R", "Do majeur en position fondamentale : Do en bas", 0),
    ]),
    L("ua-l3", "Enchaîner sans bouger", ["Enchaîner des accords en bougeant le moins possible"], (rng) => {
      const a = progression(C0, [{ d: 1 }, { d: 4 }, { d: 5 }, { d: 1 }], { rounds: 2, bpm: 56, lead: true });
      const b = progression(C0, [{ d: 1 }, { d: 6 }, { d: 4 }, { d: 5 }], { rounds: 2, bpm: 56, lead: true });
      return [
        info("Pourquoi renverser ?", "Passer de Do à Fa à Sol en position fondamentale oblige la main à sauter. En choisissant à chaque fois le renversement le plus proche de l'accord précédent, deux notes sur trois ne bougent presque pas : c'est plus fluide, plus facile et plus musical. C'est ce que font tous les pianistes qui accompagnent.", undefined),
        mc(rng, "Pourquoi renverse-t-on les accords dans une grille ?", "pour que la main bouge peu", ["pour jouer plus fort", "pour changer de tonalité"], "Les notes communes restent en place : la main se déplace à peine."),
        { k: "piece", title: a.title, goal: "I – IV – V – I avec renversements : regarde la main droite à peine bouger.", xml: a.xml, pass: 70, hands: "both" },
        { k: "piece", title: b.title, goal: "I – vi – IV – V, avec renversements.", xml: b.xml, pass: 70, hands: "both" },
      ];
    }),
  ],
};

export const FOUNDATIONS: Unit[] = [u1, u2, u3, u4, u5, u6, ub, u7, u8, u9, ua];
export { NAMES7 };
