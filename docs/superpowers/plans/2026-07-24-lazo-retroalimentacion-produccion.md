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

### Task 2: Playwright en CI — `[x]` completado 2026-07-24 (verde confirmado en el log real)

**Files:** `.github/workflows/ci.yml`, `playwright.config.ts`, `lib/auth.ts`
**Esfuerzo real:** ~1 sesión larga — tres hallazgos reales encadenados, ninguno anticipado en el
plan original. El checkmark verde de GitHub Actions mintió dos veces seguidas (`continue-on-error`
lo enmascaraba); la verificación de verdad fue siempre leer `gh run view --log`, nunca el ✓.

⚠️ **Dos supuestos de esta tarea resultaron falsos al verificar contra la ejecución real de CI
— quedan documentados para que el siguiente lector no los repita:**

1. **Este repo nunca ha usado Pull Requests** (`gh pr list --state all` → vacío; un solo merge
   commit local en todo el historial). Gatear a `pull_request`, como decía el plan original,
   habría dejado el E2E tan muerto como estaba — exactamente el bug que esta tarea corrige.
2. **`FIREBASE_SERVICE_ACCOUNT_KEY` no está configurado en el repo** (`gh secret list` → vacío).
   GitHub Actions **nunca ha desplegado nada** — todo el historial de deploys ha sido manual vía
   `npm run deploy:hosting`. Esto es una decisión del dueño, no algo que este plan decida.
   → **Resuelto el 2026-07-27** (con auto-deploy completo aprobado por el dueño): ver
   "Cierre del gap de `FIREBASE_SERVICE_ACCOUNT_KEY`" al final de la Task 3, incluidos los
   cuatro bugs que el pipeline escondía y que aparecieron al probar la credencial.

Consecuencia práctica: sin esa credencial, la condición real de "Build Next.js App"
(`pull_request || (need_hosting && !firebase_credentials.available)`) es **`true` en cada push
normal a `main`**. El E2E se cuelga del mismo gate — corre cada vez que hay un build real que
probar, sin importar el tipo de evento.

- [x] `ci.yml`: "Install Playwright Browsers" + "Run Playwright E2E" + "Upload Playwright report",
      insertados después de "Build Next.js App", con el **mismo `if`** que ese paso (no
      `pull_request` a secas).
- [x] `npx playwright install --with-deps chrome` — no `chromium`. La config ya usa
      `channel: "chrome"`; instalar el paquete genérico habría dado "browser not found" en el
      primer run, disfrazado de error de configuración.
- [x] `webServer` en `playwright.config.ts`: `npm run start` cuando `CI` está seteado (sirve el
      build real de webpack que ya hizo el paso anterior del mismo job); `npm run dev` en local
      para no romper el flujo cómodo que ya existía. Antes decía `command: "npm.cmd run dev"`
      a secas — **hardcodeado a Windows, tronaba en `ubuntu-latest`** sin que nadie lo hubiera
      notado porque el paso nunca había corrido en CI.
- [x] `continue-on-error: true` en el primer run (sin PR que sirva de "run de prueba" real, esta
      fue la forma de probarlo sin arriesgar bloquear el pipeline). Pendiente quitarlo una vez
      confirmado en verde — ver nota abajo.
- [x] Reporter HTML agregado (`[["github"], ["html", ...]]`) — sin esto, `Upload Playwright
      report` no tenía nada que subir; el reporter `"github"` solo anota, no genera archivos.
- [x] Confirmados en verde los 2 specs de accesibilidad existentes, corriendo local dos veces:
      contra `next dev` (`npm run test:e2e`) y contra `next start` con `CI=true` (simulando
      exactamente el paso de CI) → 4 passed, 4 skipped (proveedores se salta sin
      `PLAYWRIGHT_STORAGE_STATE`, como está diseñado) en ambos casos.

**Verificación:** sin PRs en este repo, la verificación real es el propio run de push a `main`.

#### Hallazgo 3 — `need_hosting` no bastaba como gate: un cambio "solo en tests" nunca corría nada

