# Original User Request

## Initial Request — 2026-06-16T16:09:38-05:00

Ensure the SMV Hub Next.js 16 application is fully functional, free of type/lint/runtime errors, has complete page routes (`/importar`, `/ordenes`), and is backed by a comprehensive Vitest suite.

Working directory: D:/proyectos_code/SMV/compras-americanas
Integrity mode: benchmark

## Requirements

### R1. Fix Existing Lint and Type Errors
Resolve all 21 ESLint problems (11 errors, 10 warnings) currently present in the test suite (`tests/extraer-route.test.ts` and `tests/schemas.test.ts`).

### R2. Complete Missing Routes & UI Pages
- Implement `/ordenes` to list all orders from Firestore in descending order of creation date, allowing the user to view order details and delete orders.
- Implement `/importar` as specified in docs/superpowers/specs/2026-06-16-importar-csv-design.md (Upload, Preview with validations, and Batch Import states).

### R3. Test Suite Expansion
Verify database CRUD operations in `lib/ordenes.ts` and import functionality in `lib/importar.ts` with new Vitest tests.

## Acceptance Criteria

### Build & Code Quality
- [ ] `npm run lint` completes with zero errors and zero warnings.
- [ ] `npm run build` compiles without errors.

### Functionality
- [ ] The `/importar` page handles CSV upload, displays preview table (coloring invalid rows red, warning rows yellow), and imports data in batches of 10.
- [ ] The `/ordenes` page fetches and lists orders from Firestore.
- [ ] Deletion of orders is functional.

### Testing
- [ ] `npm test` runs all tests successfully with 100% pass rate.
- [ ] Coverage for critical files (`lib/importar.ts`, `lib/ordenes.ts`) is increased with specific unit tests.
