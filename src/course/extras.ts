/** Compléments du parcours, insérés là où un professeur les placerait : l'oreille dès les premières notes,
 *  le toucher (nuances, legato / staccato), la mesure à 3 temps et les liaisons, le jeu EN RYTHME (et plus seulement
 *  pas à pas), la lecture à deux mains, la pédale, et des « morceaux-étapes » du répertoire qui valident chaque palier. */
import { P, M, kbFor, info, note, pieceQ, type Rng } from "./build";
import { buildXml } from "./xml";
import { mc } from "./foundations";
import { rh, AU_CLAIR, MARY, ODE } from "./pieces";
import { repById, repXml } from "../repertoire";
import { echoDrill, intervalDrill, chordEarDrill, sightReading } from "../exercises";
import { ACCOMP_UNIT, bluesLesson } from "./accomp";
import { PEDAL_UNIT, FINGER_UNIT } from "./pedalFinger";
import { RHYTHM2_UNIT } from "./rhythm2";
import type { Lesson, Q, Unit } from "./types";

const L = (id: string, title: string, goals: string[], build: (rng: Rng) => Q[]): Lesson => ({ id, title, goals, build });

/** Un morceau du répertoire comme étape du parcours. */
function repQ(id: string, goal: string, pass: number, mode: "step" | "rhythm" = "step", speed?: number): Q {
  const p = repById(id)!;
  return { k: "piece", title: p.title, goal, xml: repXml(p), pass, hands: "both", mode, speed };
}
/** Exercice de toucher : quelques notes conjointes, doigts écrits. */
function touchQ(prompt: string, want: Extract<Q, { k: "touch" }>["want"], names: string[], fingers: number[], hint: string): Q {
  const notes = names.map(M);
  return { k: "touch", prompt, want, notes, fingers, hand: "R", kbd: kbFor(notes), hint,
    show: { staff: { clef: "G", evs: names.map((n) => note(P(n), 2)) }, badges: notes.map((m, i) => ({ m, t: String(fingers[i]), hand: "R" as const })) } };
}
const UP = ["C4", "D4", "E4", "F4", "G4"], DOWN = [...UP].reverse(), F_UP = [1, 2, 3, 4, 5], F_DOWN = [5, 4, 3, 2, 1];
const rhythm = (prompt: string, pattern: number[], bpm: number, o: { beats?: number; ties?: number[]; hint?: string } = {}): Q => ({ k: "rhythm", prompt, pattern, bpm, ...o });

// ───────── l'oreille dès le début ─────────
const echoLesson = L("u2-l5", "Rejoue ce que tu entends", ["Retrouver au clavier une courte mélodie entendue"], (rng) => [
  info("Jouer d'oreille", "Un musicien entend avant de jouer. L'appli joue trois notes autour du Do central : écoute si ça monte, si ça descend, si ça se répète… puis rejoue-les. Tu peux réécouter autant de fois que tu veux.", undefined),
  ...echoDrill(1, rng, 5),
]);
const intervalEar = L("u7-l4", "Les intervalles à l'oreille", ["Reconnaître une tierce, une quinte et une octave sans les voir"], (rng) => [
  info("Chaque écart a sa couleur", "Tu vas entendre des noms complets. Une tierce peut faire 4 demi-tons (tierce MAJEURE, celle de l'accord majeur) ou 3 (tierce MINEURE). La quinte et l'octave n'ont qu'une forme courante, qu'on appelle « juste » : quinte juste = 7 demi-tons, octave = 12.\n\nLa tierce sonne douce et pleine, la quinte « vide » et stable, l'octave comme la même note en plus aigu. Pour t'aider, chaque intervalle est associé au début d'une chanson connue : chante-la dans ta tête.", undefined),
  ...intervalDrill(1, rng, 8),
]);
const chordEar = L("u8-l6", "Majeur ou mineur, à l'oreille", ["Entendre si un accord est majeur ou mineur"], (rng) => [
  info("Lumineux ou sombre", "Un accord majeur sonne clair, joyeux ; un accord mineur sonne sombre, mélancolique. L'appli joue l'accord note par note puis plaqué : écoute surtout la note du milieu (la tierce).", undefined),
  ...chordEarDrill(1, rng, 8),
]);

