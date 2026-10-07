/** Onglet « Aujourd'hui » : la séance du jour, construite d'après ta progression (comme le ferait un professeur),
 *  ton temps de pratique réel, ta série et tes progrès. C'est la page d'accueil : on ouvre l'appli, on suit la liste. */
import { LESSONS, UNITS } from "./course/curriculum";
import { loadProgress, currentIndex, isDone as lessonDone, streak, dayKey } from "./course/engine";
import { REPERTOIRE, SONGS, repFileName } from "./repertoire";
import { dueReviews, reviewCount, weekRhythm } from "./review";
import * as Coach from "./coach";
import { getAll as songStats } from "./stats";
import { exerciseLevel } from "./exercisesView";
import { MAJOR_KEYS, nameOf } from "./course/theory";
import * as Daily from "./daily";
import * as Skills from "./skills";
import { dayNum } from "./review";
import { dueLessons } from "./recall";

export interface TodayHost { go(action: string): void; }
let host: TodayHost, root: HTMLElement;
const GOAL_KEY = "pianoflow-goal";
const goal = () => { try { return Number(localStorage.getItem(GOAL_KEY)) || 20; } catch { return 20; } };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export interface PlanItem { icon: string; title: string; detail: string; min: number; action: string; /** tâche cochée quand elle est faite (Daily) */ tag: string; /** rang de priorité quand le temps manque */ key?: string; }

const unitDone = (p: ReturnType<typeof loadProgress>, id: string) => { const u = UNITS.find((x) => x.id === id); return !!u && u.lessons.every((l) => lessonDone(p, l.id)); };
const unitStarted = (p: ReturnType<typeof loadProgress>, id: string) => { const u = UNITS.find((x) => x.id === id); return !!u && u.lessons.some((l) => lessonDone(p, l.id)); };

/** Niveau de répertoire conseillé d'après le parcours (des leçons-repères, pour qu'une leçon ajoutée ne le fasse pas reculer). */
export function repLevel(p = loadProgress()): number {
  if (lessonDone(p, "k-7-4")) return 3;    // septièmes et cadences : les pièces de concert
  if (lessonDone(p, "ua-l5")) return 2;    // arpèges, pédale, Prélude de Bach : les grands classiques
  if (lessonDone(p, "u6-l9")) return 1;    // deux mains en rythme (Ode à la joie) : les premiers vrais morceaux
  return 0;
}
/** Le morceau qu'on est en train d'apprendre avec le coach (répertoire OU bibliothèque) : le plus récemment travaillé. */
export function pieceInProgress(): { name: string; pct: number } | null {
  const all = Coach.loadAll(), stats = songStats();
  const cand = Object.entries(all).filter(([name, c]) => (c.pct ?? 0) > 0 && (c.pct ?? 0) < 100 && (stats[name]?.bestRhythm ?? 0) < 90 && !COURSE_FILES.has(name));
  if (!cand.length) return null;
  cand.sort((a, b) => (b[1].at ?? 0) - (a[1].at ?? 0));
  return { name: cand[0][0], pct: cand[0][1].pct ?? 0 };
}
const COURSE_FILES = new Set(REPERTOIRE.filter((r) => r.level === 0).map(repFileName));

/** Séance finie et encore du temps : la leçon suivante du parcours, en bonus. */
function moreItems(p: ReturnType<typeof loadProgress>): Pick<PlanItem, "icon" | "title" | "detail" | "min" | "action">[] {
  const cur = currentIndex(p, LESSONS.map((l) => l.id)), next = LESSONS[cur];
  return next ? [{ icon: "➕", title: `Encore du temps ? Leçon : ${next.title}`, detail: `${next.unit.title} · leçon ${next.inUnit + 1}/${next.unit.lessons.length}`, min: 8, action: `lesson:${next.id}` }] : [];
}

