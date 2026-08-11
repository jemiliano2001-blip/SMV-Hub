# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Proyecto y dominio

**SMV Hub** es la plataforma interna de SMV Maquinados (Monterrey, México): compras,
diseño, operación del taller y gestión del día a día. Empezó como registro de compras
industriales en Estados Unidos (eBay, Amazon, McMaster-Carr, Mercado Libre, etc.) con
extracción de facturas por IA; hoy agrupa módulos de compras, cotizaciones, almacén,
personal y reportes en un solo lugar.

> **Nombre técnico:** el repo y la base Firestore siguen llamándose `compras-americanas`
> (proyecto Firebase `smv-brain`). Solo el branding visible en la UI es **SMV Hub**.

Módulos actuales:

- `/nueva-compra` — captura una compra; sube la imagen de la factura y la IA extrae proveedor,
  ítems, montos y moneda.
- `/ordenes` — lista las órdenes con búsqueda de texto libre + filtros de estado por pill; detalle en modal; edición inline vía `OrdenFormModal`; bulk delete.
- `/reportes` — reporte con KPIs, tabla agrupada con subtotales y export a PDF (vía `@media print` de Tailwind). Incluye envío de reportes por correo y órdenes recurrentes. Lógica pura en `lib/reportes.ts`; UI en `app/reportes/`.
- `/reportes/contable` — cierre contable por lotes: agrupa órdenes pendientes en un
  `ReporteContableLote` (`lib/reportes-contables.ts`), traduce descripciones al español y
  sugiere/reasigna claves SAT en batch vía IA (`lib/reportes-contables-ia.ts` +
  `POST /api/retro-traducir-lote`, `POST /api/sat-descripciones`).
- `/finanzas` — facturación y cobranza de clientes sincronizada con Odoo; requiere el módulo
  `finanzas` (ver `lib/roles.ts` y `firestore.rules`). Lógica en `lib/finanzas.ts` / `lib/finanzas-facturas.ts`;
  sync en `functions/src/odooSync.ts` + `odoo-mapeo.ts`.
- `/documentos-venta` — solicitudes de documento (factura o remisión) sobre una orden de venta (SO)
  de Odoo, con flujo `pendiente → en_proceso → completada/rechazada` (`lib/schemas.ts`:
  `SolicitudDocumento`). Lógica en `lib/documentos-venta.ts`; sync de órdenes de venta en
  `lib/services/ventas-odoo-sync.ts`; API en `app/api/documentos-venta/`.
- `/caja-chica` — movimientos y arqueo de caja chica (`lib/caja-chica.ts`).
- `/claves-sat` — buscador de claves SAT (`BuscadorClavesSat.tsx`), complementa la sugerencia
  automática de `/nueva-compra`.
- `/cotizaciones` — gestión de cotizaciones; importación por CSV, tabs de estado y listado.
- `/proveedores` — catálogo de proveedores de herramienta (USA Tooling); FK opcional `proveedorId`
  en órdenes/cotizaciones; inteligencia cruzada (precios históricos, lead time, scorecards) en
  `lib/proveedores-inteligencia-cruzada.ts`. Centro de mando con paneles dedicados: compras Odoo
  (`PanelComprasOdoo.tsx`) e inteligencia 360 (`PanelInteligencia360.tsx`). El comparador de precios
  MX (`ComparadorPreciosInsumos.tsx`) solo muestra ítems de Odoo con `precioUnitario > 0`
  (`lib/compras-odoo/rangos.ts` → `esItemComprable()`); el flag `esRfq` (PO aún no aprobada en
  Odoo) **no** se usa como filtro — Odoo permite capturar precio de línea antes de aprobar la PO,
  así que una RFQ con precio real sí cuenta. Los ítems en $0 siguen visibles para clasificación IA
  y en la tabla diagnóstica de `PanelComprasOdoo.tsx`.
- `/requisiciones` — gestión de requisiciones (CRUD vía `lib/requisiciones.ts` + hook `useRequisiciones`).
  Al crear una requisición, `SeccionRecomendacionInteligente.tsx` sugiere proveedor vía
  `lib/motor-recomendador-proveedores.ts`, un motor de scoring local/cliente y transparente.
