import type { Hand } from "../follower";

export type AppMode = "step" | "rhythm";  // Pas à pas (le morceau attend tes touches) / En rythme (le morceau avance, noté sur le temps)
export type View = "flow" | "fall";       // Partition qui défile (Flowkey) / Notes qui tombent (Synthesia)
export type FingerMode = "auto" | "all" | "off";
/** Les quatre onglets, et les vues qu'ils ouvrent. */
export type Tab = "today" | "course" | "library" | "exercises";
export type ViewName = Tab | "tech" | "solfege" | "drill";
/** Ouverture d'un morceau dans la vue de jeu. */
export interface OpenOpts { /** tâche de la séance du jour que ce morceau accomplit */ tag?: string; /** démarrer le coach */ coach?: boolean; library?: boolean; back?: ViewName; hands?: "R" | "L" | "both"; mode?: AppMode; speed?: number; hook?: { pass: number; mode: AppMode; minSpeed: number; hands: Hand; cb: (acc: number) => void }; }
export type OpenFile = (file: File, opts?: OpenOpts) => Promise<void>;
