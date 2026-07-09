# Reportes de Compras — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una página `/reportes` a SMV Hub que muestre un reporte profesional con KPIs, tabla agrupada con subtotales y exportación a PDF por impresión del navegador.

**Architecture:** Lógica pura en `lib/reportes.ts` (funciones sin efectos secundarios, completamente testeables con Vitest). Un Client Component `ReporteView.tsx` que llama a `listarOrdenes()`, pasa los datos por las funciones puras y renderiza componentes de presentación. El PDF se genera vía `window.print()` con `@media print` en el CSS.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS v4, Zod, Vitest, Firestore (`listarOrdenes` de `lib/ordenes.ts`).

## Global Constraints

- Next.js 16: `params` son Promises — siempre hacer `await params`. Todas las páginas son dinámicas por defecto.
- Los Client Components tienen `'use client'` al inicio del archivo.
- Tailwind v4 — sin `tailwind.config.js`; la configuración vive en `globals.css` con `@theme`.
- Path alias `@/*` apunta a la raíz del repo. Usar siempre `@/lib/...`, `@/app/...`.
- Montos siempre formateados con `Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda })`.
- Vitest con `environment: 'node'` y `globals: true` (ver `vitest.config.ts`).
- Firebase v12 — los imports son de `'firebase/firestore'` (modular SDK).
- Fechas en `OrdenCompra.fechaFactura` son strings ISO `YYYY-MM-DD` o `null`.

---

## File Map

| Acción | Archivo | Responsabilidad |
|--------|---------|-----------------|
| Modificar | `lib/schemas.ts` | Agregar `cuentaCargo` y `destino` opcionales a `CamposManualSchema` |
| Modificar | `app/nueva-compra/NuevaCompraForm.tsx` | Agregar inputs opcionales para los dos campos nuevos |
| Crear | `lib/reportes.ts` | Tipos y funciones puras: `filtrarPorRango`, `aplanarLineas`, `agrupar`, `calcularKpis`, `periodoPreset` |
| Crear | `tests/reportes.test.ts` | Tests Vitest para las funciones puras |
| Crear | `app/reportes/page.tsx` | Server Component raíz con AuthGuard |
| Crear | `app/reportes/ReporteView.tsx` | Client Component: estado, fetch, orquestación |
| Crear | `app/reportes/components/CabeceraReporte.tsx` | Logo SMV + título + botón "Guardar PDF" |
| Crear | `app/reportes/components/FiltrosReporte.tsx` | Presets de periodo + selector agrupación + selector moneda |
| Crear | `app/reportes/components/FranjaKpis.tsx` | 4 tarjetas de KPI |
| Crear | `app/reportes/components/TablaReporte.tsx` | Tabla agrupada con subtotales y total general |
| Crear | `app/reportes/components/AvisoPendientes.tsx` | Banner estático de compras pendientes |
| Modificar | `app/globals.css` | Reglas `@media print` |
| Modificar | `app/page.tsx` | Enlace "Reportes" en la navegación de inicio |

---

## Task 1: Schema — Agregar cuentaCargo y destino

**Files:**
- Modify: `lib/schemas.ts`
- Modify: `app/nueva-compra/NuevaCompraForm.tsx`

**Interfaces:**
- Produces: `OrdenCompra` tendrá `cuentaCargo: string` y `destino: string` (con default `""`) que Tasks 2–3 usan en `Linea`.

- [ ] **Step 1: Agregar los campos a CamposManualSchema**

Abrir `lib/schemas.ts`. Cambiar el bloque `CamposManualSchema` de:
```ts
export const CamposManualSchema = z.object({
  requisitor: z.string().min(1, "El requisitor es obligatorio"),
  ordenTrabajo: z.string().min(1, "La orden de trabajo es obligatoria"),
  empresa: z.string().min(1, "La empresa es obligatoria"),
})
```
a:
```ts
export const CamposManualSchema = z.object({
  requisitor: z.string().min(1, "El requisitor es obligatorio"),
  ordenTrabajo: z.string().min(1, "La orden de trabajo es obligatoria"),
  empresa: z.string().min(1, "La empresa es obligatoria"),
  cuentaCargo: z.string().optional().default(""),
  destino: z.string().optional().default(""),
})
```

- [ ] **Step 2: Verificar que los tipos derivados están bien**

`NuevaCompraFormSchema` y `OrdenCompraSchema` derivan automáticamente de `CamposManualSchema`, así que el cambio se propaga sin tocar esos schemas. Verificar mentalmente:
- `NuevaCompraForm` tendrá `cuentaCargo?: string` y `destino?: string`
- `OrdenCompra` tendrá los mismos campos

- [ ] **Step 3: Actualizar NuevaCompraForm — defaultValues y resets**

En `app/nueva-compra/NuevaCompraForm.tsx`, modificar el `defaultValues` para incluir los campos:
```tsx
defaultValues: { moneda: 'USD', items: [], cuentaCargo: '', destino: '' },
```

Dentro de `handleImageChange`, en el `reset()` que repopula el form tras la extracción, agregar los campos al objeto:
```tsx
reset({
  proveedor: ext.proveedor,
  numeroFactura: ext.numeroFactura ?? '',
  fechaFactura: ext.fechaFactura ?? '',
  moneda: ext.moneda,
  subtotal: ext.subtotal,
  impuestos: ext.impuestos,
  total: ext.total,
  items: ext.items,
  requisitor: '',
  ordenTrabajo: '',
  empresa: '',
  cuentaCargo: '',
  destino: '',
})
```