const skillTag = (key: string) => (key === "reading" || key === "sight" ? key : `drill:${key}`);
const SKILL_TEXT: Record<string, (lv: number) => string> = {
  reading: () => "Une manche de 10 notes, clé de Sol et de Fa.",
  sight: (lv) => `Un morceau inédit, niveau ${lv}, en rythme du premier coup.`,
  rhythm: (lv) => `Lire et taper six rythmes (niveau ${lv}).`,
  echo: () => "L'appli joue quelques notes : rejoue-les. Relie l'oreille aux doigts.",
  intervals: () => "Reconnaître l'écart entre deux notes.",
  chords: () => "Majeur ou mineur ? Entendre la couleur d'un accord.",
  pedal: (lv) => `Changer la pédale à chaque accord, niveau ${lv} : le dessin après chaque passage montre ce qu'a fait ton pied.`,
  fingers: (lv) => `Trouver la position de la main et les passages du pouce (niveau ${lv}).`,
  improv: (lv) => `Inventer une mélodie sur la grille, niveau ${lv}.`,
};
const SKILL_ICON: Record<string, string> = { reading: "🎼", sight: "👀", rhythm: "🥁", echo: "👂", intervals: "👂", chords: "👂", pedal: "🦶", fingers: "🖐️", improv: "🎷" };
/** Une compétence dans la séance : ce qu'on fait, et pourquoi elle est là (sa maîtrise). */
function skillItem(st: Skills.SkillState, i: number): PlanItem {
  const k = st.skill.key, why = st.level === null ? "Pas encore travaillé : on commence."
    : `Maîtrise ${st.level} %${st.days >= 7 ? `, pas travaillé depuis ${st.days} jours` : ""} : ${st.level < 80 ? "un de tes points faibles en ce moment." : "on l'entretient."}`;
  return { icon: SKILL_ICON[k] ?? "🎯", title: st.skill.label, detail: `${SKILL_TEXT[k]?.(exerciseLevel(k)) ?? ""} ${why}`.trim(), min: k === "reading" || k === "sight" ? 4 : 3, action: `ex:${k}`, tag: skillTag(k), key: `skill${i}` };
}

/** Nouvelles leçons par jour, au plus : au-delà, on apprend plus vite qu'on ne retient. Le reste du temps sert à fixer
 *  (révision, morceau, points faibles). Après la séance, « Encore du temps ? » propose quand même la suivante. */
const newLessonsMax = (minutes: number) => (minutes >= 45 ? 3 : 2);

/** Le morceau du jour : celui qu'on apprend avec le coach, sinon le premier pas encore maîtrisé à son niveau du répertoire
 *  (en descendant d'un niveau si tout est maîtrisé), sinon une chanson. Jamais « Frère Jacques » pour qui en est aux arpèges. */
function pieceItem(p: ReturnType<typeof loadProgress>): PlanItem | null {
  const lv = repLevel(p), learning = pieceInProgress(), stats = songStats();
  const mastered = (r: (typeof REPERTOIRE)[number]) => (stats[repFileName(r)]?.bestRhythm ?? 0) >= 90;
  if (learning) {
    const r = REPERTOIRE.find((x) => repFileName(x) === learning.name);
    return { icon: "🎵", title: `Morceau : ${r ? r.title : learning.name.replace(/\.(musicxml|mxl|xml)$/i, "")}`, detail: `Coach à ${learning.pct} % : continue là où tu en étais.`, min: 8, action: r ? `rep:${r.id}` : `lib:${learning.name}`, tag: "piece" };
  }
  if (lv > 0) {
    for (let l = lv; l >= 1; l--) {
      const next = REPERTOIRE.find((r) => r.level === l && !r.song && !mastered(r));
      if (next) return { icon: "🎵", title: `Morceau : ${next.title}`, detail: `${l === lv ? "À ton niveau" : `Niveau ${l}`} : ${next.tip}`, min: 8, action: `rep:${next.id}`, tag: "piece" };
    }
    const song = SONGS.find((r) => !mastered(r));
    return song ? { icon: "🎵", title: `Morceau : ${song.title}`, detail: song.tip, min: 8, action: `rep:${song.id}`, tag: "piece" } : null;
  }
  if (!unitDone(p, "u2")) return null;
  // débutant : les petits morceaux du parcours (le coach commence par la main droite seule), puis les chansons à accompagner
  const ok = (id: string) => mastered(REPERTOIRE.find((r) => r.id === id)!);
  const ids = unitDone(p, "u3") ? ["twinkle", "ode", "s-frere", "s-clair", "s-twinkle"] : ["twinkle", "ode"];
  const id = ids.find((x) => !ok(x)), next = id && REPERTOIRE.find((r) => r.id === id);
  return next ? { icon: "🎵", title: `Morceau : ${next.title}`, detail: unitDone(p, "u3") ? next.tip : "Avec le coach : commence par la main droite seule, la gauche viendra après l'unité « Main gauche ».", min: 8, action: `rep:${next.id}`, tag: "piece" } : null;
}

