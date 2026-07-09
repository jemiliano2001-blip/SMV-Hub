# Control de Baños — Captura Rápida Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Acelerar la captura en `/banos` (pestaña Registro) con fecha/hora automáticas, pills de baño, input operador con datalist, y llegada en un solo clic — sin cambios de schema ni Firestore.

**Architecture:** Helpers de fecha/hora local en `lib/format.ts` (corrige el bug de `toISOString()` UTC). Validación de operador activo en `lib/banos-captura.ts`. `RegistroBanoList.tsx` rediseña solo la barra de captura y la acción "Llegó"; reutiliza `useBanos` y `useOperadores` sin cambios.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript estricto, Vitest, Tailwind v4, Firestore client SDK.

**Spec:** `docs/superpowers/specs/2026-07-06-banos-captura-rapida-design.md`

## Global Constraints

- Prohibido `any` y `@ts-ignore` (CLAUDE.md).
- Componentes UI no importan Firestore directamente — solo hooks `useBanos` / `useOperadores`.
- Timestamps en captura = zona local del cliente (`getFullYear` / `getHours`, **no** `toISOString()` para fecha).
- `fecha` formato `YYYY-MM-DD`; `horaEntrada` / `horaLlegada` formato `HH:mm`.
- Baño obligatorio en cada registro (`BanoSchema`: `Baño #1`, `Baño #2`, `CNC`, `Automatizacion`).
- Operador debe coincidir exactamente con un operador **activo** del catálogo.
- Sin cambios en `lib/schemas.ts`, `lib/banos.ts`, `lib/hooks/useBanos.ts`, Cuenta diaria ni Resumen.
- Sin dependencias nuevas.

---

## File map

| File | Responsibility |
|---|---|
| `lib/format.ts` | `fechaHoyLocal`, `horaAhoraLocal`, `formatIndicadorCapturaBano` |
| `lib/banos-captura.ts` | `resolverOperadorActivo` — validación nombre ↔ catálogo |
| `tests/banos-captura.test.ts` | Tests unitarios de helpers |
| `app/banos/RegistroBanoList.tsx` | UI de captura, pills, tablas, un clic en Llegó |

---

### Task 1: Helpers de fecha/hora y validación de operador

**Files:**
- Modify: `lib/format.ts`
- Create: `lib/banos-captura.ts`
- Create: `tests/banos-captura.test.ts`

**Interfaces:**
- Consumes: `Operador` de `@/lib/schemas` (solo en `banos-captura.ts`).
- Produces:
  - `fechaHoyLocal(date?: Date): string` → `"YYYY-MM-DD"`
  - `horaAhoraLocal(date?: Date): string` → `"HH:mm"`
  - `formatIndicadorCapturaBano(date?: Date): string` → `"Hoy, 6 jul 2026 — 14:52"`
  - `resolverOperadorActivo(nombre: string, operadores: Operador[]): Operador | null`

- [ ] **Step 1: Write the failing tests**

Crear `tests/banos-captura.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
  fechaHoyLocal,
  horaAhoraLocal,
  formatIndicadorCapturaBano,
} from "@/lib/format"
import { resolverOperadorActivo } from "@/lib/banos-captura"
import type { Operador } from "@/lib/schemas"

const AHORA = new Date("2026-07-06T14:52:00")

function makeOperador(overrides: Partial<Operador> = {}): Operador {
  return {
    id: "op-1",
    nombre: "Juan Pérez",
    area: "taller",
    activo: true,
    creadoEn: AHORA,
    actualizadoEn: AHORA,
    ...overrides,
  }
}

describe("fechaHoyLocal", () => {
  it("devuelve YYYY-MM-DD en zona local", () => {
    expect(fechaHoyLocal(AHORA)).toBe("2026-07-06")
  })
})

describe("horaAhoraLocal", () => {
  it("devuelve HH:mm en zona local", () => {
    expect(horaAhoraLocal(AHORA)).toBe("14:52")
  })

  it("rellena con cero a la izquierda", () => {
    const d = new Date("2026-07-06T08:05:00")
    expect(horaAhoraLocal(d)).toBe("08:05")
  })
})

describe("formatIndicadorCapturaBano", () => {
  it("incluye Hoy y la hora", () => {
    const s = formatIndicadorCapturaBano(AHORA)
    expect(s).toMatch(/^Hoy, /)
    expect(s).toContain("14:52")
  })
})

describe("resolverOperadorActivo", () => {
  const ops = [makeOperador(), makeOperador({ id: "op-2", nombre: "María López" })]

  it("encuentra por nombre exacto", () => {
    expect(resolverOperadorActivo("Juan Pérez", ops)?.id).toBe("op-1")
  })

  it("ignora espacios alrededor", () => {
    expect(resolverOperadorActivo("  Juan Pérez  ", ops)?.id).toBe("op-1")
  })

  it("null si no existe", () => {
    expect(resolverOperadorActivo("Fantasma", ops)).toBeNull()
  })

  it("null si nombre vacío", () => {
    expect(resolverOperadorActivo("   ", ops)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/banos-captura.test.ts`