- `/almacen` — control de entradas y salidas de materiales y herramientas hacia piso. El tab
  Reabastecimiento ROP fue **retirado** el 2026-07-24 (corría sobre datos demo en producción);
  con él se eliminaron `lib/recompra-herramientas.ts` y el módulo `reabastecimiento-rop`. No
  recrearlo sin datos reales de inventario.
- `/endmills` — inventario y pedidos de fresas (endmills) importadas de China: stock, objetivo
  par, cantidad sugerida y recepción de pedidos (`lib/endmills.ts`, `lib/endmills-calculos.ts`,
  hook `useEndmills`). Módulo `endmills` (label "Endmills China" en `lib/roles.ts`). Scripts
  dedicados: `npm run endmills:import`, `endmills:verify:dev`, `endmills:assign-module`.
- `/banos` — registros de tiempos de baño, conteos diarios y agregación de resumen mensual.
- `/horas-extra` — tabla editable para seguimiento de horas extras semanales por departamento.
- `/operadores` — catálogo de personal para auto-completar en módulos operativos.
- `/usuarios` — administración de accesos y roles (solo super-admin); lógica en `lib/usuarios.ts` /
  `lib/usuarios-admin.ts`.
- `/notificaciones` — notificaciones in-app por módulo/audiencia con estado leído/no-leído
  (`lib/notificaciones.ts`). El acceso no requiere un módulo propio: se concede a quien tenga
  cualquier módulo listado como audiencia (`puedeVerNotificaciones` en `lib/roles.ts`).
- `/pedidos-almacen` — captura rápida de pedidos desde piso (encargado de almacén); CRUD en
  `lib/pedidos-almacen.ts`, colección Firestore propia `pedidos-almacen`; gated por módulo
  `pedidos-almacen` (`admin`/`compras`/`almacen`), no requiere el módulo base `almacen`.
- `/auditoria` — pantalla exclusiva de auditoría (`lib/auditoria.ts`).
- `/login` — página de inicio de sesión con Google Sign-In; redirige al home si ya hay sesión.

`POST /api/scrape` extrae precio/datos de un producto desde URLs de un whitelist de hosts
(Amazon, eBay, McMaster, MSC, DigiKey, Mouser, Home Depot, Mercado Libre) con cheerio.

El roadmap vivo está en [PROJECT.md](PROJECT.md) y los planes detallados en
[docs/superpowers/plans/](docs/superpowers/plans/).

## Comandos

```bash
npm run dev            # servidor de desarrollo en http://localhost:3000
npm run build          # build de producción (incluye verify:firebase-ssr)
npm run lint           # ESLint
npx tsc --noEmit       # verificación TypeScript sin emitir archivos
npm test               # corre la suite de Vitest una vez
npm run test:watch     # Vitest en modo watch
npm run test:coverage  # Vitest con reporte de cobertura
npm run test:rules     # Reglas de Firestore (requiere Firestore emulator corriendo)
npm run test:emulator  # test:rules + tests/reportes-integridad-emulator.test.ts
npm run test:e2e        # Playwright: pruebas de accesibilidad (axe-core) sobre login/proveedores
npm run test:e2e:headed # igual, con navegador visible

# Correr un solo archivo de pruebas (la mayoría de los archivos en tests/ reflejan 1:1 los
# módulos de lib/, pero también hay tests de Route Handlers como extraer-route.test.ts):
npx vitest run tests/reportes.test.ts

# Catálogo SAT (poblar/actualizar data/sat/catalogo.json)
npm run sat:import          # importación estándar
npm run sat:import:phpcfdi  # importación desde el catálogo phpcfdi

# Endmills (China) — inventario y pedidos
npm run endmills:import          # importa catálogo de medidas/fresas
npm run endmills:verify:dev      # verifica datos contra el emulator/dev
npm run endmills:assign-module   # asigna el módulo endmills a usuarios existentes
```

Los tests `test:rules`/`test:emulator` usan `@firebase/rules-unit-testing` y se saltan
automáticamente si no hay `FIRESTORE_EMULATOR_HOST` — para correrlos localmente:
`npx firebase-tools emulators:exec --only firestore "npm run test:emulator"`.