/** La séance du jour : ce que ferait faire un professeur, dans son ordre. S'échauffer ; se rappeler ce qu'on a appris
 *  (révision espacée) ; une ou deux choses nouvelles ; les appliquer dans un morceau ; reprendre ce qui a été raté ;
 *  finir par ses points faibles. Le parcours n'est qu'une partie de la séance, pas la séance. */
export function buildPlan(minutes = goal(), date = dayKey()): PlanItem[] {
  const p = loadProgress(), ids = LESSONS.map((l) => l.id), cur = currentIndex(p, ids), today = dayNum(new Date(date + "T12:00:00"));
  const doneTags = Daily.day(date).done;
  const items: PlanItem[] = [];
  let moreLessons: PlanItem[] = [], lessonCap = 5;
  // 1. échauffement : la position / la gamme de la dernière tonalité étudiée
  if (unitDone(p, "u2")) {
    // la dernière tonalité majeure travaillée dans le parcours (k-M-G-1, k-M-Eb-tour…)
    const last = [...LESSONS].reverse().find((l) => /^k-M-/.test(l.id) && lessonDone(p, l.id));
    const kid = last ? last.id.split("-")[2].replace("s", "♯").replace(/b$/, "♭") : "C";
    const ki = Math.max(0, MAJOR_KEYS.findIndex((k) => k.id === kid));
    items.push(unitDone(p, "u9")
      ? { icon: "🔥", title: `Échauffement : gamme de ${nameOf(MAJOR_KEYS[ki])} majeur`, detail: "Deux octaves, mains ensemble, lentement et régulier.", min: 3, action: `scale:${ki}`, tag: "warmup" }
      : { icon: "🔥", title: `Échauffement : cinq doigts en ${nameOf(MAJOR_KEYS[ki])}`, detail: unitDone(p, "u3") ? "Majeur puis mineur, mains ensemble : délie les doigts." : "Main droite seule pour l'instant (la gauche viendra avec l'unité « Main gauche »).", min: 3, action: `five:${ki}`, tag: "warmup" });
  }
  // 2. révision express : quelques questions des leçons apprises il y a 1, 3, 7, 14… jours (faite aujourd'hui : elle reste, cochée)
  const due = dueLessons(p, today);
  if (due.length || doneTags.includes("recall")) {
    const names = due.slice(0, 2).map((l) => `« ${l.title} »`).join(", ") + (due.length > 2 ? "…" : "");
    items.push({ icon: "🧠", title: "Révision express", detail: due.length ? `${due.length * 2} questions sur ${names} : se rappeler ce qu'on a appris, c'est ce qui le fixe.` : "Faite : ce qui est bien retenu reviendra plus tard.", min: 4, action: "recall:today", tag: "recall", key: "recall" });
  }
  // 3. la nouveauté : une ou deux leçons du parcours (ou des révisions de leçons quand tout est fini). Celles déjà faites
  //    aujourd'hui restent affichées (cochées) : la liste ne change pas sous les yeux une fois l'étape accomplie.
  const doneToday = doneTags.filter((t) => t.startsWith("lesson:")).map((t) => t.slice(7));
  const first = LESSONS.find((l) => l.id === doneToday[0]) ?? (cur < LESSONS.length ? LESSONS[cur] : undefined);
  const lessonItem = (l: (typeof LESSONS)[number], tag: string, key: string): PlanItem => ({ icon: "🗺️", title: `Leçon : ${l.title}`, detail: `Nouveau · ${l.unit.title}, leçon ${l.inUnit + 1}/${l.unit.lessons.length}`, min: 8, action: `lesson:${l.id}`, tag, key });
  if (first) {
    lessonCap = newLessonsMax(minutes);
    items.push(lessonItem(first, "lesson", "lesson"));
    // les leçons suivantes, dans l'ordre (celles faites aujourd'hui d'abord : la liste ne bouge pas une fois cochée)
    const after = [...doneToday.slice(1).map((id) => LESSONS.find((l) => l.id === id)!).filter(Boolean),
      ...LESSONS.filter((l) => l.index > first.index && !lessonDone(p, l.id) && !doneToday.includes(l.id))];
    if (after[0] && lessonCap > 1) items.push(lessonItem(after[0], `lesson:${after[0].id}`, "lesson2"));
    moreLessons = after.slice(1).map((l, i) => lessonItem(l, `lesson:${l.id}`, `lesson+${i}`));
  } else {
    // parcours fini : on révise d'abord les leçons les moins bien réussies, puis celles revues il y a le plus longtemps
    // (celles revues aujourd'hui restent en tête, cochées : la liste ne bouge pas une fois l'étape faite)
    const d = (l: (typeof LESSONS)[number]) => p.done[l.id];
    const byNeed = [...LESSONS].sort((a, b) => (d(a)?.stars ?? 0) - (d(b)?.stars ?? 0) || (d(a)?.at ?? 0) - (d(b)?.at ?? 0));
    const revs = [...doneToday.map((id) => LESSONS.find((l) => l.id === id)!).filter(Boolean), ...byNeed.filter((l) => !doneToday.includes(l.id))];
    const revItem = (l: (typeof LESSONS)[number], tag: string, key: string): PlanItem => ({ icon: "🔁", title: `Révision : ${l.title}`, detail: "Le parcours est fini : on consolide.", min: 6, action: `lesson:${l.id}`, tag, key });
    items.push(revItem(revs[0], "lesson", "lesson"));
    moreLessons = revs.slice(1).map((l, i) => revItem(l, `lesson:${l.id}`, `lesson+${i}`));
  }
  // 4. un morceau à son niveau : appliquer ce qu'on apprend
  const piece = pieceItem(p); if (piece) items.push(piece);
  // 5. révision des erreurs : ce qui a été raté ces derniers jours revient
  const errs = dueReviews();
  if (errs.length) {
    const r0 = errs[0];
    items.push({ icon: "🔁", title: `Révision : ${r0.label}`, detail: errs.length > 1 ? `${errs.length} choses à revoir aujourd'hui ; on commence par celle qui résiste le plus.` : "Ratée récemment : elle revient pour être fixée (puis dans 3, 7 et 14 jours).", min: 4, action: r0.action, tag: "review" });
  }
  // 6. les compétences les plus faibles (ou pas encore travaillées), une par famille : lecture, rythme, oreille, pédale…
  //    La maîtrise retenue est celle du début de journée : la séance ne change pas une fois l'étape faite.
  const picks = Skills.toPractice(p, today);
  // ce qui a déjà été travaillé aujourd'hui garde sa place, devant le reste
  picks.sort((x, y) => Number(doneTags.includes(skillTag(y.skill.key))) - Number(doneTags.includes(skillTag(x.skill.key))));
  picks.forEach((st, i) => items.push(skillItem(st, i)));
  // la durée choisie : on garde l'essentiel d'abord, on ajoute le reste si le temps le permet
  //    Comme chez un professeur : la nouveauté, ce qui est à revoir, le morceau et au moins un exercice ciblé ; le temps en plus va aux
  //    exercices ciblés (lecture, rythme, oreille…) avant une deuxième leçon.
  const order = ["lesson", "recall", "piece", "skill0", "warmup", "skill1", "review", "skill2", "skill3", "lesson2", ...picks.slice(4).map((_, i) => `skill${i + 4}`)];
  const kept: PlanItem[] = []; let total = 0;
  for (const k of order) { const it = items.find((x) => (x.key ?? x.tag) === k); if (it && (total + it.min <= minutes + 3 || !kept.length)) { kept.push(it); total += it.min; } }
  // encore du temps : d'autres leçons, dans la limite du jour (parcours fini : des révisions de leçons, jusqu'à 5)
  const extra: PlanItem[] = [], isLesson = (x: PlanItem) => !!x.key?.startsWith("lesson");
  for (const it of moreLessons) {
    if (kept.some((x) => x.tag === it.tag)) continue;
    if (total + it.min > minutes + 2 || kept.filter(isLesson).length + extra.length >= lessonCap) break;
    extra.push(it); total += it.min;
  }
  const out = items.filter((x) => kept.includes(x)), at = out.reduce((a, x, i) => (isLesson(x) ? i + 1 : a), 0);
  out.splice(at, 0, ...extra);
  // l'ordre de la séance : échauffement, révisions, nouveauté, exercices ciblés, et le morceau pour finir
  return out.map((x, i) => ({ x, i, r: PHASE_RANK(x) })).sort((a, b) => a.r - b.r || a.i - b.i).map((y) => y.x);
}

