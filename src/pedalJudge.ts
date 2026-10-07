/** La pédale dans un morceau : les indications « Ped. / changement / * » de la partition, comparées à ce que le pied a fait
 *  pendant le jeu en rythme. Logique pure (le texte MusicXML et les instants sont fournis). */
export interface PedalMark { q: number; type: "start" | "change" | "stop" }
const num = (el: Element | null | undefined, d = 0) => { const v = Number(el?.textContent); return Number.isFinite(v) ? v : d; };
const kid = (el: Element, tag: string) => Array.from(el.children).find((c) => c.tagName === tag);

/** Positions (en noires depuis le début) des indications de pédale. */
export function pedalMarks(xml: string): PedalMark[] {
  if (!/<pedal\b/.test(xml)) return [];
  const doc = new DOMParser().parseFromString(xml, "application/xml"), out: PedalMark[] = [];
  const part = doc.getElementsByTagName("part")[0]; if (!part) return out;
  let divisions = 1, base = 0;
  for (const m of Array.from(part.children).filter((c) => c.tagName === "measure")) {
    let cur = 0, max = 0;
    for (const el of Array.from(m.children)) {
      if (el.tagName === "attributes") { const d = num(kid(el, "divisions")); if (d > 0) divisions = d; }
      else if (el.tagName === "backup") cur -= num(kid(el, "duration"));
      else if (el.tagName === "forward") { cur += num(kid(el, "duration")); max = Math.max(max, cur); }
      else if (el.tagName === "note") { if (!kid(el, "chord") && !kid(el, "grace")) cur += num(kid(el, "duration")); max = Math.max(max, cur); }
      else if (el.tagName === "direction") {
        const p = el.getElementsByTagName("pedal")[0], t = p?.getAttribute("type");
        const off = num(kid(el, "offset") ?? null, 0);
        if (t === "start" || t === "change" || t === "stop") out.push({ q: base + (cur + off) / divisions, type: t });
      }
    }
    base += max / divisions;
  }
  return out.sort((a, b) => a.q - b.q);
}

/** Juge le pied : à chaque « Ped. » il doit descendre peu après ; à chaque changement, remonter puis redescendre ;
 *  à chaque « * », remonter. `at(q)` donne l'instant (ms, temps de la partition) d'une position. */
export function judgePedalMarks(marks: PedalMark[], at: (q: number) => number, events: { t: number; down: boolean }[], beatMs: number, from = -Infinity, to = Infinity): { ok: number; total: number; late: number; missing: number } {
  let ok = 0, total = 0, late = 0, missing = 0;
  const win = Math.max(450, beatMs * 1.2);
  for (const m of marks) {
    const t = at(m.q); if (t < from - 1 || t >= to) continue;
    total++;
    const downs = events.filter((e) => e.down && e.t >= t - 150 && e.t <= t + win);
    const ups = events.filter((e) => !e.down && e.t >= t - win && e.t <= t + 250);
    const good = m.type === "start" ? downs.length > 0 : m.type === "stop" ? events.some((e) => !e.down && e.t >= t - 300 && e.t <= t + win) : ups.length > 0 && downs.some((d) => ups.some((u) => u.t <= d.t));
    if (good) ok++;
    else if (m.type !== "stop" && events.some((e) => e.down && e.t > t + win && e.t <= t + 3 * win)) late++;
    else missing++;
  }
  return { ok, total, late, missing };
}
