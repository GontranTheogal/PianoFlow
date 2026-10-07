import type { Ev } from "./xml";

export type Hand = "R" | "L";
export interface Mark { m: number; c: "sel" | "target" | "ok" | "bad"; }
/** Ce qu'on montre avec la question : une portée (notes fixes) et/ou des repères sur le clavier. */
export interface Show {
  staff?: { clef: "G" | "F"; fifths?: number; evs: Ev[]; /** étiquettes sous chaque note, dans l'ordre */ labels?: string[] };
  marks?: Mark[];
  /** pastilles (doigts, degrés…) posées sur les touches */
  badges?: { m: number; t: string; hand?: Hand }[];
}
export type KbdRange = [number, number];
/** Son joué par l'appli (oreille, écho) : chaque pas = notes simultanées. */
export interface Audio { steps: number[][]; ms?: number; }

export type Q =
  | { k: "info"; title: string; body: string; show?: Show; kbd?: KbdRange }
  /** Appuyer sur LA bonne touche : octave exacte (`midi`) ou n'importe quelle octave (`pcs`). */
  | { k: "press"; prompt: string; target: { midi: number } | { pcs: number[] }; show?: Show; kbd: KbdRange; hint?: string; ok?: string; audio?: Audio }
  /** Jouer une suite de notes dans l'ordre. */
  | { k: "seq"; prompt: string; notes: number[]; hand?: Hand; fingers?: number[]; show?: Show; kbd: KbdRange; hint?: string; ok?: string;
      /** écho : l'appli joue la suite, on la rejoue d'oreille (rien n'est montré) */ audio?: Audio; hidden?: boolean }
  /** Jouer un accord (touches enfoncées ensemble) : toutes les classes de hauteur de `pcs`, au moins `size` touches différentes. */
  | { k: "chord"; prompt: string; pcs: number[]; /** note la plus grave exigée (classe de hauteur) : renversements */ bass?: number; show?: Show; kbd: KbdRange; name: string; hint?: string }
  | { k: "choice"; prompt: string; options: string[]; answer: number; show?: Show; explain: string; kbd?: KbdRange; audio?: Audio }
  /** Toucher (clavier MIDI) : nuance (vélocité) ou articulation (durées) d'une suite de notes. */
  | { k: "touch"; prompt: string; notes: number[]; fingers?: number[]; hand?: Hand; want: "p" | "f" | "cresc" | "dim" | "legato" | "staccato"; kbd: KbdRange; show?: Show; hint?: string }
  /** Pédale (clavier MIDI avec pédale) : jouer chaque accord puis changer la pédale juste après. */
  | { k: "pedal"; prompt: string; chords: number[][]; kbd: KbdRange; show?: Show; hint?: string }
  /** Taper un rythme avec le métronome (silences = valeurs négatives, en croches : 2 = noire, 4 = blanche…). */
  | { k: "rhythm"; prompt: string; pattern: number[]; bpm: number; hint?: string; /** temps par mesure (3 pour 3/4, 6 pour 6/8), 4 par défaut */ beats?: number; /** unité de temps : 8 = la croche (6/8), 4 par défaut */ beatType?: 4 | 8; /** croches liées à la suivante (indices) */ ties?: number[] }
  /** Improviser : l'appli joue une grille (basse + accord à chaque mesure), on joue librement avec les notes de `scale`. */
  | { k: "improv"; prompt: string; grid: number[][]; names: string[]; bpm: number; scale: number[]; scaleName: string; rounds: number; kbd: KbdRange; hint?: string }
  /** Jouer un exercice dans le moteur d'entraînement (partition + clavier + notes qui tombent). */
  | { k: "piece"; title: string; goal: string; xml: string; pass: number; hands?: "R" | "L" | "both";
      /** « step » = pas à pas (justesse) ; « rhythm » = en rythme (justesse + temps), à `speed` % au moins */ mode?: "step" | "rhythm"; speed?: number };

export interface Lesson {
  id: string;
  title: string;
  /** Ce qu'on saura faire à la fin (affiché sur la fiche de la leçon). */
  goals: string[];
  /** Fabrique les questions ; `rng` rend la leçon variée mais reproductible dans les tests. */
  build: (rng: () => number) => Q[];
}
export interface Unit { id: string; title: string; sub: string; icon: string; color: string; lessons: Lesson[]; }