`determinarTargetsDeploy()` ignora a propósito `e2e/`, `tests/`, `docs/` y `playwright.config.ts`
para no disparar un redeploy de hosting por cambios que no tocan la app — correcto para el
deploy. Pero "Build Next.js App" y los pasos de Playwright reusaban ese mismo `need_hosting`
como gate: un commit que solo tocara `e2e/` (como el propio Task 3 que sigue) nunca iba a generar
un build contra el cual correr Playwright — el mismo bug que esta tarea corrige, reintroducido
por su propio fix. Se separó en dos flags en el paso "Determine Firebase deploy targets":
`need_hosting` (deploy, sin tocar) y `need_build_verify` (build+E2E; también `true` si cambian
archivos bajo `e2e/` o `playwright.config.ts`).

#### Hallazgo 4 — el primer run "verde" no lo era: `continue-on-error` mentía

El primer push con Playwright real mostró ✓ en todos los pasos, pero el log crudo
(`gh run view --log`) decía **4 failed, 4 skipped, 0 passed** — `continue-on-error: true`
absorbe la falla y el checkmark no lo refleja. Las capturas del artifact (`Upload Playwright
report`) mostraban "This page couldn't load" — un error de conexión del navegador, no un crash
de React. Hipótesis inicial (descartada con evidencia): `next start` sin host explícito
escuchando solo en IPv6 en `ubuntu-latest` mientras Chromium resuelve `localhost` a IPv4
primero — se agregó `-H 0.0.0.0` de todas formas (higiene correcta, no dañina), pero el log del
siguiente run mostró `✓ Ready in 140ms` con `Network: http://0.0.0.0:3000` **antes** de que los
tests arrancaran: el bind nunca fue el problema.

#### Hallazgo 5 — la causa real: `getAuth()` sin `NEXT_PUBLIC_FIREBASE_*` tumba toda la página

`gh secret list` confirmó que ni siquiera los secrets `NEXT_PUBLIC_FIREBASE_*` (config pública
del cliente, no sensible) están configurados — el build de CI corre con `apiKey: ""`. Diagnóstico
reproducido **localmente**, sin depender de otro run de CI: build con las mismas env vars vacías
que usa `ci.yml` + un script de una vez con `page.on("pageerror", ...)` capturó
`Firebase: Error (auth/invalid-api-key)`, con el HTML resultante marcado
`id="__next_error__"` — el error boundary global de Next.js atrapando una excepción no
controlada. Rastreado a `useUsuario()` en `lib/auth.ts:78`: llama `getClienteAuth()` (→
`getAuth()`, que valida la API key sincrónicamente) dentro de un `useEffect` sin try/catch.

Esto **no es un problema exclusivo de CI** — viola directamente la regla de CLAUDE.md "un fallo
de red o de sistema nunca rompe la UI visualmente": cualquier usuario real con Firebase mal
configurado vería la misma pantalla rota. Fix aplicado en `lib/auth.ts`: try/catch alrededor de
`getClienteAuth()`/`onAuthStateChanged`; si falla, degrada a "sin sesión, no cargando" en vez de
propagar la excepción (`AuthGuard` ya maneja `usuario === null` redirigiendo a `/login`).

**Verificado sin tocar ningún secret de GitHub** — se reprodujo el build exacto de CI localmente
(mismas env vars vacías) antes y después del fix: 4 failed → 4 passed. Confirmado también en CI
real (run `30135083901`): `gh run view --log` → `4 skipped`, `4 passed (11.8s)`, cero failed.

- [x] `continue-on-error: true` **retirado** del paso "Run Playwright E2E" — el run en verde real
      (no solo el checkmark) ya está confirmado.

---

### Task 3: E2E del camino del dinero — `[x]` completado 2026-07-25, los 5 pasos verdes

**Files:** `e2e/camino-dinero.spec.ts` (`e2e/auth.setup.ts` se escribió y luego se eliminó — ver
corrección de `storageState`/IndexedDB más abajo)
**Esfuerzo:** ~3 noches. **Es la tarea más grande del plan**, no una de seis chicas.