En `clearImage()`, actualizar el `reset()`:
```tsx
reset({ moneda: 'USD', items: [], cuentaCargo: '', destino: '' })
```

- [ ] **Step 4: Agregar los inputs en la sección "Datos de la compra"**

En `app/nueva-compra/NuevaCompraForm.tsx`, dentro de la sección `{/* ── Datos de la compra ──────────────────────────────────────────── */}`, agregar dos inputs opcionales después del input de `empresa`:

```tsx
<div>
  <label className={cls.label}>Cuenta Cargo</label>
  <input {...register('cuentaCargo')} className={cls.input} placeholder="SO19316 / Fresadora Daniel" />
</div>

<div>
  <label className={cls.label}>Destino</label>
  <input {...register('destino')} className={cls.input} placeholder="SMV / Fisher / Siltech" />
</div>
```

- [ ] **Step 5: Verificar tipos en NuevaCompraFormWrapper**

`app/nueva-compra/NuevaCompraFormWrapper.tsx` ya hace `crearOrden({ ...data, imagenUrl, imagenPath })`. Como `data` es `NuevaCompraForm` que ahora incluye `cuentaCargo` y `destino`, se propagan automáticamente. No se requieren cambios.

- [ ] **Step 6: Correr tests existentes**

```bash
npm run test -- --run
```
Expected: todos los tests existentes pasan (los campos nuevos son opcionales con default, no rompen nada).

- [ ] **Step 7: Commit**

```bash
git add lib/schemas.ts app/nueva-compra/NuevaCompraForm.tsx
git commit -m "feat(schema): add optional cuentaCargo and destino fields"
```

---

## Task 2: lib/reportes.ts — Lógica pura (TDD)

**Files:**
- Create: `lib/reportes.ts`
- Create: `tests/reportes.test.ts`

**Interfaces:**
- Consumes: `OrdenCompra` de `@/lib/schemas`
- Produces:
  - `Linea` — una fila por ítem con impuestos distribuidos
  - `Grupo` — array de líneas agrupadas + subtotales
  - `Kpis` — métricas del reporte
  - `ReporteData` — tipo compuesto (no obligatorio exportar, pero útil)
  - `filtrarPorRango(ordenes: OrdenCompra[], desde: Date, hasta: Date): OrdenCompra[]`
  - `aplanarLineas(ordenes: OrdenCompra[]): Linea[]`
  - `agrupar(lineas: Linea[], criterio: CriterioAgrupacion): Grupo[]`
  - `calcularKpis(lineas: Linea[]): Kpis`
  - `periodoPreset(tipo: 'semana' | 'mes'): { desde: Date; hasta: Date }`

- [ ] **Step 1: Escribir el archivo de tipos y stubs en lib/reportes.ts**

Crear `lib/reportes.ts` con solo las declaraciones de tipos y funciones vacías que tiran error (así los tests fallan por la razón correcta):

```ts
import type { OrdenCompra } from "@/lib/schemas"

export type CriterioAgrupacion = "proveedor" | "destino" | "requisitor"

export type Linea = {
  ordenId: string
  referencia: string
  dia: Date | null
  proveedor: string
  descripcion: string
  cantidad: number | null
  precioUnitario: number | null
  subtotal: number
  total: number
  requisitor: string
  cuentaCargo: string
  destino: string
  moneda: string
}

export type Grupo = {
  clave: string
  lineas: Linea[]
  subtotal: number
  total: number
}

export type Kpis = {
  totalComprado: number
  numOrdenes: number
  numArticulos: number
  numProveedores: number
  destinoTop: string
  destinoTopPct: number
}

export function filtrarPorRango(
  ordenes: OrdenCompra[],
  desde: Date,
  hasta: Date
): OrdenCompra[] {
  throw new Error("not implemented")
}

export function aplanarLineas(ordenes: OrdenCompra[]): Linea[] {
  throw new Error("not implemented")
}

export function agrupar(lineas: Linea[], criterio: CriterioAgrupacion): Grupo[] {
  throw new Error("not implemented")
}

export function calcularKpis(lineas: Linea[]): Kpis {
  throw new Error("not implemented")
}

export function periodoPreset(tipo: "semana" | "mes"): { desde: Date; hasta: Date } {
  throw new Error("not implemented")
}
```

- [ ] **Step 2: Escribir los tests en tests/reportes.test.ts**

