# Rango Odoo + habituales MX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El comparador de `/proveedores` muestra min/avg/máx histórico por ítem (agrupado híbrido, todas las monedas por separado) y el directorio México abre con habituales Odoo primero.

**Architecture:** Lógica pura en `lib/compras-odoo/clave-hibrida.ts` y `lib/proveedores/directorio.ts`. La UI del comparador y del directorio solo consume esas funciones. El ETL de Odoo no se toca.

**Tech Stack:** TypeScript estricto, Vitest, React 19, Firestore ya sincronizado.

**Spec:** [2026-08-14-proveedores-rango-odoo-design.md](../specs/2026-08-14-proveedores-rango-odoo-design.md)

## Global Constraints

- Prohibido `any` y `@ts-ignore`.
- Nunca mezclar MXN y USD en un rango.
- `esItemComprable` = `precioUnitario > 0`; `esRfq` no filtra el rango.
- Los filtros de la tabla no achican el rango histórico.
- Inteligencia 360, Functions y AP de `/finanzas` no se tocan.
- USA directorio: nombre + Cargar más, sin sort habitual.

## File map

- Create: `lib/compras-odoo/clave-hibrida.ts`
- Create: `tests/compras-odoo-clave-hibrida.test.ts`
- Modify: `lib/compras-odoo/index.ts` — reexportar
- Modify: `app/proveedores/components/ComparadorPreciosInsumos.tsx`
- Modify: `lib/proveedores/directorio.ts`
- Modify: `lib/hooks/useDirectorioProveedores.ts`
- Modify: `app/proveedores/components/DirectorioProveedores.tsx`
- Modify: `app/proveedores/components/TarjetaProveedor.tsx`
- Modify: `app/proveedores/page.tsx` — pasar `mercado`
- Modify: `tests/proveedores-directorio.test.ts`

---

### Task 1: Clave híbrida + rango + semáforo

**Files:**
- Create: `lib/compras-odoo/clave-hibrida.ts`
- Create: `tests/compras-odoo-clave-hibrida.test.ts`
- Modify: `lib/compras-odoo/index.ts`

**Interfaces:**
- Consumes: `esItemComprable` from `./rangos`
- Produces:
  - `claveHibridaItem(item: ItemParaClaveHibrida): string`
  - `rangoHistoricoPorClave(items, clave, moneda): RangoHistoricoClave`
  - `indiceRangosHistoricos(items): Map<string, RangoHistoricoClave>` keyed by `${clave}::${moneda}`
  - `posicionPrecioEnRango(precio, rango): "barato" | "en_medio" | "caro" | null`
  - `grupoConMasCompras(rangos): RangoHistoricoClave | null`

- [ ] **Step 1: Write failing tests** in `tests/compras-odoo-clave-hibrida.test.ts` covering SKU wins, family+tipo+medida, description fallback, empty SKU, no currency mix, $0 ignored, RFQ with price counts, filtered subset does not shrink range, semáforo thresholds.

- [ ] **Step 2: Implement `clave-hibrida.ts`**

```ts
export type ItemParaClaveHibrida = {
  odooRefInterna?: string | null
  categoriaId: string
  tipoInsumo?: string | null
  tipoMetal?: string | null
  medida?: string | null
  descripcion: string
  moneda?: string | null
  precioUnitario: number
  odooPartnerId?: number
}

export type RangoHistoricoClave = {
  clave: string
  moneda: string
  min: number
  max: number
  promedio: number
  n: number
  proveedores: number
}

export function claveHibridaItem(item: ItemParaClaveHibrida): string
export function rangoHistoricoPorClave(
  items: ItemParaClaveHibrida[],
  clave: string,
  moneda: string,
): RangoHistoricoClave | null
export function indiceRangosHistoricos(
  items: ItemParaClaveHibrida[],
): Map<string, RangoHistoricoClave>
export function posicionPrecioEnRango(
  precio: number,
  rango: RangoHistoricoClave,
): "barato" | "en_medio" | "caro"
export function grupoConMasCompras(
  rangos: Iterable<RangoHistoricoClave>,
): RangoHistoricoClave | null
```

