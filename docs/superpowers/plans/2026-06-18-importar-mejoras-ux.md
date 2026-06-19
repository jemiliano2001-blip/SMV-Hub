# Mejoras UX Importación Masiva — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir plantilla CSV descargable, panel de columnas detectadas, thumbnails en capturas, columnas Total/Moneda en el preview, persistencia de ordenTrabajo y deduplicación básica con banner de confirmación.

**Architecture:** Las mejoras de lógica pura van en `lib/importar.ts` y `lib/ordenes.ts` (con tests); las mejoras de UI son adiciones a los cuatro componentes de `app/importar/` sin tocar la lógica de validación ni importación existente.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript estricto, Firebase v12 Firestore, Vitest, Tailwind CSS v4, lucide-react

## Global Constraints

- Prohibido `any` y `@ts-ignore`; usar tipos explícitos siempre
- No modificar `erroresRequeridos`, `importarOrdenes`, `crearOrdenesLote` ni el flujo de validación existente
- Correr `npm test` y `npm run lint` antes de cada commit
- Alias `@/*` apunta a la raíz del repo

---

### Task 1: Extender `lib/importar.ts` — `ResultadoCSV`, `procesarCSV`, `verificarDuplicados`

**Files:**
- Modify: `lib/importar.ts`
- Modify: `tests/importar.test.ts`

**Interfaces:**
- Produces:
  - `ResultadoCSV.columnasDetectadas: string[]`
  - `verificarDuplicados(filas, existentes) → Array<{ indice: number; motivo: string }>`

- [ ] **Step 1: Escribir los tests nuevos en `tests/importar.test.ts`**

Añadir al final del archivo, después del bloque `describe("importarOrdenes", ...)`:

```ts
// ── verificarDuplicados ───────────────────────────────────────────────────────

import { verificarDuplicados } from "@/lib/importar"

describe("verificarDuplicados", () => {
  const filaConFactura = (indice: number, numeroFactura: string, proveedor: string) => ({
    indice,
    datos: {
      proveedor,
      numeroFactura,
      fechaFactura: null,
      moneda: "USD",
      subtotal: null,
      impuestos: null,
      total: null,
      items: [],
      requisitor: "juan",
      ordenTrabajo: "OT-1",
      empresa: "SMV",
      cuentaCargo: "",
      destino: "",
      linkProveedor: null,
      fechaEntrega: null,
      estado: "pendiente" as const,
    },
    errores: [] as string[],
    advertencias: [] as string[],
    seleccionada: true,
  })

  it("devuelve [] cuando no hay duplicados", () => {
    const filas = [filaConFactura(0, "INV-1", "Amazon")]
    const existentes = [{ numeroFactura: "INV-99", proveedor: "Amazon" }]
    expect(verificarDuplicados(filas, existentes)).toHaveLength(0)
  })

  it("detecta un duplicado exacto", () => {
    const filas = [filaConFactura(0, "INV-1", "Amazon")]
    const existentes = [{ numeroFactura: "INV-1", proveedor: "Amazon" }]
    const result = verificarDuplicados(filas, existentes)
    expect(result).toHaveLength(1)
    expect(result[0].indice).toBe(0)
    expect(result[0].motivo).toContain("INV-1")
  })

  it("la comparación es case-insensitive", () => {
    const filas = [filaConFactura(0, "inv-1", "AMAZON")]
    const existentes = [{ numeroFactura: "INV-1", proveedor: "amazon" }]
    expect(verificarDuplicados(filas, existentes)).toHaveLength(1)
  })

  it("ignora filas cuyo numeroFactura es null", () => {
    const filas = [{
      ...filaConFactura(0, "INV-1", "Amazon"),
      datos: { ...filaConFactura(0, "INV-1", "Amazon").datos, numeroFactura: null },
    }]
    const existentes = [{ numeroFactura: "INV-1", proveedor: "Amazon" }]
    expect(verificarDuplicados(filas, existentes)).toHaveLength(0)
  })

  it("ignora existentes cuyo numeroFactura es null", () => {
    const filas = [filaConFactura(0, "INV-1", "Amazon")]
    const existentes = [{ numeroFactura: null, proveedor: "Amazon" }]
    expect(verificarDuplicados(filas, existentes)).toHaveLength(0)
  })

  it("mismo proveedor pero diferente factura no es duplicado", () => {
    const filas = [filaConFactura(0, "INV-1", "Amazon")]
    const existentes = [{ numeroFactura: "INV-2", proveedor: "Amazon" }]
    expect(verificarDuplicados(filas, existentes)).toHaveLength(0)
  })
})

// ── procesarCSV incluye columnasDetectadas ────────────────────────────────────

describe("procesarCSV — columnasDetectadas", () => {
  it("incluye las columnas detectadas en el resultado exitoso", () => {
    const csv = [
      "Proveedor,Requisitor,Orden de trabajo,Empresa,Fecha del pedido",
      "Amazon,Juan,OT-1,SMV,2026-01-01",
    ].join("\n")
    const { columnasDetectadas, error } = procesarCSV(csv)
    expect(error).toBeNull()
    expect(columnasDetectadas).toContain("proveedor")
    expect(columnasDetectadas).toContain("requisitor")
    expect(columnasDetectadas).toContain("ordenTrabajo")
    expect(columnasDetectadas).toContain("empresa")
    expect(columnasDetectadas).toContain("fechaFactura")
  })

  it("devuelve columnasDetectadas vacío cuando hay error de columna faltante", () => {
    const csv = ["Proveedor,Requisitor", "Amazon,Juan"].join("\n")
    const { columnasDetectadas, error } = procesarCSV(csv)
    expect(error).not.toBeNull()
    expect(columnasDetectadas).toEqual([])
  })

  it("devuelve columnasDetectadas vacío cuando CSV tiene menos de 2 filas", () => {
    const { columnasDetectadas } = procesarCSV("Proveedor,Requisitor")
    expect(columnasDetectadas).toEqual([])
  })
})
```