✅ **Decidido (2026-07-24):** usuario de prueba con email/password en `smv-brain-dev`, opción
recomendada — el bypass invalida medio recorrido y el `storageState` manual se pudre sin avisar.

- **Correo:** `admin@smv-hub-e2e.local` (dominio inexistente a propósito — nunca recibe correo real).
  `admin` a secas no sirve: Firebase Auth exige formato de email válido.
- **Password:** debe tener 6+ caracteres — Firebase Auth rechaza `admin` solo por corto
  (`auth/weak-password`). Usar algo simple pero válido, p. ej. `admin1234`; guardarlo **solo**
  como secret de GitHub (`E2E_TEST_USER_PASSWORD`) y en `.env.local` local — nunca en el repo.
- ~~Falta crear el usuario en `smv-brain-dev`~~ — creado 2026-07-25 vía `scripts/crear-usuario-e2e.mjs`.

⚠️ **Corrección 2026-07-25 — `smv-brain-dev` no existía.** El proyecto Firebase de dev descrito
en `docs/infra/firebase-dev-project.md` nunca se había creado (dev local venía apuntando a
`smv-brain` de producción todo este tiempo, sin que nadie lo notara porque nunca hubo un test que
escribiera datos). Se creó de cero por CLI + llamadas REST directas a las APIs de Google Cloud
(el CLI de Firebase no cubre todo el flujo):

- Proyecto GCP/Firebase `smv-brain-dev` (`firebase projects:create`).
- Firestore, base nombrada `compras-americanas`, región `nam5` (igual que prod) + reglas e
  índices desplegados.
- **Facturación vinculada** — con autorización explícita del usuario, se vinculó la misma cuenta
  de facturación que ya usa `smv-brain` en producción (`billingAccounts/01ADC9-BA5EDD-BD0880`).
  Fue necesario porque el bucket de Storage por defecto todavía depende del mecanismo legado de
  App Engine, que exige facturación activa incluso dentro de cuota gratis Spark.
- Storage: bucket por defecto creado vía `firebasestorage.googleapis.com` (API de consola, no
  tiene comando CLI) + reglas desplegadas.
- Authentication: proveedor Email/Password habilitado, `localhost`/`127.0.0.1` añadidos a
  `authorizedDomains` (si no, el SDK bloquea el flujo aunque sea password, no OAuth).
- App Web registrada para sacar el `firebaseConfig` real (`apiKey`, `appId`, etc.) para
  `.env.local`.

`docs/infra/firebase-dev-project.md` queda desactualizado en el paso "Crear el proyecto (una vez,
en consola)" — en la práctica se hizo 100% por API/CLI, cero clicks en la consola. Pendiente
actualizar ese doc si se repite el proceso alguna vez (otro entorno, ej. staging).

⚠️ **Corrección 2026-07-24 sobre esta nota** (verificado leyendo el código real antes de
construir sobre el plan): `AUTHORIZED_EMAILS_EXTRA` **no existe en ningún lugar del código** —
`grep` solo lo encuentra en este plan y en `AGENTS.md`. Es una suposición del plan original que
ya estaba obsoleta: la autorización real desde la auditoría de julio pasa por
`verificarUsuarioAutorizado()` (`lib/api-auth.ts:28`) → `obtenerUsuarioAdmin()`
(`lib/usuarios-admin.ts:38`), que exige que exista el doc `usuarios/{uid}` en Firestore con
`activo: true` (o el correo break-glass). No hay whitelist por variable de entorno.

Mejor noticia: `crearUsuarioAdmin()` (`lib/usuarios-admin.ts:127`) ya resuelve las tres cosas
que el usuario de prueba necesita **en una sola llamada** — crea la cuenta de Auth, estampa los
custom claims (`smvHubActivo`, `smvHubModulos`) vía `sincronizarClaimsAcceso()`, y crea el doc
`usuarios/{uid}` con `activo: true` y los módulos de la plantilla. No es importable desde un
script `.mjs` suelto (usa alias `@/lib/...`), así que el script de creación replica esa misma
secuencia seguiendo el patrón de `scripts/backfill-claims-usuarios.mjs`.

