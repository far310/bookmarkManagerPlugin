# Project Guidelines

## Scope

- This workspace builds a Chrome/Firefox extension with Vite + React + TypeScript.
- Current product goal: implement a Google bookmarks manager extension (bookmark list, search, organize, and quick actions).
- Keep changes focused on extension features and avoid unrelated refactors.

## Build and Run

- Install: `npm install`
- Dev (Chrome default): `npm run dev`
- Dev (Chrome): `npm run dev:chrome`
- Dev (Firefox): `npm run dev:firefox`
- Build (Chrome default): `npm run build`
- Build (Chrome): `npm run build:chrome`
- Build (Firefox): `npm run build:firefox`

## Architecture

- Extension entry pages live under `src/pages/*`.
- Main boundaries:
  - `src/pages/background`: background logic and browser event handling.
  - `src/pages/content`: content script logic for page-context interactions.
  - `src/pages/popup`, `src/pages/options`, `src/pages/newtab`, `src/pages/panel`, `src/pages/devtools`: React UI surfaces.
- Browser-specific build differences are defined in `vite.config.chrome.ts` and `vite.config.firefox.ts`.
- Shared Vite/plugin behavior is defined in `vite.config.base.ts` and `custom-vite-plugins.ts`.

## Conventions

- When adding/removing a page, update both page files and `manifest.json` declarations together.
- Keep cross-browser compatibility in mind:
  - Chrome background uses `service_worker`.
  - Firefox background uses `scripts`.
- Use existing TypeScript path aliases from `tsconfig.json` (`@src/*`, `@assets/*`, `@locales/*`, `@pages/*`).
- Prefer Tailwind utility classes; page-level CSS files are optional and should stay minimal.
- i18n is optional and currently disabled (`localize = false` in `vite.config.base.ts`).

## Development Rules

- Use a background-first implementation flow for new bookmark features:
  1. background action/API
  2. UI integration
  3. manifest permission review
- Keep changes small and scoped; avoid renaming or moving unrelated files.
- For each feature, define loading, success, and error states in UI.
- Prefer typed message contracts between UI and background; avoid untyped ad-hoc payloads.

## Quality Gates

- Validate affected browser target before finishing work:
  - Chrome work: run `npm run build:chrome`
  - Firefox work: run `npm run build:firefox`
  - Cross-browser work: run both builds
- If permissions are changed in `manifest.json`, document why each added permission is necessary.
- When adding or removing extension pages, keep `manifest.json` entries synchronized.

## File-Level Instructions

- Background rules: `.github/instructions/background-bookmark.instructions.md`
- UI rules: `.github/instructions/bookmark-ui.instructions.md`
- Manifest and permissions rules: `.github/instructions/manifest-permissions.instructions.md`

## Bookmark Manager Feature Guidance

- Implement bookmark-related business logic in `src/pages/background/index.ts` first (source of truth for bookmark APIs and state flow).
- Keep UI pages (`popup`, `options`, `newtab`) as thin views that call background logic, rather than duplicating bookmark logic in multiple pages.
- When adding bookmark capabilities, verify required extension permissions in `manifest.json` and keep permission scope minimal.
- For every new user action (search, move, delete, edit), define clear success/error states in UI.

## References

- Project usage and customization: `README.md`
- Manifest configuration: `manifest.json`, `manifest.dev.json`
- Vite and browser build setup: `vite.config.base.ts`, `vite.config.chrome.ts`, `vite.config.firefox.ts`