- [ ] **Step 2: Correr tests para verificar que fallan**

```bash
npx vitest run tests/importar.test.ts
```

Esperado: errores `verificarDuplicados is not a function` y `columnasDetectadas is not defined`.

- [ ] **Step 3: Implementar los cambios en `lib/importar.ts`**

Añadir la exportación de `verificarDuplicados` al final del archivo (antes del último `}`):

```ts
// ── verificarDuplicados ───────────────────────────────────────────────────────

export function verificarDuplicados(
  filas: FilaParseada[],
  existentes: Array<{ numeroFactura: string | null; proveedor: string }>
): Array<{ indice: number; motivo: string }> {
  const set = new Set(
    existentes
      .filter(e => e.numeroFactura !== null)
      .map(e => `${e.numeroFactura!.toLowerCase()}|${e.proveedor.toLowerCase()}`)
  )
  return filas
    .filter(f => f.datos.numeroFactura !== null)
    .filter(f =>
      set.has(
        `${f.datos.numeroFactura!.toLowerCase()}|${f.datos.proveedor.toLowerCase()}`
      )
    )
    .map(f => ({
      indice: f.indice,
      motivo: `${f.datos.proveedor} / factura ${f.datos.numeroFactura}`,
    }))
}
```

Actualizar la interfaz `ResultadoCSV`:

```ts
export interface ResultadoCSV {
  filas: FilaParseada[]
  error: string | null
  columnasDetectadas: string[]
}
```

Actualizar `procesarCSV` — los dos `return` de error y el return final:

```ts
export function procesarCSV(texto: string): ResultadoCSV {
  const matriz = parsearCSVTexto(texto)
  if (matriz.length < 2) {
    return {
      filas: [],
      error: "El CSV no tiene datos (se necesita al menos una fila de encabezado y una de datos)",
      columnasDetectadas: [],
    }
  }

  const [headers, ...filas] = matriz
  const colIdx = detectarColumnas(headers)

  const faltantes = COLUMNAS_REQUERIDAS.filter(c => colIdx[c] === undefined)
  if (faltantes.length > 0) {
    return {
      filas: [],
      error: `Columnas requeridas no encontradas: ${faltantes.join(", ")}`,
      columnasDetectadas: [],
    }
  }

  return {
    filas: filas.map((celdas, i) => mapearFila(celdas, colIdx, i)),
    error: null,
    columnasDetectadas: Object.keys(colIdx),
  }
}
```

