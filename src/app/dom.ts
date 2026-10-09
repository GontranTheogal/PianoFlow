import { readStr, writeStr } from "../storage";

export const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
/** Réglages de l'appli, rangés sous « pianoflow-<clé> ». */
export const store = {
  get: (k: string, d: string) => readStr("pianoflow-" + k, d),
  set: (k: string, v: string) => writeStr("pianoflow-" + k, v),
};
let toastTimer: number | undefined;
export function toast(msg: string, ms = 1800) {
  const el = $("toast"); el.textContent = msg; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => el.classList.remove("show"), ms);
}
export const cleanName = (n: string) => n.replace(/\.(xml|musicxml|mxl)$/i, "");