// ───────── premiers morceaux-étapes ─────────
const twinkle = L("u3-l5", "Morceau-étape : Ah ! vous dirai-je, maman", ["Jouer un morceau complet aux deux mains, avec la méthode du coach"], (rng) => [
  info("Ton premier vrai morceau", "Voici un morceau entier, mains ensemble. La méthode est toujours la même : main droite seule, main gauche seule, puis mains ensemble, lentement. Dans l'onglet Morceaux, le bouton Apprendre fait exactement ça pour toi, section par section. Ici, joue-le en entier, pas à pas.", undefined),
  mc(rng, "Pour apprendre un nouveau morceau, on commence par…", "chaque main seule, lentement", ["les deux mains au tempo", "la fin du morceau"], "Mains séparées d'abord, puis ensemble, toujours plus lentement qu'on ne le croit nécessaire : c'est la méthode de tous les professeurs."),
  repQ("twinkle", "Sur Sol–La, la main s'ouvre puis revient en position : suis les doigtés.", 80),
]);

// ───────── le toucher ─────────
const touchUnit: Unit = {
  id: "uc", title: "Le toucher", sub: "Doux, fort, lié, détaché", icon: "feather", color: "#e879f9", lessons: [
    L("uc-l1", "Piano et forte", ["Jouer doux (p) et fort (f) à volonté"], (rng) => [
      info("La force vient de la vitesse", "Au piano, le volume dépend de la VITESSE à laquelle la touche descend, pas de la force avec laquelle on l'écrase. Doux (« piano », écrit p) : la touche descend lentement, le doigt reste au contact. Fort (« forte », écrit f) : on laisse tomber le poids du bras, le doigt reste ferme. Il faut un clavier MIDI sensible à la vélocité (presque tous le sont).", undefined),
      touchQ("Monte les cinq notes, piano (doux)", "p", UP, F_UP, "Enfonce chaque touche lentement, sans bruit."),
      touchQ("Redescends, forte (fort)", "f", DOWN, F_DOWN, "Laisse tomber le poids du bras dans chaque doigt."),
      mc(rng, "Que veut dire « p » sur une partition ?", "piano : doux", ["pause", "plus vite"], "p = piano (doux), f = forte (fort). Et pp = très doux, ff = très fort, mf = moyennement fort."),
      touchQ("Monte les cinq notes, forte", "f", UP, F_UP, "Le poignet reste souple, le doigt ferme."),
      touchQ("Redescends, piano", "p", DOWN, F_DOWN, "Garde le contact avec la touche avant de l'enfoncer."),
    ]),
    L("uc-l2", "Crescendo et decrescendo", ["Faire grandir puis diminuer le son"], (rng) => [
      info("Une phrase qui respire", "Crescendo (signe <) : le son grandit petit à petit. Decrescendo (signe >) : il diminue. Une mélodie qui monte appelle souvent un crescendo, une qui descend un decrescendo : c'est ce qui la rend vivante.", undefined),
      mc(rng, "Le signe « < » sous des notes veut dire…", "crescendo : de plus en plus fort", ["decrescendo : de moins en moins fort", "accélérer"], "Le signe s'ouvre : le son grandit."),
      touchQ("Monte en crescendo : de très doux à fort", "cresc", UP, F_UP, "Commence presque sans bruit, finis sonore : chaque note un peu plus forte que la précédente."),
      touchQ("Redescends en decrescendo : de fort à très doux", "dim", DOWN, F_DOWN, "Commence fort, laisse le son s'éteindre."),
      touchQ("Encore : crescendo en montant", "cresc", UP, F_UP, "Exagère la différence."),
    ]),
    L("uc-l3", "Legato et staccato", ["Lier les notes sans trou", "Détacher les notes en rebondissant"], (rng) => [
      info("Lié ou détaché", "Legato (une courbe au-dessus des notes) : on relâche une touche au moment exact où la suivante s'enfonce, comme on marche, un pied toujours au sol. Staccato (un point au-dessus ou au-dessous de la note) : la note est courte, le doigt rebondit comme sur une surface brûlante.", undefined),
      touchQ("Monte les cinq notes, legato (bien lié)", "legato", UP, F_UP, "Ne lève un doigt qu'au moment où le suivant enfonce sa touche."),
      touchQ("Redescends, staccato (détaché)", "staccato", DOWN, F_DOWN, "Rebondis : chaque note très courte."),
      mc(rng, "Un point au-dessus d'une note indique…", "staccato : jouer court", ["une note pointée", "un silence"], "Le point AU-DESSUS (ou au-dessous) de la tête = staccato ; le point APRÈS la note allonge sa durée."),
      touchQ("Monte, staccato", "staccato", UP, F_UP, "Le poignet léger, le son court."),
      touchQ("Redescends, legato", "legato", DOWN, F_DOWN, "Comme une ligne continue."),
    ]),
  ],
};

