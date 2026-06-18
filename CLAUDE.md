# CLAUDE.md

Esta guía orienta a Claude Code (claude.ai/code) al trabajar en este repositorio.

@AGENTS.md

## Proyecto y dominio

SMV es un taller de maquinado en México que realiza compras de herramienta y partes
industriales en Estados Unidos (eBay, Amazon, McMaster-Carr, Mercado Libre, etc.). Esta app
registra esas compras, extrae los datos de la factura con IA y los guarda en Firestore para
seguimiento y reportes.

Módulos actuales:

- `/nueva-compra` — captura una compra; sube la imagen de la factura y la IA extrae proveedor,
  ítems, montos y moneda.
- `/ordenes` — lista las órdenes (más recientes primero), permite ver detalle y eliminar.
- `/importar` — importación masiva por CSV con preview validado y carga por lotes a Firestore.
- `/reportes` — (en desarrollo) reporte con KPIs, tabla agrupada con subtotales y export a PDF.

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
```

## Stack

- **Next.js 16.2.9** con App Router (directorio `app/`)
- **React 19.2.4** con Server Components y Server Actions
- **Tailwind CSS v4** — basado en PostCSS, sin `tailwind.config.js`; la config vive en `globals.css` vía `@theme`
- **TypeScript** en modo estricto; alias `@/*` → raíz del repo
- **Firebase v12**, **@anthropic-ai/sdk**, **react-hook-form + zod**, **lucide-react**
- **Vitest** para pruebas

## Estructura del código

- `app/` — páginas y componentes de Next.js (App Router)
- `lib/` — lógica pura, schemas Zod y acceso a Firestore (`schemas.ts`, `ordenes.ts`, `importar.ts`, `extraer-ia.ts`, `firebase.ts`, `auth.ts`, `storage.ts`)
- `tests/` — pruebas de Vitest
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