- [ ] **Step 4: Correr tests para verificar que pasan**

```bash
npx vitest run tests/importar.test.ts
```

Esperado: todos los tests en verde (los existentes + los nuevos).

- [ ] **Step 5: Lint y commit**

```bash
npm run lint
git add lib/importar.ts tests/importar.test.ts
git commit -m "feat: add verificarDuplicados and expose columnasDetectadas in procesarCSV"
```

---

### Task 2: Añadir `buscarPorFacturaYProveedor` en `lib/ordenes.ts`

**Files:**
- Modify: `lib/ordenes.ts`

**Interfaces:**
- Consumes: Firestore `db`, `collection`, `query`, `getDocs`, `where` (nuevo import)
- Produces: `buscarPorFacturaYProveedor(pares) → Promise<Array<{ numeroFactura: string | null; proveedor: string }>>`

- [ ] **Step 1: Añadir `where` a los imports de Firestore**

En `lib/ordenes.ts`, actualizar la línea de imports de `firebase/firestore`:

```ts
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
} from "firebase/firestore"
```

- [ ] **Step 2: Añadir la función al final de `lib/ordenes.ts`**

```ts
// Busca órdenes existentes por combinación numeroFactura+proveedor para deduplicación.
// Solo evalúa facturas con numeroFactura no nulo. Divide en chunks de 30 (límite Firestore `in`).
export async function buscarPorFacturaYProveedor(
  pares: Array<{ numeroFactura: string; proveedor: string }>
): Promise<Array<{ numeroFactura: string | null; proveedor: string }>> {
  if (pares.length === 0) return []

  const CHUNK = 30
  const resultados: Array<{ numeroFactura: string | null; proveedor: string }> = []

  for (let i = 0; i < pares.length; i += CHUNK) {
    const facturas = pares.slice(i, i + CHUNK).map(p => p.numeroFactura)
    const snap = await getDocs(
      query(collection(db, "ordenes"), where("numeroFactura", "in", facturas))
    )
    snap.docs.forEach(d => {
      const data = d.data() as { numeroFactura?: string | null; proveedor?: string }
      resultados.push({
        numeroFactura: data.numeroFactura ?? null,
        proveedor: data.proveedor ?? "",
      })
    })
  }

  return resultados
}
```

- [ ] **Step 3: Lint y commit**

```bash
npm run lint
git add lib/ordenes.ts
git commit -m "feat: add buscarPorFacturaYProveedor for import deduplication"
```

- [ ] **Step 4: Verificación manual**

Arrancar `npm run dev` y abrir `/importar`. No se ejecuta nada aún — solo verificar que la app arranca sin error de TypeScript (`npm run build` también válido).

---

### Task 3: Thumbnails en `app/importar/ImportarCapturas.tsx`

**Files:**
- Modify: `app/importar/ImportarCapturas.tsx`

**Interfaces:**
- No produce ni consume interfaces de otras tareas (independiente)

- [ ] **Step 1: Añadir estado `objectUrls` y actualizar `agregarArchivos`**

Reemplazar en `ImportarCapturas`:

```tsx
// Estado actual a conservar:
const [archivos, setArchivos] = useState<File[]>([])
// Añadir:
const [objectUrls, setObjectUrls] = useState<string[]>([])
```

Reemplazar la función `agregarArchivos` completa:

```tsx
const agregarArchivos = (lista: FileList) => {
  const imgs = Array.from(lista).filter(f => f.type.startsWith('image/'))
  if (imgs.length === 0) {
    setError('Selecciona archivos de imagen (jpeg, png, gif o webp)')
    return
  }
  setError(null)
  const nuevosUrls = imgs.map(f => {
    try { return URL.createObjectURL(f) } catch { return '' }
  })
  setArchivos(prev => [...prev, ...imgs])
  setObjectUrls(prev => [...prev, ...nuevosUrls])
}
```

- [ ] **Step 2: Actualizar `quitarArchivo` y `reiniciar` para revocar URLs**

