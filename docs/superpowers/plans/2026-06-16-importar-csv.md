# Importación masiva desde CSV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una página `/importar` que permita subir un CSV exportado de Google Sheets y crear todas las órdenes en Firestore en un batch, con preview y validación antes de confirmar.

**Architecture:** Parseo del CSV en el browser (sin servidor), preview con tabla interactiva en tres estados (upload → preview → resultado), y escritura a Firestore en lotes de 10 llamando a `crearOrden` existente. Se extiende `OrdenCompraSchema` con dos campos nuevos (`linkProveedor`, `fechaEntrega`) y se hace `imagenUrl`/`imagenPath` opcional para soportar órdenes sin imagen.

**Tech Stack:** Next.js 16 App Router, React 19, Firebase Firestore, Zod v4, TypeScript strict, Vitest, Tailwind CSS v4

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `lib/schemas.ts` | Modificar | Agregar `linkProveedor`, `fechaEntrega`; hacer `imagenUrl`/`imagenPath` opcionales |
| `lib/ordenes.ts` | Modificar | Agregar campos opcionales a `NuevaOrdenPayload`; respetar `estado` del payload en `crearOrden` |
| `lib/importar.ts` | Crear | Parseo CSV, detección de columnas, mapeo/validación de filas, batch write |
| `tests/schemas.test.ts` | Modificar | Tests para nuevos campos y `imagenUrl` opcional |
| `tests/importar.test.ts` | Crear | Tests para todas las funciones de `lib/importar.ts` |
| `app/importar/page.tsx` | Crear | Server Component — layout de la página |
| `app/importar/ImportarCSV.tsx` | Crear | Client Component — lógica de tres estados (upload/preview/resultado) |
| `app/page.tsx` | Modificar | Agregar botón "Importar CSV" en la home |

---

## Task 1: Actualizar `lib/schemas.ts` — nuevos campos + imagenUrl opcional

**Files:**
- Modify: `lib/schemas.ts`
- Modify: `tests/schemas.test.ts`

- [ ] **Step 1: Agregar tests que fallan**

Al final del bloque `describe("OrdenCompraSchema", ...)` en `tests/schemas.test.ts`, agregar:

```typescript
  it("acepta orden sin imagenUrl ni imagenPath (importación histórica)", () => {
    const { imagenUrl, imagenPath, ...sinImagen } = OK
    const r = OrdenCompraSchema.safeParse(sinImagen)
    expect(r.success).toBe(true)
  })

  it("acepta linkProveedor como string", () => {
    const r = OrdenCompraSchema.safeParse({ ...OK, linkProveedor: "https://amazon.com/p/123" })
    expect(r.success).toBe(true)
  })

  it("acepta linkProveedor null", () => {
    const r = OrdenCompraSchema.safeParse({ ...OK, linkProveedor: null })
    expect(r.success).toBe(true)
  })

  it("acepta fechaEntrega como string", () => {
    const r = OrdenCompraSchema.safeParse({ ...OK, fechaEntrega: "2024-07-10" })
    expect(r.success).toBe(true)
  })

  it("acepta fechaEntrega null", () => {
    const r = OrdenCompraSchema.safeParse({ ...OK, fechaEntrega: null })
    expect(r.success).toBe(true)
  })
```

- [ ] **Step 2: Verificar que los tests fallan**

```bash
npx vitest run tests/schemas.test.ts
```

Esperado: FAIL — los 5 tests nuevos fallan (campos no existen, imagenUrl requerida).

- [ ] **Step 3: Aplicar cambios al schema**

En `lib/schemas.ts`, reemplazar el bloque `OrdenCompraSchema`:

```typescript
export const OrdenCompraSchema = NuevaCompraFormSchema.extend({
  id: z.string(),
  imagenUrl: z.string().url().optional(),
  imagenPath: z.string().optional(),
  linkProveedor: z.string().nullable().optional(),
  fechaEntrega: z.string().nullable().optional(),
  estado: EstadoOrdenSchema.default("pendiente"),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
})
```

- [ ] **Step 4: Verificar que todos los tests pasan**

```bash
npx vitest run tests/schemas.test.ts
```

Esperado: PASS — todos los tests, incluidos los anteriores (el test `rechaza imagenUrl sin formato URL` sigue pasando porque `.optional()` solo permite `undefined`, no strings no-URL).

- [ ] **Step 5: Commit**

```bash
git add lib/schemas.ts tests/schemas.test.ts
git commit -m "feat: agregar linkProveedor, fechaEntrega e imagenUrl opcional al schema"
```