Crear `tests/reportes.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
  filtrarPorRango,
  aplanarLineas,
  agrupar,
  calcularKpis,
  periodoPreset,
} from "@/lib/reportes"
import type { OrdenCompra } from "@/lib/schemas"

// ── Helper ────────────────────────────────────────────────────────────────────

function makeOrden(overrides: Partial<OrdenCompra> = {}): OrdenCompra {
  return {
    id: "ord-1",
    proveedor: "McMaster-Carr",
    numeroFactura: "INV-001",
    fechaFactura: "2026-06-10",
    moneda: "USD",
    subtotal: 100,
    impuestos: 16,
    total: 116,
    items: [
      { descripcion: "Tornillo M8", cantidad: 10, precioUnitario: 10, total: 100 },
    ],
    requisitor: "Juan",
    ordenTrabajo: "OT-100",
    empresa: "SMV",
    cuentaCargo: "SO19316",
    destino: "SMV",
    estado: "pendiente",
    creadoEn: new Date("2026-06-10"),
    actualizadoEn: new Date("2026-06-10"),
    ...overrides,
  }
}

// ── filtrarPorRango ───────────────────────────────────────────────────────────

describe("filtrarPorRango", () => {
  it("incluye órdenes cuya fechaFactura está dentro del rango", () => {
    const orden = makeOrden({ fechaFactura: "2026-06-10" })
    const resultado = filtrarPorRango(
      [orden],
      new Date("2026-06-01"),
      new Date("2026-06-30")
    )
    expect(resultado).toHaveLength(1)
  })

  it("excluye órdenes fuera del rango", () => {
    const orden = makeOrden({ fechaFactura: "2026-05-15" })
    const resultado = filtrarPorRango(
      [orden],
      new Date("2026-06-01"),
      new Date("2026-06-30")
    )
    expect(resultado).toHaveLength(0)
  })

  it("excluye órdenes sin fechaFactura", () => {
    const orden = makeOrden({ fechaFactura: null })
    const resultado = filtrarPorRango(
      [orden],
      new Date("2026-06-01"),
      new Date("2026-06-30")
    )
    expect(resultado).toHaveLength(0)
  })

  it("incluye órdenes exactamente en los límites del rango (inclusive)", () => {
    const desde = new Date("2026-06-01")
    const hasta = new Date("2026-06-30")
    const ordenInicio = makeOrden({ id: "a", fechaFactura: "2026-06-01" })
    const ordenFin = makeOrden({ id: "b", fechaFactura: "2026-06-30" })
    const resultado = filtrarPorRango([ordenInicio, ordenFin], desde, hasta)
    expect(resultado).toHaveLength(2)
  })
})

// ── aplanarLineas ─────────────────────────────────────────────────────────────

describe("aplanarLineas", () => {
  it("crea una Linea por ítem con impuestos proporcionales", () => {
    const orden = makeOrden({
      subtotal: 100,
      impuestos: 16,
      items: [
        { descripcion: "A", cantidad: 1, precioUnitario: 60, total: 60 },
        { descripcion: "B", cantidad: 2, precioUnitario: 20, total: 40 },
      ],
    })
    const lineas = aplanarLineas([orden])
    expect(lineas).toHaveLength(2)
    // Línea A: subtotal 60, impuesto proporcional = 16 * 60/100 = 9.6 → total = 69.6
    expect(lineas[0].subtotal).toBeCloseTo(60)
    expect(lineas[0].total).toBeCloseTo(69.6)
    // Línea B: subtotal 40, impuesto = 16 * 40/100 = 6.4 → total = 46.4
    expect(lineas[1].subtotal).toBeCloseTo(40)
    expect(lineas[1].total).toBeCloseTo(46.4)
  })

  it("cuando no hay impuestos, total == subtotal de línea", () => {
    const orden = makeOrden({
      impuestos: null,
      items: [{ descripcion: "X", cantidad: 1, precioUnitario: 50, total: 50 }],
    })
    const [linea] = aplanarLineas([orden])
    expect(linea.subtotal).toBe(50)
    expect(linea.total).toBe(50)
  })

  it("cuando la orden no tiene ítems, crea una línea sintética con orden.total", () => {
    const orden = makeOrden({ items: [], subtotal: 200, impuestos: 32, total: 232 })
    const lineas = aplanarLineas([orden])
    expect(lineas).toHaveLength(1)
    expect(lineas[0].total).toBe(232)
    expect(lineas[0].descripcion).toBe("(orden sin ítems)")
  })

  it("mapea correctamente los campos de referencia y moneda", () => {
    const orden = makeOrden({ id: "ord-99", numeroFactura: "INV-X", moneda: "MXN" })
    const [linea] = aplanarLineas([orden])
    expect(linea.ordenId).toBe("ord-99")
    expect(linea.referencia).toBe("INV-X")
    expect(linea.moneda).toBe("MXN")
  })

  it("cuando no hay numeroFactura usa el id como referencia", () => {
    const orden = makeOrden({ id: "ord-42", numeroFactura: null })
    const [linea] = aplanarLineas([orden])
    expect(linea.referencia).toBe("ord-42")
  })

  it("mapea cuentaCargo y destino de la orden", () => {
    const orden = makeOrden({ cuentaCargo: "CC-5", destino: "Fisher" })
    const [linea] = aplanarLineas([orden])
    expect(linea.cuentaCargo).toBe("CC-5")
    expect(linea.destino).toBe("Fisher")
  })
})

// ── agrupar ───────────────────────────────────────────────────────────────────

describe("agrupar", () => {
  function makeLinea(overrides: Partial<ReturnType<typeof makeOrden>> & {
    proveedor?: string; destino?: string; requisitor?: string; total?: number; subtotal?: number
  } = {}) {
    return {
      ordenId: "ord-1",
      referencia: "INV-1",
      dia: new Date("2026-06-10"),
      proveedor: overrides.proveedor ?? "Prov A",
      descripcion: "Desc",
      cantidad: 1,
      precioUnitario: 10,
      subtotal: overrides.subtotal ?? 10,
      total: overrides.total ?? 10,
      requisitor: overrides.requisitor ?? "Juan",
      cuentaCargo: "",
      destino: overrides.destino ?? "SMV",
      moneda: "USD",
    }
  }

  it("agrupa líneas por proveedor", () => {
    const lineas = [
      makeLinea({ proveedor: "A", total: 100 }),
      makeLinea({ proveedor: "B", total: 50 }),
      makeLinea({ proveedor: "A", total: 200 }),
    ]
    const grupos = agrupar(lineas, "proveedor")
    expect(grupos).toHaveLength(2)
    const grupoA = grupos.find((g) => g.clave === "A")!
    expect(grupoA.lineas).toHaveLength(2)
    expect(grupoA.total).toBe(300)
  })

  it("ordena grupos por total descendente", () => {
    const lineas = [
      makeLinea({ proveedor: "Barato", total: 10 }),
      makeLinea({ proveedor: "Caro", total: 500 }),
    ]
    const grupos = agrupar(lineas, "proveedor")
    expect(grupos[0].clave).toBe("Caro")
    expect(grupos[1].clave).toBe("Barato")
  })

  it("agrupa líneas sin destino bajo '(sin destino)'", () => {
    const lineas = [makeLinea({ destino: "" })]
    const grupos = agrupar(lineas, "destino")
    expect(grupos[0].clave).toBe("(sin destino)")
  })

  it("calcula subtotal y total por grupo", () => {
    const lineas = [
      { ...makeLinea(), subtotal: 80, total: 100 },
      { ...makeLinea(), subtotal: 120, total: 150 },
    ]
    const [grupo] = agrupar(lineas, "proveedor")
    expect(grupo.subtotal).toBe(200)
    expect(grupo.total).toBe(250)
  })
})

// ── calcularKpis ──────────────────────────────────────────────────────────────

describe("calcularKpis", () => {
  function mkl(overrides: {
    referencia?: string; proveedor?: string; destino?: string; total?: number; cantidad?: number
  } = {}) {
    return {
      ordenId: "ord-1",
      referencia: overrides.referencia ?? "INV-1",
      dia: new Date(),
      proveedor: overrides.proveedor ?? "Prov",
      descripcion: "Desc",
      cantidad: overrides.cantidad ?? 1,
      precioUnitario: 10,
      subtotal: overrides.total ?? 100,
      total: overrides.total ?? 100,
      requisitor: "Juan",
      cuentaCargo: "",
      destino: overrides.destino ?? "SMV",
      moneda: "USD",
    }
  }

  it("suma el total comprado", () => {
    const kpis = calcularKpis([mkl({ total: 100 }), mkl({ total: 200 })])
    expect(kpis.totalComprado).toBe(300)
  })

  it("cuenta órdenes distintas por referencia", () => {
    const kpis = calcularKpis([
      mkl({ referencia: "INV-1" }),
      mkl({ referencia: "INV-1" }),  // misma referencia → 1 orden
      mkl({ referencia: "INV-2" }),
    ])
    expect(kpis.numOrdenes).toBe(2)
  })

  it("cuenta proveedores distintos", () => {
    const kpis = calcularKpis([
      mkl({ proveedor: "A" }),
      mkl({ proveedor: "A" }),
      mkl({ proveedor: "B" }),
    ])
    expect(kpis.numProveedores).toBe(2)
  })

  it("suma artículos correctamente", () => {
    const kpis = calcularKpis([mkl({ cantidad: 3 }), mkl({ cantidad: 5 })])
    expect(kpis.numArticulos).toBe(8)
  })

  it("identifica el destino con mayor gasto y calcula su porcentaje", () => {
    const kpis = calcularKpis([
      mkl({ destino: "SMV", total: 600 }),
      mkl({ destino: "Fisher", total: 400 }),
    ])
    expect(kpis.destinoTop).toBe("SMV")
    expect(kpis.destinoTopPct).toBeCloseTo(60)
  })

  it("devuelve porcentaje 0 cuando no hay gasto", () => {
    const kpis = calcularKpis([])
    expect(kpis.destinoTopPct).toBe(0)
    expect(kpis.totalComprado).toBe(0)
  })
})

// ── periodoPreset ─────────────────────────────────────────────────────────────

describe("periodoPreset", () => {
  it("'mes' retorna el primer y último día del mes actual", () => {
    const hoy = new Date()
    const { desde, hasta } = periodoPreset("mes")
    expect(desde.getMonth()).toBe(hoy.getMonth())
    expect(desde.getDate()).toBe(1)
    expect(hasta.getMonth()).toBe(hoy.getMonth())
    // Último día del mes
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
    expect(hasta.getDate()).toBe(ultimoDia)
  })

  it("'semana' retorna lunes y domingo de la semana actual", () => {
    const { desde, hasta } = periodoPreset("semana")
    // Lunes = 1, Domingo = 0
    expect(desde.getDay()).toBe(1)
    expect(hasta.getDay()).toBe(0)
    // Diferencia de 6 días
    const diff = (hasta.getTime() - desde.getTime()) / (1000 * 60 * 60 * 24)
    expect(diff).toBe(6)
  })
})
```

