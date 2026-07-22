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
- `/importar` — importación masiva por CSV con preview validado y carga por lotes a Firestore.
- `/reportes` — reporte con KPIs, tabla agrupada con subtotales y export a PDF (vía `@media print` de Tailwind). Incluye envío de reportes por correo y órdenes recurrentes. Lógica pura en `lib/reportes.ts`; UI en `app/reportes/`. Incluye `DashboardInteligenciaCompras.tsx` — dashboard de gasto/proveedores cruzando `useProveedores`, `useProveedoresInteligencia` y `useRequisicionesFlujo`.
- `/reportes/contable` — cierre contable por lotes: agrupa órdenes pendientes en un
  `ReporteContableLote` (`lib/reportes-contables.ts`), traduce descripciones al español y
  sugiere/reasigna claves SAT en batch vía IA (`lib/reportes-contables-ia.ts` +
  `POST /api/retro-traducir-lote`, `POST /api/sat-descripciones`).
- `/finanzas` — facturación y cobranza de clientes sincronizada con Odoo; solo rol `admin` (ver
  `lib/roles.ts` y `firestore.rules`). Lógica en `lib/finanzas.ts` / `lib/finanzas-facturas.ts`;
  sync en `functions/src/odooSync.ts` + `odoo-mapeo.ts`.
- `/caja-chica` — movimientos y arqueo de caja chica (`lib/caja-chica.ts`).
- `/claves-sat` — buscador de claves SAT (`BuscadorClavesSat.tsx`), complementa la sugerencia
  automática de `/nueva-compra`.
- `/cotizaciones` — gestión de cotizaciones; importación por CSV, tabs de estado y listado.
- `/proveedores` — catálogo de proveedores de herramienta (USA Tooling); FK opcional `proveedorId`
  en órdenes/cotizaciones; inteligencia cruzada (precios históricos, lead time, scorecards) en
  `lib/proveedores-inteligencia-cruzada.ts`. Centro de mando con paneles dedicados: compras Odoo
  (`PanelComprasOdoo.tsx`), detección de proveedores fantasma (`PanelProveedoresFantasma.tsx`),
  calculadora de landed price (`CalculadoraLandedPrice.tsx`) e inteligencia 360 (`PanelInteligencia360.tsx`).
- `/requisiciones` — gestión de requisiciones (CRUD vía `lib/requisiciones.ts` + hook `useRequisiciones`).
  Al crear una requisición, `SeccionRecomendacionInteligente.tsx` sugiere proveedor vía
  `lib/motor-recomendador-proveedores.ts` — un motor de scoring local/cliente, **distinto** del
  cliente Vertex AI en `lib/services/recommendation.ts` (ver `/proveedores` arriba). No confundir
  ambos al modificar recomendaciones.
- `/ordenes-servicio` — gestión de órdenes de servicio (CRUD vía `lib/ordenes-servicio.ts` + hook `useOrdenesServicio`).
- `/almacen` — control de entradas y salidas de materiales y herramientas hacia piso. Tab
  Reabastecimiento ROP (`TableroReabastecimientoHerramientas.tsx`, módulo `reabastecimiento-rop`)
  corre sobre datos demo (`DEMO_ITEMS_RECOMPRA` en `lib/recompra-herramientas.ts`) — no está
  conectado a Firestore todavía.
- `/banos` — registros de tiempos de baño, conteos diarios y agregación de resumen mensual.
- `/horas-extra` — tabla editable para seguimiento de horas extras semanales por departamento.
- `/operadores` — catálogo de personal para auto-completar en módulos operativos.
- `/usuarios` — administración de accesos y roles (solo `admin`); lógica en `lib/usuarios.ts` /
  `lib/usuarios-admin.ts`.
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
npm test               # corre la suite de Vitest una vez
npm run test:watch     # Vitest en modo watch
npm run test:coverage  # Vitest con reporte de cobertura

# Correr un solo archivo de pruebas (la mayoría de los archivos en tests/ reflejan 1:1 los
# módulos de lib/, pero también hay tests de Route Handlers como extraer-route.test.ts):
npx vitest run tests/reportes.test.ts

