# Auditoría SaaS de 16 capas — SMV Hub

**Fecha:** 2026-09-18 · **Commit auditado:** `094cdd75` (main, árbol limpio)
**Método:** inspección directa del repo (config, rules, Route Handlers, lib/, functions/, CI) +
Triple Validación ejecutada en local.

## 1. Resumen ejecutivo

**Puntuación: 11 / 16 capas robustas · 4 parciales · 1 crítica.**

SMV Hub está muy por encima de un proyecto "vibe coded": tipado estricto real (0 `any`,
0 `TODO`), 1,571 tests unitarios en verde, 1,382 líneas de Firestore Rules con default-deny
y validadores por colección, auth server-side en los 30 Route Handlers, CI con lint + tsc +
tests + emulador + Playwright, y sync con Odoo con estado de error persistido.

Lo que lo separa de "SaaS de producción sin pendientes" son **dos cosas concretas y
arreglables esta semana**:

1. **`next@16.2.9` tiene 11 advisories abiertas, 2 de ellas RCE no autenticado** — y una
   (Image Optimization con AVIF) aplica porque `/_next/image` está activo y `next/image`
   se usa en 2 componentes. Fix: `next@16.3.5`.
2. **`/nueva-compra` manda 10.5 MB de JavaScript al navegador** (1.2 MB gzip) porque el
   catálogo SAT completo (~52k claves) se empaqueta en el cliente vía
   `lib/sat/validar-clave.ts` → `lib/sat/catalogo.ts` → `data/sat/catalogo.json`. Las demás
   rutas pesan ~1.3 MB. Es la pantalla que se usa desde el celular en el taller.

### Triple Validación

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ 0 errores |
| `npm run lint` | ✅ 0 warnings |
| `npm test` | ✅ 161 archivos · 1,571 tests passed · 37 skipped (4 archivos de emulador, corren en CI) |
| `npm run build` | ✅ compila; verificador de bundle SSR OK; **chunk cliente de 10.7 MB** (ver capa 3) |

## 2. Matriz semáforo

