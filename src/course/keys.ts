/** Unités 10 et suivantes : une tonalité à la fois (armure, gamme, arpège, accords, enchaînements), puis septièmes et cadences. */
import { pieceNotes, midiOf as tMidi, armureText, relativeText, thumbNotes, nameOf as tName, type Piece, type KeyDef } from "../techCore";
import { P, M, kbFor, info, shuffle, drawN, note, piece, seqFromPiece, pieceFrom, type Rng } from "./build";
import { mc } from "./foundations";
import { progression, chordQ, ROMAN, type Step } from "./pieces";
import { MAJOR_KEYS, MINOR_KEYS, degreeChord, keyLabel, keyTonic, midiOf, chordName, nameOf, chordPitches, type Quality } from "./theory";
import type { Lesson, Unit, Q } from "./types";

const L = (id: string, title: string, goals: string[], build: (rng: Rng) => Q[]): Lesson => ({ id, title, goals, build });
const keyId = (k: KeyDef) => `${k.mode === "major" ? "M" : "m"}-${k.id.replace("♯", "s").replace("♭", "b")}`;
const SHARPS = ["Fa♯", "Do♯", "Sol♯", "Ré♯", "La♯", "Mi♯", "Si♯"], FLATS = ["Si♭", "Mi♭", "La♭", "Ré♭", "Sol♭", "Do♭", "Fa♭"];
const altered = (fifths: number) => (fifths > 0 ? SHARPS.slice(0, fifths) : FLATS.slice(0, -fifths)).join(", ");
const countLabel = (f: number) => (f === 0 ? "aucune altération" : `${Math.abs(f)} ${f > 0 ? (f > 1 ? "dièses" : "dièse") : f < -1 ? "bémols" : "bémol"}`);

function degChordQ(key: KeyDef, d: number, hand: "R" | "L" = "R", seventh = false): Q {
  const c = degreeChord(key, d, seventh, hand === "R" ? 4 : 3);
  const roman = ["", "I", "II", "III", "IV", "V", "VI", "VII"][d];
  return chordQ({ li: c.root.li, alter: c.root.alter }, c.q, hand, `Joue l'accord ${chordName(c.root, c.q)} (degré ${c.q === "min" || c.q === "min7" || c.q === "dim" ? roman.toLowerCase() : roman} de ${keyLabel(key)}) : touches ensemble`);
}
/** Les notes du premier accord peuvent demander des altérations : la portée de l'énoncé porte l'armure de la tonalité. */
function withFifths(q: Q, fifths: number): Q {
  if (q.k === "chord" && q.show?.staff) return { ...q, show: { ...q.show, staff: { ...q.show.staff, fifths } } };
  return q;
}

/** Armures voisines (±1, ±2 altérations), pour des mauvaises réponses plausibles. */
const neighbours = (f: number, allowZero: boolean): number[] => [f + 1, f - 1, f + 2, f - 2].filter((x) => Math.abs(x) <= 7 && (allowZero || x !== 0));

/** Mi♯, Si♯, Do♭, Fa♭ tombent sur des touches blanches : on le dit quand l'armure en contient. */
function whiteAltText(fifths: number): string {
  const odd = (fifths > 0 ? SHARPS.slice(0, fifths) : FLATS.slice(0, -fifths)).filter((n) => ["Mi♯", "Si♯", "Do♭", "Fa♭"].includes(n));
  if (!odd.length) return "";
  const white: Record<string, string> = { "Mi♯": "Fa", "Si♯": "Do", "Do♭": "Si", "Fa♭": "Mi" };
  return ` Surprise : ${odd.map((n) => `${n} est la touche blanche ${white[n]}`).join(", ")}. Une gamme utilise chaque nom de note (Do, Ré, Mi…) une seule fois ; ${odd[0].slice(0, -1)} a donc besoin de son altération, et ${white[odd[0]]} est déjà pris par une autre note de la gamme.`;
}