- [ ] **Step 3: Correr tests — deben fallar con "not implemented"**

```bash
npm run test -- --run tests/reportes.test.ts
```
Expected: todos los tests fallan con `Error: not implemented`. Si alguno pasa, es un bug en el test.

- [ ] **Step 4: Implementar filtrarPorRango en lib/reportes.ts**

Reemplazar el stub de `filtrarPorRando` con la implementación real:

```ts
export function filtrarPorRango(
  ordenes: OrdenCompra[],
  desde: Date,
  hasta: Date
): OrdenCompra[] {
  const ini = startOfDay(desde)
  const fin = endOfDay(hasta)
  return ordenes.filter((o) => {
    if (!o.fechaFactura) return false
    const f = new Date(o.fechaFactura)
    return f >= ini && f <= fin
  })
}

function startOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

function endOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(23, 59, 59, 999)
  return r
}
```

- [ ] **Step 5: Implementar aplanarLineas en lib/reportes.ts**

```ts
export function aplanarLineas(ordenes: OrdenCompra[]): Linea[] {
  const lineas: Linea[] = []

  for (const orden of ordenes) {
    const ref = orden.numeroFactura ?? orden.id
    const dia = orden.fechaFactura ? new Date(orden.fechaFactura) : null
    const base = {
      ordenId: orden.id,
      referencia: ref,
      dia,
      proveedor: orden.proveedor,
      requisitor: orden.requisitor,
      cuentaCargo: orden.cuentaCargo ?? "",
      destino: orden.destino ?? "",
      moneda: orden.moneda,
    }

    if (orden.items.length === 0) {
      lineas.push({
        ...base,
        descripcion: "(orden sin ítems)",
        cantidad: null,
        precioUnitario: null,
        subtotal: orden.subtotal ?? 0,
        total: orden.total ?? 0,
      })
      continue
    }

    const ordenSubtotal = orden.items.reduce((s, item) => s + (item.total ?? 0), 0)
    const impuestos = orden.impuestos ?? 0

    for (const item of orden.items) {
      const subLinea = item.total ?? 0
      const propTax = ordenSubtotal > 0
        ? impuestos * (subLinea / ordenSubtotal)
        : impuestos / orden.items.length
      lineas.push({
        ...base,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        subtotal: subLinea,
        total: subLinea + propTax,
      })
    }
  }

  return lineas
}
```

