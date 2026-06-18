# Diseño — Módulo de reportes de compras

Fecha: 2026-06-18
Proyecto: compras-americanas (Next.js 16 + React 19 + Firestore)
Estado: propuesta para revisión

## Objetivo

Reemplazar la tabla de Excel pegada en Outlook por un módulo de reportes dentro de la
app: el usuario filtra por semana o mes, ve un reporte profesional con marca SMV
(KPIs + tabla agrupada con subtotales) y lo exporta a PDF para enviarlo.

## Decisiones (del brainstorming)

- **Medio**: página en la app (`/reportes`) + exportación a PDF vía impresión del navegador.
- **Fuente de datos**: órdenes guardadas en Firestore (colección `ordenes`).
- **Mejoras**: franja de KPIs arriba; agrupación con subtotales; diseño limpio con marca SMV.
- **Agrupación**: selector Proveedor (default) / Destino / Requisitor.
- **Logo**: `public/smv-logo.png` (marca horizontal) en la cabecera; `public/smv-logo-completo.png` disponible.

## Fuera de alcance (YAGNI)

- Generación de PDF en servidor (Puppeteer/react-pdf) y envío automático por correo. Si luego
  se necesita envío semanal automatizado, se migra el render a server-side.
- Export a Excel/CSV (ya existe flujo de hoja de cálculo aparte).
- Resaltado de celdas faltantes más allá del aviso de "pendientes en efectivo".

## Cambios al modelo de datos

El reporte necesita dos campos que hoy no existen en `OrdenCompra`. Se agregan como
campos manuales **opcionales** (no rompen el form ni las órdenes existentes):

```ts
// lib/schemas.ts — CamposManualSchema
cuentaCargo: z.string().optional().default(""),
destino: z.string().optional().default(""),
```

- `cuentaCargo` → columna "Cuenta Cargo" (ej. "SO19316", "Fresadora Daniel").
- `destino` → columna "Destino" (ej. "SMV", "Fisher", "Siltech").

Se agregan los dos inputs (opcionales) al form de `nueva-compra` para poder capturarlos.
Las órdenes viejas sin estos campos se tratan como `""` (se muestran vacías / "—").

## Arquitectura

Ruta nueva `app/reportes/page.tsx` (Server Component que envuelve un Client Component
para filtros/estado), protegida por `AuthGuard` como el resto.

Unidades (cada una con un propósito claro y testeable):

1. **`lib/reportes.ts`** — lógica pura, sin React ni Firestore. Entrada: `OrdenCompra[]` +
   `{ desde, hasta, agruparPor }`. Salida: estructura `ReporteData` con grupos, subtotales,
   total general y KPIs. Funciones puras → fáciles de testear con Vitest.
   - `filtrarPorRango(ordenes, desde, hasta)` — filtra por `fechaFactura` (Día de la orden).
   - `aplanarLineas(ordenes)` — una fila por ítem: `{ referencia, dia, proveedor, descripcion,
     cantidad, precioUnitario, subtotal, total, requisitor, cuentaCargo, destino }`.
     - `subtotal` de línea = `item.total` (cantidad × precioUnitario).
     - `total` de línea = subtotal + parte proporcional de `orden.impuestos`
       (`impuestos × subtotalLínea / subtotalOrden`); si la orden no trae impuestos, total = subtotal.
   - `agrupar(lineas, criterio)` — agrupa por `proveedor | destino | requisitor`, ordena
     grupos por gasto desc, calcula subtotal y total por grupo.
   - `calcularKpis(lineas)` — total comprado (Σ total), # órdenes (distinct `referencia`),
     # proveedores (distinct), destino principal (mayor gasto) + su %.

2. **`app/reportes/ReporteView.tsx`** (Client) — orquesta filtros y render. Estado:
   `{ desde, hasta, agruparPor }`. Carga órdenes con `listarOrdenes()` (ya existe en
   `lib/ordenes.ts`), llama a `lib/reportes.ts`, pasa `ReporteData` a los componentes de
   presentación. Maneja loading / vacío / error.