function majorUnit(key: KeyDef, color: string): Unit {
  const name = keyLabel(key), id = keyId(key);
  const sc1 = piece(key, "scale", "major", 1, "up"), sc2 = piece(key, "scale", "major", 2, "updown");
  const thumbs = thumbNotes(sc1), tonic = tName(key);
  return {
    id: `uk-${id}`, title: name, sub: armureText(key.fifths).replace("à l'armure", ""), icon: key.fifths > 0 ? "♯" : "♭", color, lessons: [
      L(`k-${id}-1`, `La gamme de ${name}`, [`Connaître l'armure de ${name}`, "Jouer la gamme avec les bons doigts"], (rng) => [
        ...(key.id === "G" ? [info("Pourquoi d'autres tonalités ?", "Une tonalité, c'est une gamme et sa note « maison » (la tonique). Changer de tonalité, c'est jouer le même morceau plus haut ou plus bas : la mélodie garde exactement la même forme, seules les touches changent. On le fait pour la voix d'un chanteur, pour le confort des doigts, ou pour la couleur (plus brillante, plus sombre).\n\nPour garder la recette de la gamme majeure en partant d'une autre note, il faut des touches noires. Plutôt que de les écrire devant chaque note, on les écrit une fois au début de chaque ligne : c'est l'ARMURE. Le parcours suit l'ordre où elles s'ajoutent une par une, qu'on appelle le « cercle des quintes » : chaque nouvelle tonalité part une quinte plus haut que la précédente (Do → Sol → Ré → La…) et gagne un dièse de plus. Sol majeur en a un, Ré majeur deux, et ainsi de suite ; dans l'autre sens, en descendant de quinte en quinte (Do → Fa → Si♭…), on gagne un bémol à chaque fois.", undefined)] : []),
        info(`${name} : l'armure`, `${armureText(key.fifths)}. ${relativeText(key)} La recette est la même que pour Do majeur (Ton Ton ½ Ton Ton Ton ½) : ce sont ces altérations, écrites une fois pour toutes à la clé, qui la reproduisent.${whiteAltText(key.fifths)}`,
          { staff: { clef: "G", fifths: key.fifths, evs: pieceNotes(sc1, "R").pitches.map((x) => note(x, 2)) } }, kbFor(pieceNotes(sc1, "R").pitches.map(tMidi))),
        mc(rng, `Combien d'altérations dans ${name} ?`, countLabel(key.fifths), neighbours(key.fifths, true).slice(0, 2).map(countLabel), `${armureText(key.fifths)}.`),
        mc(rng, "Lesquelles sont à l'armure ?", altered(key.fifths), neighbours(key.fifths, false).filter((f) => Math.sign(f) === Math.sign(key.fifths)).slice(0, 2).map(altered), "Les altérations s'ajoutent toujours dans le même ordre : dièses Fa Do Sol Ré La Mi Si (chacun une quinte au-dessus du précédent) ; bémols Si Mi La Ré Sol Do Fa (le même ordre, à l'envers)."),
        seqFromPiece(`Main droite : monte la gamme de ${name}`, sc1, "R", `Pouce sur ${thumbs.join(" et ")}.${thumbs.includes(tonic) ? "" : ` Le pouce évite les touches noires : la gamme ne commence donc pas par le pouce, suis le doigté écrit sur ${tonic}.`}`),
        mc(rng, "Sur quelles notes le pouce droit tombe-t-il en montant ?", thumbs.join(" et "), shuffle(rng, ["Do et Fa", "Mi et La", "Sol et Si", "Ré et La", "Fa et Si", "La et Ré", "Si et Mi"]).filter((x) => x !== thumbs.join(" et ")).slice(0, 2), "Le pouce passe sous la main à chaque changement de position."),
        seqFromPiece(`Main gauche : monte la gamme de ${name}`, sc1, "L"),
        pieceFrom(sc1, "Une octave, mains ensemble, doigtés écrits.", 66),
        pieceFrom(sc2, "Deux octaves, montée et descente. Reste régulier.", 72),
      ]),
      L(`k-${id}-2`, key.arp ? `Arpège et accords de ${name}` : `Accords de ${name}`, key.arp ? ["Jouer l'arpège sur 1 puis 2 octaves", "Jouer les accords I, IV et V"] : ["Jouer les accords I, IV et V"], (rng) => {
        const out: Q[] = [info(key.arp ? `L'arpège de ${name}` : `Les accords de ${name}`, `${key.arp ? "L'arpège, c'est" : "L'accord de base est"} l'accord de ${tonic}${key.arp ? " joué note par note" : ""} : ${chordPitches(keyTonic(key), 4, "maj").map((p) => nameOf(p)).join(" – ")}${key.arp ? ", puis l'octave" : ""}. Les accords I, IV et V de la tonalité sont les trois accords de base : ${[1, 4, 5].map((d) => { const c = degreeChord(key, d); return chordName(c.root, c.q, true); }).join(", ")}.`, undefined)];
        if (key.arp) out.push(seqFromPiece("Main droite : l'arpège", piece(key, "arpeggio", "major", 1, "up"), "R"), seqFromPiece("Main gauche : l'arpège", piece(key, "arpeggio", "major", 1, "up"), "L"));
        out.push(withFifths(degChordQ(key, 1), key.fifths), withFifths(degChordQ(key, 4), key.fifths), withFifths(degChordQ(key, 5), key.fifths));
        out.push(...drawN(rng, [1, 4, 5], 3, 5).map((d) => withFifths(degChordQ(key, d), key.fifths)));
        if (key.arp) out.push(pieceFrom(piece(key, "arpeggio", "major", 1, "updown"), "L'arpège sur une octave, montée et descente.", 66), pieceFrom(piece(key, "arpeggio", "major", 2, "updown"), "L'arpège sur deux octaves.", 66));
        return out;
      }),
      L(`k-${id}-3`, `Enchaîner les accords en ${name}`, ["Enchaîner I – IV – V – I", "Jouer I – vi – IV – V"], (rng) => {
        const a = progression(key, [{ d: 1 }, { d: 4 }, { d: 5 }, { d: 1 }], { rounds: 2, bpm: 56 });
        const b = progression(key, [{ d: 1 }, { d: 6 }, { d: 4 }, { d: 5 }], { rounds: 2, bpm: 56, lead: true });
        const d4 = degreeChord(key, 4), d5 = degreeChord(key, 5), d6 = degreeChord(key, 6);
        return [
          info("Les chiffres romains", `En ${name}, I = ${chordName(degreeChord(key, 1).root, "maj", true)}, IV = ${chordName(d4.root, d4.q, true)}, V = ${chordName(d5.root, d5.q, true)}, vi = ${chordName(d6.root, d6.q, true)}. Pourquoi des chiffres plutôt que des noms ? Parce qu'une grille notée en degrés (I – IV – V – I) se joue dans n'importe quelle tonalité : on l'apprend une fois, on la transpose partout. Dans la deuxième grille, chaque accord est « renversé » pour que la main bouge le moins possible.`, undefined),
          mc(rng, `Dans ${name}, quel est l'accord du IV ?`, chordName(d4.root, d4.q, true), [chordName(d5.root, d5.q, true), chordName(d6.root, d6.q, true)], "Le IV est bâti sur le 4e degré de la gamme."),
          mc(rng, `Dans ${name}, quel est l'accord du V ?`, chordName(d5.root, d5.q, true), [chordName(d4.root, d4.q, true), chordName(d6.root, d6.q, true)], "Le V est bâti sur le 5e degré de la gamme."),
          { k: "piece", title: a.title, goal: "Accords en position fondamentale à droite, basse à gauche.", xml: a.xml, pass: 70, hands: "both" },
          { k: "piece", title: b.title, goal: "Accords renversés : la main droite bouge à peine.", xml: b.xml, pass: 70, hands: "both" },
        ];
      }),
    ],
  };
}

