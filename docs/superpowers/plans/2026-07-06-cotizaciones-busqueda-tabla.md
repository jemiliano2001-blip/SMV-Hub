# Cotizaciones — Búsqueda, Ordenamiento y Paginación Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mejorar la pestaña Consultar de `/cotizaciones` con búsqueda multi-palabra, ordenamiento por columna y paginación de 50 filas, sin cambiar el schema ni Firestore.

**Architecture:** Lógica pura nueva en `lib/cotizaciones-tabla.ts` (filtrar → ordenar → paginar). `CotizacionesList.tsx` conserva estado de UI y delega el pipeline vía `useMemo`. Tests Vitest cubren toda la lógica de negocio.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript estricto, Vitest, Tailwind v4, `normalizar()` de `lib/format.ts`.

**Spec:** `docs/superpowers/specs/2026-07-06-cotizaciones-busqueda-tabla-design.md`

## Global Constraints

- Prohibido `any` y `@ts-ignore` (CLAUDE.md).
- Validación en frontera: no aplica (sin cambios de schema ni formularios).
- Componentes UI no importan Firestore directamente — solo `useCotizaciones` (sin cambios al hook).
- Precios multi-moneda: al ordenar por `precioUnitario` o `total`, USD antes MXN; nunca mezclar montos entre monedas.
- Paginación fija: **50** filas/página.
- Orden inicial: columna `fecha`, dirección `desc`.
- Sin columnas nuevas visibles en la tabla.
- Sin dependencias nuevas.

---

### Task 1: Tipos, tokenización y `filtrarCotizaciones`

**Files:**
- Create: `lib/cotizaciones-tabla.ts`
- Create: `tests/cotizaciones-tabla.test.ts`

**Interfaces:**
- Consumes: `Cotizacion` de `@/lib/schemas`, `normalizar` de `@/lib/format`.
- Produces:
  - `FiltroUbicacion`, `FiltroEstatus`, `FiltrosCotizacion`
  - `tokenizarBusqueda(busqueda: string): string[]`
  - `hayTokens(busqueda: string): boolean`
  - `filtrarCotizaciones(cotizaciones: Cotizacion[], filtros: FiltrosCotizacion): Cotizacion[]`

- [ ] **Step 1: Write the failing tests**

Crear `tests/cotizaciones-tabla.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { filtrarCotizaciones, tokenizarBusqueda, hayTokens } from "@/lib/cotizaciones-tabla"
import type { Cotizacion } from "@/lib/schemas"

const AHORA = new Date("2026-06-19")

function makeCotizacion(overrides: Partial<Cotizacion> = {}): Cotizacion {
  return {
    id: "c-1",
    solicitante: "Francisco",
    fecha: "2026-06-19",
    estatus: "cotizado",
    ubicacion: "USA",
    proveedor: "Tri-City Tool Parts",
    descripcion: "E110576 Seal Husky C304H",
    numeroParte: "E110576",
    cantidad: 1,
    precioUnitario: 14.24,
    moneda: "USD",
    total: 14.24,
    diasHabiles: "3 - 5 dias",
    link: "https://example.com",
    notas: null,
    creadoEn: AHORA,
    actualizadoEn: AHORA,
    ...overrides,
  }
}

describe("tokenizarBusqueda", () => {
  it("divide por espacios y normaliza", () => {
    expect(tokenizarBusqueda("  Seal  E110  ")).toEqual(["seal", "e110"])
  })

  it("devuelve array vacío sin texto", () => {
    expect(tokenizarBusqueda("   ")).toEqual([])
  })
})

describe("hayTokens", () => {
  it("true cuando hay palabras", () => {
    expect(hayTokens("motor")).toBe(true)
  })

  it("false cuando está vacío", () => {
    expect(hayTokens("")).toBe(false)
  })
})

describe("filtrarCotizaciones", () => {
  const base = [
    makeCotizacion(),
    makeCotizacion({
      id: "c-2",
      descripcion: "Motor eléctrico 1HP",
      numeroParte: "MOT-1HP",
      proveedor: "Levinson",
      ubicacion: "MX",
      moneda: "MXN",
      solicitante: "Edgar",
    }),
  ]

  it("encuentra por descripción con un token", () => {
    const r = filtrarCotizaciones(base, {
      busqueda: "motor",
      ubicacion: "todas",
      estatus: "todos",
    })
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe("c-2")
  })

  it("encuentra por número de parte", () => {
    const r = filtrarCotizaciones(base, {
      busqueda: "e110576",
      ubicacion: "todas",
      estatus: "todos",
    })
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe("c-1")
  })

  it("exige todos los tokens (AND)", () => {
    const r = filtrarCotizaciones(base, {
      busqueda: "seal e110",
      ubicacion: "todas",
      estatus: "todos",
    })
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe("c-1")
  })

  it("sin coincidencia devuelve vacío", () => {
    const r = filtrarCotizaciones(base, {
      busqueda: "imposible xyz",
      ubicacion: "todas",
      estatus: "todos",
    })
    expect(r).toHaveLength(0)
  })

  it("filtra por ubicación y estatus antes del texto", () => {
    const r = filtrarCotizaciones(base, {
      busqueda: "",
      ubicacion: "MX",
      estatus: "todos",
    })
    expect(r).toHaveLength(1)
    expect(r[0].ubicacion).toBe("MX")
  })

  it("busca en solicitante", () => {
    const r = filtrarCotizaciones(base, {
      busqueda: "edgar",
      ubicacion: "todas",
      estatus: "todos",
    })
    expect(r).toHaveLength(1)
    expect(r[0].solicitante).toBe("Edgar")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cotizaciones-tabla.test.ts`

