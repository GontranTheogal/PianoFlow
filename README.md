# PianoFlow

Application web (PWA) pour apprendre le piano avec un clavier MIDI ou un piano acoustique écouté au micro : parcours de leçons, exercices (lecture, rythme, oreille, gammes, accords), répertoire gradué et coach sur tes propres partitions MusicXML.

Tout reste dans le navigateur : la progression et les pianos calibrés sont dans `localStorage`, les partitions dans IndexedDB. Rien n'est envoyé en ligne, pas même le son du micro, analysé sur place. Pour changer d'appareil, utilise **Réglages → Sauvegarde** (export puis import d'un fichier).

Le clavier MIDI passe par Web MIDI : **Chrome, Edge ou Firefox** sur ordinateur. Safari, et donc l'iPad, ne le prend pas en charge.

## Piano acoustique (micro)

**Réglages → Mon piano → Micro** : l'appli reconnaît les notes jouées sur un piano acoustique, accords compris. Il faut une page en https (ou sur `localhost`). Le micro passe par getUserMedia et Web Audio (AudioWorklet), que Safari prend aussi en charge : contrairement au MIDI, l'iPad devrait donc pouvoir s'en servir. Seul Chromium a été testé.

- **Ajouter un piano** : pour un piano désaccordé (ou accordé plus bas que le La 440), et pour une reconnaissance plus sûre sur n'importe quel piano. L'appli demande de jouer chaque touche plusieurs fois (3 par défaut) et mesure sa fréquence réelle, l'inharmonicité de ses cordes et son timbre. On peut s'arrêter et reprendre, passer une touche cassée, recalibrer une seule touche. Une mauvaise touche, ou la bonne une octave plus haut ou plus bas, est signalée.
- **Pendant le jeu**, les notes attendues par la partition aident la reconnaissance (notes douces, octaves, mains décalées) ; les sons de l'appli (autre main, démonstration, métronome) ne sont pas pris pour ceux du pianiste ; en rythme, chaque note est jugée à l'instant où elle a été frappée, pas à celui où elle a été reconnue (environ 150 ms plus tard).
- **Sans MIDI**, ce qui demande la vélocité, la durée exacte des notes ou la pédale (exercices de toucher et de pédale) reste approximatif ou indisponible.

## Développement

Il faut Node 22. Pour le test navigateur, la première fois : `npx playwright install chromium-headless-shell`.

```sh
npm ci
npm run dev      # serveur de développement
npm test         # tests (tsx)
npm run test:e2e # test de fumée dans Chromium headless, sur le build (lancer npm run build avant)
npm run build    # tsc + vite build + liste de précache du service worker
```

## Déploiement

Chaque push sur `main` lance les tests puis publie `dist/` sur GitHub Pages (`.github/workflows/deploy-pages.yml`). Réglage à faire une seule fois : Settings → Pages → Source : « GitHub Actions ».

## Repères

- `src/main.ts` : point d'entrée, avec la vue de jeu et la bibliothèque.
- `src/course/` : le parcours de leçons.
- `src/pieces/` et `src/repertoire.ts` : le répertoire intégré.
- `src/fingeringModel.ts` : le modèle de doigtés appris. Ce sont des données figées, générées par un script retiré du dépôt mais toujours présent dans l'historique git.
- `src/mic/` : la reconnaissance au micro. `detector.ts` repère les attaques et décompose le son nouveau en touches (NMF sur un gabarit par touche), `calibrate.ts` mesure une frappe pendant le calibrage, `pianos.ts` garde les pianos, `input.ts` branche le micro du navigateur. Tout sauf `input.ts` est pur et testé (`tests/mic.test.ts`, sur le piano de synthèse de `tests/synth-piano.ts`). L'interface est dans `src/app/micView.ts`.