function minorUnit(key: KeyDef, color: string): Unit {
  const name = keyLabel(key), id = keyId(key);
  const nat = piece(key, "scale", "natural", 1, "updown"), har = piece(key, "scale", "harmonic", 1, "updown"), mel = piece(key, "scale", "melodic", 1, "updown");
  const relMajor = [...MAJOR_KEYS].find((k) => k.fifths === key.fifths)!;
  const leading = pieceNotes({ ...har, direction: "up" }, "R").pitches[6];
  return {
    id: `uk-${id}`, title: name, sub: "la couleur sombre", icon: "🌙", color, lessons: [
      L(`k-${id}-1`, `La gamme de ${name} (naturelle)`, [`Connaître l'armure de ${name} et son ton relatif`, "Jouer la mineure naturelle"], (rng) => [
        ...(key.id === "A" ? [info("Majeur, mineur : deux humeurs", "Joue les touches blanches de La à La : ce sont les notes de Do majeur, mais la « maison » est maintenant La. Tout l'équilibre change : la tierce au-dessus de la tonique devient petite (3 demi-tons) et la gamme sonne sombre, mélancolique. C'est le mode MINEUR.\n\nSur la partition, une tonalité se reconnaît aux dièses ou bémols écrits une fois pour toutes au début de chaque ligne, juste après la clé : l'ARMURE. Ils valent pour tout le morceau. Do majeur n'en a aucun, La mineur non plus : ils ont la même armure. Tu verras des armures avec des dièses dès Sol majeur.\n\nBeaucoup de morceaux célèbres sont en mineur (la Lettre à Élise, Greensleeves, la Sonate « Clair de lune ») ; et beaucoup de chansons passent d'une humeur à l'autre. Chaque tonalité majeure a ainsi une sœur mineure, avec la même armure : son « ton relatif ».", undefined)] : []),
        info(`${name}, ton relatif de ${keyLabel(relMajor)}`, `${armureText(key.fifths)}. ${name} et ${keyLabel(relMajor)} partagent exactement la même armure : on dit qu'ils sont « relatifs ». La gamme mineure naturelle suit la recette Ton ½ Ton Ton ½ Ton Ton (sa tierce est plus petite : 3 demi-tons, d'où sa couleur sombre).`,
          { staff: { clef: "G", fifths: key.fifths, evs: pieceNotes(nat, "R").pitches.slice(0, 8).map((x) => note(x, 2)) } }, kbFor(pieceNotes(nat, "R").pitches.map(tMidi))),
        mc(rng, `Quel est le ton relatif majeur de ${name} ?`, keyLabel(relMajor), shuffle(rng, MAJOR_KEYS.filter((k) => k.id !== relMajor.id)).slice(0, 2).map(keyLabel), "Même armure : on descend d'une tierce mineure (3 demi-tons) depuis la tonique mineure pour trouver le relatif majeur."),
        mc(rng, "La gamme mineure naturelle a une tierce…", "mineure (3 demi-tons)", ["majeure (4 demi-tons)", "augmentée"], "Ton puis demi-ton : de la tonique à la 3e note, 3 demi-tons."),
        seqFromPiece(`Main droite : monte la gamme de ${name} naturelle`, nat, "R"),
        seqFromPiece(`Main gauche : monte la gamme de ${name} naturelle`, nat, "L"),
        pieceFrom(nat, "Mineure naturelle, mains ensemble, montée et descente.", 66),
      ]),
      L(`k-${id}-2`, `Harmonique et mélodique en ${name}`, ["Relever le 7e degré (harmonique)", "Relever les 6e et 7e degrés en montant (mélodique)"], (rng) => [
        info("Deux gammes mineures de plus", `La mineure HARMONIQUE relève le 7e degré d'un demi-ton (${nameOf(leading)} ici) : cette « sensible » tire vers la tonique. Du coup, un grand saut d'un ton et demi apparaît entre le 6e et le 7e degré. La mineure MÉLODIQUE relève les 6e ET 7e degrés en montant pour adoucir ce saut, et redescend en naturelle.`, undefined),
        mc(rng, "Quelle note la mineure harmonique relève-t-elle ?", "la 7e", ["la 3e", "la 5e"], "Le 7e degré, d'un demi-ton : la sensible."),
        mc(rng, "En descendant, la mineure mélodique redevient…", "la mineure naturelle", ["la mineure harmonique", "la majeure"], "On redescend avec les notes de la naturelle."),
        seqFromPiece(`Main droite : gamme de ${name} harmonique`, har, "R", `La 7e note est relevée : ${nameOf(leading)}.`),
        pieceFrom(har, "Mineure harmonique : attention à la 7e note relevée.", 66),
        pieceFrom(mel, "Mineure mélodique : 6e et 7e relevés en montant, naturels en descendant.", 66),
      ]),
      L(`k-${id}-3`, `Arpège et accords de ${name}`, ["Jouer l'arpège mineur", "Enchaîner i – iv – V – i"], (rng) => {
        const arp = piece(key, "arpeggio", "natural", 1, "up");
        const prog = progression(key, [{ d: 1 }, { d: 4 }, { d: 5 }, { d: 1 }], { rounds: 2, bpm: 56 });
        const out: Q[] = [
          info(`Les accords de ${name}`, `L'accord de tonique est mineur (i, en minuscule) ; celui du 4e degré aussi (iv) ; mais celui du V (dominante) est majeur, parce qu'il utilise la sensible de la gamme harmonique (${nameOf(leading)}). Les trois accords de base : ${[1, 4, 5].map((d) => { const c = degreeChord(key, d); return chordName(c.root, c.q, true); }).join(", ")}.`, undefined),
        ];
        if (key.arp) out.push(seqFromPiece("Main droite : l'arpège mineur", arp, "R"), seqFromPiece("Main gauche : l'arpège mineur", arp, "L"));
        out.push(withFifths(degChordQ(key, 1), key.fifths), withFifths(degChordQ(key, 4), key.fifths), withFifths(degChordQ(key, 5), key.fifths));
        out.push(mc(rng, `En ${name}, l'accord du V est…`, "majeur", ["mineur", "diminué"], "La sensible rend la tierce du V majeure."));
        if (key.arp) out.push(pieceFrom(piece(key, "arpeggio", "natural", 2, "updown"), "L'arpège mineur sur deux octaves.", 66));
        out.push({ k: "piece", title: prog.title, goal: "i – iv – V – i, deux fois : accords à droite, basse à gauche.", xml: prog.xml, pass: 70, hands: "both" });
        return out;
      }),
    ],
  };
}

