// Test de fumée dans un vrai navigateur (Chromium headless) sur le build : `npm run build && npm run test:e2e`.
// Parcourt les chemins principaux et échoue à la moindre erreur JavaScript.
import assert from "node:assert/strict";
import { preview } from "vite";
import { chromium } from "playwright";

const server = await preview({ preview: { port: 4180, strictPort: true } });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();
const errors = [];
const ok = (name) => console.log("  ✓ " + name);
try {
  const page = await browser.newPage({ acceptDownloads: true });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto(url + "?debug", { waitUntil: "load" });
  assert.equal(await page.locator("#tabs .tab").count(), 4);
  assert.ok(await page.locator("#todayView").isVisible());
  ok("démarrage : quatre onglets, séance du jour affichée");

  for (const tab of ["course", "exercises", "library"]) await page.click(`[data-tab="${tab}"]`);
  await page.locator(".rep-card").first().waitFor({ timeout: 5000 });   // rendu asynchrone (bibliothèque en IndexedDB)
  ok("onglets : parcours, exercices, morceaux");

  await page.click("#toggleSettings");
  await page.click('#themeSeg [data-theme="dark"]');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark");
  await page.click('#themeSeg [data-theme="auto"]');
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 5000 }), page.click("#backupExport")]);
  assert.match(dl.suggestedFilename(), /^pianoflow-sauvegarde-.*\.json$/);
  await page.click("#closeSettings");
  ok("réglages : thème sombre, export de la sauvegarde");

  await page.locator(".rep-card [data-rep]:not([data-coach])").first().click();
  await page.waitForSelector("#score svg .note", { timeout: 30000 });
  ok("morceau : partition gravée par Verovio");

  const first = await page.evaluate(() => window.__pf.expected());
  assert.ok(first.length > 0);
  for (const p of first) await page.evaluate((p) => window.__pf.midi(p), p);
  const next = await page.evaluate(() => window.__pf.expected());
  assert.notDeepEqual(next, first);
  ok("jeu : les bonnes notes font avancer la partition");

  await page.click("#homeBtn");
  assert.ok(await page.locator("#libraryHomeView").isVisible());
  ok("retour à la bibliothèque");

  assert.deepEqual(errors, [], "erreurs dans la page");
  ok("aucune erreur JavaScript");
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
