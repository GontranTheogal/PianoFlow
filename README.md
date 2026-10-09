# PianoFlow

Application web (PWA) pour apprendre le piano avec un clavier MIDI : parcours de leçons, exercices (lecture, rythme, oreille, gammes, accords), répertoire gradué et coach sur tes propres partitions MusicXML.

Tout reste dans le navigateur : la progression est dans `localStorage`, les partitions dans IndexedDB. Rien n'est envoyé en ligne. Pour changer d'appareil, utilise **Réglages → Sauvegarde** (export puis import d'un fichier).

Le clavier MIDI passe par Web MIDI : **Chrome, Edge ou Firefox** sur ordinateur. Safari, et donc l'iPad, ne le prend pas en charge.

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