# Catálogo SAT (poblar/actualizar data/sat/catalogo.json)
npm run sat:import          # importación estándar
npm run sat:import:phpcfdi  # importación desde el catálogo phpcfdi
```

`npm run build` corre con `--webpack` (no Turbopack) y valida el bundle después: Firebase
Hosting usa Turbopack por defecto, pero con `firebase-admin`/`firebase-functions` genera
aliases con hash que la función SSR no resuelve en producción — no lo cambies a `next build`
a secas (ver `next.config.ts` y `scripts/verificar-bundle-firebase.mjs`).

Para deploy manual de Hosting (fuera de CI) usa `npm run deploy:hosting` — parchea el build a
webpack antes de correr `firebase deploy --only hosting` (ver `scripts/firebase-deploy.mjs`);
no uses `firebase deploy` a secas, falla por el mismo motivo que `next build` a secas.

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
  - `requisiciones.ts`, `ordenes-servicio.ts` — CRUD de requisiciones y órdenes de servicio
  - `importar.ts` — parseo de CSV y validación de filas antes de la carga masiva
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
  - `hooks/` — hooks de datos por módulo (`useOrdenes`, `useCotizaciones`, `useRequisiciones`, `useOrdenesServicio`)
  - `services/recommendation.ts` — cliente del lado del cliente que llama a la Cloud Function `recommendProvider` (Vertex AI) para sugerir el mejor proveedor dado SKU + lista de suppliers con precio y lead time
- `functions/` — Cloud Functions de Firebase (TypeScript en `functions/src/`): `autoPurchase`,
  `recommendProvider` (Vertex AI), sync con Google Sheets (`sheetsSync`), Excel (`excelSync`) y
  Odoo (`odooSync` + `odoo-mapeo.ts` — primer uso de Secret Manager vía `runWith({ secrets })`
  en este repo), `auth.ts` (middleware de autenticación compartido). Build/deploy aparte de la
  app Next.js.
- `tests/` — pruebas de Vitest; la mayoría prueban lógica pura de `lib/` sin Firebase real, pero
  `extraer-route.test.ts` y `extraer-lote.test.ts` testean los Route Handlers mockeando fetch/Gemini,
  y `lib-ordenes.test.ts` / `ordenes.test.ts` cubren la capa CRUD de Firestore
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
- **`OrdenServicioSchema`** — seguimiento de OTs con proveedores externos (hoja Fisher).
  `estatus: "pendiente"|"en_proceso"|"detenida"|"entregada"|"cancelado"` (legacy `"recibido"` →
  `"entregada"`). Campos clave: `numOC`, `ingAcargo`, `ordenTrabajo`, `tiempoEntrega`.

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

## Autenticación

El acceso se controla con Google Sign-In vía `lib/auth.ts` (`useUsuario`) y `app/AuthGuard.tsx`.

Modo debug: en desarrollo (`next dev`) se omite el login por defecto para agilizar las
pruebas locales — `useUsuario` devuelve un usuario simulado y no se contacta Firebase Auth.
En producción **siempre** se exige sesión. Control con `NEXT_PUBLIC_DEV_AUTH_BYPASS`:
`"true"` fuerza el bypass, `"false"` lo desactiva (exige login incluso en dev), sin definir
deja el comportamiento por defecto (bypass solo fuera de producción).

### Roles y permisos

Además de la sesión, cada usuario tiene un `Rol` (`admin`|`compras`|`diseno`|`almacen`,
`lib/schemas.ts`). `lib/roles.ts` define `PERMISOS_POR_ROL` (rutas base permitidas por rol) y
`tienePermiso(rol, pathname)`; `AuthGuard.tsx` bloquea la navegación y `NavBar.tsx` oculta los
enlaces según el rol. `/finanzas`, `/auditoria` y `/usuarios` son exclusivos de `admin` —
mantener sincronizado con `firestore.rules`.

## Flujo de planeación

Para tareas no triviales (features nuevas, refactors que tocan múltiples archivos, cambios al
modelo de datos):

1. Redacta primero el diseño en `docs/superpowers/specs/YYYY-MM-DD-*.md` (qué y por qué).
2. Redacta un plan ejecutable task-by-task en `docs/superpowers/plans/YYYY-MM-DD-*.md`.
3. Espera confirmación antes de modificar código de producción.