SKU: texto normalizado no vacío → `sku:${sku}`.
Familia: tipo (`tipoInsumo ?? tipoMetal`) y medida no vacíos → `fam:${categoriaId}|tipo:${tipo}|med:${medida}`.
Si no: `desc:${descripcionNormalizada}`.

Rango: solo `esItemComprable`, misma clave, misma moneda. Promedio redondeado a 2 decimales. `proveedores` = distinct `odooPartnerId`.

Semáforo: `|precio - min| < 0.05` → barato; `precio <= promedio` → en_medio; si no → caro.

- [ ] **Step 3: Export from `lib/compras-odoo/index.ts` and run** `npx vitest run tests/compras-odoo-clave-hibrida.test.ts`

---

### Task 2: Banda + semáforo + ficha en el comparador

**Files:**
- Modify: `app/proveedores/components/ComparadorPreciosInsumos.tsx`

**Interfaces:**
- Consumes: `claveHibridaItem`, `indiceRangosHistoricos`, `posicionPrecioEnRango`, `grupoConMasCompras` from `@/lib/compras-odoo`
- `indiceRangosHistoricos(items)` se calcula sobre **todos** los `items` del prop (histórico), no sobre `itemsCoincidentes`.

- [ ] **Step 1:** Reemplazar `claveComparacion` local por `claveHibridaItem`. El trophy / “sólo comparables” sigue agrupando filas visibles con esa misma clave (más moneda si hace falta para no mezclar). Trophy se queda en MXN entre visibles, como hoy.

- [ ] **Step 2:** `indiceRangosHistoricos(items)` en un `useMemo`. Banda fija arriba cuando `hayCriterio` y hay un `grupoConMasCompras` entre los rangos de los grupos presentes en `itemsCoincidentes`. Copy: min · avg · máx, moneda, n compras, n proveedores.

- [ ] **Step 3:** En cada fila, pista `barato` / `en medio` / `caro` via `posicionPrecioEnRango(item.precioUnitario, rangoDeSuClaveMoneda)`. Sin rango → sin pista.

- [ ] **Step 4:** Ficha de detalle: misma banda del ítem + hasta 8 compras del histórico de esa clave+moneda (todas las de `items`, no filtradas), más recientes primero: proveedor, fecha, `referenciaDoc`.

- [ ] **Step 5:** Presupuesto, filtros y toggle “sólo comparables” no cambian de comportamiento. El rango no depende del toggle.

---

### Task 3: Directorio MX habituales + Ver todos + chip

**Files:**
- Modify: `lib/proveedores/directorio.ts`
- Modify: `tests/proveedores-directorio.test.ts`
- Modify: `lib/hooks/useDirectorioProveedores.ts`
- Modify: `app/proveedores/components/DirectorioProveedores.tsx`
- Modify: `app/proveedores/components/TarjetaProveedor.tsx`
- Modify: `app/proveedores/page.tsx`

**Interfaces:**
- Add `"habitual"` to `OrdenamientoProveedor`.
- `filtrarOrdenarDirectorio`: `habitual` ordena por `ordenesOdoo` desc; `undefined` y `0` al final, alfabético entre ellos.
- `requiereCatalogoCompleto` true si `orden === "habitual"`.
- Hook: al montar / cambiar a `mexico`, default `orden = "habitual"`; USA → `"nombre"`.
- `DirectorioProveedores` recibe `mercado`. Vista default MX (`habitual`, sin búsqueda, categoría todas): recorta a `tamanoPagina` (18) y botón **Ver todos (N)**. Búsqueda/filtro/otro sort → lista completa. USA: Cargar más como hoy. Select “Habituales (Odoo)” solo en MX.
- `TarjetaProveedor`: chip `N compras Odoo` si `ordenesOdoo >= 1`. Misma info en la celda de nombre de la vista tabla.

- [ ] **Step 1:** Tests de `habitual` y `requiereCatalogoCompleto` en `tests/proveedores-directorio.test.ts`.

- [ ] **Step 2:** Implementar sort + hook default + UI Ver todos + chip.

- [ ] **Step 3:** Run `npx vitest run tests/compras-odoo-clave-hibrida.test.ts tests/proveedores-directorio.test.ts` and `npx tsc --noEmit`.