// ── Accords de septième et cadences ──
const C0 = MAJOR_KEYS[0], G0 = MAJOR_KEYS[1], F0 = MAJOR_KEYS[11];
const pieceProg = (key: KeyDef, steps: Step[], goal: string, o: { lead?: boolean; rounds?: number; bpm?: number } = {}): Q => {
  const p = progression(key, steps, { bpm: 56, ...o });
  return { k: "piece", title: p.title, goal, xml: p.xml, pass: 70, hands: "both" };
};
const sevenths: Unit = {
  id: "uk-7", title: "Septièmes et cadences", sub: "Les accords qui racontent une histoire", icon: "🎷", color: "#c084fc", lessons: [
    L("k-7-1", "L'accord de septième de dominante", ["Construire et jouer V7", "Enchaîner I – IV – V7 – I"], (rng) => [
      info("Ajouter une quatrième note", "En ajoutant une tierce au-dessus d'une triade, on obtient un accord de septième. Sur le Ve degré, ça donne le V7 (septième de dominante) : Sol – Si – Ré – Fa. Il crée une tension qui réclame le retour à la tonique.", undefined),
      mc(rng, "Un accord de septième compte combien de notes ?", "4", ["3", "5"], "Une triade (3 notes) + une tierce : 4 notes."),
      info("Pourquoi ça « tire » vers Do", "Dans Sol7, deux notes sont instables. Si veut monter d'un demi-ton vers Do ; Fa veut descendre d'un demi-ton vers Mi. Ensemble, Si et Fa forment un triton (trois tons), l'intervalle le plus tendu de la gamme. En arrivant sur Do majeur, les deux se résolvent en même temps : c'est la détente que l'oreille attendait.\n\nToute la musique tonale joue avec ce va-et-vient tension → détente. Quand tu accompagnes, le V7 juste avant la fin d'une phrase rend l'arrivée sur le I beaucoup plus satisfaisante.", undefined),
      mc(rng, "Dans Sol7 → Do, où va le Si ?", "il monte d'un demi-ton, sur Do", ["il descend sur La", "il reste sur Si"], "Si est la « sensible » : la note juste sous la tonique, qui veut y monter."),
      mc(rng, "Et le Fa de Sol7 ?", "il descend d'un demi-ton, sur Mi", ["il monte sur Sol", "il reste sur Fa"], "Fa glisse sur Mi, la tierce de Do : la tension se défait."),
      degChordQ(C0, 5, "R", true),
      mc(rng, "Quel accord crée la plus forte envie de revenir à la tonique ?", "Le V7", ["Le I", "Le vi"], "La dominante avec sa septième : tension maximale, résolution sur le I."),
      pieceProg(C0, [{ d: 1 }, { d: 4 }, { d: 5, seventh: true }, { d: 1 }], "Quatre accords, dont le V7 : écoute la tension puis la détente.", { rounds: 2 }),
    ]),
    L("k-7-2", "Les cadences", ["Reconnaître les cadences parfaite, plagale et demi-cadence", "Jouer II – V – I"], (rng) => [
      info("Finir une phrase", "Une cadence est une façon de terminer (ou de suspendre) une phrase musicale. V → I : cadence PARFAITE (conclusive, « point final »). IV → I : cadence PLAGALE (le « amen »). I → V : DEMI-CADENCE (suspendue, « point-virgule »).", undefined),
      mc(rng, "V → I, c'est une cadence…", "parfaite", ["plagale", "suspendue"], "V → I conclut, comme un point final."),
      mc(rng, "IV → I, c'est la cadence…", "plagale", ["parfaite", "suspendue"], "La cadence plagale : le « amen » des chants religieux."),
      mc(rng, "Une phrase qui finit sur le V paraît…", "suspendue", ["terminée", "triste"], "Elle attend une suite : c'est la demi-cadence."),
      pieceProg(C0, [{ d: 2 }, { d: 5 }, { d: 1 }, { d: 1 }], "II – V – I : l'enchaînement le plus important du jazz.", { lead: true, rounds: 2 }),
    ]),
    L("k-7-3", "Septièmes majeure et mineure", ["Jouer Imaj7, ii7 et V7", "Enchaîner ii7 – V7 – Imaj7"], (rng) => [
      info("Trois couleurs de septième", "Sur le I on obtient une septième majeure (Do–Mi–Sol–Si, douce et lumineuse) ; sur le ii une septième mineure (Ré–Fa–La–Do) ; sur le V la septième de dominante (Sol–Si–Ré–Fa). Ce qui change, c'est la 4e note : dans Do–Mi–Sol–Si, le Si est à un demi-ton sous l'octave (septième majeure) ; dans Ré–Fa–La–Do et Sol–Si–Ré–Fa, la septième est à un ton sous l'octave (septième mineure). La suite ii7 – V7 – Imaj7 est la base de tout le répertoire de jazz.", undefined),
      degChordQ(C0, 1, "R", true), degChordQ(C0, 2, "R", true), degChordQ(C0, 5, "R", true),
      mc(rng, "Sur le Ire degré, la septième est…", "majeure (Si)", ["mineure (Si♭)", "diminuée"], "Do–Mi–Sol–Si : la septième est à un demi-ton sous l'octave."),
      pieceProg(C0, [{ d: 2, seventh: true }, { d: 5, seventh: true }, { d: 1, seventh: true }, { d: 1, seventh: true }], "ii7 – V7 – Imaj7 en Do majeur.", { lead: true, rounds: 2 }),
    ]),
    L("k-7-4", "II – V – I dans d'autres tonalités", ["Transposer un enchaînement", "Jouer II – V – I en Sol majeur et en Fa majeur"], (rng) => [
      info("Transposer", "Un enchaînement se joue partout : on garde les mêmes degrés et on change de tonalité. Les doigts et la forme des accords restent presque identiques ; seules les touches noires changent.", undefined),
      mc(rng, "En Sol majeur, le II est…", "La mineur", ["Si mineur", "Ré majeur"], "Le 2e degré de Sol majeur est La : accord de La mineur."),
      pieceProg(G0, [{ d: 2, seventh: true }, { d: 5, seventh: true }, { d: 1, seventh: true }, { d: 1, seventh: true }], "II – V – I avec septièmes, en Sol majeur.", { lead: true, rounds: 2 }),
      pieceProg(F0, [{ d: 2, seventh: true }, { d: 5, seventh: true }, { d: 1, seventh: true }, { d: 1, seventh: true }], "II – V – I avec septièmes, en Fa majeur.", { lead: true, rounds: 2 }),
    ]),
  ],
};

