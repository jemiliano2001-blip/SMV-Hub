# Lazo de retroalimentación con producción — Implementation Plan

**Goal:** Que un bug de negocio en los caminos donde se mueve dinero **rompa CI**, y que un
error en producción llegue con suficiente detalle para arreglarlo sin reproducirlo. Hoy ninguna
de las dos cosas es posible: CI no ejecuta ningún E2E y la telemetría de errores manda solo un
string de scope.

**Architecture:** Sin dependencias nuevas. Se usa lo que ya está instalado — Vitest para las
reglas de dinero que son funciones puras, Playwright (ya en `devDependencies`, ya con
`playwright.config.ts`) para el cableado, el emulador de Firestore para las reglas, y el GA4 ya
montado en `lib/ux-telemetry.ts` para telemetría. El único trabajo de infraestructura real es
meter Playwright a `ci.yml`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript estricto, Vitest 4, Playwright 1.61,
Firebase Emulator Suite, GitHub Actions.

**Spec:** [`docs/superpowers/specs/2026-07-24-lazo-retroalimentacion-produccion-design.md`](../specs/2026-07-24-lazo-retroalimentacion-produccion-design.md)

## Global Constraints

- Prohibido `any` y `@ts-ignore` (CLAUDE.md).
- **Ningún test toca Firestore de producción.** Los E2E corren contra `smv-brain-dev`; los tests
  de reglas contra el emulador local.
- **Ninguna credencial en el repo.** El `storageState` va como secret de GitHub, nunca commiteado.
- La llamada a Gemini se stubea en E2E — se prueba el cableado de la app, no la IA. Un test que
  gasta cuota de API en cada push es un test que se termina desactivando.
- Los tests nuevos deben fallar **antes** del fix y pasar después. Un test que pasa contra el
  código roto no está probando nada (es exactamente cómo pasaron los ~40 huecos de julio).
- No tocar el comportamiento de ningún módulo existente. Este plan agrega verificación, no
  cambia funcionalidad — salvo Task 4, que amplía un payload de telemetría.

---

## File map

| File | Responsibility |
|---|---|
| `tests/reportes.test.ts` | (existe) + casos de envío prorrateado en órdenes con ítems |
| `tests/roles-modulos.test.ts` | (existe) + casos de revocación de super-admin sobre plantilla admin |
| `.github/workflows/ci.yml` | Paso nuevo: instalar navegadores + `npm run test:e2e` |
| `playwright.config.ts` | `webServer` + `storageState` desde env |
| `e2e/auth.setup.ts` | Proyecto de setup que carga el `storageState` del secret |
| `e2e/camino-dinero.spec.ts` | E2E: nueva compra → orden → reporte → cierre contable |
| `lib/ux-telemetry.ts` | `registrarErrorInterfaz` con `digest` + ruta |
| `app/error.tsx`, `app/proveedores/error.tsx` | Pasar `error.digest` y `pathname` al reporte |
| `tests/ux-telemetry.test.ts` | Payload correcto y sin PII |
| `tests/firestore-rules.test.ts` | Emulador: 4 casos negativos en colecciones sensibles |
| `firebase.json` | Config del emulador de Firestore para los tests |
| `package.json` | Script `test:rules` |

---

### Task 0: Borrar la pestaña ROP — `[x]` completado 2026-07-24

**Files:** `app/almacen/page.tsx`, `app/almacen/TableroReabastecimientoHerramientas.tsx` (borrado),
`lib/recompra-herramientas.ts` (borrado), `tests/recompra-herramientas.test.ts` (borrado),
`lib/roles.ts`, `lib/schemas.ts`, `tests/roles-modulos.test.ts`, `tests/usuarios.test.ts`,
`tests/usuarios-admin.test.ts`, `scripts/backfill-modulos-usuarios.mjs`, `CLAUDE.md`, `AGENTS.md`

- [x] Borrar el tablero, su lib de datos demo y su test.
- [x] `/almacen` queda con dos tabs (Entradas/Salidas) y sin chequeo de permisos — se cayeron
      `useUsuario`, `usePermisos`, `tieneModulo` y `authBypassActivo` de la página.
- [x] Eliminar `reabastecimiento-rop` de `ModuloIdSchema`, `GRUPOS_MODULOS`, las plantillas
      admin/compras y el script de backfill.
- [x] Simplificar `Record<Exclude<ModuloId, "reabastecimiento-rop">, string>` → `Record<ModuloId, string>`.
- [x] Reapuntar las 6 aserciones de tests que usaban el módulo como sujeto de prueba.
- [x] Actualizar `CLAUDE.md` y `AGENTS.md` con la razón del retiro.