// ───────── lecture à deux mains ─────────
const twoHandReading = L("u5-l6", "Lire et jouer à deux mains", ["Lire les deux portées en même temps et jouer sans s'arrêter"], (rng) => {
  const a = sightReading(1, rng), b = sightReading(2, rng), c = sightReading(2, rng);
  return [
    info("Lire avant de jouer", "Avant de jouer une partition nouvelle : repère la clé et la position de chaque main, lis la main droite, puis la gauche, et cherche les endroits où elles changent ensemble. Ensuite joue lentement, sans revenir en arrière : on lit toujours un peu en avance.", undefined),
    { k: "piece", title: a.title, goal: "Main droite seule, position de Do : lis et joue.", xml: buildXml(a.spec), pass: 80, hands: "R" },
    { k: "piece", title: b.title, goal: "Deux mains : la gauche tient une note par mesure.", xml: buildXml(b.spec), pass: 80, hands: "both" },
    { k: "piece", title: c.title, goal: "Encore une, inédite : regarde une note en avance.", xml: buildXml(c.spec), pass: 80, hands: "both" },
  ];
});

// ───────── rythme : 3 temps, liaisons, jouer en mesure ─────────
const threeFour = L("u6-l6", "La mesure à 3 temps", ["Compter en 3/4", "Jouer la blanche pointée (3 temps)"], (rng) => [
  info("Un, deux, trois", "Les deux chiffres au début de la partition donnent la mesure : 4/4 = quatre temps par mesure ; 3/4 = trois temps (valse, menuet). Le premier temps de chaque mesure est le plus appuyé : UN-deux-trois. La blanche pointée dure 3 temps : une mesure entière en 3/4.", undefined),
  mc(rng, "En 3/4, combien de temps par mesure ?", "3", ["4", "2"], "Le chiffre du haut donne le nombre de temps : 3."),
  mc(rng, "Une blanche pointée dure…", "3 temps", ["2 temps", "4 temps"], "Blanche (2) + la moitié (1) = 3 temps."),
  rhythm("Tape six noires en 3/4 (deux mesures)", [2, 2, 2, 2, 2, 2], 72, { beats: 3, hint: "UN-deux-trois, UN-deux-trois" }),
  rhythm("Tape : blanche, noire, blanche, noire", [4, 2, 4, 2], 72, { beats: 3 }),
  rhythm("Tape : blanche pointée, puis trois noires", [6, 2, 2, 2], 72, { beats: 3, hint: "Tape une fois, compte « 1-2-3 », puis les trois noires." }),
  rhythm("Tape : noire, blanche, blanche pointée", [2, 4, 6], 72, { beats: 3 }),
]);
const ties = L("u6-l7", "La liaison de prolongation", ["Tenir une note liée sans la rejouer"], (rng) => [
  info("Deux notes, un seul son", "Une petite courbe qui relie deux notes de MÊME hauteur est une liaison de prolongation : on joue la première et on la tient pendant la durée des deux, sans rejouer la seconde. Elle sert surtout à faire durer une note par-dessus la barre de mesure.", undefined),
  mc(rng, "Deux blanches liées (même note) se jouent…", "une seule fois, tenue 4 temps", ["deux fois", "deux fois plus vite"], "La liaison additionne les durées : 2 + 2 = 4 temps, une seule attaque."),
  rhythm("Tape ce rythme : la liaison relie deux blanches", [4, 4, 2, 2, 4], 66, { ties: [0], hint: "Une seule frappe pour les deux blanches liées." }),
  rhythm("Tape : la note liée passe la barre de mesure", [2, 2, 2, 2, 2, 2, 4], 66, { ties: [3], hint: "La 4e noire se prolonge sur le 1er temps de la mesure suivante : ne la rejoue pas." }),
  rhythm("Tape : noire, blanche liée à une noire", [2, 4, 2, 8], 66, { ties: [1] }),
]);
const playInTime = L("u6-l8", "Jouer en mesure", ["Jouer une mélodie au tempo, sans s'arrêter, en rythme"], (rng) => [
  info("La partition avance toute seule", "Jusqu'ici la partition t'attendait à chaque note. En mode « En rythme », elle avance au tempo après quatre clics de décompte, et chaque note est notée sur sa justesse ET son placement (dans le temps, en avance, en retard). Règle d'or : ne t'arrête jamais pour corriger une fausse note, continue. Commence à vitesse réduite : 70 %.", undefined),
  mc(rng, "Tu joues une fausse note en rythme : que fais-tu ?", "je continue sans m'arrêter", ["je m'arrête et je la corrige", "je recommence au début"], "En musique, le temps ne s'arrête pas : on garde la pulsation et on corrige au tour suivant."),
  { ...pieceQ({ title: "Au clair de la lune (en rythme)", goal: "Main droite, en rythme, vitesse 70 % au moins.", bpm: 72, rh: rh(AU_CLAIR), hands: "R", pass: 75 }), mode: "rhythm", speed: 70 } as Q,
  { ...pieceQ({ title: "Mary avait un petit agneau (en rythme)", goal: "Les notes répétées doivent rester régulières.", bpm: 72, rh: rh(MARY), hands: "R", pass: 75 }), mode: "rhythm", speed: 70 } as Q,
  { ...pieceQ({ title: "Ode à la joie (en rythme)", goal: "Attention au « longue – courte » de la noire pointée.", bpm: 80, rh: rh(ODE), hands: "R", pass: 75 }), mode: "rhythm", speed: 70 } as Q,
]);
const odeMilestone = L("u6-l9", "Morceau-étape : l'Ode à la joie, deux mains, en rythme", ["Jouer un morceau à deux mains au tempo"], (rng) => [
  info("Deux mains, en rythme", "Tu as tout ce qu'il faut : les deux mains, la lecture, le rythme. Si c'est difficile, travaille-le d'abord dans l'onglet Morceaux avec Apprendre (mains séparées, puis ensemble, puis en rythme), puis reviens le valider ici.", undefined),
  mc(rng, "Un passage accroche toujours au même endroit : que faire ?", "le travailler seul, en boucle, lentement", ["rejouer tout le morceau plus vite", "le sauter"], "Isole la mesure difficile (bouton boucle), joue-la lentement jusqu'à ce qu'elle soit facile, puis raccroche-la au reste."),
  repQ("ode", "Deux mains, en rythme, 70 % de la vitesse au moins.", 75, "rhythm", 70),
]);