// ── ordre de parcours : cercle des quintes, chaque mineur relatif juste après son majeur ──
const palette = ["#22d3ee", "#60a5fa", "#a78bfa", "#f472b6", "#fb923c", "#facc15", "#4ade80", "#2dd4bf"];
const M_ = (id: string) => MAJOR_KEYS.find((k) => k.id === id)!, m_ = (id: string) => MINOR_KEYS.find((k) => k.id === id)!;
const ORDER: KeyDef[] = [m_("A"), M_("G"), m_("E"), M_("F"), m_("D"), M_("D"), M_("B♭"), m_("G"), M_("A"), M_("E♭"), m_("C"), M_("E"), M_("A♭"), m_("F"), M_("B"), M_("D♭"), M_("F♯")];
export const KEY_UNITS: Unit[] = ORDER.slice(0, 9).map((k, i) => (k.mode === "major" ? majorUnit(k, palette[i % palette.length]) : minorUnit(k, palette[i % palette.length])));

/** Les tonalités lointaines (3 à 6 altérations) : rien de neuf à comprendre, seulement de nouvelles touches.
 *  Une leçon par tonalité (armure, gamme, accords, enchaînement) plutôt que trois leçons identiques chacune ;
 *  l'onglet Gammes, arpèges, accords garde tout le détail pour qui veut s'y entraîner davantage. */