1. **Tener el doc `usuarios/{uid}` con `activo: true`** — reemplaza la whitelist inexistente.
2. **Tener el claim `smvHubActivo: true`**: `storage.rules:26` lo exige para subir la imagen de
   la factura. Lo estampa el script al crear el usuario (mismo paso que `sincronizarClaimsAcceso`).
3. **Tener los módulos del recorrido** en `modulos[]`: `nueva-compra`, `ordenes` y `reportes`.
   Plantilla `compras` los cubre.

Sin (1) `/api/extraer` falla con 403 y las reglas de Firestore bloquean `ordenes`; sin (2) falla
la subida a Storage antes de llegar a la IA; sin (3) `AuthGuard` lo saca de la ruta.

⚠️ **Corrección 2026-07-25 sobre App Check** — la nota original decía que estar desactivado en
`firestore.rules`/`storage.rules` bastaba para no bloquear a Playwright. Cierto para las reglas,
pero el **SDK cliente** de App Check no lo sabe: si `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` y
`NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN` están seteados en `.env.local` (heredados de cuando
apuntaba a `smv-brain` de prod, donde sí están registrados) pero el proyecto destino
(`smv-brain-dev`) nunca tuvo App Check configurado, `initializeAppCheck()` reintenta el canje de
token contra un 403 sostenido y **satura el hilo del navegador headless** — cualquier comando de
Playwright después de eso (`page.route()`, `page.goto()`, etc.) se cuelga indefinidamente, sin
error visible, hasta el timeout del test. Costó ~40 min de diagnóstico (trace + screenshot en el
momento exacto del timeout) llegar a esto. Fix aplicado en el spec: abortar las llamadas a
`content-firebaseappcheck.googleapis.com` con `page.route(...).abort()` antes de todo lo demás —
seguro porque las reglas ya ignoran App Check.

⚠️ **Corrección 2026-07-25 sobre el `storageState` de `auth.setup.ts`** — el diseño original
(proyecto "setup" separado + `page.context().storageState()` + `dependencies: ["setup"]` en
"money-path") **no funciona con Firebase Auth**: la sesión vive en IndexedDB, que
`storageState()` no serializa (solo cookies + localStorage). El storageState resultante quedaba
vacío de todo lo de `localhost` y el proyecto "money-path" arrancaba deslogueado. Se eliminó
`e2e/auth.setup.ts` y el proyecto "setup"; el login ahora ocurre dentro del propio
`camino-dinero.spec.ts`, en la misma página/contexto, al inicio del test (~3s de costo, aceptable
para un spec que ya es lento por naturaleza).

Y el checkbox "Notificar por WhatsApp al guardar" en `/nueva-compra` está **marcado por default**
y abre `window.open()` + escribe al portapapeles al guardar — el spec lo desmarca antes de
guardar para no pelear con una pestaña nueva en medio del test.

- [x] Login real dentro del propio spec (no un proyecto "setup" separado — ver corrección arriba).
- [x] Stub de la llamada a Gemini vía `page.route('**/api/extraer', …)` devolviendo una
      `ExtraccionInvoice` fija. No se prueba la IA; se prueba qué hace la app con su respuesta.
- [x] **Paso 1 — captura:** `/nueva-compra`, subir imagen, verificar que el form se llena con los
      datos del stub, guardar.
- [x] **Paso 2 — la orden existe:** `/ordenes`, buscar por número de factura, abrir el detalle,
      verificar proveedor y total.
- [x] **Paso 3 — el reporte cuadra (el que atrapa el bug del envío):** `/reportes` con el
      periodo correcto. Aserción: el total del KPI **incluye el envío**. Este es el paso que
      justifica todo el E2E. Maneja también el caso "periodo sin compras" (FranjaKpis no se
      renderiza si `lineas.length === 0` — ver `ReporteView.tsx:188`), necesario porque
      `smv-brain-dev` arrancó vacío.
