const NAMES = ["Do", "Do#", "Ré", "Ré#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
export const noteName = (p: number) => NAMES[p % 12] + (Math.floor(p / 12) - 1);
