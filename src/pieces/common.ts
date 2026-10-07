/** Outils communs aux morceaux du répertoire : valeurs de notes, fabrication de la partition. */
import { evs, type Tok } from "../course/build";
import type { PieceSpec, Ev, Dur } from "../course/xml";

// durées en croches
export const t = 0.25, s = 0.5, ds = 0.75, e = 1, de = 1.5, q = 2, dq = 3, h = 4, dh = 6, w = 8;
/** triolets : croche de triolet, double croche de triolet, noire de triolet */
export const e3 = 2 / 3, s3 = 1 / 3, q3 = 4 / 3;

export interface RepPiece {
  id: string; title: string; composer: string;
  /** 0 = pièce du parcours (pas dans l'onglet Morceaux) ; 1 à 3 = niveaux du répertoire */ level: 0 | 1 | 2 | 3;
  /** croisements de mains écrits (la main gauche passe au-dessus) : pas de contrôle de tessiture */ crossing?: boolean;
  /** chanson avec grille d'accords (section à part dans Morceaux) */ song?: boolean;
  /** ce que le morceau fait travailler */ skills: string; /** le conseil avant de commencer */ tip: string;
  /** d'où viennent les notes (édition de référence contre laquelle la transcription a été vérifiée) */ source?: string;
  spec: () => PieceSpec;
}
type Voices = Tok[] | Tok[][];
const toHand = (v: Voices | null): Ev[] | Ev[][] | null => (!v ? null : Array.isArray(v[0]?.[0]) ? (v as Tok[][]).map(evs) : evs(v as Tok[]));

export function spec(title: string, composer: string, bpm: number, rh: Voices, lh: Voices | null, o: Partial<PieceSpec> = {}): PieceSpec {
  return { title, composer, bpm, fifths: 0, rh: toHand(rh), lh: toHand(lh), ...o };
}
/** Suite de notes simples de même valeur : run(e3, "G#3 C#4 E4", "135"). */
export const run = (d: Dur, names: string, fingers: string, mk?: string): Tok[] =>
  names.split(" ").map((n, i): Tok => (i === 0 && mk ? [n, d, +fingers[i], mk] : [n, d, +fingers[i]]));
/** Répète une suite de jetons. */
export const rep = (n: number, toks: Tok[]): Tok[] => Array.from({ length: n }, () => toks).flat();