- [ ] **Step 6: Implementar agrupar en lib/reportes.ts**

```ts
export function agrupar(lineas: Linea[], criterio: CriterioAgrupacion): Grupo[] {
  const map = new Map<string, Linea[]>()
  for (const linea of lineas) {
    const clave = linea[criterio] || `(sin ${criterio})`
    const arr = map.get(clave) ?? []
    arr.push(linea)
    map.set(clave, arr)
  }
  return Array.from(map.entries())
    .map(([clave, ls]) => ({
      clave,
      lineas: ls,
      subtotal: ls.reduce((s, l) => s + l.subtotal, 0),
      total: ls.reduce((s, l) => s + l.total, 0),
    }))
    .sort((a, b) => b.total - a.total)
}
```

- [ ] **Step 7: Implementar calcularKpis en lib/reportes.ts**

```ts
export function calcularKpis(lineas: Linea[]): Kpis {
  const totalComprado = lineas.reduce((s, l) => s + l.total, 0)
  const numOrdenes = new Set(lineas.map((l) => l.referencia)).size
  const numArticulos = lineas.reduce((s, l) => s + (l.cantidad ?? 0), 0)
  const numProveedores = new Set(lineas.map((l) => l.proveedor)).size

  const gastosPorDestino = new Map<string, number>()
  for (const l of lineas) {
    const d = l.destino || "(sin destino)"
    gastosPorDestino.set(d, (gastosPorDestino.get(d) ?? 0) + l.total)
  }

  let destinoTop = ""
  let destinoTopGasto = 0
  for (const [d, gasto] of gastosPorDestino) {
    if (gasto > destinoTopGasto) {
      destinoTop = d
      destinoTopGasto = gasto
    }
  }

  const destinoTopPct = totalComprado > 0
    ? (destinoTopGasto / totalComprado) * 100
    : 0

  return { totalComprado, numOrdenes, numArticulos, numProveedores, destinoTop, destinoTopPct }
}
```

- [ ] **Step 8: Implementar periodoPreset en lib/reportes.ts**

```ts
export function periodoPreset(tipo: "semana" | "mes"): { desde: Date; hasta: Date } {
  const hoy = new Date()
  if (tipo === "semana") {
    const day = hoy.getDay() // 0=dom,1=lun...
    const diffLunes = day === 0 ? -6 : 1 - day
    const lunes = new Date(hoy)
    lunes.setDate(hoy.getDate() + diffLunes)
    const domingo = new Date(lunes)
    domingo.setDate(lunes.getDate() + 6)
    return { desde: lunes, hasta: domingo }
  }
  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
  return { desde, hasta }
}
```

- [ ] **Step 9: Correr tests — deben pasar todos**

```bash
npm run test -- --run tests/reportes.test.ts
```
Expected: todos los tests pasan (✓). Si alguno falla, leer el mensaje de error y corregir la implementación.

- [ ] **Step 10: Commit**

```bash
git add lib/reportes.ts tests/reportes.test.ts
git commit -m "feat: add pure reporting logic with full Vitest coverage"
```

---

## Task 3: Página /reportes — Route, ReporteView y componentes

**Files:**
- Create: `app/reportes/page.tsx`
- Create: `app/reportes/ReporteView.tsx`
- Create: `app/reportes/components/CabeceraReporte.tsx`
- Create: `app/reportes/components/FiltrosReporte.tsx`
- Create: `app/reportes/components/FranjaKpis.tsx`
- Create: `app/reportes/components/TablaReporte.tsx`
- Create: `app/reportes/components/AvisoPendientes.tsx`

**Interfaces:**
- Consumes:
  - `listarOrdenes(): Promise<OrdenCompra[]>` de `@/lib/ordenes`
  - `filtrarPorRango`, `aplanarLineas`, `agrupar`, `calcularKpis`, `periodoPreset` de `@/lib/reportes`
  - `CriterioAgrupacion`, `Grupo`, `Kpis`, `Linea` de `@/lib/reportes`
  - `AuthGuard` de `@/app/AuthGuard`
- Produces: ruta `/reportes` accesible y protegida

- [ ] **Step 1: Crear app/reportes/page.tsx**

