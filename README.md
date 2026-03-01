# YourBar

YourBar is a cross-platform Expo app for managing a home cocktail bar. It helps you track ingredients, build a shopping list, and discover which cocktails you can make based on what you already have.

## Features

- **Cocktail library** with search, filters, tags, and favorites.
- **Ingredient inventory** with in-stock toggles, shopping list support, and brand/base ingredient tracking.
- **Shaker mode** that surfaces cocktails you can make from selected ingredients.
- **Ratings & preferences** including cocktail ratings, garnish/substitute rules, and start screen defaults.
- **Local persistence** for inventory data using on-device storage.

## Tech Stack

- Expo + React Native with Expo Router for file-based navigation.
- TypeScript with custom providers for inventory state management.
- Expo FileSystem for local data snapshots.

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the app:

   ```bash
   npm run start
   ```

You can also launch platform-specific builds:

```bash
npm run ios
npm run android
npm run web
```

## Useful Scripts

- `npm run lint` – run Expo linting.
- `npm run check:catalog-overlay` – validate catalog localization overlay keys and print missing/extra reports.
- `npm run check:catalog-overlay:strict` – same check, exits with error if required keys are missing.
- `npm run typecheck` – run TypeScript compiler checks without emitting files.
- `npm run check:all` – run lint, strict catalog overlay validation, and type checks.
- `npm run update:image-manifest` – rebuild the image manifest used by the app.
- `npm run prune:image-manifest` – remove unused image entries from the manifest.
- `npm run reset-project` – reset starter assets and regenerate a clean Expo Router app tree.

Before opening a pull request, run `npm run check:all` to catch lint, localization, and TypeScript issues in one pass.

## Project Structure

- `app/` – Expo Router screens and navigation.
- `components/` – shared UI components.
- `providers/` – app-wide state and data management.
- `libs/` – data storage, filtering, and helper utilities.
- `constants/` – static tag lists, theme tokens, and metadata.

## Data & Storage

Inventory, settings, and ratings are stored locally in an on-device snapshot. You can export or import inventory data through the app to back up and restore your bar setup.

## Catalog localization overlay

`assets/data/data.json` remains the source of truth for cocktails and ingredients. Localized catalog text is layered via overlay files in `libs/i18n/locales/catalog/`.

Supported overlay keys:

- `cocktail.<id>.name`
- `cocktail.<id>.description`
- `cocktail.<id>.instructions`
- `ingredient.<id>.name`
- `ingredient.<id>.description`
- Optional per-recipe override: `cocktail.<id>.ingredient.<order>.name`

Fallback behavior:

1. Locale overlay value.
2. Default (`en-GB`) overlay value.
3. Base value from `assets/data/data.json`.

This preserves recipe safety when linked ingredient records are missing because recipe rows still have snapshot names in base data.

## Privacy

YourBar does not collect any personal data. The only information sent off-device is crash diagnostics reported via Sentry to help improve app stability.