La suite E2E también incluye `e2e/camino-dinero.spec.ts`: usa autenticación real,
escribe únicamente en `smv-brain-dev`, stubea Gemini y valida compra → orden →
reportes/cierre contable. Requiere `E2E_TEST_USER_PASSWORD`; consulta
`docs/testing/e2e.md`.

`npm run build` corre con `--webpack` (no Turbopack) y valida el bundle después: Firebase
Hosting usa Turbopack por defecto, pero con `firebase-admin`/`firebase-functions` genera
aliases con hash que la función SSR no resuelve en producción — no lo cambies a `next build`
a secas (ver `next.config.ts` y `scripts/verificar-bundle-firebase.mjs`).

Para deploy manual de Hosting (fuera de CI) usa `npm run deploy:hosting` — fija
`--project smv-brain`, carga `.env.production` sobre `.env.local` y parchea el build a
webpack antes de correr `firebase deploy --only hosting:smv-hub` (ver `scripts/firebase-deploy.mjs`);
no uses `firebase deploy` a secas, falla por el mismo motivo que `next build` a secas. Tampoco
ejecutes `firebase deploy --only functions --force`: `smv-brain` comparte Functions con otras
aplicaciones y un deploy global puede eliminarlas. El codebase de Hub es `smv-hub`.

### Cloud Functions (`functions/`)

Build y deploy son independientes de la app Next.js — requieren `cd functions` primero:

```bash
cd functions
npm run build   # tsc → lib/
npm run serve   # build + firebase emulators:start --only functions
npm run deploy  # build + firebase deploy --only functions (usa codebase "smv-hub", ver AGENTS.md)
```

## Variables de entorno

Crea un archivo `.env.local` en la raíz (no se hace commit):

```bash
# Firebase (obtener de Firebase Console → Project Settings → Web App)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Gemini (para extracción IA de facturas — crear en Google AI Studio)
GEMINI_API_KEY=
# Opcional: override del modelo de extracción (default gemini-3.5-flash)
# GEMINI_MODEL=
# Opcional: modelo económico para sugerencia de claves SAT (default gemini-3.1-flash-lite)
# GEMINI_MODEL_SAT=
# Opcional: modelo de escalación para casos SAT ambiguos (default gemini-3.5-flash)
# GEMINI_MODEL_SAT_ESCALADO=

# Opcional: omite el login en desarrollo (ver sección Autenticación)
# NEXT_PUBLIC_DEV_AUTH_BYPASS=true

# App Check (reCAPTCHA v3) — ver docs/infra/app-check-setup.md
# NEXT_PUBLIC_RECAPTCHA_SITE_KEY=
# NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN=   # solo localhost

# Base Firestore nombrada (default compras-americanas)
# NEXT_PUBLIC_FIRESTORE_DATABASE_ID=compras-americanas

# Desarrollo: usar proyecto smv-brain-dev — ver docs/infra/firebase-dev-project.md
# NEXT_PUBLIC_FIREBASE_PROJECT_ID=smv-brain-dev
```

## Stack

- **Next.js 16.2.9** con App Router (directorio `app/`)
- **React 19.2.4** con Server Components y Server Actions
- **Tailwind CSS v4** — basado en PostCSS, sin `tailwind.config.js`; la config vive en `globals.css` vía `@theme`
- **TypeScript** en modo estricto; alias `@/*` → raíz del repo
- **Firebase v12**, **react-hook-form + zod**, **lucide-react**, **cheerio** (scraping)
- **Extracción IA: Gemini vía REST** (`generativelanguage.googleapis.com`, structured output con
  `responseSchema`), implementada a mano en `lib/extraer-ia.ts` con `fetch` — sin SDK.
- **Vitest** para pruebas

## Estructura del código