---

## Task 2: Actualizar `lib/ordenes.ts` — NuevaOrdenPayload + estado en crearOrden

**Files:**
- Modify: `lib/ordenes.ts`

- [ ] **Step 1: Actualizar imports y tipo `NuevaOrdenPayload`**

Agregar `EstadoOrden` al import de schemas y actualizar el tipo:

```typescript
import type { OrdenCompra, NuevaCompraForm, EstadoOrden } from "@/lib/schemas"

export type NuevaOrdenPayload = NuevaCompraForm & {
  imagenUrl?: string
  imagenPath?: string
  linkProveedor?: string | null
  fechaEntrega?: string | null
  estado?: EstadoOrden
}
```

- [ ] **Step 2: Actualizar `crearOrden` para respetar `estado` del payload**

```typescript
export async function crearOrden(payload: NuevaOrdenPayload): Promise<string> {
  const ahora = new Date()
  const ref = await addDoc(ordenesRef(), {
    ...payload,
    id: "",
    estado: payload.estado ?? ("pendiente" as const),
    creadoEn: ahora,
    actualizadoEn: ahora,
  })
  return ref.id
}
```

- [ ] **Step 3: Verificar TypeScript limpio**

```bash
npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add lib/ordenes.ts
git commit -m "feat: NuevaOrdenPayload acepta campos de importación y estado explícito"
```

---

## Task 3: `lib/importar.ts` Parte 1 — parseo CSV y detección de columnas

**Files:**
- Create: `lib/importar.ts`
- Create: `tests/importar.test.ts`

- [ ] **Step 1: Crear `tests/importar.test.ts` con tests de parseo que fallan**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockCrearOrden } = vi.hoisted(() => ({
  mockCrearOrden: vi.fn().mockResolvedValue("fake-id"),
}))

vi.mock("@/lib/ordenes", () => ({
  crearOrden: mockCrearOrden,
}))

vi.mock("@/lib/firebase", () => ({
  db: {},
  storage: {},
}))

import { parsearCSVTexto, detectarColumnas } from "@/lib/importar"

// ── parsearCSVTexto ──────────────────────────────────────────────────────────

describe("parsearCSVTexto", () => {
  it("parsea CSV de dos filas con tres columnas", () => {
    const csv = "a,b,c\n1,2,3"
    expect(parsearCSVTexto(csv)).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ])
  })

  it("maneja campos entre comillas que contienen comas", () => {
    const csv = '"Tornillo, M6",10,15.00\nText,1,2'
    const rows = parsearCSVTexto(csv)
    expect(rows[0][0]).toBe("Tornillo, M6")
  })

  it("hace trim de espacios en celdas no entrecomilladas", () => {
    const csv = " Proveedor , Requisitor \n acme , juan "
    const rows = parsearCSVTexto(csv)
    expect(rows[0]).toEqual(["Proveedor", "Requisitor"])
    expect(rows[1]).toEqual(["acme", "juan"])
  })

  it("ignora líneas en blanco al final", () => {
    const csv = "a,b\n1,2\n\n"
    expect(parsearCSVTexto(csv)).toHaveLength(2)
  })

  it("maneja saltos de línea CRLF (Windows)", () => {
    const csv = "a,b\r\n1,2\r\n3,4"
    expect(parsearCSVTexto(csv)).toHaveLength(3)
  })
})

// ── detectarColumnas ─────────────────────────────────────────────────────────

