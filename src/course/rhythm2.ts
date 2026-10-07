/** Le rythme, suite : ce que les morceaux demandent après les croches (doubles croches, rythme pointé, triolets, 6/8,
 *  levée et reprises). Placée avant les accords : la Marche militaire de Schumann (rythme pointé), le Prélude de Bach
 *  (doubles croches), Douce nuit (6/8) et Joyeux anniversaire (levée) en ont besoin. */
import { info, type Rng } from "./build";
import { mc } from "./foundations";
import type { Lesson, Q, Unit } from "./types";

const L = (id: string, title: string, goals: string[], build: (rng: Rng) => Q[]): Lesson => ({ id, title, goals, build });
const rhythm = (prompt: string, pattern: number[], bpm: number, o: { beats?: number; beatType?: 4 | 8; hint?: string } = {}): Q => ({ k: "rhythm", prompt, pattern, bpm, ...o });
const six = (prompt: string, pattern: number[], hint?: string) => rhythm(prompt, pattern, 100, { beats: 6, beatType: 8, hint });
const T = 2 / 3;   // croche de triolet

export const RHYTHM2_UNIT: Unit = {
  id: "ur2", title: "Le rythme, suite", sub: "Doubles croches, triolets, 6/8", icon: "🥁", color: "#8b5cf6", lessons: [
    L("ur2-l1", "Les doubles croches", ["Jouer quatre notes égales dans un temps"], (rng) => [
      info("Quatre notes par temps", "Coupe une croche en deux : tu obtiens deux doubles croches (deux crochets, ou deux barres quand elles sont groupées). Quatre doubles croches font un temps, comme une noire.\n\nPour les placer, découpe chaque temps en quatre en disant « ti-ki-ti-ki ». Commence lentement : la régularité compte plus que la vitesse.", undefined),
      mc(rng, "Combien de doubles croches dans une noire ?", "4", ["2", "8"], "Une noire = 2 croches = 4 doubles croches."),
      mc(rng, "Deux doubles croches valent…", "une croche", ["une noire", "une blanche"], "La double croche est la moitié de la croche."),
      rhythm("Tape : quatre doubles croches, puis une noire", [0.5, 0.5, 0.5, 0.5, 2, 0.5, 0.5, 0.5, 0.5, 2], 56, { hint: "« ti-ki-ti-ki », « noire »" }),
      rhythm("Tape : une croche, deux doubles croches", [1, 0.5, 0.5, 1, 0.5, 0.5, 2, 2], 56, { hint: "« ti, ti-ki »" }),
      rhythm("Tape : deux doubles croches, une croche", [0.5, 0.5, 1, 0.5, 0.5, 1, 2, 2], 56, { hint: "« ti-ki, ti »" }),
      rhythm("Tape ce mélange", [2, 0.5, 0.5, 0.5, 0.5, 1, 1, 2], 56),
    ]),
    L("ur2-l2", "Croche pointée et double croche", ["Jouer le rythme long-court « sautillé »"], (rng) => [
      info("Le rythme sautillé", "Le point allonge une note de la moitié de sa valeur : une croche pointée vaut une croche et demie. Il reste un quart de temps, juste la place d'une double croche. Ensemble, elles font un temps : long-court, comme un cheval qui galope.\n\nC'est le rythme des marches, comme la Marche militaire de Schumann, plus loin dans le parcours.", undefined),
      mc(rng, "Croche pointée + double croche, ça dure…", "un temps", ["un demi-temps", "deux temps"], "¾ de temps + ¼ de temps = 1 temps."),
      mc(rng, "Laquelle des deux est la plus longue ?", "la croche pointée", ["la double croche", "elles sont égales"], "Trois fois plus longue que la double croche qui la suit."),
      rhythm("Tape : croche pointée – double, deux fois, puis deux noires", [1.5, 0.5, 1.5, 0.5, 2, 2], 60),
      rhythm("Tape : noire, puis le rythme sautillé", [2, 1.5, 0.5, 2, 1.5, 0.5], 60),
      rhythm("Croches égales, puis sautillées : entends la différence", [1, 1, 1.5, 0.5, 1, 1, 1.5, 0.5], 60, { hint: "« ti-ti », puis « taaa-ki »" }),
    ]),
    L("ur2-l3", "Le triolet", ["Jouer trois notes égales dans un temps"], (rng) => [
      info("Trois dans un temps", "Un triolet, c'est trois notes jouées dans le temps de deux. Trois croches surmontées d'un petit 3 remplissent un seul temps, comme une noire.\n\nDis « tri-o-let » sur chaque temps, sans ralentir la pulsation : ce sont les notes qui se serrent, pas le métronome qui change.", undefined),
      mc(rng, "Un triolet de croches dure…", "un temps, comme une noire", ["un temps et demi", "deux temps"], "Trois croches de triolet = deux croches ordinaires = un temps."),
      rhythm("Tape : triolet, noire, triolet, noire", [T, T, T, 2, T, T, T, 2], 60, { hint: "« tri-o-let, noire »" }),
      rhythm("Tape : noire, triolet, noire, triolet", [2, T, T, T, 2, T, T, T], 60),
      rhythm("Deux croches, puis un triolet : trois notes au lieu de deux", [1, 1, T, T, T, 1, 1, T, T, T], 60, { hint: "« ti-ti, tri-o-let »" }),
    ]),
    L("ur2-l4", "La mesure à 6/8", ["Compter en deux grands temps de trois croches"], (rng) => [
      info("Deux grands temps de trois", "En 6/8, le chiffre du bas (8) dit que l'unité est la croche, et le chiffre du haut qu'il y en a 6 par mesure. On ne les compte pas à plat : on les groupe par trois, en deux grands temps, « UN-deux-trois QUATRE-cinq-six ».\n\nÇa balance, comme une berceuse ou une barque : « Douce nuit » est en 6/8. Le métronome clique chaque croche, plus fort sur 1.", undefined),
      mc(rng, "En 6/8, combien de croches par mesure ?", "6", ["3", "8"], "6 en haut : six unités ; 8 en bas : l'unité est la croche."),
      mc(rng, "Comment se groupent-elles ?", "par trois, en deux grands temps", ["par deux, en trois temps", "elles ne se groupent pas"], "C'est ce qui distingue 6/8 de 3/4 : deux grands temps de trois, au lieu de trois temps de deux."),
      six("Tape six croches par mesure, deux mesures", [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], "Appuie un peu le 1 et le 4"),
      six("Tape : noire, croche (long-court), quatre fois", [2, 1, 2, 1, 2, 1, 2, 1], "« taa-ti, taa-ti »"),
      six("Tape : noire pointée (un grand temps), puis trois croches", [3, 1, 1, 1, 3, 1, 1, 1]),
      six("Tape ce mélange", [3, 2, 1, 1, 1, 1, 3]),
    ]),
    L("ur2-l5", "Levée et reprises", ["Commencer un morceau par une levée", "Suivre les reprises et les fins 1 et 2"], (rng) => [
      info("La levée", "Beaucoup de morceaux commencent juste avant le premier temps fort : ces notes d'élan forment une mesure incomplète, la levée (ou anacrouse). « Joyeux anniversaire » commence ainsi : « Joyeux » vient avant le temps fort, qui tombe sur « an- ».\n\nLe temps emprunté par la levée est souvent rendu à la dernière mesure du morceau.", undefined),
      mc(rng, "Une levée, c'est…", "une mesure incomplète avant le premier temps fort", ["une note tenue longtemps", "un silence à la fin"], "Quelques notes d'élan, avant la première barre de mesure."),
      rhythm("Levée d'un temps : compte 1-2-3 sans taper, tape sur 4, puis quatre noires", [-6, 2, 2, 2, 2, 2], 72, { hint: "Le 4 est la levée ; le 1 suivant est le temps fort" }),
      info("Les reprises", "Deux barres avec deux points, ‖: au début et :‖ à la fin, encadrent un passage à jouer deux fois (sans ‖:, on reprend au début).\n\nQuand la fin change la deuxième fois, des crochets « 1. » et « 2. » disent quelle fin prendre : la 1re fois, on joue le crochet 1 puis on reprend ; la 2e fois, on saute le crochet 1 et on joue le 2. « D.C. » (da capo) veut dire : reprends au début, jusqu'au mot « Fine ».", undefined),
      mc(rng, "Que veut dire :‖ ?", "reprendre depuis ‖: (ou depuis le début)", ["s'arrêter", "jouer plus fort"], "Le passage entre ‖: et :‖ se joue deux fois."),
      mc(rng, "À la 2e fois, le crochet « 1. » est…", "sauté", ["rejoué", "joué deux fois"], "On passe directement au crochet « 2. »."),
      mc(rng, "« D.C. » veut dire…", "reprendre au début", ["finir ici", "ralentir"], "Da capo : « depuis la tête ». On s'arrête alors sur « Fine »."),
    ]),
  ],
};
