import { Capacitor } from "@capacitor/core";

/** true seulement dans une appli de bureau empaquetée avec Tauri (pas dans le navigateur, pas sur iPad). La synchro passe par Netlify ou le serveur local (`npm run serve`). */
export function isDesktopApp(): boolean {
  return typeof (window as any).__TAURI__ !== "undefined";
}
/** true seulement dans l'appli native iPad (Capacitor). Attention : window.Capacitor existe aussi
 *  dans un simple navigateur dès que @capacitor/core est embarqué, d'où isNativePlatform(). */
export function isIpadApp(): boolean {
  return Capacitor.isNativePlatform();
}
