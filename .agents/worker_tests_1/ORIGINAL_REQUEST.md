## 2026-06-16T21:21:14Z
You are worker_tests_1. Your working directory is D:\proyectos_code\SMV\compras-americanas\.agents\worker_tests_1.
Please implement unit tests for `lib/ordenes.ts` inside `tests/lib-ordenes.test.ts`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Detailed Instructions:
- Create `tests/lib-ordenes.test.ts` to test the CRUD operations exported by `lib/ordenes.ts`: `crearOrden`, `listarOrdenes`, `obtenerOrden`, `actualizarOrden`, and `eliminarOrden`.
- Mock `@/lib/firebase` to export mock `db` and `storage` objects.
- Mock `firebase/firestore` functions like `collection`, `doc`, `addDoc`, `getDoc`, `getDocs`, `updateDoc`, `deleteDoc`, `query`, `orderBy`, `Timestamp` to assert that they are called with correct arguments and return correct mocked results.
- Implement tests verifying:
  1. `crearOrden(payload)`:
     - Asserts `addDoc` is called with the mocked collection reference and order fields.
     - Asserts the function returns the generated document ID.
     - Asserts default status is set to "pendiente".
  2. `listarOrdenes()`:
     - Asserts `getDocs` is called with a query using the collection and `orderBy("creadoEn", "desc")`.
     - Asserts it returns the array of orders correctly converted/mapped.
  3. `obtenerOrden(id)`:
     - Asserts `getDoc` is called with correct doc reference.
     - Asserts it returns the converted order object if snapshot exists, or null if it doesn't.
  4. `actualizarOrden(id, cambios)`:
     - Asserts `updateDoc` is called on the doc reference with updated fields and `actualizadoEn` timestamp.
  5. `eliminarOrden(id)`:
     - Asserts `deleteDoc` is called on the doc reference.

Verification:
- Run `npm run lint` to ensure zero warnings/errors.
- Run `npm run test` to verify that the newly added tests and all other tests pass.
- Run `npm run build` to verify successful compilation.

Write a handoff.md in your directory D:\proyectos_code\SMV\compras-americanas\.agents\worker_tests_1\ when done. Then send a message to me.
