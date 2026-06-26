# Project: Compras Americanas Fixes & Enhancements

## Architecture
- Next.js 16 App Router application.
- State is persisted in Firebase Firestore.
- Styling with Tailwind CSS v4.
- Verification is done with Vitest and ESLint.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | Baseline & ESLint Fixes | Fix 21 ESLint problems in `tests/extraer-route.test.ts` and `tests/schemas.test.ts` | None | DONE |
| 2 | Implementation of `/ordenes` | List orders in descending order, view details, delete order | None | DONE |
| 3 | Implementation of `/importar` | CSV upload, validate and color preview rows, batch import to Firestore | M2 | DONE |
| 4 | Add Vitest Tests | Test suite expansion for `lib/ordenes.ts` and `lib/importar.ts` | M1, M2, M3 | DONE |
| 5 | Verification & Audit | Ensure all builds, tests, and lints pass clean, and audit is clean | M1, M2, M3, M4 | DONE |

## Code Layout
- `app/` - Next.js page components
- `lib/` - Utility functions, schemas, Firestore DB logic
- `tests/` - Vitest test files