3. **Componentes de presentación** (puros, reciben props):
   - `CabeceraReporte` — logo SMV, título, rango de fechas, botón "Guardar PDF".
   - `FiltrosReporte` — presets de periodo (Esta semana / Este mes / Personalizado con dos
     fechas) + selector de agrupación.
   - `FranjaKpis` — 4 tarjetas métricas.
   - `TablaReporte` — tabla agrupada: fila de encabezado de grupo, filas de línea, fila de
     subtotal por grupo, fila de total general. Montos alineados a la derecha, tabular-nums.
   - `AvisoPendientes` — banner "Quedan pendientes las compras en efectivo" (estático por ahora).

## Flujo de datos

```
listarOrdenes() ─► OrdenCompra[]
   │
   ▼  filtrarPorRango(desde, hasta)   (por fechaFactura)
OrdenCompra[] del periodo
   │
   ▼  aplanarLineas()
Linea[]  (una por ítem)
   │
   ├─► agrupar(criterio) ─► Grupo[] { clave, lineas, subtotal, total }
   └─► calcularKpis()     ─► Kpis    { totalComprado, ordenes, proveedores, destinoTop }
   │
   ▼
ReporteView renderiza CabeceraReporte + FranjaKpis + TablaReporte
```

## Exportación a PDF

- Botón "Guardar PDF" llama a `window.print()`.
- CSS `@media print` (en `globals.css` o módulo del reporte):
  - Oculta navegación, botones, filtros (`.no-print`).
  - Fuerza fondo blanco, colores legibles, evita cortes de grupo a media tabla
    (`break-inside: avoid` en filas de grupo/subtotal).
  - Tamaño carta, márgenes razonables; el logo y la cabecera se repiten arriba.
- Resultado: el usuario hace "Guardar como PDF" desde el diálogo de impresión y obtiene un
  PDF fiel a la vista.

## Filtros de periodo

- Presets: **Esta semana** (lunes–domingo de la fecha actual), **Este mes**, **Personalizado**
  (dos `<input type="date">`).
- El título del reporte refleja el rango ("Semana del 11 al 18 de julio, 2025" o "Julio 2025").
- Se filtra por `fechaFactura`. Órdenes sin `fechaFactura` quedan fuera del periodo (se podrá
  revisar con un contador "N órdenes sin fecha" si hace falta — no en v1).

## KPIs (v1)

1. **Total comprado** (Σ total con IVA) + subtítulo "IVA incluido $X".
2. **Órdenes (PO)** — # de `referencia` distintas + subtítulo "N artículos".
3. **Proveedores** — # distintos + subtítulo proveedor top.
4. **Destino principal** — destino con mayor gasto + su % del total.

## Monedas (importante)

Las órdenes pueden venir en monedas distintas (MXN en Mercado Libre, USD en eBay/Amazon/
McMaster). Sumar `total` entre monedas sería incorrecto. Regla v1:

- Los KPIs y los totales/subtotales se calculan **por moneda**. Si el periodo mezcla monedas,
  se muestran totales separados (ej. "Total MXN $X" y "Total USD $Y") y un filtro de moneda
  arriba (default: la moneda con más órdenes en el periodo).
- `calcularKpis` y `agrupar` reciben ya las líneas filtradas por una sola moneda; el selector
  de moneda vive en `ReporteView`.

## Manejo de errores y estados

- **Cargando**: skeleton/placeholder mientras `listarOrdenes()` resuelve.
- **Vacío**: si no hay órdenes en el rango, mensaje "No hay compras en este periodo".
- **Error de Firestore**: banner de error con botón "Reintentar".
- Montos siempre redondeados a 2 decimales y formateados `es-MX`.

## Pruebas

- `tests/reportes.test.ts` (Vitest) sobre `lib/reportes.ts` (funciones puras):
  - `filtrarPorRango` incluye/excluye por fecha correctamente (límites del rango).
  - `aplanarLineas` reparte IVA proporcional y maneja órdenes sin impuestos / sin ítems.
  - `agrupar` agrupa, ordena por gasto y suma subtotales/totales por grupo.
  - `calcularKpis` cuenta distintos y elige el destino principal.
- Sin pruebas de UI en v1 (los componentes son presentación pura sobre datos ya testeados).

## Navegación

- Agregar enlace "Reportes" en la navegación principal (`app/layout.tsx` / página de inicio),
  junto a Órdenes / Nueva compra / Importar.