```tsx
import AuthGuard from "@/app/AuthGuard"
import ReporteView from "@/app/reportes/ReporteView"

export default function ReportesPage() {
  return (
    <AuthGuard>
      <ReporteView />
    </AuthGuard>
  )
}
```

- [ ] **Step 2: Crear app/reportes/components/AvisoPendientes.tsx**

```tsx
export default function AvisoPendientes() {
  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 no-print">
      ⚠ Quedan pendientes las compras en efectivo — no se reflejan en este reporte.
    </div>
  )
}
```

- [ ] **Step 3: Crear app/reportes/components/FranjaKpis.tsx**

```tsx
import type { Kpis } from "@/lib/reportes"

type Props = { kpis: Kpis; moneda: string }

function KpiCard({ titulo, valor, subtitulo }: { titulo: string; valor: string; subtitulo: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-500 mb-1">{titulo}</p>
      <p className="text-2xl font-bold text-gray-900 tabular-nums leading-tight">{valor}</p>
      {subtitulo && <p className="text-xs text-gray-400 mt-1">{subtitulo}</p>}
    </div>
  )
}

export default function FranjaKpis({ kpis, moneda }: Props) {
  const fmt = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: 2,
  })

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      <KpiCard
        titulo="Total comprado"
        valor={fmt.format(kpis.totalComprado)}
        subtitulo="IVA incluido"
      />
      <KpiCard
        titulo="Órdenes (PO)"
        valor={String(kpis.numOrdenes)}
        subtitulo={`${kpis.numArticulos} artículos`}
      />
      <KpiCard
        titulo="Proveedores"
        valor={String(kpis.numProveedores)}
        subtitulo=""
      />
      <KpiCard
        titulo="Destino principal"
        valor={kpis.destinoTop || "—"}
        subtitulo={kpis.destinoTop ? `${kpis.destinoTopPct.toFixed(1)}% del gasto` : ""}
      />
    </div>
  )
}
```

- [ ] **Step 4: Crear app/reportes/components/TablaReporte.tsx**

```tsx
import type { Grupo } from "@/lib/reportes"

type Props = { grupos: Grupo[]; totalGeneral: number; moneda: string }

const COLS = 11

function fmtFecha(d: Date | null): string {
  if (!d) return "—"
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export default function TablaReporte({ grupos, totalGeneral, moneda }: Props) {
  const fmt = (n: number) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: moneda,
      minimumFractionDigits: 2,
    }).format(n)

  if (grupos.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-8 text-center">
        No hay compras en este periodo con los filtros seleccionados.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[900px]">
        <thead>
          <tr className="border-b-2 border-gray-300">
            {["Referencia","Día","Proveedor","Descripción","Cant.","P. Unitario","Subtotal","Total","Requisitor","Cuenta Cargo","Destino"].map((h, i) => (
              <th
                key={h}
                className={`pb-2 pr-3 text-xs font-semibold text-gray-600 ${i >= 4 && i <= 7 ? "text-right" : "text-left"}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grupos.map((grupo) => (
            <>
              <tr key={`gh-${grupo.clave}`} className="bg-blue-50 print:bg-gray-100">
                <td
                  colSpan={COLS}
                  className="py-2 px-2 text-sm font-semibold text-blue-900 border-t border-blue-200"
                >
                  {grupo.clave}
                </td>
              </tr>

              {grupo.lineas.map((linea, i) => (
                <tr
                  key={`${grupo.clave}-${i}`}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-1.5 pr-3 font-mono text-xs text-gray-500">{linea.referencia}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap text-xs">{fmtFecha(linea.dia)}</td>
                  <td className="py-1.5 pr-3">{linea.proveedor}</td>
                  <td className="py-1.5 pr-3 max-w-[200px] truncate" title={linea.descripcion}>
                    {linea.descripcion}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{linea.cantidad ?? "—"}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {linea.precioUnitario != null ? fmt(linea.precioUnitario) : "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{fmt(linea.subtotal)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums font-medium">{fmt(linea.total)}</td>
                  <td className="py-1.5 pr-3 text-xs">{linea.requisitor || "—"}</td>
                  <td className="py-1.5 pr-3 text-xs">{linea.cuentaCargo || "—"}</td>
                  <td className="py-1.5 text-xs">{linea.destino || "—"}</td>
                </tr>
              ))}

              <tr key={`st-${grupo.clave}`} className="border-t border-gray-300 bg-gray-50">
                <td colSpan={6} className="py-1.5 pr-3 text-right text-xs font-semibold text-gray-600">
                  Subtotal {grupo.clave}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums font-semibold text-gray-800">
                  {fmt(grupo.subtotal)}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums font-semibold text-gray-800">
                  {fmt(grupo.total)}
                </td>
                <td colSpan={3} />
              </tr>
            </>
          ))}

          <tr className="border-t-2 border-gray-900">
            <td colSpan={7} className="py-2.5 pr-3 text-right text-sm font-bold text-gray-900 uppercase tracking-wide">
              Total General
            </td>
            <td className="py-2.5 pr-3 text-right tabular-nums text-base font-bold text-gray-900">
              {fmt(totalGeneral)}
            </td>
            <td colSpan={3} />
          </tr>
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 5: Crear app/reportes/components/FiltrosReporte.tsx**