**Verificación:** `npx tsc --noEmit` limpio · 625 tests pasando · `GET /almacen 200` sin errores
de consola · `grep` sin referencias en código (solo quedan menciones en specs históricos, que
son historia y no se editan).

**Nota de seguridad:** quitar el string del enum es seguro porque
`modulosDesdeUsuarioLegacy` (`lib/roles.ts:236-241`) hace `safeParse` por ítem y descarta
strings desconocidos. Los docs de usuario en Firestore que aún traen `reabastecimiento-rop` en
`modulos[]` simplemente lo pierden — sin excepción, sin bloqueo de acceso. **Verificar esto era
obligatorio antes de tocar el enum**; si el parseo hubiera sido estricto, esto dejaba gente
fuera del sistema.

---

### Task 1: Tests unitarios de las dos reglas de dinero puras — `[x]` completado 2026-07-24

**Files:** `tests/reportes.test.ts`, `tests/roles-modulos.test.ts`
**Esfuerzo real:** ~40 min

Dos de los cuatro P1 de la auditoría de julio eran funciones puras. Se cubren con Vitest a costo
casi cero — no necesitan navegador. Hacer esto antes del E2E es el orden correcto: el peldaño
barato primero.

- [x] **`aplanarLineas` con envío.** Orden con 2 ítems, `envio: 100`, `impuestos: 0`. La suma de
      `total` de las líneas recupera `subtotal + envío` (120 + 80 = 200).
- [x] Caso borde: ítems con `total` sumando 0 → envío repartido en partes iguales (25/25),
      sin `NaN`.
- [x] **`esSuperAdminDesdeUsuarioLegacy` revocando.** `{ esSuperAdmin: false, rol: "admin" }` →
      `false`, y lo mismo con `plantilla: "admin"`. El booleano explícito le gana al fallback.
- [x] Caso de migración ya existía en el `it` (`{ rol: "admin" }` sin el campo → `true`) — no se
      duplicó, se sumaron los `expect` nuevos al bloque existente.

**Verificación:** `npx vitest run tests/reportes.test.ts tests/roles-modulos.test.ts` → 40/40.
**Prueba de que el test sirve:** se revirtió a mano cada fix (quitar `propEnvio` de la suma en
`lib/reportes.ts`; exigir `data.esSuperAdmin === true` en vez de solo `typeof === "boolean"` en
`lib/roles.ts`) y los 3 tests nuevos fallaron como se esperaba. Se restauró el código real
después — `git diff` confirma cero cambios netos en ambos archivos de producción.

---

### Task 2: Playwright en CI — `[ ]`

**Files:** `.github/workflows/ci.yml`, `playwright.config.ts`, `package.json`
**Esfuerzo:** 1 noche
**Va antes de escribir el E2E.** Sin este paso, cualquier spec nuevo nace muerto — exactamente
el estado actual de `e2e/login-accessibility.spec.ts` y `e2e/proveedores-accessibility.spec.ts`,
que existen desde hace días y **nunca se han ejecutado** porque `ci.yml` no menciona Playwright.

- [ ] Añadir a `ci.yml`, después de "Build Next.js App" y solo en `pull_request`:
      `npx playwright install --with-deps chromium` + `npm run test:e2e`.
      Solo Chromium: tres navegadores triplican el tiempo de CI para atrapar bugs que este
      proyecto no tiene (no hay usuarios en Safari).
- [ ] `webServer` en `playwright.config.ts` levantando `npm run start`, con
      `reuseExistingServer: !process.env.CI`.
      ⚠️ **El paso debe ir gateado a `pull_request`, igual que el build.** En `ci.yml` el paso
      "Build Next.js App" solo corre en PR (o si falta credencial de Firebase); en `main` con
      credenciales, Firebase Frameworks hace su propio build y el workflow **omite `npm run build`
      a propósito** para no compilar dos veces. Si el paso de Playwright corre en `main`,
      `npm run start` truena porque no hay `.next`. El E2E se cuelga del build del PR, punto.
- [ ] **No cambiar `webServer` a `npm run dev` para librar el problema anterior.** `dev` usa
      Turbopack y los builds están clavados a `--webpack` (CLAUDE.md) — probarías un bundler
      distinto al de producción, que es justo el problema que ese flag existe para evitar.
- [ ] `continue-on-error: true` **solo en el primer PR**, para ver que el paso corre sin
      bloquear a nadie. Quitarlo en el PR siguiente — un test que no puede fallar no es un test.
- [ ] Subir el reporte HTML de Playwright como artifact (mismo patrón que el de Lighthouse, que
      ya está resuelto en el workflow).
- [ ] Confirmar que los 2 specs de accesibilidad existentes pasan. **Si fallan, arreglarlos aquí**
      — llevan días rotos sin que nadie se enterara, que es justo la tesis de este plan.