// ───────── technique et pédale ─────────
const hanon = L("u9-l5", "Morceau-étape : Hanon n°1", ["Jouer un exercice de virtuosité régulier aux deux mains"], () => [
  info("La gymnastique des doigts", "Les exercices de Hanon font travailler chaque doigt également, mains ensemble. L'important n'est pas la vitesse mais l'ÉGALITÉ : toutes les notes aussi fortes et aussi régulières, doigts bien levés. Quelques minutes par jour suffisent.", undefined),
  repQ("hanon1", "Mains ensemble, très régulier, pas à pas.", 85),
  repQ("hanon1", "Puis en rythme, lentement (60 %) : chaque note à sa place.", 80, "rhythm", 60),
]);
const prelude = L("ua-l5", "Morceau-étape : Prélude en Do de Bach", ["Jouer un vrai classique en arpèges aux deux mains"], (rng) => [
  info("Bach, Prélude en Do majeur", "Chaque mesure est un seul accord, déroulé note par note et répété. Avant de jouer une mesure, plaque l'accord pour le mettre dans la main, puis déroule-le. Ici, les onze premières mesures ; le prélude complet est dans l'onglet Morceaux (niveau 2), à travailler avec Apprendre.", undefined),
  mc(rng, "Chaque mesure de ce prélude est…", "un accord arpégé, joué deux fois", ["une gamme", "une mélodie nouvelle"], "Repère l'accord de la mesure (plaque-le), et les doigts n'ont plus qu'à le dérouler."),
  repQ("prelude-debut", "Deux mains, pas à pas, sans hésitation.", 80),
]);
const menuet = L("k-M-G-4", "Morceau-étape : Menuet en Sol", ["Jouer un menuet à 3 temps aux deux mains"], () => [
  info("Le Menuet en Sol", "Ce menuet du Cahier d'Anna Magdalena Bach est en Sol majeur (un Fa♯ à la clé) et à 3 temps : le premier temps de chaque mesure est légèrement appuyé. Les doigtés indiquent les changements de position : respecte-les.", undefined),
  repQ("menuet", "Pas à pas, deux mains.", 80),
  repQ("menuet", "Puis en rythme, à 70 % au moins.", 75, "rhythm", 70),
]);
const canon = L("k-M-D-4", "Morceau-étape : le Canon de Pachelbel", ["Jouer le thème du Canon en Ré majeur"], () => [
  info("Le Canon", "En Ré majeur (Fa♯ et Do♯ à la clé). La basse répète huit notes pendant que la mélodie descend : écoute comme tout s'emboîte.", undefined),
  repQ("canon", "Deux mains, pas à pas.", 80),
  repQ("canon", "En rythme, à 80 % au moins.", 75, "rhythm", 80),
]);
const elise = L("k-m-E-4", "Morceau-étape : la Lettre à Élise", ["Jouer le thème de la Lettre à Élise, mains relayées"], () => [
  info("La Lettre à Élise", "En La mineur, à 3/8 : trois temps par mesure, mais ici le temps est une croche (le chiffre du bas dit quelle note fait un temps : 4 = la noire, 8 = la croche). Compte « 1-2-3 » vite et léger. Le Ré♯ oscille avec le Mi ; puis les deux mains se relaient : la gauche lance l'arpège, la droite le termine. Commence par chaque main seule, très lentement. Ici le thème ; le morceau entier (avec l'épisode central) est au niveau 2 de l'onglet Morceaux.", undefined),
  repQ("elise-theme", "Deux mains, pas à pas.", 80),
  repQ("elise-theme", "En rythme, à 70 % au moins.", 75, "rhythm", 70),
]);