const TIPS = [
  "Un peu chaque jour vaut mieux que beaucoup une fois par semaine : la mémoire des doigts se construit pendant le sommeil.",
  "Lent et juste avant vite : jouer vite avec des fautes, c'est apprendre les fautes.",
  "Les passages difficiles se travaillent à part, en boucle, puis se raccrochent au reste.",
  "Mains séparées d'abord, mains ensemble ensuite, toujours plus lentement que ce que tu crois nécessaire.",
  "Garde les épaules basses, les poignets souples, les doigts arrondis : une main détendue est une main rapide.",
  "Compte à voix haute quand le rythme résiste : c'est ce que font les pianistes professionnels.",
  "Écoute-toi : est-ce que ça chante ? La justesse des notes n'est que le début de la musique.",
  "Fais une pause de quelques minutes toutes les 20 minutes : la concentration revient intacte.",
];

function bars(h: { day: string; min: number }[], target: number): string {
  const W = 14 * 30, H = 110, max = Math.max(target, ...h.map((x) => x.min), 1);
  const days = ["D", "L", "M", "M", "J", "V", "S"];
  return `<svg viewBox="0 0 ${W} ${H + 18}" class="td-chart" role="img" aria-label="Minutes de pratique sur 14 jours">
    <line x1="0" x2="${W}" y1="${H - (target / max) * H}" y2="${H - (target / max) * H}" stroke="#f59e0b" stroke-dasharray="4 4" stroke-width="1.5"/>
    ${h.map((x, i) => { const bh = Math.max(x.min ? 3 : 0, (x.min / max) * H), d = new Date(x.day + "T12:00:00");
      return `<rect x="${i * 30 + 6}" y="${H - bh}" width="18" height="${bh}" rx="4" fill="${x.min >= target ? "#22c55e" : x.min ? "#93c5fd" : "var(--clay-hi)"}"><title>${x.day} : ${x.min} min</title></rect>
      <text x="${i * 30 + 15}" y="${H + 14}" text-anchor="middle" font-size="10" fill="var(--muted)">${days[d.getDay()]}</text>`; }).join("")}
  </svg>`;
}

