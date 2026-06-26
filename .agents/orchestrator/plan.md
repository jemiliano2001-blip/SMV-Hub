# Plan - Compras Americanas Fixes and Enhancements

## Project Overview
The objective is to fix existing ESLint problems in test files, implement `/ordenes` and `/importar` pages, and add Vitest tests for database CRUD (`lib/ordenes.ts`) and csv imports (`lib/importar.ts`). Finally, ensure all builds, tests, and lints pass clean.

## Decomposition
We decompose the work into the following Milestones:
1. **Milestone 1: Lint & Code Quality baseline & fixes**
   - Gather baseline lint errors by running a lint/typecheck command.
   - Spawn an Explorer/Worker to fix ESLint errors and warnings in `tests/extraer-route.test.ts` and `tests/schemas.test.ts`.
2. **Milestone 2: Implement `/ordenes` page**
   - Retrieve all orders from Firestore in descending order of creation date.
   - Allow viewing order details and deleting orders.
3. **Milestone 3: Implement `/importar` page**
   - Handle CSV upload, preview table (validated rows, warnings, invalid rows highlighted).
   - Batch import orders in groups of 10.
4. **Milestone 4: Add Vitest tests**
   - Cover CRUD operations in `lib/ordenes.ts`.
   - Cover import logic in `lib/importar.ts`.
5. **Milestone 5: Verification & Audit**
   - Verify all tests pass, build compiles successfully, and lint reports zero errors/warnings.
   - Run the Forensic Auditor to ensure no cheating/facade implementations.