**Verificación:** abrir un PR de prueba y ver el paso de Playwright ejecutándose en Actions.

---

### Task 3: E2E del camino del dinero — `[ ]`

**Files:** `e2e/auth.setup.ts`, `e2e/camino-dinero.spec.ts`
**Esfuerzo:** ~3 noches. **Es la tarea más grande del plan**, no una de seis chicas.

✅ **Decidido (2026-07-24):** usuario de prueba con email/password en `smv-brain-dev`, opción
recomendada — el bypass invalida medio recorrido y el `storageState` manual se pudre sin avisar.

- **Correo:** `admin@smv-hub-e2e.local` (dominio inexistente a propósito — nunca recibe correo real).
  `admin` a secas no sirve: Firebase Auth exige formato de email válido.
- **Password:** debe tener 6+ caracteres — Firebase Auth rechaza `admin` solo por corto
  (`auth/weak-password`). Usar algo simple pero válido, p. ej. `admin1234`; guardarlo **solo**
  como secret de GitHub (`E2E_TEST_USER_PASSWORD`) y en `.env.local` local — nunca en el repo.
- Falta crear el usuario en `smv-brain-dev` y darle lo que pide la nota de abajo (whitelist +
  claim + módulos). Se hace al empezar esta tarea, no antes — no tiene sentido crear el usuario
  hasta que haya un spec que lo use.

⚠️ **Tener sesión no basta — el usuario de prueba necesita tres cosas más**, y descubrirlas a
medio camino cuesta dos noches de depuración:

1. **Estar en la whitelist**: `/api/extraer` exige token válido **y** correo autorizado
   (`lib/api-auth.ts:47` → `lib/authorized-emails.ts`). Agregar el correo del usuario de prueba
   vía `AUTHORIZED_EMAILS_EXTRA` en el entorno de `smv-brain-dev`.
2. **Tener el claim `smvHubActivo: true`**: `storage.rules:29` lo exige para subir la imagen de
   la factura. Se propaga al activar el usuario en `/usuarios` (o con
   `scripts/backfill-claims-usuarios.mjs`), y el token tarda hasta 1h en refrescarse.
3. **Tener los módulos del recorrido** en `modulos[]`: `nueva-compra`, `ordenes` y `reportes`.
   Plantilla `compras` los cubre.

Sin (1) el paso 1 falla con 401; sin (2) falla la subida a Storage antes de llegar a la IA;
sin (3) `AuthGuard` lo saca de la ruta.

- [ ] `e2e/auth.setup.ts` como proyecto de setup de Playwright, con dependencia desde el spec.
- [ ] Stub de la llamada a Gemini vía `page.route('**/api/extraer', …)` devolviendo una
      `ExtraccionInvoice` fija. No se prueba la IA; se prueba qué hace la app con su respuesta.
- [ ] **Paso 1 — captura:** `/nueva-compra`, subir imagen, verificar que el form se llena con los
      datos del stub, guardar.
- [ ] **Paso 2 — la orden existe:** `/ordenes`, buscar por número de factura, abrir el detalle,
      verificar proveedor y total.
- [ ] **Paso 3 — el reporte cuadra (el que atrapa el bug del envío):** `/reportes` con el
      periodo correcto. Aserción: el total del KPI **incluye el envío**. Este es el paso que
      justifica todo el E2E.
- [ ] **Paso 4 — el filtro de moneda filtra (el otro P1):** cambiar a MXN y verificar que las
      cifras cambian, no solo el `<select>`.
- [ ] **Paso 5 — cierre contable acotado:** `/reportes/contable`, cerrar lote con dos monedas
      pendientes. Aserción: solo se archivan las órdenes de la moneda activa y el diálogo avisa
      de las otras.
- [ ] Limpieza: el spec borra la orden que creó, o usa un prefijo identificable y un
      `afterAll` que barre. `smv-brain-dev` no debe llenarse de basura de CI.

**Verificación:** `npm run test:e2e` local, y el PR de prueba en verde.
**Prueba de que el test sirve:** revertir a mano el `comprasEnMonedaActiva` del dashboard y
confirmar que el paso 4 falla.

---

### Task 4: Errores de producción con detalle — `[ ]`

**Files:** `lib/ux-telemetry.ts`, `app/error.tsx`, `app/proveedores/error.tsx`, `tests/ux-telemetry.test.ts`
**Esfuerzo:** media noche

Hoy `registrarErrorInterfaz(scope)` manda a GA4 un evento `exception` con
`description: "ui_proveedores"` y nada más. Sabes que algo tronó; nunca qué.