/** Tes compétences : la maîtrise de chacune (oubli compris), par famille. Ce qui est faible revient dans la séance du jour. */
function skillsCard(p: ReturnType<typeof loadProgress>): string {
  const st = Skills.states(p); if (!st.length) return "";
  const color = (v: number) => (v >= 85 ? "#22c55e" : v >= 60 ? "#93c5fd" : "#f59e0b");
  const fams = Object.entries(Skills.FAMILIES).filter(([f]) => st.some((x) => x.skill.family === f));
  return `<h2 class="td-h2">Tes compétences</h2>
    <div class="td-card"><div class="td-skills">${fams.map(([f, info]) => `<p class="td-skfam">${info.icon} ${esc(info.label)}</p>${st.filter((x) => x.skill.family === f).map((x) =>
      `<div class="td-sk"><span>${esc(x.skill.label)}</span><small>${x.level === null ? "pas encore travaillé" : `${x.level} %`}</small><span class="bar"><i style="width:${x.level ?? 0}%;background:${color(x.level ?? 0)}"></i></span></div>`).join("")}`).join("")}</div>
      <small>La maîtrise suit tes derniers résultats et baisse doucement sans pratique. La séance du jour te fait travailler les plus faibles.</small></div>`;
}

/** Bilan de la semaine : temps, leçons, morceaux, tendances du jeu en rythme, et l'objectif qui en découle. */
function weekCard(p: ReturnType<typeof loadProgress>): string {
  const h = Daily.history(14), dow = (new Date().getDay() + 6) % 7;
  const thisW = h.slice(14 - (dow + 1)).reduce((s, x) => s + x.min, 0), lastW = h.slice(14 - (dow + 1) - 7, 14 - (dow + 1)).reduce((s, x) => s + x.min, 0);
  const since = new Date(); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - dow);
  const lessons = Object.values(p.done).filter((d) => (d.at ?? 0) >= since.getTime()).length;
  const pieces = Object.entries(Coach.loadAll()).filter(([, c]) => (c.at ?? 0) >= since.getTime()).map(([n]) => REPERTOIRE.find((r) => repFileName(r) === n)?.title ?? n.replace(/\.(musicxml|mxl|xml)$/i, ""));
  const w = weekRhythm(), notes = w ? w.good + w.early + w.late + w.miss : 0;
  let tendency = "", goalTxt = "";
  if (w && notes >= 40) {
    const e = w.early / notes, l = w.late / notes, m = w.miss / notes;
    if (m > 0.15) { tendency = `beaucoup de notes manquées en rythme (${Math.round(m * 100)} %)`; goalTxt = "Ralentis à 60-70 % et travaille les mesures signalées en boucle avant d'accélérer."; }
    else if (e > 0.18 && e > l) { tendency = `tu joues souvent en avance (${Math.round(e * 100)} % des notes)`; goalTxt = "Garde le métronome et compte à voix haute : laisse venir chaque temps."; }
    else if (l > 0.18) { tendency = `tu joues souvent en retard (${Math.round(l * 100)} % des notes)`; goalTxt = "Lis une note plus loin pour préparer les doigts, et travaille les changements de position à part."; }
    else { tendency = "ton rythme est régulier"; goalTxt = "Monte d'un cran : vitesse 90-100 %, ou le morceau suivant."; }
  }
  if (!goalTxt) goalTxt = thisW < lastW ? "Un peu chaque jour : vise ton objectif quotidien au moins 5 jours sur 7." : "Continue comme ça : un morceau en cours avec le coach, et le parcours chaque jour.";
  const rev = reviewCount();
  return `<h2 class="td-h2">Ta semaine</h2>
    <div class="td-card td-week">
      <div class="td-tiles"><div><b>${thisW} min</b><small>cette semaine ${lastW ? `(${thisW >= lastW ? "+" : ""}${thisW - lastW} vs la précédente)` : ""}</small></div>
        <div><b>${lessons}</b><small>leçon${lessons > 1 ? "s" : ""} réussie${lessons > 1 ? "s" : ""}</small></div>
        <div><b>${pieces.length}</b><small>morceau${pieces.length > 1 ? "x" : ""} travaillé${pieces.length > 1 ? "s" : ""} avec le coach</small></div>
        <div><b>${rev}</b><small>point${rev > 1 ? "s" : ""} en révision</small></div></div>
      ${pieces.length ? `<p>🎵 ${pieces.slice(0, 4).map(esc).join(", ")}</p>` : ""}
      ${tendency ? `<p>🥁 En rythme, ${esc(tendency)}.</p>` : ""}
      <p>🎯 <b>Objectif de la semaine :</b> ${esc(goalTxt)}</p>
    </div>`;
}