Reemplazar `quitarArchivo`:

```tsx
const quitarArchivo = (i: number) => {
  if (objectUrls[i]) URL.revokeObjectURL(objectUrls[i])
  setArchivos(prev => prev.filter((_, idx) => idx !== i))
  setObjectUrls(prev => prev.filter((_, idx) => idx !== i))
}
```

Reemplazar `reiniciar`:

```tsx
const reiniciar = () => {
  objectUrls.forEach(url => { if (url) URL.revokeObjectURL(url) })
  setArchivos([])
  setObjectUrls([])
  setFilas(null)
  setError(null)
  if (fileInputRef.current) fileInputRef.current.value = ''
}
```

- [ ] **Step 3: Reemplazar `<ImageIcon>` por thumbnail en la lista**

En el JSX, dentro del `archivos.map`, reemplazar:

```tsx
// Antes:
<span className="flex items-center gap-2 truncate text-gray-700">
  <ImageIcon className="h-4 w-4 text-gray-400 shrink-0" />
  <span className="truncate">{f.name}</span>
</span>

// Después:
<span className="flex items-center gap-3 truncate text-gray-700">
  {objectUrls[i] ? (
    <img
      src={objectUrls[i]}
      alt=""
      className="h-10 w-10 rounded object-cover shrink-0 border border-gray-200"
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
    />
  ) : (
    <ImageIcon className="h-10 w-10 text-gray-300 shrink-0" />
  )}
  <span className="truncate text-sm">{f.name}</span>
</span>
```

El import de `ImageIcon` se conserva como fallback; no eliminarlo.

- [ ] **Step 4: Lint y commit**

```bash
npm run lint
git add app/importar/ImportarCapturas.tsx
git commit -m "feat: show image thumbnails in capturas file list"
```

- [ ] **Step 5: Verificación manual**

En `/importar` → tab "Desde capturas", subir 2-3 imágenes. Verificar:
- Thumbnails aparecen en la lista
- Quitar una imagen revoca su URL (sin error en consola)
- "Limpiar" limpia thumbnails

---

### Task 4: Plantilla CSV + panel de columnas en `app/importar/ImportarCSV.tsx`

**Files:**
- Modify: `app/importar/ImportarCSV.tsx`

**Interfaces:**
- Consumes: `procesarCSV` ahora devuelve `columnasDetectadas: string[]` (Task 1)
- Produces: prop `columnasDetectadas?: string[]` pasada a `<PreviewImportacion>`

- [ ] **Step 1: Añadir estado y función de descarga de plantilla**

Dentro del componente `ImportarCSV`, antes de los handlers, añadir:

```tsx
const [columnasDetectadas, setColumnasDetectadas] = useState<string[] | null>(null)

const descargarPlantilla = () => {
  const headers = 'Proveedor,Requisitor,Orden de trabajo,Empresa,Estado del pedido,Fecha del pedido,Cantidad,Descripción,Link,Fecha entrega / Guía,Moneda,Total'
  const ej1 = 'McMaster-Carr,emiliano,OT-2024-001,SMV Maquinados,aprobado,2026-06-18,2,Tornillo M6x20 acero inoxidable,https://www.mcmaster.com,2026-06-25,USD,12.50'
  const ej2 = 'Amazon,emiliano,OT-2024-002,SilTech,pendiente,2026-06-18,1,Sensor de temperatura,https://www.amazon.com,,USD,45.00'
  const blob = new Blob([[headers, ej1, ej2].join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'plantilla-compras.csv'
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 2: Capturar `columnasDetectadas` en `handleFile`**

En la función `handleFile`, dentro del bloque `reader.onload`, reemplazar:

```tsx
// Antes:
const resultado = procesarCSV(text)
if (resultado.error) {
  setError(resultado.error)
} else {
  setFilas(resultado.filas.map(f => ({ ...f, seleccionada: f.errores.length === 0 })))
}

