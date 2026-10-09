/** Icônes SVG (Lucide, licence ISC) en ligne, à la place des emojis : même rendu sur tous les systèmes, couleur du texte,
 *  taille 1em. Seules les icônes listées ici entrent dans le bundle. */
import {
  ArrowLeftRight, Bell, BicepsFlexed, Brain, Check, Compass, Dice5, Drum, Ear, Eye, FastForward, Feather, FolderOpen, Footprints, Hand, Headphones, KeyboardMusic, Lightbulb,
  Lock, Map as MapIcon, Mic, Moon, Music, Music2, Music4, PartyPopper, Pause, PenLine, Pencil, Piano, Play, Plus, RefreshCw, Repeat, RotateCcw,
  Save, Settings, SkipForward, Sparkles, Star, Sun, Target, Trash2, TrendingUp, Trophy, Volume2, Waves, X, Zap, Flame,
} from "lucide-static";

const ICONS = {
  "arrow-left-right": ArrowLeftRight,
  bell: Bell, "biceps-flexed": BicepsFlexed, brain: Brain, check: Check, compass: Compass, dice: Dice5, drum: Drum, ear: Ear, eye: Eye, "fast-forward": FastForward, feather: Feather,
  "folder-open": FolderOpen, footprints: Footprints, hand: Hand, headphones: Headphones, "keyboard-music": KeyboardMusic,
  lightbulb: Lightbulb, lock: Lock, map: MapIcon, mic: Mic, moon: Moon, music: Music, "music-2": Music2, "music-4": Music4,
  "party-popper": PartyPopper, pause: Pause, "pen-line": PenLine, pencil: Pencil, piano: Piano, play: Play, plus: Plus,
  "refresh-cw": RefreshCw, repeat: Repeat, "rotate-ccw": RotateCcw, save: Save, settings: Settings, "skip-forward": SkipForward,
  sparkles: Sparkles, star: Star, sun: Sun, target: Target, "trash-2": Trash2, "trending-up": TrendingUp, trophy: Trophy, "volume-2": Volume2, waves: Waves, x: X,
  zap: Zap, flame: Flame,
} as const;
export type IconName = keyof typeof ICONS;

const cache = new Map<string, string>();
/** SVG décoratif (aria-hidden) : le libellé est porté par le texte voisin, ou par un aria-label sur le bouton. */
export function icon(name: IconName, cls = ""): string {
  const key = name + "|" + cls;
  let svg = cache.get(key);
  if (!svg) {
    svg = ICONS[name].trim().replace(/\s*\n\s*/g, " ").replace("<svg class=\"lucide", `<svg aria-hidden="true" focusable="false" class="ic${cls ? " " + cls : ""} lucide`);
    cache.set(key, svg);
  }
  return svg;
}
export const isIconName = (s: string): s is IconName => s in ICONS;
/** Une icône si `s` en nomme une, sinon le texte tel quel (échappé) : par exemple « ♯ » pour l'unité des altérations. */
export function iconOrText(s: string, esc: (t: string) => string, cls = ""): string {
  return isIconName(s) ? icon(s, cls) : esc(s);
}