let view: "plan" | "progress" = "plan";
const WELCOME_KEY = "pianoflow-welcomed";
const welcomed = () => { try { return !!localStorage.getItem(WELCOME_KEY); } catch { return true; } };

/** Premier lancement : trois questions, pas plus (clavier, temps par jour, débutant ou pas). */
function welcomeHtml(g: number): string {
  return `<div class="td-wrap td-narrow"><div class="td-welcome">
    <h1>Bienvenue 🎹</h1>
    <p>PianoFlow te fait apprendre le piano par petites séances, avec ton clavier MIDI.</p>
    <ol class="td-steps">
      <li><b>Branche ton clavier</b><small>en USB ou en Bluetooth. La pastille 🎹 en haut passe au vert quand il est reconnu.</small></li>
      <li><b>Combien de temps par jour ?</b><small>Tu pourras changer plus tard. Mieux vaut peu chaque jour que beaucoup une fois par semaine.</small>
        <span class="td-goals">${[10, 20, 30, 45].map((m) => `<button data-act="td:goal:${m}" class="${m === g ? "on" : ""}">${m} min</button>`).join("")}</span></li>
      <li><b>Où en es-tu ?</b>
        <span class="td-choice"><button class="sf-btn pri" data-act="td:begin">Je débute</button><button class="sf-btn" data-act="td:placement">J'ai déjà joué</button></span>
        <small>« J'ai déjà joué » ouvre le parcours : chaque unité a un test pour la valider d'un coup si tu la connais déjà.</small></li>
    </ol></div></div>`;
}