Expected: FAIL — cannot find module `@/lib/cotizaciones-tabla`

- [ ] **Step 3: Write minimal implementation**

Crear `lib/cotizaciones-tabla.ts`:

```ts
import type { Cotizacion, EstatusCotizacion } from "@/lib/schemas"
import { normalizar } from "@/lib/format"

export type FiltroUbicacion = "todas" | "MX" | "USA"
export type FiltroEstatus = "todos" | EstatusCotizacion

export type FiltrosCotizacion = {
  busqueda: string
  ubicacion: FiltroUbicacion
  estatus: FiltroEstatus
}

const CAMPOS_BUSQUEDA = ["descripcion", "numeroParte", "proveedor", "solicitante"] as const

export function tokenizarBusqueda(busqueda: string): string[] {
  return busqueda
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizar)
}

export function hayTokens(busqueda: string): boolean {
  return tokenizarBusqueda(busqueda).length > 0
}

function camposNormalizados(c: Cotizacion): string[] {
  return CAMPOS_BUSQUEDA.map((campo) => normalizar(c[campo] ?? ""))
}

export function filtrarCotizaciones(
  cotizaciones: Cotizacion[],
  filtros: FiltrosCotizacion
): Cotizacion[] {
  const tokens = tokenizarBusqueda(filtros.busqueda)

  return cotizaciones.filter((c) => {
    if (filtros.ubicacion !== "todas" && c.ubicacion !== filtros.ubicacion) return false
    if (filtros.estatus !== "todos" && c.estatus !== filtros.estatus) return false

    if (tokens.length === 0) return true

    const campos = camposNormalizados(c)
    return tokens.every((token) => campos.some((campo) => campo.includes(token)))
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/cotizaciones-tabla.test.ts`

Expected: PASS (solo los tests de Task 1; los de Task 2 aún no existen)

- [ ] **Step 5: Commit**

```bash
git add lib/cotizaciones-tabla.ts tests/cotizaciones-tabla.test.ts
git commit -m "feat(cotizaciones): add token search filter for quotes table"
```

---

### Task 2: `puntuacionRelevancia` y `ordenarCotizaciones`

**Files:**
- Modify: `lib/cotizaciones-tabla.ts`
- Modify: `tests/cotizaciones-tabla.test.ts`

**Interfaces:**
- Consumes: tipos y `filtrarCotizaciones` de Task 1.
- Produces:
  - `ColumnaOrdenCotizacion`, `DireccionOrden`
  - `direccionDefaultColumna(columna: ColumnaOrdenCotizacion): DireccionOrden`
  - `puntuacionRelevancia(cotizacion: Cotizacion, busqueda: string): number`
  - `ordenarCotizaciones(cotizaciones, columna, direccion, opts?): Cotizacion[]`
    - `opts?: { busqueda?: string; usarRelevancia?: boolean }`

- [ ] **Step 1: Write the failing tests**

Añadir al final de `tests/cotizaciones-tabla.test.ts`:

```ts
import {
  filtrarCotizaciones,
  tokenizarBusqueda,
  hayTokens,
  puntuacionRelevancia,
  ordenarCotizaciones,
} from "@/lib/cotizaciones-tabla"

describe("puntuacionRelevancia", () => {
  it("prioriza coincidencia exacta de número de parte", () => {
    const exacta = makeCotizacion({ numeroParte: "E110576" })
    const parcial = makeCotizacion({
      id: "c-2",
      numeroParte: "E110576-X",
      descripcion: "Otro sello",
    })
    expect(puntuacionRelevancia(exacta, "E110576")).toBeLessThan(
      puntuacionRelevancia(parcial, "E110576")
    )
  })
})

describe("ordenarCotizaciones", () => {
  it("ordena por fecha desc con null al final", () => {
    const rows = [
      makeCotizacion({ id: "a", fecha: "2026-01-01" }),
      makeCotizacion({ id: "b", fecha: "2026-06-01" }),
      makeCotizacion({ id: "c", fecha: null }),
    ]
    const r = ordenarCotizaciones(rows, "fecha", "desc")
    expect(r.map((x) => x.id)).toEqual(["b", "a", "c"])
  })

  it("ordena por total sin mezclar USD y MXN", () => {
    const rows = [
      makeCotizacion({ id: "mx-alto", moneda: "MXN", total: 5000, ubicacion: "MX" }),
      makeCotizacion({ id: "usd-bajo", moneda: "USD", total: 10, ubicacion: "USA" }),
      makeCotizacion({ id: "usd-alto", moneda: "USD", total: 100, ubicacion: "USA" }),
    ]
    const r = ordenarCotizaciones(rows, "total", "desc")
    expect(r.map((x) => x.id)).toEqual(["usd-alto", "usd-bajo", "mx-alto"])
  })

  it("ordena estatus en orden fijo cotizado → revisar → cancelado", () => {
    const rows = [
      makeCotizacion({ id: "x", estatus: "cancelado" }),
      makeCotizacion({ id: "y", estatus: "cotizado" }),
      makeCotizacion({ id: "z", estatus: "revisar" }),
    ]
    const r = ordenarCotizaciones(rows, "estatus", "asc")
    expect(r.map((x) => x.id)).toEqual(["y", "z", "x"])
  })

  it("aplica relevancia cuando usarRelevancia es true", () => {
    const rows = [
      makeCotizacion({
        id: "parcial",
        numeroParte: "E110576-X",
        descripcion: "Sello genérico E110576",
        fecha: "2026-06-01",
      }),
      makeCotizacion({
        id: "exacta",
        numeroParte: "E110576",
        descripcion: "Seal Husky",
        fecha: "2026-01-01",
      }),
    ]
    const r = ordenarCotizaciones(rows, "fecha", "desc", {
      busqueda: "E110576",
      usarRelevancia: true,
    })
    expect(r[0].id).toBe("exacta")
  })

  it("no aplica relevancia cuando usarRelevancia es false", () => {
    const rows = [
      makeCotizacion({
        id: "parcial",
        numeroParte: "E110576-X",
        fecha: "2026-06-01",
      }),
      makeCotizacion({
        id: "exacta",
        numeroParte: "E110576",
        fecha: "2026-01-01",
      }),
    ]
    const r = ordenarCotizaciones(rows, "fecha", "desc", {
      busqueda: "E110576",
      usarRelevancia: false,
    })
    expect(r[0].id).toBe("parcial")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cotizaciones-tabla.test.ts`

Expected: FAIL — `puntuacionRelevancia` / `ordenarCotizaciones` not exported

- [ ] **Step 3: Write minimal implementation**

Añadir a `lib/cotizaciones-tabla.ts`:

```ts
export type ColumnaOrdenCotizacion =
  | "fecha"
  | "solicitante"
  | "proveedor"
  | "descripcion"
  | "numeroParte"
  | "cantidad"
  | "precioUnitario"
  | "total"
  | "estatus"

export type DireccionOrden = "asc" | "desc"

const ORDEN_ESTATUS: Record<EstatusCotizacion, number> = {
  cotizado: 0,
  revisar: 1,
  cancelado: 2,
}

const DIRECCION_DEFAULT: Record<ColumnaOrdenCotizacion, DireccionOrden> = {
  fecha: "desc",
  solicitante: "asc",
  proveedor: "asc",
  descripcion: "asc",
  numeroParte: "asc",
  cantidad: "desc",
  precioUnitario: "desc",
  total: "desc",
  estatus: "asc",
}

export function direccionDefaultColumna(columna: ColumnaOrdenCotizacion): DireccionOrden {
  return DIRECCION_DEFAULT[columna]
}

export function puntuacionRelevancia(cotizacion: Cotizacion, busqueda: string): number {
  const busquedaNorm = normalizar(busqueda.trim())
  if (!busquedaNorm) return 3

  const parte = normalizar(cotizacion.numeroParte ?? "")
  const descripcion = normalizar(cotizacion.descripcion)
  const primerToken = tokenizarBusqueda(busqueda)[0] ?? ""

  if (parte && parte === busquedaNorm) return 0
  if (parte && parte.startsWith(busquedaNorm)) return 1
  if (primerToken && descripcion.startsWith(primerToken)) return 2
  return 3
}

function compararTexto(a: string | null, b: string | null, dir: DireccionOrden): number {
  const sa = a ?? ""
  const sb = b ?? ""
  if (!sa && !sb) return 0
  if (!sa) return 1
  if (!sb) return -1
  const cmp = sa.localeCompare(sb, "es")
  return dir === "asc" ? cmp : -cmp
}

function compararNumero(
  a: number | null,
  b: number | null,
  dir: DireccionOrden
): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return dir === "asc" ? a - b : b - a
}

function compararPrecio(
  a: Cotizacion,
  b: Cotizacion,
  campo: "precioUnitario" | "total",
  dir: DireccionOrden
): number {
  const monedaCmp = a.moneda.localeCompare(b.moneda)
  if (monedaCmp !== 0) return monedaCmp
  return compararNumero(a[campo], b[campo], dir)
}

function compararPorColumna(
  a: Cotizacion,
  b: Cotizacion,
  columna: ColumnaOrdenCotizacion,
  dir: DireccionOrden
): number {
  switch (columna) {
    case "fecha":
      return compararTexto(a.fecha, b.fecha, dir)
    case "solicitante":
      return compararTexto(a.solicitante, b.solicitante, dir)
    case "proveedor":
      return compararTexto(a.proveedor, b.proveedor, dir)
    case "descripcion":
      return compararTexto(a.descripcion, b.descripcion, dir)
    case "numeroParte":
      return compararTexto(a.numeroParte, b.numeroParte, dir)
    case "cantidad":
      return compararNumero(a.cantidad, b.cantidad, dir)
    case "precioUnitario":
      return compararPrecio(a, b, "precioUnitario", dir)
    case "total":
      return compararPrecio(a, b, "total", dir)
    case "estatus": {
      const cmp = ORDEN_ESTATUS[a.estatus] - ORDEN_ESTATUS[b.estatus]
      return dir === "asc" ? cmp : -cmp
    }
    default: {
      const _exhaustive: never = columna
      return _exhaustive
    }
  }
}

export function ordenarCotizaciones(
  cotizaciones: Cotizacion[],
  columna: ColumnaOrdenCotizacion,
  direccion: DireccionOrden,
  opts?: { busqueda?: string; usarRelevancia?: boolean }
): Cotizacion[] {
  const copia = [...cotizaciones]

  copia.sort((a, b) => {
    if (opts?.usarRelevancia && opts.busqueda) {
      const rel =
        puntuacionRelevancia(a, opts.busqueda) - puntuacionRelevancia(b, opts.busqueda)
      if (rel !== 0) return rel
      const fechaDesempate = compararTexto(a.fecha, b.fecha, "desc")
      if (fechaDesempate !== 0) return fechaDesempate
    }

    return compararPorColumna(a, b, columna, direccion)
  })

  return copia
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/cotizaciones-tabla.test.ts`

Expected: PASS (todos los tests hasta aquí)

- [ ] **Step 5: Commit**

```bash
git add lib/cotizaciones-tabla.ts tests/cotizaciones-tabla.test.ts
git commit -m "feat(cotizaciones): add sort and relevance ranking for quotes table"
```

---

### Task 3: `paginarCotizaciones`

**Files:**
- Modify: `lib/cotizaciones-tabla.ts`
- Modify: `tests/cotizaciones-tabla.test.ts`