describe("detectarColumnas", () => {
  it("detecta columnas en el orden exacto del spec", () => {
    const headers = [
      "Estado del pedido", "Fecha del pedido", "Proveedor",
      "Cantidad", "Descripción", "Link",
      "Fecha entrega", "Requisitor", "Orden de trabajo", "Empresa",
    ]
    const idx = detectarColumnas(headers)
    expect(idx["estado"]).toBe(0)
    expect(idx["fechaFactura"]).toBe(1)
    expect(idx["proveedor"]).toBe(2)
    expect(idx["cantidad"]).toBe(3)
    expect(idx["descripcion"]).toBe(4)
    expect(idx["linkProveedor"]).toBe(5)
    expect(idx["fechaEntrega"]).toBe(6)
    expect(idx["requisitor"]).toBe(7)
    expect(idx["ordenTrabajo"]).toBe(8)
    expect(idx["empresa"]).toBe(9)
  })

  it("es case-insensitive y hace trim", () => {
    const headers = ["  PROVEEDOR  ", "REQUISITOR", "ORDEN DE TRABAJO", "EMPRESA"]
    const idx = detectarColumnas(headers)
    expect(idx["proveedor"]).toBe(0)
    expect(idx["requisitor"]).toBe(1)
    expect(idx["ordenTrabajo"]).toBe(2)
    expect(idx["empresa"]).toBe(3)
  })

  it("reconoce alias 'Guía' para fechaEntrega", () => {
    const headers = ["Guía"]
    const idx = detectarColumnas(headers)
    expect(idx["fechaEntrega"]).toBe(0)
  })

  it("reconoce alias 'Fecha' para fechaFactura", () => {
    const headers = ["Fecha"]
    const idx = detectarColumnas(headers)
    expect(idx["fechaFactura"]).toBe(0)
  })

  it("devuelve objeto vacío si ningún header es reconocido", () => {
    const idx = detectarColumnas(["XYZ", "ABC"])
    expect(Object.keys(idx)).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Verificar que los tests fallan**

```bash
npx vitest run tests/importar.test.ts
```

Esperado: FAIL — módulo `@/lib/importar` no existe.

- [ ] **Step 3: Crear `lib/importar.ts` con `parsearCSVTexto` y `detectarColumnas`**

```typescript
import type { EstadoOrden, ItemFactura } from "@/lib/schemas"
import { crearOrden, type NuevaOrdenPayload } from "@/lib/ordenes"

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface FilaParseada {
  indice: number
  datos: NuevaOrdenPayload & { estado: EstadoOrden }
  errores: string[]       // bloquean la importación
  advertencias: string[]  // no bloquean, pero avisan
  seleccionada: boolean
}

export interface ResultadoCSV {
  filas: FilaParseada[]
  error: string | null
}

// ── Alias de columnas → nombre de campo ──────────────────────────────────────

const ALIAS: Record<string, string> = {
  "estado": "estado",
  "estado del pedido": "estado",
  "fecha": "fechaFactura",
  "fecha del pedido": "fechaFactura",
  "proveedor": "proveedor",
  "cantidad": "cantidad",
  "descripcion": "descripcion",
  "descripción": "descripcion",
  "link": "linkProveedor",
  "fecha entrega": "fechaEntrega",
  "fecha de entrega": "fechaEntrega",
  "guia": "fechaEntrega",
  "guía": "fechaEntrega",
  "requisitor": "requisitor",
  "orden de trabajo": "ordenTrabajo",
  "empresa": "empresa",
}

const COLUMNAS_REQUERIDAS = ["proveedor", "requisitor", "ordenTrabajo", "empresa"]

// ── parsearCSVTexto ───────────────────────────────────────────────────────────

export function parsearCSVTexto(texto: string): string[][] {
  const lineas = texto.split(/\r?\n/).filter(l => l.trim() !== "")
  return lineas.map(linea => {
    const campos: string[] = []
    let i = 0
    while (i < linea.length) {
      if (linea[i] === '"') {
        let campo = ""
        i++
        while (i < linea.length) {
          if (linea[i] === '"' && linea[i + 1] === '"') {
            campo += '"'
            i += 2
          } else if (linea[i] === '"') {
            i++
            break
          } else {
            campo += linea[i++]
          }
        }
        campos.push(campo)
        if (linea[i] === ",") i++
      } else {
        const fin = linea.indexOf(",", i)
        if (fin === -1) {
          campos.push(linea.slice(i).trim())
          break
        }
        campos.push(linea.slice(i, fin).trim())
        i = fin + 1
      }
    }
    return campos
  })
}

// ── detectarColumnas ──────────────────────────────────────────────────────────

export function detectarColumnas(headers: string[]): Record<string, number> {
  const resultado: Record<string, number> = {}
  headers.forEach((h, i) => {
    const campo = ALIAS[h.trim().toLowerCase()]
    if (campo) resultado[campo] = i
  })
  return resultado
}

// ── Stubs — se implementan en Tasks 4 y 5 ────────────────────────────────────

export function procesarCSV(_texto: string): ResultadoCSV {
  throw new Error("not implemented")
}

export async function importarOrdenes(
  _filas: FilaParseada[],
  _onProgreso?: (n: number, total: number) => void
): Promise<{ importadas: number }> {
  throw new Error("not implemented")
}
```

- [ ] **Step 4: Verificar que los tests de parseo pasan**

```bash
npx vitest run tests/importar.test.ts
```

Esperado: PASS — los 10 tests de `parsearCSVTexto` y `detectarColumnas`.

- [ ] **Step 5: Commit**

```bash
git add lib/importar.ts tests/importar.test.ts
git commit -m "feat: parseo CSV y detección de columnas con tests"
```

---

## Task 4: `lib/importar.ts` Parte 2 — mapeo y validación de filas

**Files:**
- Modify: `lib/importar.ts`
- Modify: `tests/importar.test.ts`

- [ ] **Step 1: Agregar tests de mapeo y validación**

Añadir al final de `tests/importar.test.ts`:

```typescript
import { mapearFila, procesarCSV } from "@/lib/importar"

// ── mapearFila ───────────────────────────────────────────────────────────────

describe("mapearFila", () => {
  const COL: Record<string, number> = {
    estado: 0, fechaFactura: 1, proveedor: 2,
    cantidad: 3, descripcion: 4, linkProveedor: 5,
    fechaEntrega: 6, requisitor: 7, ordenTrabajo: 8, empresa: 9,
  }

  const filaOK = [
    "Aprobado", "2024-06-01", "Amazon",
    "2", "Cable USB", "https://amazon.com",
    "2024-06-15", "Juan", "OT-100", "SMV Norte",
  ]

  it("produce fila válida sin errores ni advertencias", () => {
    const r = mapearFila(filaOK, COL, 0)
    expect(r.errores).toHaveLength(0)
    expect(r.advertencias).toHaveLength(0)
    expect(r.seleccionada).toBe(true)
  })

  it("mapea estado 'Aprobado' → 'aprobada'", () => {
    const r = mapearFila(filaOK, COL, 0)
    expect(r.datos.estado).toBe("aprobada")
  })

  it("mapea estado 'Pendiente' → 'pendiente'", () => {
    const fila = [...filaOK]
    fila[0] = "Pendiente"
    const r = mapearFila(fila, COL, 0)
    expect(r.datos.estado).toBe("pendiente")
  })

  it("estado desconocido → 'pendiente' + advertencia", () => {
    const fila = [...filaOK]
    fila[0] = "Entregado"
    const r = mapearFila(fila, COL, 0)
    expect(r.datos.estado).toBe("pendiente")
    expect(r.advertencias).toHaveLength(1)
    expect(r.advertencias[0]).toContain("Entregado")
  })

  it("cantidad numérica se convierte a number", () => {
    const r = mapearFila(filaOK, COL, 0)
    expect(r.datos.items[0].cantidad).toBe(2)
  })

  it("cantidad no numérica → null + advertencia", () => {
    const fila = [...filaOK]
    fila[3] = "dos cajas"
    const r = mapearFila(fila, COL, 0)
    expect(r.datos.items[0].cantidad).toBeNull()
    expect(r.advertencias.some(a => a.includes("cantidad") || a.includes("Cantidad"))).toBe(true)
  })

  it("cantidad vacía → null sin advertencia", () => {
    const fila = [...filaOK]
    fila[3] = ""
    const r = mapearFila(fila, COL, 0)
    expect(r.datos.items[0].cantidad).toBeNull()
    expect(r.advertencias).toHaveLength(0)
  })

  it("proveedor vacío → error bloqueante", () => {
    const fila = [...filaOK]
    fila[2] = ""
    const r = mapearFila(fila, COL, 0)
    expect(r.errores.some(e => e.toLowerCase().includes("proveedor"))).toBe(true)
  })

  it("requisitor vacío → error bloqueante", () => {
    const fila = [...filaOK]
    fila[7] = ""
    const r = mapearFila(fila, COL, 0)
    expect(r.errores.some(e => e.toLowerCase().includes("requisitor"))).toBe(true)
  })

  it("ordenTrabajo vacío → error bloqueante", () => {
    const fila = [...filaOK]
    fila[8] = ""
    const r = mapearFila(fila, COL, 0)
    expect(r.errores.some(e => e.toLowerCase().includes("trabajo") || e.toLowerCase().includes("orden"))).toBe(true)
  })

  it("empresa vacía → error bloqueante", () => {
    const fila = [...filaOK]
    fila[9] = ""
    const r = mapearFila(fila, COL, 0)
    expect(r.errores.some(e => e.toLowerCase().includes("empresa"))).toBe(true)
  })

  it("linkProveedor y fechaEntrega se mapean correctamente", () => {
    const r = mapearFila(filaOK, COL, 0)
    expect(r.datos.linkProveedor).toBe("https://amazon.com")
    expect(r.datos.fechaEntrega).toBe("2024-06-15")
  })

  it("campo ausente del colIdx produce null, no error", () => {
    const colSinLink: Record<string, number> = { ...COL }
    delete colSinLink["linkProveedor"]
    const r = mapearFila(filaOK, colSinLink, 0)
    expect(r.datos.linkProveedor).toBeNull()
    expect(r.errores).toHaveLength(0)
  })
})

// ── procesarCSV ──────────────────────────────────────────────────────────────

describe("procesarCSV", () => {
  const CSV_OK = [
    "Estado del pedido,Fecha del pedido,Proveedor,Cantidad,Descripción,Link,Fecha entrega,Requisitor,Orden de trabajo,Empresa",
    "Pendiente,2024-06-01,Amazon,2,Cable USB,https://amazon.com,2024-06-15,Juan,OT-100,SMV Norte",
    "Aprobado,2024-06-02,Grainger,1,Guante,,2024-06-20,María,OT-200,SMV Sur",
  ].join("\n")

  it("parsea dos filas válidas sin error", () => {
    const { filas, error } = procesarCSV(CSV_OK)
    expect(error).toBeNull()
    expect(filas).toHaveLength(2)
  })

  it("devuelve error si falta columna requerida", () => {
    const csvSinProveedor = [
      "Estado del pedido,Requisitor,Orden de trabajo,Empresa",
      "Pendiente,Juan,OT-100,SMV Norte",
    ].join("\n")
    const { error } = procesarCSV(csvSinProveedor)
    expect(error).not.toBeNull()
    expect(error).toContain("proveedor")
  })

  it("devuelve error si el CSV tiene menos de 2 filas", () => {
    const { error } = procesarCSV("Proveedor,Requisitor")
    expect(error).not.toBeNull()
  })
})
```

- [ ] **Step 2: Verificar que los tests nuevos fallan**

```bash
npx vitest run tests/importar.test.ts
```

Esperado: los tests de `parsearCSVTexto` y `detectarColumnas` siguen en PASS; los nuevos de `mapearFila` y `procesarCSV` fallan.

- [ ] **Step 3: Implementar `mapearFila` y `procesarCSV` en `lib/importar.ts`**

Reemplazar el contenido de `lib/importar.ts` después del bloque `detectarColumnas`:

```typescript
// ── Mapa de estado ────────────────────────────────────────────────────────────

const MAPA_ESTADO: Record<string, EstadoOrden> = {
  pendiente: "pendiente",
  pending: "pendiente",
  aprobada: "aprobada",
  aprobado: "aprobada",
  approved: "aprobada",
  rechazada: "rechazada",
  rechazado: "rechazada",
  rejected: "rechazada",
}

// ── mapearFila ────────────────────────────────────────────────────────────────

export function mapearFila(
  celdas: string[],
  colIdx: Record<string, number>,
  indice: number
): FilaParseada {
  const get = (campo: string) =>
    colIdx[campo] !== undefined ? (celdas[colIdx[campo]] ?? "").trim() : ""

  const errores: string[] = []
  const advertencias: string[] = []

  const proveedor = get("proveedor")
  const requisitor = get("requisitor")
  const ordenTrabajo = get("ordenTrabajo")
  const empresa = get("empresa")

  if (!proveedor) errores.push("Proveedor vacío")
  if (!requisitor) errores.push("Requisitor vacío")
  if (!ordenTrabajo) errores.push("Orden de trabajo vacía")
  if (!empresa) errores.push("Empresa vacía")

  const estadoRaw = get("estado").toLowerCase()
  let estado: EstadoOrden = "pendiente"
  if (estadoRaw) {
    const mapeado = MAPA_ESTADO[estadoRaw]
    if (mapeado) {
      estado = mapeado
    } else {
      advertencias.push(`Estado "${get("estado")}" no reconocido — se usará "pendiente"`)
    }
  }

  const cantidadStr = get("cantidad")
  let cantidad: number | null = null
  if (cantidadStr !== "") {
    const n = Number(cantidadStr)
    if (isNaN(n)) {
      advertencias.push(`Cantidad "${cantidadStr}" no es un número — se usará null`)
    } else {
      cantidad = n
    }
  }

  const items: ItemFactura[] = [
    {
      descripcion: get("descripcion"),
      cantidad,
      precioUnitario: null,
      total: null,
    },
  ]

  return {
    indice,
    datos: {
      proveedor,
      numeroFactura: null,
      fechaFactura: get("fechaFactura") || null,
      moneda: "USD",
      subtotal: null,
      impuestos: null,
      total: null,
      items,
      requisitor,
      ordenTrabajo,
      empresa,
      linkProveedor: get("linkProveedor") || null,
      fechaEntrega: get("fechaEntrega") || null,
      estado,
    },
    errores,
    advertencias,
    seleccionada: true,
  }
}

// ── procesarCSV ───────────────────────────────────────────────────────────────

export function procesarCSV(texto: string): ResultadoCSV {
  const matriz = parsearCSVTexto(texto)
  if (matriz.length < 2) {
    return { filas: [], error: "El CSV no tiene datos (se necesita al menos una fila de encabezado y una de datos)" }
  }

  const [headers, ...filas] = matriz
  const colIdx = detectarColumnas(headers)

  const faltantes = COLUMNAS_REQUERIDAS.filter(c => colIdx[c] === undefined)
  if (faltantes.length > 0) {
    return { filas: [], error: `Columnas requeridas no encontradas: ${faltantes.join(", ")}` }
  }

  return {
    filas: filas.map((celdas, i) => mapearFila(celdas, colIdx, i)),
    error: null,
  }
}
```

- [ ] **Step 4: Verificar que todos los tests pasan**

```bash
npx vitest run tests/importar.test.ts
```

Esperado: PASS — todos los tests de parseo, detección, mapeo y validación.

- [ ] **Step 5: Commit**

```bash
git add lib/importar.ts tests/importar.test.ts
git commit -m "feat: mapeo y validación de filas CSV con tests"
```

---

## Task 5: `lib/importar.ts` Parte 3 — `importarOrdenes` batch write

**Files:**
- Modify: `lib/importar.ts`
- Modify: `tests/importar.test.ts`

- [ ] **Step 1: Agregar tests de batch write**

Añadir al final de `tests/importar.test.ts`:

```typescript
import { importarOrdenes } from "@/lib/importar"

// ── importarOrdenes ──────────────────────────────────────────────────────────

function makeFilaValida(indice: number) {
  return {
    indice,
    datos: {
      proveedor: `Proveedor ${indice}`,
      numeroFactura: null,
      fechaFactura: null,
      moneda: "USD",
      subtotal: null,
      impuestos: null,
      total: null,
      items: [{ descripcion: "Item", cantidad: 1, precioUnitario: null, total: null }],
      requisitor: "Juan",
      ordenTrabajo: "OT-100",
      empresa: "SMV Norte",
      linkProveedor: null,
      fechaEntrega: null,
      estado: "pendiente" as const,
    },
    errores: [],
    advertencias: [],
    seleccionada: true,
  }
}

describe("importarOrdenes", () => {
  beforeEach(() => {
    mockCrearOrden.mockClear()
  })

  it("importa 50 filas válidas llamando crearOrden 50 veces", async () => {
    const filas = Array.from({ length: 50 }, (_, i) => makeFilaValida(i))
    const { importadas } = await importarOrdenes(filas)
    expect(mockCrearOrden).toHaveBeenCalledTimes(50)
    expect(importadas).toBe(50)
  })

  it("omite filas con errores bloqueantes", async () => {
    const filas = [
      makeFilaValida(0),
      { ...makeFilaValida(1), errores: ["Proveedor vacío"] },
      makeFilaValida(2),
    ]
    const { importadas } = await importarOrdenes(filas)
    expect(mockCrearOrden).toHaveBeenCalledTimes(2)
    expect(importadas).toBe(2)
  })

  it("omite filas desmarcadas (seleccionada: false)", async () => {
    const filas = [
      makeFilaValida(0),
      { ...makeFilaValida(1), seleccionada: false },
      makeFilaValida(2),
    ]
    const { importadas } = await importarOrdenes(filas)
    expect(mockCrearOrden).toHaveBeenCalledTimes(2)
    expect(importadas).toBe(2)
  })

  it("llama onProgreso al completar cada lote", async () => {
    const filas = Array.from({ length: 25 }, (_, i) => makeFilaValida(i))
    const progresos: number[] = []
    await importarOrdenes(filas, (n) => progresos.push(n))
    // 25 filas en lotes de 10 → 3 lotes (10, 20, 25)
    expect(progresos).toEqual([10, 20, 25])
  })

  it("importa cero filas si todas están desmarcadas", async () => {
    const filas = [{ ...makeFilaValida(0), seleccionada: false }]
    const { importadas } = await importarOrdenes(filas)
    expect(mockCrearOrden).not.toHaveBeenCalled()
    expect(importadas).toBe(0)
  })
})
```

- [ ] **Step 2: Verificar que los tests nuevos fallan**

```bash
npx vitest run tests/importar.test.ts
```

Esperado: los tests anteriores en PASS; los de `importarOrdenes` fallan (`not implemented`).

- [ ] **Step 3: Implementar `importarOrdenes` en `lib/importar.ts`**

Reemplazar el stub de `importarOrdenes`:

```typescript
export async function importarOrdenes(
  filas: FilaParseada[],
  onProgreso?: (completadas: number, total: number) => void
): Promise<{ importadas: number }> {
  const validas = filas.filter(f => f.seleccionada && f.errores.length === 0)
  const LOTE = 10
  let importadas = 0

  for (let i = 0; i < validas.length; i += LOTE) {
    const lote = validas.slice(i, i + LOTE)
    await Promise.all(lote.map(f => crearOrden(f.datos)))
    importadas += lote.length
    onProgreso?.(importadas, validas.length)
  }

  return { importadas }
}
```

- [ ] **Step 4: Verificar que todos los tests pasan**

```bash
npx vitest run tests/importar.test.ts
```

Esperado: PASS — todos (parseo + detección + mapeo + batch write).

- [ ] **Step 5: TypeScript limpio**

```bash
npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/importar.ts tests/importar.test.ts
git commit -m "feat: importarOrdenes con batch write y tests"
```

---

## Task 6: UI — `app/importar/page.tsx` + `ImportarCSV.tsx`

**Files:**
- Create: `app/importar/page.tsx`
- Create: `app/importar/ImportarCSV.tsx`

- [ ] **Step 1: Crear `app/importar/page.tsx`**

```typescript
import ImportarCSV from './ImportarCSV'

export default function ImportarPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Importar desde CSV</h1>
          <p className="text-sm text-gray-500 mt-1">
            Exporta tu Google Sheets como CSV y súbelo aquí para importar las órdenes en bloque
          </p>
        </div>
        <ImportarCSV />
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Crear `app/importar/ImportarCSV.tsx`**

```typescript
'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, CheckCircle, Loader2, AlertCircle, AlertTriangle } from 'lucide-react'
import { procesarCSV, importarOrdenes, type FilaParseada } from '@/lib/importar'

type Etapa = 'upload' | 'preview' | 'importando' | 'listo'

const cls = {
  th: 'px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide',
  td: 'px-3 py-2 text-sm text-gray-700 whitespace-nowrap',
}

export default function ImportarCSV() {
  const router = useRouter()
  const [etapa, setEtapa] = useState<Etapa>('upload')
  const [errorCSV, setErrorCSV] = useState<string | null>(null)
  const [filas, setFilas] = useState<FilaParseada[]>([])
  const [progreso, setProgreso] = useState(0)
  const [importadas, setImportadas] = useState(0)
  const [errorImport, setErrorImport] = useState<string | null>(null)

  const procesarArchivo = useCallback(async (file: File) => {
    setErrorCSV(null)
    const texto = await file.text()
    const { filas: filasParseadas, error } = procesarCSV(texto)
    if (error) {
      setErrorCSV(error)
      return
    }
    setFilas(filasParseadas)
    setEtapa('preview')
  }, [])

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) procesarArchivo(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) procesarArchivo(file)
  }

  function toggleFila(indice: number) {
    setFilas(prev =>
      prev.map(f => f.indice === indice ? { ...f, seleccionada: !f.seleccionada } : f)
    )
  }

  async function handleImportar() {
    setEtapa('importando')
    setErrorImport(null)
    try {
      const total = filas.filter(f => f.seleccionada && f.errores.length === 0).length
      setProgreso(0)
      const { importadas: n } = await importarOrdenes(filas, (completadas) => {
        setProgreso(Math.round((completadas / total) * 100))
      })
      setImportadas(n)
      setEtapa('listo')
    } catch {
      setErrorImport('Error al importar. Revisa tu conexión e intenta de nuevo.')
      setEtapa('preview')
    }
  }

  const filasListas = filas.filter(f => f.seleccionada && f.errores.length === 0).length
  const filasConError = filas.filter(f => f.errores.length > 0).length

  // ── Estado: upload ───────────────────────────────────────────────────────────

  if (etapa === 'upload') {
    return (
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-16 text-center hover:border-blue-400 transition-colors"
      >
        <Upload className="mx-auto h-10 w-10 text-gray-400 mb-4" />
        <p className="text-gray-600 mb-2">Arrastra tu archivo CSV aquí</p>
        <p className="text-sm text-gray-400 mb-6">o</p>
        <label className="cursor-pointer rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
          Seleccionar archivo CSV
          <input type="file" accept=".csv" onChange={handleFileInput} className="sr-only" />
        </label>
        {errorCSV && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 text-left">
            <AlertCircle className="inline h-4 w-4 mr-1" />
            {errorCSV}
          </div>
        )}
        <p className="mt-6 text-xs text-gray-400">
          Exporta desde Google Sheets → Archivo → Descargar → Valores separados por comas (.csv)
        </p>
      </div>
    )
  }

  // ── Estado: preview ──────────────────────────────────────────────────────────

  if (etapa === 'preview') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{filasListas}</span> de{' '}
            {filas.length} filas listas para importar
            {filasConError > 0 && (
              <span className="ml-2 text-red-600">· {filasConError} con error</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setEtapa('upload')}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cambiar archivo
            </button>
            <button
              onClick={handleImportar}
              disabled={filasListas === 0}
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Importar {filasListas} órdenes
            </button>
          </div>
        </div>

        {errorImport && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorImport}
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className={cls.th + ' w-10'}></th>
                  <th className={cls.th}>Proveedor</th>
                  <th className={cls.th}>Descripción</th>
                  <th className={cls.th}>Requisitor</th>
                  <th className={cls.th}>OT</th>
                  <th className={cls.th}>Empresa</th>
                  <th className={cls.th}>Estado</th>
                  <th className={cls.th}>Fecha</th>
                  <th className={cls.th + ' w-48'}>Avisos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filas.map(fila => {
                  const tieneError = fila.errores.length > 0
                  const tieneAviso = fila.advertencias.length > 0
                  const rowCls = tieneError
                    ? 'bg-red-50'
                    : tieneAviso
                    ? 'bg-yellow-50'
                    : ''
                  return (
                    <tr key={fila.indice} className={rowCls}>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={fila.seleccionada && !tieneError}
                          disabled={tieneError}
                          onChange={() => toggleFila(fila.indice)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className={cls.td}>{fila.datos.proveedor || <span className="text-red-500">—</span>}</td>
                      <td className={cls.td}>{fila.datos.items[0]?.descripcion}</td>
                      <td className={cls.td}>{fila.datos.requisitor || <span className="text-red-500">—</span>}</td>
                      <td className={cls.td}>{fila.datos.ordenTrabajo}</td>
                      <td className={cls.td}>{fila.datos.empresa}</td>
                      <td className={cls.td}>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          fila.datos.estado === 'aprobada' ? 'bg-green-100 text-green-700' :
                          fila.datos.estado === 'rechazada' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {fila.datos.estado}
                        </span>
                      </td>
                      <td className={cls.td}>{fila.datos.fechaFactura}</td>
                      <td className="px-3 py-2 text-xs">
                        {tieneError && (
                          <span className="flex items-start gap-1 text-red-600">
                            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                            {fila.errores.join(' · ')}
                          </span>
                        )}
                        {!tieneError && tieneAviso && (
                          <span className="flex items-start gap-1 text-yellow-700">
                            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                            {fila.advertencias.join(' · ')}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // ── Estado: importando ───────────────────────────────────────────────────────

  if (etapa === 'importando') {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-16 text-center shadow-sm">
        <Loader2 className="mx-auto h-10 w-10 text-blue-500 animate-spin mb-4" />
        <p className="text-gray-700 font-medium mb-4">Importando órdenes…</p>
        <div className="max-w-xs mx-auto">
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progreso}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">{progreso}%</p>
        </div>
      </div>
    )
  }

  // ── Estado: listo ────────────────────────────────────────────────────────────

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-16 text-center shadow-sm">
      <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
      <p className="text-xl font-semibold text-gray-900 mb-2">
        ✓ {importadas} órdenes importadas
      </p>
      <p className="text-sm text-gray-500 mb-8">Todas las órdenes están disponibles en la lista</p>
      <button
        onClick={() => router.push('/ordenes')}
        className="rounded-lg bg-blue-600 px-8 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
      >
        Ver órdenes
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add app/importar/page.tsx app/importar/ImportarCSV.tsx
git commit -m "feat: página /importar con upload, preview y resultado"
```

---

## Task 7: Actualizar home + suite de tests completa

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Agregar enlace "Importar CSV" en `app/page.tsx`**

En el bloque de botones (después del enlace "Ver órdenes"), agregar:

```typescript
          <Link
            href="/importar"
            className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Importar CSV
          </Link>
```

- [ ] **Step 2: Correr todos los tests**

```bash
npm test
```

Esperado: PASS — todos los tests previos más los nuevos de `importar.test.ts`.

- [ ] **Step 3: TypeScript final**

```bash
npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 4: Commit final**

```bash
git add app/page.tsx
git commit -m "feat: enlace a /importar en la home"
```