/** Tes progrès : tout ce qui se mesure, sur une page à part pour que l'accueil reste une simple liste à suivre. */
function progressHtml(p: ReturnType<typeof loadProgress>, g: number): string {
  const doneN = LESSONS.filter((l) => lessonDone(p, l.id)).length;
  const mastered = REPERTOIRE.filter((r) => r.level >= 1 && (songStats()[repFileName(r)]?.bestRhythm ?? 0) >= 90).length;
  const tip = TIPS[Number(dayKey().replace(/-/g, "")) % TIPS.length];
  return `<div class="td-wrap">
    <div class="td-head"><button class="sf-back" data-act="td:back">← Séance du jour</button><h1>Tes progrès</h1></div>
    <div class="td-progress">
      <div class="td-card"><h3>Pratique (14 jours)</h3>${bars(Daily.history(14), g)}<small>${Daily.totalMinutes()} min au total · pointillés : ton objectif</small></div>
      <div class="td-card td-tiles">
        <div><b>${doneN}/${LESSONS.length}</b><small>leçons du parcours</small></div>
        <div><b>${mastered}/${REPERTOIRE.filter((r) => r.level >= 1).length}</b><small>morceaux maîtrisés (≥ 90 % en rythme)</small></div>
        <div><b>${repLevel(p) || "–"}</b><small>niveau de répertoire</small></div>
        <div><b>⚡ ${p.xp}</b><small>XP</small></div>
      </div>
    </div>
    ${skillsCard(p)}
    ${weekCard(p)}
    <div class="td-tip">💡 ${esc(tip)}</div>
  </div>`;
}

const PHASE_RANK = (x: PlanItem) => (x.tag === "warmup" ? 0 : x.tag === "recall" || x.tag === "review" ? 1 : isLessonItem(x) ? 2 : x.tag === "piece" ? 4 : 3);
const isLessonItem = (x: PlanItem) => !!x.key?.startsWith("lesson");

/** Ce que contient la séance, en mots : on voit d'un coup qu'elle n'est pas « les leçons dans l'ordre ». */
function kinds(plan: PlanItem[]): string {
  const k = (x: PlanItem) => x.tag === "warmup" ? "échauffement" : x.tag === "recall" || x.tag === "review" || x.icon === "🔁" ? "révision"
    : x.key?.startsWith("lesson") ? "nouveauté" : x.tag === "piece" ? "morceau" : "exercices ciblés";
  const list = [...new Set(plan.map(k))];
  return list.length > 1 ? ` : ${list.join(", ")}` : "";
}