- [x] **Paso 4 — el filtro de moneda filtra (el otro P1):** completado 2026-07-25 como segundo
      `test()` en el mismo describe (`mode: "serial"`, comparte worker con pasos 1-3 sin correr en
      paralelo contra la misma base). Crea una orden USD (100) y una MXN (500) reales, cambia el
      `<select>` de `/reportes` → "Reporte Gerencial & Filtros" y verifica que el KPI **cambia al
      valor exacto de cada moneda** (100 y 500), no solo que el `<select>` cambia de opción.
      Decisión de alcance: se probó el filtro de moneda de `ReporteView.tsx` (el panel "Reporte
      Gerencial & Filtros" que ya usan los pasos 1-3), no el de `DashboardInteligenciaCompras.tsx`
      ("Dashboard Inteligencia 3-Tier", la otra pestaña) — ese segundo componente lee de una
      colección espejo (`compras_proveedor`) que requiere un botón de sincronización manual en
      `/proveedores` (`sincronizarComprasDesdeOrdenes()`), no se alimenta directo de `ordenes`.
      Meter esa dependencia cruzada de página hacía el test mucho más lento y frágil para
      guardar el mismo patrón de bug (filtrar por moneda activa sin mezclar montos).
- [x] **Paso 5 — cierre contable acotado:** completado 2026-07-25, mismo test que el paso 4
      (reutiliza las dos órdenes ya creadas). `/reportes/contable`, selecciona USD, clic en
      "Cerrar Reporte" → el diálogo de confirmación (`AlertDialog` de shadcn/ui) menciona
      explícitamente "MXN" y "seguirán pendientes" antes de confirmar. Tras confirmar: la orden
      USD desaparece de "Nuevos (Pendientes por Enviar)", la orden MXN **sigue apareciendo** — la
      aserción que de verdad atrapa el bug (archivar todas las monedas de un jalón). Detalle de
      limpieza: `reportes_contables` tiene `allow update, delete: if false` en `firestore.rules`
      (un lote cerrado es inmutable por diseño, ni un super-admin puede borrarlo desde el
      cliente) — el spec borra el lote que crea con Admin SDK en el `finally` (mismo patrón de
      credenciales que `scripts/crear-usuario-e2e.mjs`), con degradación segura: si no hay
      `GOOGLE_APPLICATION_CREDENTIALS` (p. ej. en CI todavía sin ese secret), el lote queda
      huérfano pero el test no falla por eso — las aserciones funcionales ya corrieron.
- [x] Limpieza: el spec borra las órdenes que creó en un `finally` (incluye las de pasos 4-5) y el
      lote contable del paso 5. Verificado con **dos corridas seguidas de los 5 pasos** + query
      directa a Firestore confirmando 0 órdenes `E2E-*` y 0 lotes en `reportes_contables`
      remanentes en `smv-brain-dev`.

**Verificación:** `npm run test:e2e -- --project=money-path` local, dos corridas consecutivas en
verde (2 tests, ~38-44s el par) contra `smv-brain-dev` real. **Verificación en CI, 2026-07-25**:
simulado localmente el entorno exacto de CI (`CI=true` → `next start` sirviendo un build real,
no `next dev`) y las mismas variables que el job usa — 2/2 verde en 1.3 min.

**Gap de CI cerrado (2026-07-25):** al configurar `E2E_TEST_USER_PASSWORD` se descubrió que el
paso "Build Next.js App" tenía `NEXT_PUBLIC_FIREBASE_PROJECT_ID: smv-brain` hardcodeado — con el
secret puesto pero el build apuntado a producción, "money-path" habría pasado de saltarse en
silencio a **fallar** en CI (login contra un usuario que solo existe en `smv-brain-dev`). Fix: se
creó un segundo set de secrets (`E2E_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_STORAGE_BUCKET`,
`_MESSAGING_SENDER_ID`, `_APP_ID`, valores de `smv-brain-dev`) y se apuntó **solo el paso de
build de verificación** de `ci.yml` a `smv-brain-dev` — ese build nunca se despliega (el deploy
real usa su propio build interno vía `firebase deploy --project smv-brain`, sin tocar), así que
no había conflicto. Se omitió a propósito `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` en ese paso: sin ella
el SDK de App Check ni intenta inicializarse (`lib/app-check.ts`), evitando por completo el
cuelgue de reintentos 403 documentado arriba, sin depender solo del `page.route(...).abort()` del
spec. `E2E_TEST_USER_PASSWORD` también se agregó al `env:` del paso "Run Playwright E2E" (antes
solo estaba disponible como secret del repo, no expuesto a ese paso — sin esto el test seguiría
saltándose aunque el secret existiera).

**Cierre del gap de `FIREBASE_SERVICE_ACCOUNT_KEY` (2026-07-27).** Se creó el service account
`github-actions-deploy@smv-brain.iam.gserviceaccount.com` con los roles necesarios para
`firebase deploy` (`firebase.admin`, `cloudfunctions.admin`, `run.admin`,
`artifactregistry.admin`, `cloudbuild.builds.editor`, `iam.serviceAccountUser`,
`storage.admin`) y se subió su key como el secret. Probando esa credencial con deploys reales
contra `smv-brain` **aparecieron cuatro bugs independientes que tenían el pipeline muerto en
silencio** — todos corregidos y verificados:

1. **El gate de `ci.yml` apagaba el E2E justo al desplegar.** Los pasos de build/Playwright
   exigían `!(need_hosting && firebase_credentials.available)` para no compilar dos veces.
   Con `available` siempre `false` (secret inexistente) el E2E corría; **en cuanto existiera el
   secret**, cualquier push que tocara código de app habría saltado build+E2E y desplegado a
   producción sin verificar nada — el inverso exacto del propósito de esta Task. Configurar el
   secret sin esto habría sido un retroceso neto. Commit `7fc0c2f`.
2. **`functions/src/index.ts` no llamaba a `initializeApp()`.** `odooSync.ts` y
   `odoo-compras-sync.ts` hacen `getFirestore()` a nivel de módulo; el CLI hace `require()` del
   bundle en su fase de discovery y tronaba con "The default Firebase app does not exist".
   Efecto: **ningún deploy de functions podía completarse, ni manual ni por CI** — las funciones
   de sync con Odoo llevaban tiempo sin poder desplegarse. Commit `11aa3d3`.
3. **Los targets de functions no llevaban el codebase.** `firebase.json` declara codebase
   `smv-hub`, pero `firebase-deploy-targets.mjs` emitía `functions:<nombre>`, que hace filtrar
   contra el codebase `default` (inexistente aquí) y **aborta el deploy completo** —
   incluyendo hosting y rules en la misma invocación — con "No function matches given --only
   filters". Formato correcto: `functions:smv-hub:<nombre>`. Commit `a86eec4`.
4. **`hosting` vía Firebase Web Frameworks tiene un conflicto de dependencias upstream sin
   solución con la versión actual de Next.js.** `firebase-tools` inyecta `firebase-frameworks`
   en el `package.json` que genera para empacar el backend SSR — la versión es
   `DEFAULT_FIREBASE_FRAMEWORKS_VERSION = "^0.11.0"`, **hardcodeada en el propio CLI**, sin
   importar lo que declaremos nosotros. `firebase-frameworks@0.11.8` trae un peerDependency
   `sharp@^0.32 || ^0.33`; `next@16.2.9` quiere `sharp@^0.34.5`. Los rangos **no se traslapan** —
   no existe una versión de `sharp` que satisfaga a ambos, y por lo tanto ningún lockfile puede
   quedar consistente con los dos presentes a la vez.

   Se intentó (y se descartó, en ese orden): (a) declarar `firebase-frameworks`/
   `firebase-functions` nosotros mismos + `overrides` para `@emnapi/*` — "arregla" el síntoma
   original (`Missing: @opentelemetry/api`/`@emnapi/runtime from lock file`) pero un `overrides`
   global destruye copias anidadas que ya satisfacían pines exactos de otros paquetes
   (`@rolldown/binding-wasm32-wasi`, `@unrs/resolver-binding-wasm32-wasi`), cambiando el error en
   vez de resolverlo; (b) regenerar el lock con `npm install --package-lock-only` — deja el árbol
   incompleto incluso corriendo de verdad en un runner `ubuntu-latest` (le faltaba hasta
   `semver`, sin relación con nada de esto); (c) un `npm install` real seguido de `npm ci` **en el
   mismo job, misma máquina** — confirmó el conflicto real de una vez por todas:
   `Invalid: lock file's sharp@0.34.5 does not satisfy sharp@0.33.5` y toda la cascada de
   `@img/sharp-*`. Ninguna de las tres cosas es arreglable ajustando nuestro propio lockfile: el
   sistema de restricciones no tiene solución mientras `firebase-tools` no actualice ese pin (el
   CLI mismo avisa: "known to work with Next.js version 12 – 16.0" — 16.2.9 ya quedó fuera de ese
   rango).

   **Decisión:** revertir `package.json`/`package-lock.json` al estado previo (idéntico a
   `7fc0c2f`, que sí pasó en CI real el 2026-07-25) y **excluir `hosting` del `--only` del deploy
   automático** en `ci.yml` — no del paso de build/E2E de verificación, que sigue corriendo igual
   para cualquier cambio de app. `functions`/`firestore:rules`/`storage` sí se automatizan (los 3
   ya verificados con la credencial nueva). `hosting` sigue siendo `npm run deploy:hosting`
   manual, como siempre ha sido. Commit `b666eda`.

   Alternativas para retomar esto más adelante, si interesa: revisar si una versión más nueva de
   `firebase-tools` sube `FIREBASE_FRAMEWORKS_VERSION` a algo compatible con `sharp@^0.34`, o
   fijar `next` a `16.0.x` (no recomendado, toca toda la app). Ninguna se investigó a fondo — es
   trabajo futuro, no bloquea lo demás.

Validación de la credencial: `firestore:rules`, `storage` y `functions:smv-hub:*` desplegaron de
verdad contra `smv-brain` con la key nueva — los tres targets que sí se automatizan. `hosting`
queda fuera del automatismo por el bug 4, documentado arriba; no es un problema de permisos ni de
la credencial (habría fallado igual con cualquier identidad). Las correcciones 1-3 (`7fc0c2f`,
`11aa3d3`, `a86eec4`) están verificadas localmente pero **aún no han pasado un run verde real en
CI** al momento de escribir esto — el primer push que las ejerce de verdad es el que sigue a este
commit.

**Prueba de que el test sirve (pendiente de ejecutar):** revertir a mano el ajuste de envío en
`aplanarLineas`/`calcularKpis` (`lib/reportes.ts`) y confirmar que el paso 3 falla.

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
Task 0 ✅ → Task 1 ✅ → Task 2 ✅ → Task 3 ✅ (5/5 pasos, verde en CI real desde 2026-07-25)
                  ↘ Task 4, Task 5, Task 6 (independientes entre sí)
```

Tasks 4, 5 y 6 no dependen de nada y se pueden hacer en cualquier orden o en paralelo.

Task 3 ya corre en CI de verdad: `E2E_TEST_USER_PASSWORD` + 5 secrets `E2E_FIREBASE_*` (config
de `smv-brain-dev`) configurados, y el paso "Build Next.js App" de `ci.yml` apuntado a
`smv-brain-dev` solo para la verificación que alimenta a Playwright (el deploy real a
`smv-brain` no se tocó).

El gap de `FIREBASE_SERVICE_ACCOUNT_KEY` (Task 2) quedó **cerrado el 2026-07-27**: CI ya puede
desplegar a producción por sí solo. Al probar la credencial salieron cuatro bugs que tenían el
pipeline muerto en silencio — el gate de `ci.yml` que habría apagado el E2E justo al desplegar,
un `initializeApp()` faltante que impedía **cualquier** deploy de functions, targets de functions
sin el prefijo de codebase que abortaban el deploy completo, y un lockfile incompleto para Linux
que tumbaba el build SSR de hosting. Detalle y commits en la sección final de la Task 3.

## Criterio de salida del plan completo

Un bug de moneda o de monto introducido a propósito **rompe CI**. Hoy es imposible por
construcción.
