## 2026-06-16T21:13:01Z
You are worker_lint_fixes_1. Your working directory is D:\proyectos_code\SMV\compras-americanas\.agents\worker_lint_fixes_1.
Please fix the 21 ESLint problems (11 errors, 10 warnings) in tests/extraer-route.test.ts and tests/schemas.test.ts.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Specific Fix Strategy:
1. For `@typescript-eslint/no-explicit-any` errors in `tests/extraer-route.test.ts`:
   - Import `NextRequest` from "next/server" in the test file.
   - Update `makeRequest(file: File | null): Request` to construct and return a `NextRequest` instead of `Request`.
   - Remove `as any` from `POST(makeRequest(...) as any)`. If there's a type mismatch, cast using `as NextRequest` or `as unknown as NextRequest` instead of `as any`.
2. For `@typescript-eslint/no-unused-vars` warnings in `tests/extraer-route.test.ts` and `tests/schemas.test.ts`:
   - Replace destructuring-based field omission (e.g. `const { moneda: _, ...sinDefaults } = VALID_EXTRACTION`) with copying and deleting (e.g. `const sinDefaults = { ...VALID_EXTRACTION } as Partial<typeof VALID_EXTRACTION>; delete sinDefaults.moneda;`). This avoids unused variable assignments like `_` or `__` or `imagenUrl`.

Verification:
- Run `npm run lint` to confirm zero lint errors/warnings.
- Run `npm test` to confirm all tests still pass.

Write a handoff.md in your directory D:\proyectos_code\SMV\compras-americanas\.agents\worker_lint_fixes_1\ summarizing your changes and verification results. When done, send a message to me.
