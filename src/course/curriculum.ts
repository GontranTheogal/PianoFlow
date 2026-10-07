import { FOUNDATIONS } from "./foundations";
import { KEYS_AND_SEVENTHS } from "./keys";
import { enrich } from "./extras";
import type { Lesson, Unit } from "./types";

/** Tout le parcours, dans l'ordre. Une leçon ne demande que ce qui précède ; l'ordre est la progression. */
export const UNITS: Unit[] = enrich([...FOUNDATIONS, ...KEYS_AND_SEVENTHS]);

export interface FlatLesson extends Lesson { unit: Unit; index: number; /** n° dans l'unité (à partir de 0) */ inUnit: number; }
export const LESSONS: FlatLesson[] = UNITS.flatMap((unit) => unit.lessons.map((l, inUnit) => ({ ...l, unit, inUnit, index: 0 }))).map((l, i) => ({ ...l, index: i }));
export const lessonById = (id: string): FlatLesson | undefined => LESSONS.find((l) => l.id === id);
