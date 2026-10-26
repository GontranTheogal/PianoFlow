// Test de fumée dans un vrai navigateur (Chromium headless) sur le build : `npm run build && npm run test:e2e`.
// Parcourt les chemins principaux et échoue à la moindre erreur JavaScript.
import assert from "node:assert/strict";
import { preview } from "vite";
import { chromium } from "playwright";

const server = await preview({ preview: { port: 4180, strictPort: true } });
const url = server.resolvedUrls.local[0];
// faux micro (son de test de Chromium), accordé sans fenêtre d'autorisation
const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
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
  ok("réglages : thème sombre, export de la sauvegarde");

  // piano acoustique : le micro s'ouvre, l'assistant s'affiche (ajout d'un piano, test), puis retour au clavier MIDI
  await page.click('#inputSeg [data-input="mic"]');
  await page.waitForFunction(() => document.getElementById("midiStatus").classList.contains("ok"), null, { timeout: 8000 });
  assert.match(await page.textContent("#midiStatus"), /Micro/);
  await page.click("#micTest");
  assert.ok(await page.locator("#micWizard #mwKbd svg").isVisible());
  await page.click('#micWizard [data-mw="close"]');
  await page.click("#toggleSettings");
  await page.click("#pianoAdd");
  assert.ok(await page.locator("#mwName").isVisible());
  await page.click('#micWizard [data-mw="close"]');
  assert.ok(await page.locator("#micWizard").isHidden());
  await page.click("#toggleSettings");
  await page.click('#inputSeg [data-input="midi"]');
  assert.doesNotMatch(await page.textContent("#midiStatus"), /Micro/);
  await page.click("#closeSettings");
  ok("micro : ouverture, assistant d'ajout d'un piano, test de reconnaissance");

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
