/** Le code de synchro tel qu'il est généré (minuscules, groupes de 5 séparés par des tirets), quelle que soit la façon dont on
 *  l'a recopié : majuscules, espaces, tirets oubliés, en trop ou changés en « – » par le clavier. Sinon deux appareils « avec le
 *  même code » ne se voient pas. Un code trop court pour être regroupé reste tel quel. Partagé par l'appli et la fonction Netlify. */
export function canonCode(code: string): string {
  const flat = code.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return flat.length >= 8 ? flat.replace(/(.{5})(?=.)/g, "$1-") : code.trim();
}