| # | Capa | Estado | Evidencia |
|---|---|---|---|
| 1 | Diseño del sistema | 🟢 | `lib/schemas.ts` (1,660 líneas) es la única fuente de verdad; `OrdenCompra = ExtraccionInvoice + CamposManual`; ciclo del dato documentado (captura → validación Zod → Firestore → auditoría → cierre contable). Specs en `docs/superpowers/specs/`. |
| 2 | Arquitectura y modularidad | 🟡 | Separación `app/` (UI) · `lib/` (dominio + Firestore) · `functions/` (ETL) se respeta: solo 3 archivos de UI importan `firebase/firestore` directo. Pero hay 8 componentes de más de 1,000 líneas (`app/usuarios/page.tsx` 1,933; `RequisicionesList.tsx` 1,521; `NuevaCompraForm.tsx` 1,363). |
| 3 | Frontend producción | 🔴 | **`/nueva-compra` carga 12.1 MB de JS** (otras rutas: 1.3 MB) por el catálogo SAT en el bundle cliente. Aparte de eso: `Skeleton` en 11 archivos, `ModuleEmptyState` en 15, `app/error.tsx` + `app/loading.tsx` de raíz, Web Vitals a Analytics (`lib/ux-telemetry.ts`). Falta `app/global-error.tsx` (un error en el layout raíz = pantalla blanca). |
| 4 | APIs y backend | 🟢 | 30/30 Route Handlers pasan por `verificarUsuarioAutorizado` / `verificarModulo` / `verificarSuperAdmin` (`lib/api-auth.ts`, Result Type). 20 rutas validan body con Zod; las 10 restantes son GET con query params o FormData con validación manual de tipo/tamaño (`/api/extraer`: MIME + 10 MB). `/api/scrape` con whitelist de hosts y protección contra redirect fuera de la lista. `maxDuration` alineado a Hosting (120 s). |
| 5 | Bases de datos | 🟡 | 10 índices compuestos + 3 overrides en `firestore.indexes.json`; `writeBatch` en 12 módulos, `runTransaction` en 5; sin patrones N+1 detectados en `lib/`. **Riesgo:** la recepción en almacén (`lib/abastecimiento-server.ts`) hace *read → check 409 → batch* sin transacción ni precondición: dos clics simultáneos (o `recibir-lote`) pueden duplicar la entrada. |
| 6 | Auth y RBAC | 🟢 | "Never trust the client" cumplido: token verificado en servidor + doc `usuarios/{uid}` activo + módulos; Firestore Rules default-deny con 45 funciones helper y validador de forma por colección; Storage con custom claims (`smvHubActivo`, `smvHubModulos`); break-glass sincronizado en 4 lugares; tests de rules en emulador en CI. App Check apagado a propósito (documentado, 3 interruptores). |
| 7 | Hosting e infra | 🟢 | Secretos en Secret Manager (`HUB_GEMINI_API_KEY`, `FINANZAS_*`), `.env*` y `*-key.json` en `.gitignore`, 0 llaves hardcodeadas, `obtenerGeminiApiKey()` como único punto de lectura. Timeouts: `AbortSignal.timeout(60s)` en Gemini, `frameworksBackend` 1 GiB / 120 s. Único `process.env` fuera de `NEXT_PUBLIC_` vive en módulos que solo importan Route Handlers. |
| 8 | CI/CD y versionado | 🟢 | `ci.yml`: lint → tsc → tests (coverage en PR) → rules en emulador (JDK 21) → build → Playwright (money-path contra `smv-brain-dev`) → Lighthouse → deploy selectivo por archivos cambiados, hosting excluido a propósito. Actions pineadas por SHA, `permissions: contents: read`, `concurrency` con cancel. 24/30 commits recientes siguen Conventional Commits. **Pendiente conocido:** deploy de Functions falla 403 por IAM Secret Manager. |
| 9 | Seguridad (OWASP) | 🟡 | Inputs validados en borde; un solo `dangerouslySetInnerHTML` (SVG de QR generado localmente, `GafetesView.tsx:206`); sin CORS abierto. **Faltan headers de seguridad**: ni `next.config.ts` ni `firebase.json` definen CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. Y **`next@16.2.9` con 11 advisories** (2 RCE, SSRF, cache confusion, DoS) + `postcss` high transitivo — todo se resuelve con `next@16.3.5`. `exceljs` moderate sin fix upstream. |
| 10 | Rate limiting y cuotas | 🟡 | `lib/rate-limit-memoria.ts` (20 req/min por uid, en memoria) solo protege `busqueda-semantica` y `memoria-operativa/consultar`. Las 7 rutas que gastan Gemini (`extraer`, `extraer-lote`, `sugerir-clave-sat`, `clasificar-items`, `proveedores/investigar`, `cotizaciones/extraer`, `documentos-venta/extraer-po`) dependen solo de auth + módulo. Sin límite por usuario, un token válido puede vaciar la cuota de Gemini. |
| 11 | Caché y CDN | 🟡 | `lib/cache-query-cliente.ts` (SWR en memoria, TTL 30 s) y `localStorage` en 6 módulos para preferencias. Firestore **sin `persistentLocalCache`** → sin lectura offline ni deduplicación entre pestañas; cada navegación re-lee. Assets estáticos sí van por CDN de Firebase Hosting con hash. |
| 12 | Errores y logging | 🟡 | Result Types en `api-auth.ts` y 3 módulos más; el resto usa `throw` tipado (171 `throw new Error` en `lib/`, todos atrapados en Route Handlers con respuesta JSON). Error Boundary de raíz + `/proveedores`. **Logging no estructurado:** 243 `console.error` en app/lib y 25 `console.*` en Functions (0 usos de `firebase-functions/logger`), sin correlación por request ni redacción de PII. |
| 13 | Monitoreo y alertas | 🟡 | Auditoría de acciones sensibles en 7 rutas + `auditoria` collection; syncs Odoo persisten `ultimoError`/`ultimoErrorEn` en `*_sync_state`; backups programados (`docs/infra/firestore-backups.md`); reportes de integridad con motor propio. **Nadie recibe alerta:** si el cron de Odoo falla 3 veces seguidas nadie se entera hasta abrir el panel. Sin health check, sin Sentry/Crashlytics. |
| 14 | Testing y calidad | 🟢 | 1,571 unit + 4 suites de emulador + 5 specs E2E (17 tests: money-path real, integridad, a11y con axe). Tests reflejan 1:1 los módulos de `lib/`; Route Handlers testeados con Gemini mockeado. Golden fixtures con datos reales de prod (lead time). Único hueco: `vitest.config` sin thresholds de cobertura. |
| 15 | Escalabilidad y resiliencia | 🟢 | Backoff exponencial (2 s → 4 s → 8 s, tope 30 s) en 429/5xx de Gemini; syncs Odoo con guard "nunca borrar local si Odoo devuelve 0"; ruta degradable en memoria operativa; batches de 100 para vectores; queries acotadas por rango en pantallas pesadas. Sin jitter en el backoff (menor). |
| 16 | Cultura de entrega | 🟢 | 0 `TODO/FIXME/HACK`, 0 `any`, 1 `@ts-expect-error`, 25 `eslint-disable` (bajo para 400+ archivos). `CLAUDE.md`/`AGENTS.md` con decisiones y sus porqués; specs → planes → código; comentarios explican *por qué* (ej. batches de 100, webpack vs Turbopack). |

## 3. Top 3 críticos

### 🔴 1. `next@16.2.9` — RCE no autenticado disponible públicamente

