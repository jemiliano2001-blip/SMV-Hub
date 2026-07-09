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
- `/reportes` — reporte con KPIs, tabla agrupada con subtotales y export a PDF (vía `@media print` de Tailwind). Incluye envío de reportes por correo y órdenes recurrentes. Lógica pura en `lib/reportes.ts`; UI en `app/reportes/`.
- `/cotizaciones` — gestión de cotizaciones; importación por CSV, tabs de estado y listado.
- `/requisiciones` — gestión de requisiciones (CRUD vía `lib/requisiciones.ts` + hook `useRequisiciones`).
- `/ordenes-servicio` — gestión de órdenes de servicio (CRUD vía `lib/ordenes-servicio.ts` + hook `useOrdenesServicio`).
- `/almacen` — control de entradas y salidas de materiales y herramientas hacia piso.
- `/banos` — registros de tiempos de baño, conteos diarios y agregación de resumen mensual.
- `/horas-extra` — tabla editable para seguimiento de horas extras semanales por departamento.
- `/operadores` — catálogo de personal para auto-completar en módulos operativos.
- `/login` — página de inicio de sesión con Google Sign-In; redirige al home si ya hay sesión.

`POST /api/scrape` extrae precio/datos de un producto desde URLs de un whitelist de hosts
(Amazon, eBay, McMaster, MSC, DigiKey, Mouser, Home Depot, Mercado Libre) con cheerio.

El roadmap vivo está en [PROJECT.md](PROJECT.md) y los planes detallados en
[docs/superpowers/plans/](docs/superpowers/plans/).

## Comandos

```bash
npm run dev            # servidor de desarrollo en http://localhost:3000
npm run build          # build de producción
npm run lint           # ESLint
npm test               # corre la suite de Vitest una vez
npm run test:watch     # Vitest en modo watch
npm run test:coverage  # Vitest con reporte de cobertura

# Correr un solo archivo de pruebas (los archivos en tests/ reflejan 1:1 los módulos de lib/):
npx vitest run tests/reportes.test.ts
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
  - `firebase.ts`, `auth.ts`, `storage.ts` — inicialización de Firebase y utilidades
  - `hooks/` — hooks de datos por módulo (`useOrdenes`, `useCotizaciones`, `useRequisiciones`, `useOrdenesServicio`)
  - `services/recommendation.ts` — cliente del lado del cliente que llama a la Cloud Function `recommendProvider` (Vertex AI) para sugerir el mejor proveedor dado SKU + lista de suppliers con precio y lead time
- `functions/` — Cloud Functions de Firebase (TypeScript en `functions/src/`): `autoPurchase`,
  `recommendProvider` (Vertex AI), sync con Google Sheets (`sheetsSync`) y Excel (`excelSync`),
  `auth.ts` (middleware de autenticación compartido entre functions). Build/deploy aparte de la app Next.js.
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
  en la UI. `estado: "no_comprado"|"en_proceso"|"comprado"|"recibido"`. Los campos
  `parteNumero` y `fechaEntregaEst` aplican solo cuando `tipo === "automatizacion"`.
- **`OrdenServicioSchema`** — seguimiento de OTs con proveedores externos (hoja Fisher).
  `estatus: "pendiente"|"en_proceso"|"recibido"|"cancelado"`. Campos clave: `numOC`, `ingAcargo`,
  `ordenTrabajo`, `tiempoEntrega`.

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

### El modelo de caché cambió — `use cache` reemplaza los route segment configs

Con `cacheComponents: true` en `next.config.ts`, los viejos exports de configuración de
segmento (`dynamic`, `revalidate`, `fetchCache`) se reemplazan por directivas:

- `'use cache'` — cachea un Server Component o función async
- `cacheLife(profile)` — define el TTL (ej. `cacheLife('hours')`)
- `cacheTag(tag)` — etiqueta para revalidación dirigida vía `revalidateTag()`

Exports viejos como `export const dynamic = 'force-dynamic'` ya no son necesarios (todas las
páginas son dinámicas por defecto).

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

## Flujo de planeación

Para tareas no triviales (features nuevas, refactors que tocan múltiples archivos, cambios al
modelo de datos):

1. Redacta primero el diseño en `docs/superpowers/specs/YYYY-MM-DD-*.md` (qué y por qué).
2. Redacta un plan ejecutable task-by-task en `docs/superpowers/plans/YYYY-MM-DD-*.md`.
3. Espera confirmación antes de modificar código de producción.

## Deuda técnica conocida

- En Windows aparecen `lib/firebase.ts` y `lib\firebase.ts` como entradas separadas por el
  sistema de archivos case-insensitive. Consolidar en una limpieza dedicada (no mezclar con
  cambios de features).