// ───────── d'autres morceaux-étapes, chacun là où il illustre ce qu'on vient d'apprendre ─────────
/** Une leçon « morceau-étape » : présentation, pas à pas, puis en rythme. */
const milestone = (id: string, rep: string, title: string, goal: string, body: string, speed = 70) => L(id, `Morceau-étape : ${title}`, [goal], () => [
  info(title, body, undefined),
  repQ(rep, "Deux mains, pas à pas.", 80),
  repQ(rep, `En rythme, à ${speed} % au moins.`, 75, "rhythm", speed),
]);
const melodie = milestone("uc-l4", "melodie", "Mélodie de Schumann", "Jouer legato une mélodie accompagnée",
  "Le tout premier morceau de l'Album pour la jeunesse de Schumann. La main droite chante, bien liée (legato) : un doigt ne se lève que quand le suivant s'enfonce. La main gauche accompagne, plus doucement. C'est exactement le toucher que tu viens de travailler.");
const marche = milestone("u8-l7", "marche", "Marche militaire de Schumann", "Jouer des accords piqués en rythme",
  "Une marche : accords courts et nets (staccato), tempo bien régulier. Les accords que tu viens d'apprendre, mais en mouvement. Le poignet rebondit, il ne s'écrase pas.");
const greensleeves = milestone("k-m-A-4", "greensleeves", "Greensleeves", "Jouer une mélodie en La mineur à 3 temps",
  "Une chanson anglaise du XVIe siècle, en La mineur, à 3 temps. Le Sol♯ (sensible de La mineur) apparaît à la fin des phrases (on appelle ces fins de phrase des « cadences ») : écoute comme il tire vers le La. La main gauche déroule des arpèges calmes.");
