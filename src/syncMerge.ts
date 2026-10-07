/** Fusion de la progression entre appareils (pure : testable sans navigateur). */

/** Clés où le plus récent gagne (réglages qui peuvent baisser) ; les autres sont fusionnées par « meilleur des deux » (records, étoiles…). */
export const LATEST_WINS: Record<string, string> = { "pianoflow-hand": "updatedAt" };
/** Clés dont chaque entrée est datée : entrée par entrée, la plus récente gagne (corrections de doigtés par morceau, maîtrise d'une compétence, qui peut baisser). */
export const LATEST_PER_ENTRY: Record<string, string> = { "pianoflow-fingerings": "at", "pianoflow-skills": "t", "pianoflow-recall": "t" };

/** Fusion « monotone » : on garde toujours le meilleur des deux côtés (records, étoiles, succès). Aucun conflit possible. */
export function mergeMax(a: any, b: any): any {
  if (a === undefined) return b;
  if (b === undefined) return a;
  if (typeof a === "number" && typeof b === "number") return Math.max(a, b);
  if (Array.isArray(a) && Array.isArray(b)) return [...new Set([...a, ...b].map((x) => JSON.stringify(x)))].map((x) => JSON.parse(x));
  if (a && b && typeof a === "object" && typeof b === "object") {
    const o: any = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) o[k] = mergeMax(a[k], b[k]);
    return o;
  }
  return b;
}

/** Parcours : « meilleur des deux », mais une remise à zéro (la plus récente des deux côtés) efface sur les deux
 *  les leçons réussies avant elle — sinon l'autre appareil ramènerait l'ancienne progression. */
function mergeCourse(local: any, remote: any): any {
  if (!local || !remote) return local ?? remote;
  const reset = Math.max(local.resetAt ?? 0, remote.resetAt ?? 0);
  if (!reset) return mergeMax(local, remote);
  const clean = (p: any) => {
    const done = Object.fromEntries(Object.entries(p.done ?? {}).filter(([, d]: [string, any]) => (d?.at ?? 0) >= reset));
    return (p.resetAt ?? 0) >= reset ? { ...p, done } : { ...p, done, xp: 0 };
  };
  return { ...mergeMax(clean(local), clean(remote)), resetAt: reset };
}

/** Fusion d'une clé : « plus récent gagne » pour les réglages, « meilleur des deux » pour la progression. */
export function mergeKey(key: string, local: any, remote: any): any {
  if (key === "pianoflow-course") return mergeCourse(local, remote);
  const per = LATEST_PER_ENTRY[key];
  if (per && local && remote && typeof local === "object" && typeof remote === "object") {
    const o: any = {};
    for (const k of new Set([...Object.keys(local), ...Object.keys(remote)])) {
      const l = local[k], r = remote[k];
      o[k] = l === undefined ? r : r === undefined ? l : (r?.[per] ?? 0) > (l?.[per] ?? 0) ? r : l;
    }
    return o;
  }
  const stamp = LATEST_WINS[key];
  if (stamp && local && remote && typeof local === "object" && typeof remote === "object") return (remote[stamp] ?? 0) > (local[stamp] ?? 0) ? remote : local;
  return mergeMax(local, remote);
}