```tsx
'use client'

import type { CriterioAgrupacion } from "@/lib/reportes"

type PresetTipo = "semana" | "mes" | "personalizado"

type Props = {
  presetTipo: PresetTipo
  desde: Date
  hasta: Date
  agruparPor: CriterioAgrupacion
  monedas: string[]
  moneda: string
  onPreset: (tipo: "semana" | "mes") => void
  onDesde: (d: Date) => void
  onHasta: (d: Date) => void
  onAgrupar: (criterio: CriterioAgrupacion) => void
  onMoneda: (m: string) => void
}

function toInputDate(d: Date): string {
  return d.toISOString().split("T")[0]
}

export default function FiltrosReporte({
  presetTipo,
  desde,
  hasta,
  agruparPor,
  monedas,
  moneda,
  onPreset,
  onDesde,
  onHasta,
  onAgrupar,
  onMoneda,
}: Props) {
  const btnBase = "px-3 py-1.5 text-sm rounded-md font-medium transition-colors"
  const btnActive = "bg-blue-600 text-white"
  const btnInactive = "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
  const inputCls = "rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="flex flex-wrap gap-3 items-end mb-6 no-print">
      {/* Period presets */}
      <div className="flex gap-2">
        <button
          className={`${btnBase} ${presetTipo === "semana" ? btnActive : btnInactive}`}
          onClick={() => onPreset("semana")}
        >
          Esta semana
        </button>
        <button
          className={`${btnBase} ${presetTipo === "mes" ? btnActive : btnInactive}`}
          onClick={() => onPreset("mes")}
        >
          Este mes
        </button>
      </div>

      {/* Custom date range */}
      <div className="flex gap-2 items-center">
        <input
          type="date"
          className={inputCls}
          value={toInputDate(desde)}
          onChange={(e) => onDesde(new Date(e.target.value + "T00:00:00"))}
        />
        <span className="text-gray-400 text-sm">—</span>
        <input
          type="date"
          className={inputCls}
          value={toInputDate(hasta)}
          onChange={(e) => onHasta(new Date(e.target.value + "T23:59:59"))}
        />
      </div>

      {/* Group by */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Agrupar:</span>
        <select
          className={inputCls}
          value={agruparPor}
          onChange={(e) => onAgrupar(e.target.value as CriterioAgrupacion)}
        >
          <option value="proveedor">Proveedor</option>
          <option value="destino">Destino</option>
          <option value="requisitor">Requisitor</option>
        </select>
      </div>

      {/* Currency filter (only shown when multiple currencies) */}
      {monedas.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Moneda:</span>
          <select
            className={inputCls}
            value={moneda}
            onChange={(e) => onMoneda(e.target.value)}
          >
            {monedas.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Crear app/reportes/components/CabeceraReporte.tsx**

```tsx
'use client'

import Image from "next/image"

type Props = { titulo: string; subtitulo: string }

export default function CabeceraReporte({ titulo, subtitulo }: Props) {
  return (
    <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
      <div className="flex items-center gap-4">
        <Image
          src="/smv-logo.png"
          alt="SMV"
          width={120}
          height={40}
          className="object-contain"
          priority
        />
        <div>
          <h1 className="text-xl font-bold text-gray-900">{titulo}</h1>
          <p className="text-sm text-gray-500">{subtitulo}</p>
        </div>
      </div>

      <button
        onClick={() => window.print()}
        className="no-print flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        ⬇ Guardar PDF
      </button>
    </div>
  )
}
```

- [ ] **Step 7: Crear app/reportes/ReporteView.tsx**

```tsx
'use client'

import { useState, useEffect } from "react"
import Link from "next/link"
import { listarOrdenes } from "@/lib/ordenes"
import {
  filtrarPorRango,
  aplanarLineas,
  agrupar,
  calcularKpis,
  periodoPreset,
  type CriterioAgrupacion,
} from "@/lib/reportes"
import type { OrdenCompra } from "@/lib/schemas"
import CabeceraReporte from "@/app/reportes/components/CabeceraReporte"
import FiltrosReporte from "@/app/reportes/components/FiltrosReporte"
import FranjaKpis from "@/app/reportes/components/FranjaKpis"
import TablaReporte from "@/app/reportes/components/TablaReporte"
import AvisoPendientes from "@/app/reportes/components/AvisoPendientes"
import { Loader2, AlertCircle } from "lucide-react"

type PresetTipo = "semana" | "mes" | "personalizado"

function tituloReporte(desde: Date, hasta: Date): string {
  const opt: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }
  const loc = "es-MX"
  if (
    desde.getDate() === 1 &&
    hasta.getDate() === new Date(hasta.getFullYear(), hasta.getMonth() + 1, 0).getDate() &&
    desde.getMonth() === hasta.getMonth()
  ) {
    return desde.toLocaleDateString(loc, { month: "long", year: "numeric" })
  }
  return `${desde.toLocaleDateString(loc, opt)} — ${hasta.toLocaleDateString(loc, opt)}`
}