export function openToday() {
  const p = loadProgress(), g = goal();
  if (!welcomed() && !LESSONS.some((l) => lessonDone(p, l.id)) && !Daily.practiceDays().length) { root.innerHTML = welcomeHtml(g); return; }
  if (view === "progress") { root.innerHTML = progressHtml(p, g); root.scrollTop = 0; return; }
  const st = streak([...new Set([...p.days, ...Daily.practiceDays()])].sort()), plan = buildPlan();
  const today = Daily.day(), mins = Math.round(today.s / 60);
  const isDoneItem = (x: PlanItem) => today.done.includes(x.tag);
  const next = plan.find((x) => !isDoneItem(x)), planDone = plan.length - plan.filter((x) => !isDoneItem(x)).length;
  const total = plan.reduce((s, x) => s + x.min, 0), left = plan.filter((x) => !isDoneItem(x)).reduce((s, x) => s + x.min, 0);
  const hour = new Date().getHours();
  const more = !next && plan.length ? moreItems(p) : [];
  const row = (x: Pick<PlanItem, "icon" | "title" | "detail" | "min" | "action">, i: number, cls: string, n: string) => `<button class="td-item ${cls}" data-act="${esc(x.action)}">
        <span class="td-n">${n}</span><span class="td-ic">${x.icon}</span><span class="td-txt"><b>${esc(x.title)}</b>${cls.includes("done") ? "" : `<small>${esc(x.detail)}</small>`}</span><span class="td-min">${x.min} min</span></button>`;
  root.innerHTML = `<div class="td-wrap">
    <div class="td-head"><h1>${hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir"}</h1>
      <p>${!next && plan.length ? "Séance terminée, bravo ! Tu peux t'arrêter là, ou continuer avec la leçon suivante." : planDone ? `Encore ${plan.length - planDone} étape${plan.length - planDone > 1 ? "s" : ""}, environ ${left} minutes.` : `Ta séance : ${plan.length} étape${plan.length > 1 ? "s" : ""}, environ ${total} minutes, dans l'ordre${kinds(plan)}. Les exercices sont choisis pour toi d'après tes résultats : rien d'autre à décider. L'onglet Exercices ne sert qu'à en faire plus.`}</p></div>
    <div class="td-top">
      <div class="td-plan">
        ${plan.map((x, i) => x === next
          ? `<button class="td-go" data-act="${esc(x.action)}"><small>${planDone ? `Étape ${i + 1} · à toi` : "Pour commencer"} · ${x.min} min</small><b>${x.icon} ${esc(x.title)}</b><em>${esc(x.detail)}</em><span>${planDone ? "Continuer" : "Commencer"} →</span></button>`
          : row(x, i, isDoneItem(x) ? "done" : "", isDoneItem(x) ? "✓" : String(i + 1))).join("")}
        ${plan.length ? "" : `<p class="td-empty">Commence par la première leçon du parcours.</p>`}
        ${more.map((x) => row(x, 0, "td-more", "+")).join("")}
        ${LESSONS.filter((l) => lessonDone(p, l.id)).length < 6 ? `<button class="td-link td-skip" data-act="td:placement">Tu sais déjà jouer ? Valide d'un coup ce que tu connais (test « Je connais déjà » de chaque unité) →</button>` : ""}
      </div>
      <div class="td-side">
        <div class="td-ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" class="bg"/>${mins > 0 ? `<circle cx="60" cy="60" r="50" class="fg" pathLength="100" style="stroke-dasharray:${Math.min(100, Math.round((mins / g) * 100))} 100"/>` : ""}</svg>
          <div><b>${mins}</b><small>/ ${g} min</small></div></div>
        <label class="td-goal">Objectif <select id="tdGoal">${[10, 20, 30, 45].map((m) => `<option value="${m}" ${m === g ? "selected" : ""}>${m} min / jour</option>`).join("")}</select></label>
        <div class="td-stats"><div><b>🔥 ${st}</b><small>jour${st > 1 ? "s" : ""} d'affilée</small></div></div>
        <button class="td-link" data-act="td:progress">Voir tes progrès →</button>
      </div>
    </div>
  </div>`;
}

/** Revenir à la séance (onglet rouvert). */
export function resetTodayView() { view = "plan"; }
export function initToday(r: HTMLElement, h: TodayHost) {
  root = r; host = h;
  root.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("[data-act]") as HTMLElement | null; if (!b) return;
    const a = b.dataset.act!;
    if (a === "td:progress" || a === "td:back") { view = a === "td:progress" ? "progress" : "plan"; openToday(); return; }
    if (a.startsWith("td:goal:")) { try { localStorage.setItem(GOAL_KEY, a.slice(8)); } catch { /* ignore */ } openToday(); return; }
    if (a === "td:begin" || a === "td:placement") {
      try { localStorage.setItem(WELCOME_KEY, "1"); } catch { /* ignore */ }
      host.go(a === "td:begin" ? `lesson:${LESSONS[0].id}` : "tab:course"); return;
    }
    host.go(a);
  });
  root.addEventListener("change", (e) => { const t = e.target as HTMLSelectElement; if (t.id === "tdGoal") { try { localStorage.setItem(GOAL_KEY, t.value); } catch { /* ignore */ } openToday(); } });
}