⚠️ **Esto revierte una decisión deliberada.** El comentario en `lib/ux-telemetry.ts` dice
textual: *"No enviamos mensajes, rutas, digests ni datos del usuario."* Se revierte a
conciencia y por escrito: el `digest` de React es un hash opaco generado en build (no contiene
el mensaje ni datos), y las rutas del Hub son estáticas (`/ordenes`, `/finanzas`) — no llevan
ids ni datos de nadie. **Los mensajes de error siguen fuera**, ahí sí puede colarse contenido
de un documento.

- [ ] Extender la firma a `registrarErrorInterfaz(scope, { digest?, ruta? })`.
- [ ] Reemplazar el comentario viejo por uno que diga qué se manda y **por qué es seguro**, para
      que el siguiente que lo lea no lo revierta pensando que fue un descuido.
- [ ] Pasar `error.digest` desde los Error Boundaries y `usePathname()` como ruta.
- [ ] Test: el payload lleva `digest` y ruta, y **no** lleva `error.message`. Este test es el
      candado que hace que la decisión aguante.

**Verificación:** `npx vitest run tests/ux-telemetry.test.ts`; forzar un error en dev y ver el
evento en la consola de GA4 (tarda hasta 24h en el reporte estándar; usar DebugView).

---

### Task 5: Tests de reglas de Firestore con emulador — `[ ]`

**Files:** `tests/firestore-rules.test.ts`, `firebase.json`, `package.json`
**Esfuerzo:** 1 noche

`firestore.rules` son 29 KB. La única verificación hoy es `tests/firestore-security.test.ts`:
15 líneas de **regex sobre el texto del archivo**, cubriendo una sola colección
(`configuraciones`). Eso comprueba que un string existe, no que la regla funcione.

- [ ] Añadir `@firebase/rules-unit-testing` a `devDependencies` (única dependencia nueva del
      plan; no hay forma de probar reglas sin el emulador).
      ⚠️ **El emulador de Firestore necesita Java (JDK 11+).** En Windows eso es una instalación
      aparte, no un `npm i` — resolverlo antes de empezar la tarea, no a medio camino.
- [ ] Script `test:rules` que arranca el emulador y corre solo este archivo. **Separado de
      `npm test`** para que la suite unitaria siga corriendo en 8 segundos sin Java.
- [ ] Cuatro casos negativos, uno por colección sensible: usuario **sin** el módulo NO puede leer
      `finanzas_facturas`, NO puede leer `caja_chica_movimientos`, NO puede escribir `usuarios`,
      NO puede leer `auditoria`.
- [ ] Un caso positivo por colección, para que el test falle también si las reglas se vuelven
      demasiado restrictivas y bloquean a quien sí debe entrar.
- [ ] Dejar `tests/firestore-security.test.ts` como está — es barato y no estorba.

**Verificación:** `npm run test:rules`.
**Prueba de que el test sirve:** aflojar a mano una regla a `allow read: if true` y confirmar
que el caso negativo falla.

---

### Task 6: Restore de backup, una vez — `[ ]`

**Files:** ninguno (operativo). Documentar el resultado en `docs/infra/firestore-backups.md`.
**Esfuerzo:** media noche

- [ ] Crear una base Firestore **desechable**, nombrada tipo `restore-drill-2026-07`.
      **No usar `smv-brain-dev`**: ahí se hacen pruebas locales casuales, y el backup trae
      nómina, facturas y usuarios reales.
- [ ] Restaurar el export más reciente ahí.
- [ ] Verificar tres cosas: las órdenes están, `caja_chica_movimientos` está, y los timestamps
      no se corrompieron.
- [ ] **Borrar la base** al terminar.
- [ ] Anotar en `docs/infra/firestore-backups.md`: fecha del drill, cuánto tardó, qué falló.

**Verificación:** el conteo de documentos restaurados coincide con producción (±  lo escrito
entre el export y la comparación).

---

## Orden de ejecución y salida degradada

```
Task 0 ✅ → Task 1 → Task 2 → Task 3 (grande, bloqueada por decisión de auth)
                  ↘ Task 4, Task 5, Task 6 (independientes entre sí)
```

Tasks 4, 5 y 6 no dependen de nada y se pueden hacer en cualquier orden o en paralelo.

**Si Task 3 se atora** (el `storageState` autenticado es el riesgo real del plan): entregar
1, 2, 4, 5 y 6 y aislar el E2E como su propio bloque. Eso ya deja las reglas verificadas, los
errores legibles, el backup probado y Playwright corriendo en CI — valor real sin el ítem caro.
Lo que **no** se puede hacer es dejar Task 2 sin Task 3 indefinidamente: CI corriendo dos specs
de accesibilidad y nada más es teatro.

## Criterio de salida del plan completo

Un bug de moneda o de monto introducido a propósito **rompe CI**. Hoy es imposible por
construcción.