**Interfaces:**
- Consumes: Task 1–2 exports.
- Produces:
  - `ResultadoPaginacion<T>`
  - `paginarCotizaciones<T>(items: T[], pagina: number, tamanoPagina: number): ResultadoPaginacion<T>`
  - `TAMANO_PAGINA_COTIZACIONES` constante = `50`

- [ ] **Step 1: Write the failing tests**

Añadir a `tests/cotizaciones-tabla.test.ts`:

```ts
import {
  paginarCotizaciones,
  TAMANO_PAGINA_COTIZACIONES,
} from "@/lib/cotizaciones-tabla"

describe("paginarCotizaciones", () => {
  const items = Array.from({ length: 127 }, (_, i) => `item-${i + 1}`)

  it("exporta tamaño de página 50", () => {
    expect(TAMANO_PAGINA_COTIZACIONES).toBe(50)
  })

  it("página 1 devuelve primeros 50", () => {
    const r = paginarCotizaciones(items, 1, 50)
    expect(r.filas).toHaveLength(50)
    expect(r.filas[0]).toBe("item-1")
    expect(r.indiceInicio).toBe(1)
    expect(r.indiceFin).toBe(50)
    expect(r.totalFilas).toBe(127)
    expect(r.totalPaginas).toBe(3)
    expect(r.paginaActual).toBe(1)
  })

  it("última página devuelve resto", () => {
    const r = paginarCotizaciones(items, 3, 50)
    expect(r.filas).toHaveLength(27)
    expect(r.filas[0]).toBe("item-101")
    expect(r.indiceInicio).toBe(101)
    expect(r.indiceFin).toBe(127)
  })

  it("página fuera de rango ajusta a la última válida", () => {
    const r = paginarCotizaciones(items, 99, 50)
    expect(r.paginaActual).toBe(3)
    expect(r.filas).toHaveLength(27)
  })

  it("sin resultados devuelve metadatos vacíos", () => {
    const r = paginarCotizaciones([], 1, 50)
    expect(r.filas).toHaveLength(0)
    expect(r.totalFilas).toBe(0)
    expect(r.totalPaginas).toBe(0)
    expect(r.indiceInicio).toBe(0)
    expect(r.indiceFin).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cotizaciones-tabla.test.ts`

Expected: FAIL — `paginarCotizaciones` not exported

- [ ] **Step 3: Write minimal implementation**

Añadir a `lib/cotizaciones-tabla.ts`:

```ts
export const TAMANO_PAGINA_COTIZACIONES = 50

export type ResultadoPaginacion<T> = {
  filas: T[]
  paginaActual: number
  totalPaginas: number
  totalFilas: number
  indiceInicio: number
  indiceFin: number
}

export function paginarCotizaciones<T>(
  items: T[],
  pagina: number,
  tamanoPagina: number
): ResultadoPaginacion<T> {
  const totalFilas = items.length

  if (totalFilas === 0) {
    return {
      filas: [],
      paginaActual: 1,
      totalPaginas: 0,
      totalFilas: 0,
      indiceInicio: 0,
      indiceFin: 0,
    }
  }

  const totalPaginas = Math.ceil(totalFilas / tamanoPagina)
  const paginaActual = Math.min(Math.max(1, pagina), totalPaginas)
  const inicio = (paginaActual - 1) * tamanoPagina
  const fin = Math.min(inicio + tamanoPagina, totalFilas)

  return {
    filas: items.slice(inicio, fin),
    paginaActual,
    totalPaginas,
    totalFilas,
    indiceInicio: inicio + 1,
    indiceFin: fin,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/cotizaciones-tabla.test.ts`

Expected: PASS (suite completa de `cotizaciones-tabla`)

- [ ] **Step 5: Commit**

```bash
git add lib/cotizaciones-tabla.ts tests/cotizaciones-tabla.test.ts
git commit -m "feat(cotizaciones): add client-side pagination for quotes table"
```

---

### Task 4: Integrar pipeline en `CotizacionesList.tsx`

**Files:**
- Modify: `app/cotizaciones/CotizacionesList.tsx`

**Interfaces:**
- Consumes: todo de `lib/cotizaciones-tabla.ts`.
- Produces: UI actualizada en `/cotizaciones` pestaña Consultar.

- [ ] **Step 1: Reemplazar `filtradas` useMemo por pipeline completo**