`npm audit --omit=dev`: 1 critical, 2 high, 9 moderate. Las que aplican a este deploy:

- **GHSA-2xp9-vwfh-vxw4** — RCE no autenticado en Image Optimization con AVIF. `next/image`
  se usa en 2 componentes y `images.unoptimized` no está configurado → `/_next/image` responde
  en prod.
- **GHSA-955p-x3mx-jcvp** — disclosure no autenticado de endpoints de Server Functions.
- **GHSA-68g3-v927-f742 / GHSA-4633-3j49-mh5q** — cache confusion de cuerpos de respuesta.
- **GHSA-m99w-x7hq-7vfj** — DoS vía Server Actions.
- **postcss** (high, transitivo): path traversal a `.map` — también lo arrastra el bump.

**Fix:** `npm i next@16.3.5` → tsc/lint/test/build → `npm run deploy:hosting`. Riesgo de
regresión bajo (misma minor); el build ya usa `--webpack` y el verificador de bundle avisa
si algo cambia en el empaquetado de `firebase-admin`.

### 🔴 2. Catálogo SAT de 10.5 MB en el bundle de `/nueva-compra`

Cadena: `app/nueva-compra/NuevaCompraForm.tsx:25` importa `validarClaveProdServCatalogo` de
`lib/sat/validar-clave.ts` → `findSatCatalogEntryByKey` de `lib/sat/catalogo.ts` →
`import catalogoData from "@/data/sat/catalogo.json"`. Webpack mete el JSON al chunk
`7798-*.js` (10.7 MB raw, 1.2 MB gzip) y el navegador hace `JSON.parse` de 52k entradas en el
hilo principal en cada carga fría. Solo `/nueva-compra` lo paga; las otras 27 páginas no.

Ya existe `/api/claves-sat` que sirve el catálogo desde servidor y `lib/sat/buscar.ts` que
solo debería correr ahí. Nada en `lib/` usa `import "server-only"`, así que esta clase de
fuga no la detecta el build.

**Fix (2 partes):**
1. Que `validarClaveProdServCatalogo` en cliente valide contra `/api/claves-sat?clave=…` (o
   un `Set` de claves precargado desde el API), y dejar la versión sincrónica solo para
   servidor.
2. `import "server-only"` al inicio de `lib/sat/catalogo.ts` y `lib/firebase-admin.ts`: la
   próxima vez que un componente cliente los importe, el build falla en vez de mandar 10 MB.

### 🟡 3. Recepción en almacén no es atómica

`lib/abastecimiento-server.ts:44-54` lee la orden, revisa `estadoRecepcion === "recibida"` y
lanza 409; luego arma un `writeBatch` (líneas 109-149) y hace `commit()`. Entre la lectura y
el commit no hay transacción ni precondición `lastUpdateTime`. Dos peticiones concurrentes
(doble tap en celular, o `recibir-lote` con IDs repetidos) pasan las dos el check y generan
**dos entradas de almacén para la misma orden** — justo la trazabilidad que las reglas de
negocio piden proteger.

**Fix:** envolver lectura + escrituras en `adminDb.runTransaction()` (la lectura de
`pedidos-almacen` por query también cabe dentro), o al menos `batch.update(ordenRef, …,
{ lastUpdateTime: ordenSnap.updateTime })` para que el segundo commit falle.

## 4. Plan de acción priorizado

### Quick wins (esta semana, cada uno < 2 h)

