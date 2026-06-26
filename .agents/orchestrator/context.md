# Project Context

## Technical Stack
- Next.js 16.2.9 (App Router)
- React 19.2.4
- Tailwind CSS v4
- Firebase Firestore (SDK v12)
- Vitest

## Key Requirements
- Resolve ESLint warnings and errors in:
  - `tests/extraer-route.test.ts`
  - `tests/schemas.test.ts`
- Implement `/ordenes` routing and UI (fetch from Firestore, delete functional).
- Implement `/importar` routing and UI (CSV drag-and-drop, preview table with warning/error row colors, batch import).
- Expand test coverage for `lib/ordenes.ts` and `lib/importar.ts` with Vitest.
- Zero warnings/errors from eslint and build/test.
