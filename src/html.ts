/** Échappe un texte avant de l'insérer dans du HTML (contenu ou attribut entre guillemets doubles). */
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