// Después:
const resultado = procesarCSV(text)
if (resultado.error) {
  setError(resultado.error)
} else {
  setColumnasDetectadas(resultado.columnasDetectadas)
  setFilas(resultado.filas.map(f => ({ ...f, seleccionada: f.errores.length === 0 })))
}
```

- [ ] **Step 3: Resetear `columnasDetectadas` en `reiniciar`**

```tsx
const reiniciar = () => {
  setFilas(null)
  setError(null)
  setColumnasDetectadas(null)
  if (fileInputRef.current) fileInputRef.current.value = ''
}
```

- [ ] **Step 4: Pasar `columnasDetectadas` al `<PreviewImportacion>` y añadir botón**

Donde se renderiza `<PreviewImportacion>` (cuando `filas` existe):

```tsx
if (filas) {
  return (
    <PreviewImportacion
      filasIniciales={filas}
      onReiniciar={reiniciar}
      columnasDetectadas={columnasDetectadas ?? undefined}
    />
  )
}
```

En el JSX principal, en el heading de la sección "Cargar archivo CSV", añadir el botón junto al título:

```tsx
<div className="flex items-center justify-between mb-4">
  <h2 className={cls.heading.replace('mb-4', '')}>Cargar archivo CSV</h2>
  <button
    onClick={descargarPlantilla}
    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-xs"
  >
    <FileSpreadsheet className="h-3.5 w-3.5 text-blue-500" />
    Descargar plantilla
  </button>