function tourLesson(key: KeyDef): Lesson {
  const name = keyLabel(key), id = keyId(key), minor = key.mode === "minor";
  const sc = minor ? piece(key, "scale", "harmonic", 1, "updown") : piece(key, "scale", "major", 1, "up");
  const sc2 = minor ? piece(key, "scale", "harmonic", 2, "updown") : piece(key, "scale", "major", 2, "updown");
  const thumbs = thumbNotes(minor ? piece(key, "scale", "natural", 1, "up") : sc), tonic = tName(key);
  const rel = [...MAJOR_KEYS, ...MINOR_KEYS].find((k) => k.fifths === key.fifths && k.mode !== key.mode);
  return L(`k-${id}-tour`, name, [`Lire l'armure de ${name}`, "Jouer sa gamme et ses trois accords de base", minor ? "Enchaîner i – iv – V – i" : "Enchaîner I – IV – V – I"], (rng) => {
    const pr = progression(key, [{ d: 1 }, { d: 4 }, { d: 5 }, { d: 1 }], { rounds: 2, bpm: 56 });
    return [
      info(`${name} : l'armure`, `${armureText(key.fifths)}.${rel ? ` ${keyLabel(rel)} a la même armure (ton relatif).` : ""} Rien de nouveau à comprendre : la recette de la gamme ${minor ? "mineure" : "majeure"} est la même que celles que tu connais, seules les touches changent.${whiteAltText(key.fifths)}`,
        { staff: { clef: "G", fifths: key.fifths, evs: pieceNotes(sc, "R").pitches.slice(0, 8).map((x) => note(x, 2)) } }, kbFor(pieceNotes(sc, "R").pitches.map(tMidi))),
      mc(rng, `Combien d'altérations dans ${name} ?`, countLabel(key.fifths), neighbours(key.fifths, true).slice(0, 2).map(countLabel), `${armureText(key.fifths)}.`),
      seqFromPiece(`Main droite : la gamme de ${name}${minor ? " harmonique" : ""}`, sc, "R", minor ? undefined : `Pouce sur ${thumbs.join(" et ")}. Suis le doigté écrit sur ${tonic}.`),
      seqFromPiece(`Main gauche : la gamme de ${name}${minor ? " harmonique" : ""}`, sc, "L"),
      pieceFrom(sc2, "Deux octaves, mains ensemble, montée et descente.", 66),
      withFifths(degChordQ(key, 1), key.fifths), withFifths(degChordQ(key, 4), key.fifths), withFifths(degChordQ(key, 5), key.fifths),
      { k: "piece", title: pr.title, goal: `${minor ? "i – iv – V – i" : "I – IV – V – I"}, deux fois : accords à droite, basse à gauche.`, xml: pr.xml, pass: 70, hands: "both" },
    ];
  });
}
const TOUR_UNIT: Unit = { id: "uk-tour", title: "Le tour des tonalités", sub: "De 3 à 6 dièses ou bémols", icon: "🧭", color: "#2dd4bf", lessons: ORDER.slice(9).map(tourLesson) };
export const KEYS_AND_SEVENTHS: Unit[] = [...KEY_UNITS, sevenths, TOUR_UNIT];
void [P, M, ROMAN];