Eliminar el `useMemo` inline actual (líneas ~46–57) y el import de `normalizar` si ya no se usa.

Añadir imports:

```tsx
import {
  filtrarCotizaciones,
  ordenarCotizaciones,
  paginarCotizaciones,
  direccionDefaultColumna,
  hayTokens,
  TAMANO_PAGINA_COTIZACIONES,
  type ColumnaOrdenCotizacion,
  type DireccionOrden,
  type FiltroUbicacion,
  type FiltroEstatus,
} from '@/lib/cotizaciones-tabla'
import { ChevronUp, ChevronDown } from 'lucide-react'
```

Añadir estado:

```tsx
const [columnaOrden, setColumnaOrden] = useState<ColumnaOrdenCotizacion>('fecha')
const [direccionOrden, setDireccionOrden] = useState<DireccionOrden>('desc')
const [pagina, setPagina] = useState(1)
const [ordenPersonalizado, setOrdenPersonalizado] = useState(false)
```

Reemplazar `filtradas` con:

```tsx
const filtros = useMemo(
  () => ({
    busqueda,
    ubicacion: filtroUbicacion,
    estatus: filtroEstatus,
  }),
  [busqueda, filtroUbicacion, filtroEstatus]
)

const filtradas = useMemo(
  () => filtrarCotizaciones(cotizaciones, filtros),
  [cotizaciones, filtros]
)

const ordenadas = useMemo(
  () =>
    ordenarCotizaciones(filtradas, columnaOrden, direccionOrden, {
      busqueda: filtros.busqueda,
      usarRelevancia: !ordenPersonalizado && hayTokens(filtros.busqueda),
    }),
  [filtradas, columnaOrden, direccionOrden, filtros.busqueda, ordenPersonalizado]
)

const paginacion = useMemo(
  () => paginarCotizaciones(ordenadas, pagina, TAMANO_PAGINA_COTIZACIONES),
  [ordenadas, pagina]
)

const filasPagina = paginacion.filas
```

- [ ] **Step 2: Reset de página al cambiar filtros**

Añadir `useEffect`:

```tsx
import { useMemo, useState, useEffect } from 'react'

useEffect(() => {
  setPagina(1)
}, [busqueda, filtroUbicacion, filtroEstatus])
```

- [ ] **Step 3: Ajustar página si queda fuera de rango al ordenar**

```tsx
useEffect(() => {
  if (paginacion.totalPaginas > 0 && pagina > paginacion.totalPaginas) {
    setPagina(paginacion.totalPaginas)
  }
}, [pagina, paginacion.totalPaginas])
```

- [ ] **Step 4: Handler de orden por columna**

```tsx
function handleOrdenColumna(columna: ColumnaOrdenCotizacion) {
  setOrdenPersonalizado(true)
  if (columnaOrden === columna) {
    setDireccionOrden((d) => (d === 'asc' ? 'desc' : 'asc'))
  } else {
    setColumnaOrden(columna)
    setDireccionOrden(direccionDefaultColumna(columna))
  }
}

function iconoOrden(columna: ColumnaOrdenCotizacion) {
  if (columnaOrden !== columna) return null
  return direccionOrden === 'asc' ? (
    <ChevronUp className="inline h-3.5 w-3.5 ml-1" />
  ) : (
    <ChevronDown className="inline h-3.5 w-3.5 ml-1" />
  )
}
```

Helper para `<th>` ordenable:

```tsx
function thOrdenable(
  columna: ColumnaOrdenCotizacion,
  label: string,
  className = ''
) {
  return (
    <th
      className={`px-4 py-3 font-semibold whitespace-nowrap cursor-pointer select-none hover:bg-gray-100 ${className}`}
      onClick={() => handleOrdenColumna(columna)}
    >
      {label}
      {iconoOrden(columna)}
    </th>
  )
}
```

Reemplazar `<th>` estáticos de Fecha, Solicitante, Proveedor, Descripción, No. parte, Cant., P. Unit., Total, Estatus por llamadas a `thOrdenable(...)`. Dejar checkbox, Ubic. y Link sin orden.

- [ ] **Step 5: Usar `filasPagina` en el tbody y selección**

Cambiar `filtradas.map` → `filasPagina.map`.

Actualizar `toggleAllSelection`:

```tsx
const toggleAllSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
  if (e.target.checked) {
    setSelectedIds(new Set(filasPagina.map((c) => c.id)))
  } else {
    setSelectedIds(new Set())
  }
}
```

Checkbox del header:

```tsx
checked={filasPagina.length > 0 && filasPagina.every((c) => selectedIds.has(c.id))}
```

Limpiar selección al cambiar página:

```tsx
useEffect(() => {
  setSelectedIds(new Set())
}, [pagina])
```

- [ ] **Step 6: Contador y controles de paginación**

Debajo del contador existente (`{filtradas.length} de {cotizaciones.length}`), añadir cuando `paginacion.totalFilas > 0`:

```tsx
{paginacion.totalFilas > 0 && (
  <p className="text-xs text-gray-500">
  Mostrando {paginacion.indiceInicio}–{paginacion.indiceFin} de {paginacion.totalFilas} resultados
  </p>
)}
```

Debajo de la tabla (antes del empty state de búsqueda), añadir controles solo si `paginacion.totalPaginas > 1`:

```tsx
{paginacion.totalPaginas > 1 && (
  <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 bg-gray-50">
    <button
      type="button"
      onClick={() => setPagina((p) => Math.max(1, p - 1))}
      disabled={pagina <= 1}
      className="text-sm font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-40"
    >
      « Anterior
    </button>
    <span className="text-sm text-gray-600">
      Página {paginacion.paginaActual} de {paginacion.totalPaginas}
    </span>
    <button
      type="button"
      onClick={() => setPagina((p) => Math.min(paginacion.totalPaginas, p + 1))}
      disabled={pagina >= paginacion.totalPaginas}
      className="text-sm font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-40"
    >
      Siguiente »
    </button>
  </div>
)}
```

Mantener el mensaje vacío cuando `filtradas.length === 0` (no `filasPagina`).

- [ ] **Step 7: Run lint and tests**

Run: `npm run lint`
Run: `npx vitest run tests/cotizaciones-tabla.test.ts`
Run: `npm run build`

Expected: sin errores nuevos.

- [ ] **Step 8: Commit**

```bash
git add app/cotizaciones/CotizacionesList.tsx
git commit -m "feat(cotizaciones): wire search, sort and pagination into quotes list"
```

---

### Task 5: Verificación manual en navegador

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Abrir** `http://localhost:3000/cotizaciones`

- [ ] **Step 2: Búsqueda**
  - Buscar `motor` → filas con esa palabra.
  - Buscar `seal e110` → solo filas con ambas palabras.

- [ ] **Step 3: Ordenamiento**
  - Clic en **Total** ↓ → USD agrupados de mayor a menor, luego MXN.
  - Segundo clic invierte dirección; icono ▲/▼ visible.

- [ ] **Step 4: Paginación**
  - Con ~443 registros → ~9 páginas de 50.
  - Anterior/Siguiente funcionan; contador «Mostrando 1–50 de …».

- [ ] **Step 5: Selección**
  - Seleccionar filas en página 1 → cambiar a página 2 → selección limpia.

- [ ] **Step 6: Regresión**
  - Clic en fila abre modal de edición.
  - Bulk delete sigue funcionando en página actual.
  - Pestaña Importar sin cambios.

---

## Spec Coverage (self-review)

| Requisito spec | Task |
|---|---|
| Búsqueda multi-palabra AND tokens | Task 1 |
| Campos: descripción, no. parte, proveedor, solicitante | Task 1 |
| Ranking relevancia con `ordenPersonalizado` | Task 2 + Task 4 |
| Orden por columna con defaults | Task 2 + Task 4 |
| Precios USD/MXN no mezclados | Task 2 |
| Paginación 50/página | Task 3 + Task 4 |
| Reset página al filtrar | Task 4 |
| Limpiar selección al cambiar página | Task 4 |
| Sin columnas nuevas | Task 4 |
| Tests Vitest | Tasks 1–3 |
| lint + build | Task 4–5 |

## Criterios de aceptación (checklist final)

- [ ] Búsqueda multi-palabra en tiempo real
- [ ] Orden por clic en encabezado con ▲/▼
- [ ] 50 filas/página con controles
- [ ] Fecha ↓ por defecto al cargar
- [ ] `npm test` pasa
- [ ] `npm run lint` y `npm run build` pasan
- [ ] Verificación manual Task 5 completada