const berceuse = milestone("k-M-F-4", "berceuse", "Berceuse de Brahms", "Jouer en Fa majeur avec un accompagnement bercé",
  "En Fa majeur : n'oublie pas le Si♭. La main gauche berce (une basse puis l'accord), la main droite chante la mélodie très liée, piano.");
const chanson = milestone("k-m-G-4", "chanson", "Vieille chanson française (Tchaïkovski)", "Jouer en Sol mineur à deux voix",
  "Extrait de l'Album pour enfants de Tchaïkovski, en Sol mineur (Si♭ et Mi♭ à la clé, Fa♯ pour la sensible). Une mélodie mélancolique sur une main gauche qui tient des notes pendant qu'une autre voix bouge.");
const chopin7 = milestone("k-M-A-4", "chopin7", "Prélude en La majeur (Chopin)", "Jouer des accords chantés avec la pédale",
  "Seize mesures de Chopin en La majeur : des accords à la main droite dont on fait chanter la note du haut, une basse et la pédale à chaque mesure. La gamme et les accords de La majeur que tu viens de travailler, en musique.", 60);
const gymnopedie = milestone("k-7-5", "gymnopedie", "Gymnopédie n° 1 (Satie)", "Jouer des accords de septième avec la pédale",
  "Toute la Gymnopédie est faite d'accords de septième majeure, ceux que tu viens d'apprendre : la main gauche joue la basse puis l'accord, la main droite une mélodie lente et libre. Pédale changée à chaque basse.", 60);

/** Où insérer : après quelle leçon (même unité). */
export const EXTRA_LESSONS: { after: string; lesson: Lesson }[] = [
  { after: "u2-l4", lesson: echoLesson },
  { after: "u3-l4", lesson: twinkle },
  { after: "u5-l5", lesson: twoHandReading },
  { after: "u6-l5", lesson: threeFour }, { after: "u6-l6", lesson: ties }, { after: "u6-l7", lesson: playInTime }, { after: "u6-l8", lesson: odeMilestone },
  { after: "u7-l3", lesson: intervalEar },
  { after: "u8-l5", lesson: chordEar },
  { after: "u9-l4", lesson: hanon },
  { after: "ua-l3", lesson: prelude },
  { after: "k-M-G-3", lesson: menuet }, { after: "k-M-D-3", lesson: canon },
  { after: "uc-l3", lesson: melodie }, { after: "u8-l6", lesson: marche }, { after: "k-m-A-3", lesson: greensleeves }, { after: "k-m-A-4", lesson: elise }, { after: "k-M-F-3", lesson: berceuse },
  { after: "k-m-G-3", lesson: chanson }, { after: "k-M-A-3", lesson: chopin7 }, { after: "k-7-4", lesson: gymnopedie }, { after: "k-7-1", lesson: bluesLesson },
];
/** Unités entières : insérées après l'unité nommée. */
export const EXTRA_UNITS: { after: string; unit: Unit }[] = [{ after: "u3", unit: touchUnit }, { after: "u7", unit: RHYTHM2_UNIT }, { after: "u9", unit: FINGER_UNIT }, { after: "ua", unit: ACCOMP_UNIT }, { after: "ua", unit: PEDAL_UNIT }];

/** Parcours complet : les unités de base, enrichies. */
export function enrich(units: Unit[]): Unit[] {
  const out = units.map((u) => ({ ...u, lessons: [...u.lessons] }));
  for (const { after, unit } of EXTRA_UNITS) out.splice(out.findIndex((x) => x.id === after) + 1, 0, { ...unit, lessons: [...unit.lessons] });
  for (const { after, lesson } of EXTRA_LESSONS) {
    const u = out.find((x) => x.lessons.some((l) => l.id === after));
    if (!u) throw new Error(`leçon introuvable : ${after}`);
    u.lessons.splice(u.lessons.findIndex((l) => l.id === after) + 1, 0, lesson);
  }
  return out;
}