- `app/` — páginas y componentes de Next.js (App Router)
- `components/` — componentes compartidos fuera de `app/`: `components/ui/` son primitivas
  shadcn/ui sobre Radix — prefiérelas antes de crear un botón/modal/dropdown a mano;
  `BuscadorGlobalCommand.tsx` es el command palette global (Cmd+K, vía `cmdk`, montado en
  `NavBar.tsx`); `AuthProvider.tsx` / `AppCheckProvider.tsx` inicializan contexto de Firebase
  Auth / App Check; `ModalCamara.tsx` es el modal compartido de captura por cámara
  (`getUserMedia`, switch frontal/trasera); `components/finanzas/` agrupa tablas/gráficas de
  `/finanzas` (cuentas por pagar, flujo de caja, conciliación Odoo).
- `app/api/extraer/` — Route Handler POST: recibe una imagen, devuelve `ExtraccionInvoice` (una factura)
- `app/api/extraer-lote/` — Route Handler POST: recibe hasta 20 imágenes + `calidad=alta` (usa
  `gemini-3.1-pro-preview`) o sin el param (usa `gemini-3.5-flash`); devuelve `{ extracciones: ExtraccionInvoice[] }`
- `app/api/scrape/` — Route Handler POST: scrapea precio/datos de una URL de host permitido (cheerio)
- `lib/` — lógica pura, schemas Zod y acceso a Firestore:
  - `schemas.ts` — fuente de verdad de tipos; ver sección "Schemas Zod"
  - `extraer-ia.ts` — `extraerFactura()` (1 imagen→1 registro) y `extraerRegistros()` (1 imagen→N registros para tablas/listados); llama a Gemini por REST
  - `factura-montos.ts` — validación de balance de montos (subtotal+envío+impuestos≈total) con tolerancia
  - `sugerencias-compra.ts` — sugerencias inteligentes que rellenan campos vacíos desde el historial (la IA siempre tiene prioridad). Integrado en `/nueva-compra`.
  - `scrape.ts` — parseo puro de precios/datos extraídos (`parsePrice`, `priceSchema`)
  - `ordenes.ts` — CRUD sobre la colección `ordenes`; `crearOrdenesLote()` usa `writeBatch` en chunks de 400
  - `requisiciones.ts` — CRUD de requisiciones
  - `importar.ts` — helpers compartidos de parseo/validación que siguen usando Nueva Compra y Cotizaciones; la ruta legacy `/importar` fue retirada
  - `cotizaciones.ts` — CRUD sobre la colección `cotizaciones`
  - `cotizaciones-importar.ts` — parseo de CSV de cotizaciones; reutiliza helpers de `importar.ts`
  - `firestore-helpers.ts` — `makeDateConverter()` y utilidades compartidas de conversión Firestore
  - `format.ts` — `formatPrecio()` y helpers de formateo (regla de negocio: locale `es-MX`)
  - `api-auth.ts` / `authorized-emails.ts` — verificación de token + whitelist de correos en Route Handlers
  - `firebase-admin.ts` — Firebase Admin SDK (para Route Handlers y Server Actions que necesitan acceso privilegiado)
  - `reportes.ts` — lógica pura de reportes: `filtrarPorRango`, `aplanarLineas`, `agrupar`, `calcularKpis`, `periodoPreset`
  - `reportes-contables.ts` / `reportes-contables-ia.ts` — lotes de cierre contable
    (colección `reportes_contables`) y clasificación IA en batch (traducción + clave SAT)
    para `/reportes/contable`
  - `firebase.ts`, `auth.ts`, `storage.ts` — inicialización de Firebase y utilidades
  - `hooks/` — hooks de datos por módulo (`useOrdenes`, `useCotizaciones`, `useRequisiciones`, `useEndmills`)
  - `services/` — clientes autenticados para ejecutar sincronizaciones manuales con Odoo y reportes:
    `compras-odoo-sync.ts`, `finanzas-sync.ts`, `ventas-odoo-sync.ts`, `reportes-integridad.ts`
- `functions/` — Cloud Functions de Firebase (TypeScript en `functions/src/`): sincronización de
  facturas y compras con Odoo (`odooSync.ts`, `odoo-compras-sync.ts` y sus mapeos), base Firestore
  nombrada y middleware de autenticación compartido. Las Functions genéricas antiguas de compra,
  recomendación, Sheets y Excel fueron retiradas. Build/deploy aparte de la app Next.js.