| # | Acción | Capa | Por qué |
|---|---|---|---|
| Q1 | `npm i next@16.3.5` + triple validación + `deploy:hosting` | 9 | Cierra 2 RCE y 9 advisories más de un jalón; también resuelve `postcss`. |
| Q2 | `import "server-only"` en `lib/sat/catalogo.ts` y `lib/firebase-admin.ts` | 3, 7 | Convierte fugas de servidor→cliente en error de build. Va a fallar el build hasta hacer Q3 — eso es lo que queremos. |
| Q3 | Validación de clave SAT en cliente vía `/api/claves-sat` (o `Set` de claves) | 3 | `/nueva-compra` baja de 12 MB a ~1.3 MB de JS. Es la pantalla del celular en el taller. |
| Q4 | `app/global-error.tsx` con el mismo `RouteError` | 3, 12 | Un error en el layout raíz hoy deja pantalla blanca sin botón de reintento. 15 líneas. |
| Q5 | Headers de seguridad en `next.config.ts` → `headers()`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self)` | 9 | Cero riesgo de regresión (no es CSP todavía). La cámara se usa en `ModalCamara`, por eso `camera=(self)`. |
| Q6 | `excedeLimite(uid)` en las 7 rutas que llaman Gemini | 10 | Ya existe el helper; son 2 líneas por ruta. Protege la cuota de un bug de UI en loop o de un token abusado. |
| Q7 | `runTransaction` (o precondición `lastUpdateTime`) en `recibirOrdenEnAlmacen` | 5 | Cierra el duplicado de entradas por doble clic. |

### Mejoras estructurales (siguientes 4–6 semanas)

| # | Acción | Capa | Por qué |
|---|---|---|---|
| S1 | **Alertas de sync Odoo:** en cada `onSchedule`, si `ultimoError` lleva ≥ 3 corridas seguidas, emitir notificación in-app a super-admins (ya existe `lib/notificaciones-server.ts`) y/o correo. Opcional: Cloud Monitoring alert sobre `function execution count` con status error. | 13 | Hoy un sync roto se descubre por accidente. Con `notificaciones` ya construido, el costo es bajo. |
| S2 | **Logger estructurado:** en Functions cambiar `console.*` por `firebase-functions/logger` (JSON en Cloud Logging, filtrable por severidad); en Route Handlers un `log(evento, { uid, ruta, ms })` mínimo que nunca serialice el body ni el email completo. | 12 | 268 `console.*` sin estructura no se pueden consultar ni alertar. PII (emails en mensajes de 403) hoy sí va a logs. |
| S3 | **CSP real** (`Content-Security-Policy` con nonce vía Next) después de Q5; `script-src 'self' 'nonce-…'`, `connect-src` a `*.googleapis.com`, `firebaseapp.com`, `identitytoolkit`, Odoo. | 9 | Es lo único que mitiga XSS de verdad si algún día un `dangerouslySetInnerHTML` recibe input externo. Requiere probar Google Sign-In popup y reCAPTCHA. |
| S4 | **Firestore `persistentLocalCache`** con `persistentMultipleTabManager` en `lib/firebase.ts`. | 11, 15 | Lectura instantánea al volver a una pestaña, dedupe entre tabs, y la app sigue mostrando datos si el wifi del taller parpadea. Validar contra el money-path E2E (los `onSnapshot` cambian de timing). |
| S5 | **Partir los 8 componentes de más de 1,000 líneas** empezando por `app/usuarios/page.tsx` (1,933) y `NuevaCompraForm.tsx` (1,363): extraer tabla, modal y hooks de datos a archivos hermanos, sin cambiar comportamiento. | 2 | No es deuda que rompa nada hoy, pero cada feature nueva en esas pantallas cuesta más. Es el candidato natural para `/mantenimiento-codigo`. |
| S6 | **Thresholds de cobertura** en `vitest.config.ts` (`lines: 70, branches: 60` para `lib/**`) para que CI falle si baja. | 14 | La suite es grande; lo que falta es que no se erosione en silencio. |
| S7 | **Rate limit real** (Firestore counter por uid/día para Gemini, o Cloud Armor si migra a App Hosting) sustituyendo el `Map` en memoria. | 10 | El actual se resetea en cold start y no cuenta entre instancias. Suficiente para hoy, no para cuando haya más usuarios. |
| S8 | Resolver el **403 de IAM Secret Manager** para la SA del CI (pendiente de Emiliano) para que Functions/rules vuelvan a desplegarse solos. | 8 | Hasta entonces cada cambio de rules es deploy manual — y las rules son la capa de seguridad. |

### Estado

- **Q1 — hecho (2026-09-18):** `next` y `eslint-config-next` 16.2.9 → 16.3.5 (pin exacto, como
  estaban). `npm audit --omit=dev`: critical 1 → 0, high 2 → 0, moderate 9 → 9 (cadena
  `firebase-admin@13` → requiere bump mayor a 14 y también toca `functions/`; `exceljs` sin fix
  real). La regla nueva `@next/next/no-location-assign-relative-destination` marcó 10
  `window.location.href` a rutas internas; se cambiaron a `useRouter().push()` en 8 archivos
  (navegación de cliente en vez de recarga completa; los destinos son Server Components que
  leen `searchParams`, así que reciben los params igual). Triple validación + build en verde.
  Pendiente: `npm run deploy:hosting`.

### Orden sugerido

Q1 → Q2+Q3 (van juntos) → Q7 → Q4 → Q5 → Q6 → S1 → S2 → S4 → S5 (con `/mantenimiento-codigo`)
→ S3 → S6 → S7. S8 no depende de código.

## 5. Lo que ya está bien y no hay que tocar

- Auth + rules + claims: es el estándar que uno esperaría de un SaaS con datos financieros.
- CI: pineado por SHA, deploy selectivo, E2E del camino del dinero contra dev real.
- Documentación de decisiones: `CLAUDE.md`/`AGENTS.md` explican *por qué* (webpack, batches
  de 100, App Check apagado), no solo qué.
- Higiene: 0 `any`, 0 `TODO`, tests 1:1 con `lib/`.