export default function ReporteView() {
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [presetTipo, setPresetTipo] = useState<PresetTipo>("semana")
  const [periodo, setPeriodo] = useState(() => periodoPreset("semana"))
  const [agruparPor, setAgruparPor] = useState<CriterioAgrupacion>("proveedor")
  const [moneda, setMoneda] = useState("MXN")

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      setOrdenes(await listarOrdenes())
    } catch {
      setError("No se pudieron cargar las órdenes. Verifica tu conexión.")
    } finally {
      setCargando(false)
    }
  }

  function handlePreset(tipo: "semana" | "mes") {
    setPresetTipo(tipo)
    setPeriodo(periodoPreset(tipo))
  }

  const ordenesDelPeriodo = filtrarPorRango(ordenes, periodo.desde, periodo.hasta)
  const lineasTodas = aplanarLineas(ordenesDelPeriodo)
  const monedas = [...new Set(lineasTodas.map((l) => l.moneda))].filter(Boolean)
  const monedaActiva = monedas.includes(moneda) ? moneda : (monedas[0] ?? "MXN")
  const lineas = lineasTodas.filter((l) => l.moneda === monedaActiva)
  const grupos = agrupar(lineas, agruparPor)
  const kpis = calcularKpis(lineas)
  const totalGeneral = grupos.reduce((s, g) => s + g.total, 0)

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500 mr-2" />
        <span className="text-sm text-gray-600">Cargando órdenes…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="text-sm text-gray-700">{error}</p>
        <button
          onClick={cargar}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-4 py-6">

        {/* Back link — hidden on print */}
        <div className="mb-4 no-print">
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            ← Inicio
          </Link>
        </div>

        <CabeceraReporte
          titulo="Reporte de compras"
          subtitulo={tituloReporte(periodo.desde, periodo.hasta)}
        />

        <FiltrosReporte
          presetTipo={presetTipo}
          desde={periodo.desde}
          hasta={periodo.hasta}
          agruparPor={agruparPor}
          monedas={monedas}
          moneda={monedaActiva}
          onPreset={handlePreset}
          onDesde={(d) => { setPeriodo((p) => ({ ...p, desde: d })); setPresetTipo("personalizado") }}
          onHasta={(d) => { setPeriodo((p) => ({ ...p, hasta: d })); setPresetTipo("personalizado") }}
          onAgrupar={setAgruparPor}
          onMoneda={setMoneda}
        />

        <AvisoPendientes />

        {lineas.length > 0 && (
          <div className="mb-6">
            <FranjaKpis kpis={kpis} moneda={monedaActiva} />
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <TablaReporte grupos={grupos} totalGeneral={totalGeneral} moneda={monedaActiva} />
        </div>

      </div>
    </main>
  )
}
```

- [ ] **Step 8: Verificar que el servidor compila sin errores de TypeScript**

```bash
npm run build 2>&1 | head -50
```
Expected: sin errores de tipo. Si hay errores, leerlos y corregirlos antes de continuar.

- [ ] **Step 9: Commit**

```bash
git add app/reportes/
git commit -m "feat: add /reportes page with grouped table, KPIs and currency filter"
```

---

## Task 4: Print CSS y enlace de navegación

**Files:**
- Modify: `app/globals.css`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: clase `.no-print` usada en CabeceraReporte, FiltrosReporte y AvisoPendientes
- Produces: reporte imprimible en carta horizontal; enlace "Reportes" en la home

- [ ] **Step 1: Agregar reglas @media print a globals.css**

Al final de `app/globals.css`, agregar:

```css
@media print {
  .no-print {
    display: none !important;
  }

  body {
    background: white !important;
    color: black !important;
  }

  @page {
    size: letter landscape;
    margin: 1cm;
  }

  /* Evitar cortes de grupo a media fila */
  tr {
    break-inside: avoid;
  }

  /* Mostrar colores de fondo en grupos */
  * {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}
```

- [ ] **Step 2: Agregar enlace "Reportes" en app/page.tsx**

En `app/page.tsx`, dentro del `<div className="flex flex-col sm:flex-row gap-3 justify-center">`, agregar un enlace más:

```tsx
<Link
  href="/reportes"
  className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
>
  Reportes
</Link>
```

- [ ] **Step 3: Verificar build limpio**

```bash
npm run build 2>&1 | tail -20
```
Expected: `✓ Compiled successfully` o equivalente sin errores.

- [ ] **Step 4: Commit final**

```bash
git add app/globals.css app/page.tsx
git commit -m "feat: add print CSS and Reportes nav link"
```

---

## Self-Review

**Spec coverage:**

| Sección del spec | Task que la implementa |
|-----------------|----------------------|
| Campos cuentaCargo + destino | Task 1 |
| lib/reportes.ts funciones puras | Task 2 |
| Tests Vitest | Task 2 |
| /reportes protegida con AuthGuard | Task 3 (page.tsx) |
| Presets de periodo | Task 3 (FiltrosReporte) |
| KPIs | Task 3 (FranjaKpis + calcularKpis) |
| Tabla agrupada con subtotales | Task 3 (TablaReporte) |
| Selector de agrupación | Task 3 (FiltrosReporte) |
| Filtro de moneda | Task 3 (FiltrosReporte + ReporteView) |
| Logo SMV | Task 3 (CabeceraReporte — `/smv-logo.png`) |
| PDF por impresión | Task 3 (botón) + Task 4 (CSS) |
| Estado cargando / vacío / error | Task 3 (ReporteView) |
| Enlace en navegación | Task 4 |

✓ Todos los requisitos del spec están cubiertos.

**Placeholder scan:** Sin TBD, TODO ni "handle edge cases" vagos — cada step tiene código real.

**Type consistency:**
- `Linea` se define en Task 2 y se usa en Task 3 via `import type { Linea, Grupo, Kpis, CriterioAgrupacion } from "@/lib/reportes"` (explícito en los props de cada componente).
- `calcularKpis(lineas: Linea[]): Kpis` — el tipo de retorno coincide con los props de `FranjaKpis`.
- `agrupar(lineas: Linea[], criterio: CriterioAgrupacion): Grupo[]` — coincide con props de `TablaReporte`.
- `cuentaCargo` y `destino` se definen en Task 1 como `string` (con default) y se mapean como `string` en `aplanarLineas`.