- `tests/` — pruebas de Vitest; la mayoría prueban lógica pura de `lib/` sin Firebase real, pero
  `extraer-route.test.ts` y `extraer-lote.test.ts` testean los Route Handlers mockeando fetch/Gemini,
  y `lib-ordenes.test.ts` / `ordenes.test.ts` cubren la capa CRUD de Firestore
- `e2e/` — Playwright/axe para login y proveedores, el camino real del dinero, integridad de
  reportes (`reportes-integridad.spec.ts`) y accesibilidad de endmills (`endmills-accessibility.spec.ts`),
  todo contra `smv-brain-dev`; nunca debe escribir en producción
- `docs/superpowers/specs/` — diseños (qué se va a construir y por qué)
- `docs/superpowers/plans/` — planes task-by-task ejecutables
- `.agents/` — artefactos del flujo de agentes (no es código de producción)

## Reglas de calidad (no negociables)

- **Tipado estricto**: prohibido `any` y `@ts-ignore`. Si un tipo es desconocido, define una
  interfaz o un schema de Zod apropiado.
- **Validación en frontera**: toda entrada de formulario o CSV pasa por un schema de Zod
  (`lib/schemas.ts`) antes de tocar Firestore.
- **Modularidad**: los componentes de UI no importan Firestore directamente. La lógica de base
  de datos vive en `lib/ordenes.ts`, `lib/importar.ts`, etc. Los componentes reciben datos por
  props o hooks.
- **Errores silenciosos para el usuario**: un fallo de red o de sistema nunca rompe la UI
  visualmente. Usa banners con mensaje claro y botón de reintento (y Error Boundaries cuando
  aplique).
- **Preservación**: no elimines funciones, imports ni variables existentes salvo que se indique
  que están obsoletos. Prohibido dejar stubs o comentarios tipo `// resto del código aquí`:
  entrega siempre el archivo completo.

## Reglas críticas de negocio

- **Precisión financiera**: formatea montos con
  `Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda })`. Evita errores de punto
  flotante en cálculos financieros.
- **Multi-moneda**: las órdenes pueden venir en MXN o USD. **Nunca sumes `total` entre monedas
  distintas** — filtra por una sola moneda antes de agregar KPIs, subtotales o totales.
- **Trazabilidad**: `creadoEn` y `actualizadoEn` son obligatorios en toda orden. Cualquier
  cambio que altere cantidades o estado de una orden debe registrar marca de tiempo y origen.
  Prefiere `estado: "rechazada"` sobre un borrado duro cuando se busque preservar el historial.
- **Zonas horarias**: almacena timestamps en UTC en Firestore. `fechaFactura` se guarda como
  string `YYYY-MM-DD`. El formateo a hora local (`es-MX`) ocurre solo en el cliente.

## Schemas Zod

`OrdenCompra` deriva de `ExtraccionInvoiceSchema` (lo que extrae la IA) extendido con
`CamposManualSchema` (lo que captura el usuario). Para agregar un campo nuevo de captura
manual, agrégalo en `CamposManualSchema` (no en `OrdenCompraSchema`) para que se propague
automáticamente al form (`NuevaCompraFormSchema`) y a la orden guardada.

`CamposManualSchema` incluye `destino` como alias legacy de `empresa` — al guardar deben
sincronizarse. Usa `resolverCampoItem(item, orden, campo)` para obtener el valor efectivo de
un campo en un ítem con fallback a la orden, y `sincronizarCamposLegacyOrden()` para propagar
desde el primer ítem a los campos de nivel orden.

Otros schemas clave en `lib/schemas.ts`:

- **`CotizacionSchema`** — modelo plano: 1 fila = 1 pieza + 1 proveedor. `ubicacion: "MX"|"USA"`
  determina la moneda (`MXN`/`USD`). `estatus: "cotizado"|"cancelado"|"revisar"`.
- **`RequisicionSchema`** — `tipo: "general"|"automatizacion"` controla qué campos son visibles
  en la UI. `estado: "no_comprado"|"en_proceso"|"comprado"|"parcial"|"recibido"`. Los campos
  `parteNumero` y `fechaEntregaEst` aplican solo cuando `tipo === "automatizacion"`.
