# Design system de PianoFlow

La direction choisie en octobre 2026 est un **clay épuré**. Les surfaces sont claires et arrondies, les ombres douces et discrètes. Il n'y a qu'une couleur de marque, et chaque autre couleur a un sens. Les jetons sont définis dans [`src/styles/00-tokens.css`](../src/styles/00-tokens.css), et c'est seulement par eux qu'on choisit une couleur.

## Couleurs

| Rôle | Jeton | Clair | Sombre | Règle |
|---|---|---|---|---|
| Marque, action principale | `--primary` / `--on-primary` | `#4f46e5` / blanc | idem | 6,3:1. Une seule action principale par écran. |
| Survol | `--primary-hover` | `#4338ca` | idem | |
| État actif doux, bandeaux de marque | `--primary-tint` / `--primary-ink` | `#eef0ff` / `#4338ca` | `#25245a` / `#b4bcfd` | Onglet actif mobile, coach, astuces. |
| Texte secondaire | `--muted` | `#596074` | `#a3a9bb` | ≥ 5,4:1 sur toutes les surfaces. |
| Focus clavier | `--focus` | `#4f46e5` | `#a5b4fc` | Contour de 2px, jamais supprimé. |

**Les couleurs de sens ne servent jamais de décor :**
- **Main droite** : bleu (`--hand-r`). En fond sous du texte, on prend `--hand-r-strong`.
- **Main gauche** : orange (`--hand-l`). En fond sous du texte, `--hand-l-strong`.
- **Juste** : vert (`--ok`, `--tint-ok` / `--ink-ok`).
- **Faux** : rouge (`--bad`, `--tint-bad` / `--ink-bad`).
- **En retard ou à revoir** : orange teinté (`--tint-orange` / `--ink-orange`).

Les **couleurs d'unité** (`--c`, données du parcours) restent pastel pour le décor : barres, bordures, pastilles. Sous du texte blanc, on emploie `--c-strong`, qui garde la même teinte avec une luminosité oklch plafonnée à 0,52, soit au moins 4,5:1.

## Typographie

- **Police** : Nunito Sans (variable, OFL), embarquée dans l'app avec les jeux latin et latin-ext seulement, donc sans appel réseau.
- **Repli** : Segoe UI, puis la police système.

## Interaction

- Le focus visible au clavier est obligatoire.
- `prefers-reduced-motion` coupe les animations.
- Les icônes sont des SVG, pas des emojis (en cours, étape 3b). Les signes ♯ ♭ ♮ sont du contenu musical : ils restent du texte.

## Vérifier

- `npm run test:e2e` : test de fumée dans Chromium.
- Contrastes : les valeurs ci-dessus ont été mesurées au calcul WCAG. Refaire la mesure à chaque nouveau couple texte/fond.