Expected: FAIL — exports not found

- [ ] **Step 3: Implement helpers**

Añadir al final de `lib/format.ts`:

```ts
/** YYYY-MM-DD en zona local del cliente (no UTC). */
export function fechaHoyLocal(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** HH:mm en zona local del cliente. */
export function horaAhoraLocal(date: Date = new Date()): string {
  const h = String(date.getHours()).padStart(2, "0")
  const m = String(date.getMinutes()).padStart(2, "0")
  return `${h}:${m}`
}

/** Texto informativo para la barra de captura de baños. */
export function formatIndicadorCapturaBano(date: Date = new Date()): string {
  const fecha = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date)
  return `Hoy, ${fecha} — ${horaAhoraLocal(date)}`
}
```

Crear `lib/banos-captura.ts`:

```ts
import type { Operador } from "@/lib/schemas"

/** Devuelve el operador activo si el nombre coincide exactamente (trim). */
export function resolverOperadorActivo(
  nombre: string,
  operadores: Operador[]
): Operador | null {
  const trimmed = nombre.trim()
  if (!trimmed) return null
  return operadores.find((o) => o.nombre === trimmed) ?? null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/banos-captura.test.ts`

Expected: PASS (4 suites, all green)

- [ ] **Step 5: Commit**

```bash
git add lib/format.ts lib/banos-captura.ts tests/banos-captura.test.ts
git commit -m "feat(banos): add local date/time helpers and operator resolver"
```

---

### Task 2: Barra de captura — pills, timestamps automáticos, sin fecha/hora manual

**Files:**
- Modify: `app/banos/RegistroBanoList.tsx`

**Interfaces:**
- Consumes: `fechaHoyLocal`, `horaAhoraLocal`, `formatIndicadorCapturaBano` de `@/lib/format`; `resolverOperadorActivo` de `@/lib/banos-captura`; `useBanos`, `useOperadores` (sin cambios).
- Produces: componente `RegistroBanoList` con nueva barra de captura (Task 3 modifica llegada en el mismo archivo).

- [ ] **Step 1: Remove obsolete state and local helper**

En `RegistroBanoList.tsx`:

1. Eliminar `formatearHoraInput` local (líneas 22–26).
2. Eliminar imports `Clock`, `X` de lucide-react (se usan en UI vieja).
3. Añadir imports:

```ts
import {
  fechaHoyLocal,
  horaAhoraLocal,
  formatIndicadorCapturaBano,
} from "@/lib/format"
import { resolverOperadorActivo } from "@/lib/banos-captura"
```

4. Reemplazar estado del formulario:

```ts
// Eliminar: fecha, horaEntrada, setFecha, setHoraEntrada
const [bano, setBano] = useState<Bano | null>(null)
const [operador, setOperador] = useState("")
const [mensajeExito, setMensajeExito] = useState<string | null>(null)
const [errorCaptura, setErrorCaptura] = useState<string | null>(null)
const [indicadorHora, setIndicadorHora] = useState(() => new Date())
```

5. Derivar fecha de hoy (no en state):

```ts
const fechaHoy = fechaHoyLocal()
```

6. Actualizar `yaEnCurso`:

```ts
const yaEnCurso = operador
  ? registros.some(
      (r) => r.fecha === fechaHoy && r.operador === operador.trim() && !r.horaLlegada
    )
  : false
```

7. Actualizar filtro de registros de hoy:

```ts
const registrosHoy = registros.filter((r) => r.fecha === fechaHoy)
```

- [ ] **Step 2: Rewrite handleAgregar**

```ts
async function handleAgregar(e: React.FormEvent) {
  e.preventDefault()
  setMensajeExito(null)
  setErrorCaptura(null)
  setErrorDuplicado(null)

  if (!bano) {
    setErrorCaptura("Selecciona un baño primero")
    return
  }

  const op = resolverOperadorActivo(operador, operadoresActivos)
  if (!op) {
    setErrorCaptura("Operador no encontrado en el catálogo")
    return
  }

  if (
    registros.some(
      (r) => r.fecha === fechaHoy && r.operador === op.nombre && !r.horaLlegada
    )
  ) {
    setErrorDuplicado(
      `${op.nombre} ya tiene un registro abierto hoy. Marca "Llegó" antes de registrar otro.`
    )
    return
  }

  const ahora = new Date()
  const fecha = fechaHoyLocal(ahora)
  const horaEntrada = horaAhoraLocal(ahora)

  setAgregando(true)
  try {
    await registrarEntrada({ fecha, operador: op.nombre, bano, horaEntrada })
    setMensajeExito(`${op.nombre} registrado — ${bano}, ${horaEntrada}`)
    setOperador("")
    setIndicadorHora(ahora)
    setTimeout(() => operadorInputRef.current?.focus(), 0)
  } catch (err) {
    console.error("Error registrando entrada:", err)
    setErrorCaptura("No se pudo registrar la entrada. Intenta de nuevo.")
  } finally {
    setAgregando(false)
  }
}
```

- [ ] **Step 3: Replace form JSX with capture bar**

Reemplazar el `<form>` actual (líneas 139–207) por:

```tsx
<form
  onSubmit={handleAgregar}
  className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3"
>
  <div className="flex flex-wrap gap-2">
    <span className="text-xs font-medium text-gray-500 w-full sm:w-auto sm:self-center">
      Baño / Área
    </span>
    {BANOS.map((b) => (
      <button
        key={b}
        type="button"
        onClick={() => {
          setBano(b)
          setErrorCaptura(null)
        }}
        className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${
          bano === b
            ? "bg-[#0369A1] text-white border-[#0369A1]"
            : "bg-white text-gray-700 border-gray-200 hover:border-[#0369A1]/50"
        }`}
      >
        {b}
      </button>
    ))}
  </div>

  <div className="flex flex-wrap items-end gap-3">
    <div className="w-full sm:w-64">
      <label className="block text-xs font-medium text-gray-500 mb-1">Operador</label>
      <input
        list="operadores-list"
        ref={operadorInputRef}
        required
        placeholder="Buscar o escribir..."
        value={operador}
        onChange={(e) => {
          setOperador(e.target.value)
          setErrorDuplicado(null)
          setErrorCaptura(null)
        }}
        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:border-[#0369A1]"
      />
      <datalist id="operadores-list">
        {operadoresActivos.map((op) => (
          <option key={op.id} value={op.nombre} />
        ))}
      </datalist>
      <p className="mt-1 text-xs text-gray-500">
        {formatIndicadorCapturaBano(indicadorHora)}
      </p>
    </div>

    <button
      type="submit"
      disabled={agregando || yaEnCurso || !bano}
      title={
        yaEnCurso
          ? `${operador} ya tiene un registro abierto hoy`
          : !bano
            ? "Selecciona un baño primero"
            : undefined
      }
      className="bg-[#0369A1] hover:bg-[#0284C7] text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 sm:ml-auto"
    >
      <Plus className="h-4 w-4" />
      Registrar Entrada
    </button>
  </div>
</form>
```

- [ ] **Step 4: Add feedback banners above form**

Antes del `<form>`, después de quick stats:

```tsx
{mensajeExito && (
  <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-emerald-800 text-sm">
    {mensajeExito}
  </div>
)}
{errorCaptura && (
  <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-red-700 text-sm">
    {errorCaptura}
  </div>
)}
```

Mantener el banner `errorDuplicado` existente.

- [ ] **Step 5: Manual smoke test**

1. `npm run dev` → `/banos`
2. Sin baño seleccionado → submit deshabilitado
3. Seleccionar baño → operador del datalist → Enter
4. Verificar banner verde y fila en "En el baño" con hora actual

- [ ] **Step 6: Commit**

```bash
git add app/banos/RegistroBanoList.tsx
git commit -m "feat(banos): capture bar with auto timestamps and bathroom pills"
```

---

### Task 3: Llegada en un clic y orden de tabla

**Files:**
- Modify: `app/banos/RegistroBanoList.tsx`

**Interfaces:**
- Consumes: `horaAhoraLocal` de `@/lib/format`; `registrarLlegada` de `useBanos`.
- Produces: tabla "En el baño" con un clic en Llegó; sin estado `confirmarLlegada`.

- [ ] **Step 1: Remove two-step confirm state**

1. Eliminar `const [confirmarLlegada, setConfirmarLlegada] = useState<string | null>(null)`.
2. Eliminar import `X` (si quedó).
3. Actualizar `handleLlegada`:

```ts
async function handleLlegada(id: string, horaOriginal: string) {
  const horaLlegada = horaAhoraLocal()
  try {
    await registrarLlegada(id, horaLlegada, horaOriginal)
  } catch (err) {
    console.error("Error registrando llegada:", err)
    setErrorCaptura("No se pudo registrar la llegada. Intenta de nuevo.")
  }
}
```

- [ ] **Step 2: Sort en curso by horaEntrada desc**

Después de `enCursoTodos`:

```ts
const enCursoOrdenados = [...enCursoTodos].sort((a, b) =>
  b.horaEntrada.localeCompare(a.horaEntrada)
)
const enCurso = filtro
  ? enCursoOrdenados.filter((r) => r.operador.toLowerCase().includes(filtro))
  : enCursoOrdenados
```

Actualizar la condición vacía para usar `enCursoTodos` como ya hace el código.

- [ ] **Step 3: Replace Llegó button JSX**

En la celda Acción de "En el baño", reemplazar el bloque `confirmarLlegada === r.id ? ...` por:

```tsx
<button
  type="button"
  onClick={() => handleLlegada(r.id, r.horaEntrada)}
  className="text-xs font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-2.5 py-1 rounded-md inline-flex items-center gap-1 transition-colors"
>
  <Check className="h-3.5 w-3.5" />
  Llegó
</button>
```

- [ ] **Step 4: Manual smoke test**

1. Registrar entrada de prueba
2. Un solo clic en "Llegó" → registro pasa a "Completados hoy" con minutos calculados
3. Sin paso de confirmación intermedio

- [ ] **Step 5: Commit**

```bash
git add app/banos/RegistroBanoList.tsx
git commit -m "feat(banos): one-click arrival and sort in-progress by time"
```

---

### Task 4: Verificación CI y criterios de aceptación

**Files:**
- Verify only (no new files)

- [ ] **Step 1: Run full test suite**

Run: `npm test`

Expected: all tests pass including `tests/banos-captura.test.ts`

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: no errors in modified files

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: build succeeds

- [ ] **Step 4: Acceptance checklist (manual)**

| Criterio | ✓ |
|---|---|
| Sin inputs de fecha ni hora en captura | |
| Indicador "Hoy, … — HH:mm" visible | |
| Pills de baño; submit sin baño deshabilitado | |
| Datalist operador conservado | |
| Enter registra con timestamps automáticos | |
| "Llegó" un solo clic | |
| Operador typo → mensaje catálogo | |
| Cuenta diaria / Resumen sin cambios | |

- [ ] **Step 5: Commit (if any lint fixes)**

```bash
git add -A
git commit -m "chore(banos): verify captura rapida passes lint test build"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|---|---|
| Fecha/hora automáticas, sin inputs | Task 2 |
| Pills baño obligatorio | Task 2 |
| Input operador + datalist | Task 2 |
| Validación operador catálogo | Task 1, 2 |
| Llegada un clic | Task 3 |
| Indicador fecha/hora solo lectura | Task 2 |
| Banner éxito / errores | Task 2, 3 |
| Orden en curso por hora ↓ | Task 3 |
| Sin cambios schema/Firestore/hooks | Global constraints |
| Tests unitarios helpers | Task 1 |
| lint / test / build | Task 4 |

No placeholders. Types consistent across tasks.