- **`SolicitudDocumentoSchema`** — solicitud de documento (factura/remisión) sobre una orden de
  venta de Odoo para `/documentos-venta`. `tipo: "factura"|"remision"`,
  `estado: "pendiente"|"en_proceso"|"completada"|"rechazada"`.

## Next.js 16 — leer esto antes de escribir código de Next.js

Esta versión tiene breaking changes respecto a tu conocimiento previo. Antes de tocar routing,
caching o data-fetching, lee la guía relevante en `node_modules/next/dist/docs/01-app/`.

### `params` es una Promise

Los route params y search params ahora son Promises. Siempre haz `await`:

```tsx
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
}
```

### El modelo de caché — `cacheComponents` NO está activo en este repo

`next.config.ts` solo tiene `serverExternalPackages`; **no** hay `cacheComponents: true`. Las
directivas `'use cache'`, `cacheLife(profile)` y `cacheTag(tag)` (que reemplazarían los viejos
exports de configuración de segmento — `dynamic`, `revalidate`, `fetchCache`) quedan inertes si
las escribes — no uses ese patrón a menos que primero actives `cacheComponents` en
`next.config.ts`.

Todas las páginas ya son dinámicas por defecto en Next 16, así que
`export const dynamic = 'force-dynamic'` no es necesario de todas formas.

### Navegación instantánea requiere `unstable_instant`

Para garantizar navegación instantánea, exporta desde la ruta:

```tsx
export const unstable_instant = { prefetch: 'static' }
```

Valida en dev/build que los `<Suspense>` estén bien posicionados. Guía:
`node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md`.

### Server Actions

Las Server Functions usan la directiva `'use server'`. Autentica dentro de cada action — que
el form esté en una página protegida no es suficiente:

```tsx
async function action(formData: FormData) {
  'use server'
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  // ...
}
```

## Firebase

Firebase v12 puede tener breaking changes respecto a v9/v10. Revisa los docs en
`node_modules/firebase/` antes de asumir patrones del SDK modular de tu conocimiento previo.

App Check se inicializa en el cliente cuando existe `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`. El
enforcement de Firestore y Storage está temporalmente desactivado (`appCheckValido()` devuelve
`true`) desde 2026-07-13; no afirmes que está activo ni cambies la función a
`request.app != null` hasta completar la validación de dominios, debug tokens y métricas descrita
en `docs/infra/app-check-setup.md`. Los callables rechazan solicitudes sin App Check por defecto;
`APP_CHECK_ENFORCE=false` es solo una salida temporal controlada.

## Autenticación

El acceso se controla con Firebase Auth vía `lib/auth.ts` (`useUsuario`) y `app/AuthGuard.tsx`.
Google Sign-In es el flujo normal; email/password existe para el usuario automatizado de E2E.

En desarrollo y producción se exige sesión real por defecto. El bypass es exclusivamente opt-in
para pruebas visuales sin acceso real a Firestore: `NEXT_PUBLIC_DEV_AUTH_BYPASS=true` devuelve un
usuario simulado solo fuera de producción. Sin definir la variable, o con `false`, se usa Firebase
Auth real. En producción el bypass siempre está desactivado.

### Roles y permisos

Además de la sesión, cada usuario tiene `modulos[]`, una `plantilla` como atajo de selección y
`esSuperAdmin`. `lib/roles.ts` resuelve permisos por módulo; `AuthGuard.tsx` bloquea la navegación
y `NavBar.tsx` oculta enlaces. `/usuarios` requiere super-admin y los módulos sensibles también
se validan en Firestore Rules. Mantener cliente, claims y reglas sincronizados.

## Flujo de planeación

Para tareas no triviales (features nuevas, refactors que tocan múltiples archivos, cambios al
modelo de datos):

1. Redacta primero el diseño en `docs/superpowers/specs/YYYY-MM-DD-*.md` (qué y por qué).
2. Redacta un plan ejecutable task-by-task en `docs/superpowers/plans/YYYY-MM-DD-*.md`.
3. Espera confirmación antes de modificar código de producción.