</div>
```

El `<h2>` dentro tenía `className={cls.heading}` que incluye `mb-4`; ahora el `mb-4` va al div padre. Mantener `text-base font-semibold text-gray-900` en el `<h2>` directamente:

```tsx
<h2 className="text-base font-semibold text-gray-900">Cargar archivo CSV</h2>
```

- [ ] **Step 5: Lint y commit**

```bash
npm run lint
git add app/importar/ImportarCSV.tsx
git commit -m "feat: add CSV template download and pass columnasDetectadas to preview"
```

- [ ] **Step 6: Verificación manual**

En `/importar` → tab CSV:
- Botón "Descargar plantilla" descarga `plantilla-compras.csv` con headers y 2 filas de ejemplo
- Subir ese mismo CSV: carga correctamente (no falla validación por ser datos de ejemplo, aunque las 2 filas de ejemplo tienen datos de muestra que pasarán la validación de columnas)

---

### Task 5: Mejoras en `app/importar/PreviewImportacion.tsx`

**Files:**
- Modify: `app/importar/PreviewImportacion.tsx`

**Interfaces:**
- Consumes:
  - `verificarDuplicados` de `@/lib/importar` (Task 1)
  - `buscarPorFacturaYProveedor` de `@/lib/ordenes` (Task 2)
  - prop `columnasDetectadas?: string[]` (Task 4)

- [ ] **Step 1: Actualizar imports**

Al inicio de `PreviewImportacion.tsx`, añadir a los imports de `@/lib/importar`:

```tsx
import {
  importarOrdenes,
  erroresRequeridos,
  verificarDuplicados,
  type FilaParseada,
} from '@/lib/importar'
```

Añadir import de `buscarPorFacturaYProveedor`:

```tsx
import { buscarPorFacturaYProveedor } from '@/lib/ordenes'
```

- [ ] **Step 2: Actualizar la firma de props y el tipo de `status`**

Reemplazar la firma del componente:

```tsx
export default function PreviewImportacion({
  filasIniciales,
  onReiniciar,
  columnasDetectadas,
}: {
  filasIniciales: FilaParseada[]
  onReiniciar: () => void
  columnasDetectadas?: string[]
}) {
```

Actualizar el estado `status`:

```tsx
const [status, setStatus] = useState<'preview' | 'confirmando-dedup' | 'importing' | 'completed'>('preview')
```

Añadir estado para duplicados:

```tsx
const [duplicados, setDuplicados] = useState<Array<{ indice: number; motivo: string }>>([])
```

- [ ] **Step 3: Persistir `ordenTrabajo` en localStorage**

En el `useEffect` existente que carga `requisitor`, añadir la carga de `ordenTrabajo`:

```tsx
useEffect(() => {
  const guardadoReq = localStorage.getItem('smv:requisitor')
  if (guardadoReq) setAplicar(a => ({ ...a, requisitor: guardadoReq }))
  const guardadoOT = localStorage.getItem('smv:ordenTrabajo')
  if (guardadoOT) setAplicar(a => ({ ...a, ordenTrabajo: guardadoOT }))
}, [])
```

En la función `aplicarATodas`, después de `if (req) localStorage.setItem('smv:requisitor', req)`, añadir:

```tsx
if (ot) localStorage.setItem('smv:ordenTrabajo', ot)
```

- [ ] **Step 4: Separar `handleImport` en dos funciones y añadir dedup**

Reemplazar la función `handleImport` completa:

```tsx
const ejecutarImport = async () => {
  const validAndSelected = filas.filter(f => f.seleccionada && f.errores.length === 0)
  setStatus('importing')
  setProgreso({ completadas: 0, total: validAndSelected.length })
  try {
    await importarOrdenes(filas, (completadas) => {
      setProgreso(prev => ({ ...prev, completadas }))
    })
    setProgreso(prev => ({ ...prev, completadas: prev.total }))
    setStatus('completed')
  } catch (err) {
    console.error('Error durante la importación:', err)
    setError('Ocurrió un error al guardar las órdenes. Algunas pueden haberse guardado.')
    setStatus('preview')
  }
}

const handleImport = async () => {
  const validAndSelected = filas.filter(f => f.seleccionada && f.errores.length === 0)
  if (validAndSelected.length === 0) return
  setError(null)

  const conFactura = validAndSelected.filter(f => f.datos.numeroFactura !== null)
  if (conFactura.length > 0) {
    try {
      const pares = conFactura.map(f => ({
        numeroFactura: f.datos.numeroFactura!,
        proveedor: f.datos.proveedor,
      }))
      const existentes = await buscarPorFacturaYProveedor(pares)
      const dups = verificarDuplicados(validAndSelected, existentes)
      if (dups.length > 0) {
        setDuplicados(dups)
        setStatus('confirmando-dedup')
        return
      }
    } catch (err) {
      console.error('Error verificando duplicados:', err)
      // fallo no bloqueante: continuar con el import
    }
  }

  await ejecutarImport()
}
```

- [ ] **Step 5: Añadir el render del estado `confirmando-dedup`**

Justo antes del `if (status === 'importing')` existente, añadir:

```tsx
if (status === 'confirmando-dedup') {
  return (
    <section className="rounded-xl border border-yellow-200 bg-yellow-50 p-8 shadow-xs max-w-xl mx-auto">
      <div className="flex items-start gap-3 mb-6">
        <AlertTriangle className="h-6 w-6 text-yellow-600 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-base font-bold text-yellow-900">
            {duplicados.length} posible{duplicados.length !== 1 ? 's' : ''} duplicado{duplicados.length !== 1 ? 's' : ''} detectado{duplicados.length !== 1 ? 's' : ''}
          </h2>
          <p className="text-sm text-yellow-800 mt-1 mb-3">
            Las siguientes órdenes pueden ya existir en la base de datos:
          </p>
          <ul className="space-y-1">
            {duplicados.map(d => (
              <li key={d.indice} className="text-xs text-yellow-900 font-medium">
                • {d.motivo}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex gap-3 justify-end">
        <button
          onClick={() => { setDuplicados([]); setStatus('preview') }}
          className="rounded-lg border border-yellow-300 bg-white px-4 py-2 text-sm font-semibold text-yellow-900 hover:bg-yellow-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={() => { setDuplicados([]); ejecutarImport() }}
          className="rounded-lg bg-yellow-600 px-5 py-2 text-sm font-semibold text-white hover:bg-yellow-700 transition-colors"
        >
          Importar de todas formas
        </button>
      </div>
    </section>
  )
}
```

- [ ] **Step 6: Añadir columnas Total y Moneda en la tabla**

En el `<thead>`, después de la `<th>` de "Estado":

```tsx
<th className="px-4 py-3.5 font-semibold text-right">Total</th>
<th className="px-4 py-3.5 font-semibold">Moneda</th>
```

En el `<tbody>` dentro del map de filas, después de la `<td>` de estado:

```tsx
<td className="px-4 py-3.5 text-right whitespace-nowrap text-gray-700">
  {fila.datos.total != null
    ? fila.datos.total.toLocaleString('es-MX')
    : '-'}
</td>
<td className="px-4 py-3.5">
  {fila.datos.moneda ? (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-bold ${
      fila.datos.moneda === 'USD'
        ? 'bg-blue-100 text-blue-700'
        : 'bg-green-100 text-green-700'
    }`}>
      {fila.datos.moneda}
    </span>
  ) : '-'}
</td>
```

- [ ] **Step 7: Añadir el panel de columnas detectadas y la constante de display**

Justo antes del `return` de la vista `preview` (dentro de `status === 'preview'`), añadir la constante auxiliar a nivel de módulo (fuera del componente, después de los imports):

```tsx
const COLUMNAS_DISPLAY: Array<{ campo: string; etiqueta: string; requerida: boolean }> = [
  { campo: 'proveedor',     etiqueta: 'Proveedor',       requerida: true  },
  { campo: 'requisitor',    etiqueta: 'Requisitor',      requerida: true  },
  { campo: 'ordenTrabajo',  etiqueta: 'Orden de trabajo',requerida: true  },
  { campo: 'empresa',       etiqueta: 'Empresa',         requerida: true  },
  { campo: 'estado',        etiqueta: 'Estado',          requerida: false },
  { campo: 'fechaFactura',  etiqueta: 'Fecha',           requerida: false },
  { campo: 'cantidad',      etiqueta: 'Cantidad',        requerida: false },
  { campo: 'descripcion',   etiqueta: 'Descripción',     requerida: false },
  { campo: 'linkProveedor', etiqueta: 'Link',            requerida: false },
  { campo: 'fechaEntrega',  etiqueta: 'Fecha entrega',   requerida: false },
  { campo: 'moneda',        etiqueta: 'Moneda',          requerida: false },
  { campo: 'totalLinea',    etiqueta: 'Total',           requerida: false },
]
```

Dentro del JSX del estado `preview`, justo antes del bloque "Aplicar a todas" (`{/* Aplicar a todas */}`), añadir:

```tsx
{columnasDetectadas && (
  <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
    <span className="text-xs font-bold text-blue-900 block mb-2">Columnas detectadas</span>
    <div className="flex flex-wrap gap-1.5">
      {COLUMNAS_DISPLAY.map(({ campo, etiqueta, requerida }) => {
        const detectada = columnasDetectadas.includes(campo)
        return (
          <span
            key={campo}
            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
              detectada
                ? 'bg-green-100 text-green-800'
                : requerida
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {detectada ? '✓' : requerida ? '✗' : '—'} {etiqueta}
          </span>
        )
      })}
    </div>
  </div>
)}
```

- [ ] **Step 8: Lint y tests**

```bash
npm run lint
npm test
```

Esperado: todos los tests pasan, cero errores de lint.

- [ ] **Step 9: Commit**

```bash
git add app/importar/PreviewImportacion.tsx
git commit -m "feat: add Total/Moneda columns, ordenTrabajo persistence, column panel and dedup banner to preview"
```

- [ ] **Step 10: Verificación manual — flujo CSV**

1. Abrir `/importar` → tab CSV
2. Hacer clic en "Descargar plantilla", verificar descarga
3. Subir el CSV descargado — verificar panel de columnas detectadas (todas en verde)
4. Verificar columnas Total y Moneda visibles en la tabla

- [ ] **Step 11: Verificación manual — flujo capturas**

1. Tab "Desde capturas" → subir 2-3 imágenes
2. Verificar thumbnails en la lista
3. Hacer clic en "Extraer datos" — verificar que el preview NO muestra panel de columnas (prop ausente)
4. Completar "Aplicar a todas" con ordenTrabajo, hacer clic en aplicar
5. Abrir una nueva importación — verificar que `ordenTrabajo` está pre-rellenado desde localStorage

- [ ] **Step 12: Verificación manual — deduplicación**

1. Importar una orden que ya exista en Firestore (mismo `numeroFactura` + `proveedor`)
2. Verificar que aparece el banner amarillo con el duplicado listado
3. Verificar "Cancelar" regresa al preview sin importar
4. Verificar "Importar de todas formas" procede normalmente
