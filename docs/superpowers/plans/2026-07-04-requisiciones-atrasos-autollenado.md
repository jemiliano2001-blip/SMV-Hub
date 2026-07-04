# Requisiciones: Semáforo de Atrasos + Autollenado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Semáforo de atrasos por prioridad en la tabla de requisiciones generales, y botón "Autollenar" que llena descripción/tienda desde un link de producto vía `/api/scrape`.

**Architecture:** Lógica pura nueva en `lib/requisicion-atraso.ts` (testeada con Vitest); campo `link` nullable en `RequisicionSchema`; cambios de UI concentrados en `app/requisiciones/RequisicionesList.tsx` y `app/requisiciones/RequisicionFormModal.tsx`. Nada se persiste para el semáforo; el autollenado reutiliza el `POST /api/scrape` existente con el patrón de `OrdenFormModal.handleScrape`.

**Tech Stack:** Next.js 16, React 19, Zod, Firebase v12 (Firestore + Auth), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-03-requisiciones-atrasos-autollenado-design.md`

## Global Constraints

- Prohibido `any` y `@ts-ignore` (CLAUDE.md).
- Fechas de negocio como string `YYYY-MM-DD`; aritmética en UTC; formateo local solo en cliente.
- Toda entrada validada con Zod en la frontera (`lib/schemas.ts`).
- Un fallo de red nunca rompe la UI: error inline + los datos capturados no se pierden.
- `npx tsc --noEmit` tiene errores PREEXISTENTES solo en `tests/reportes.test.ts` — el criterio es "cero errores nuevos".
- El dev server del usuario ya corre en `http://localhost:3000`. El autollenado requiere sesión real de Google (el token de Firebase se manda a `/api/scrape`); con `NEXT_PUBLIC_DEV_AUTH_BYPASS=true` el botón fallará con 401 — misma limitación que ya tiene el scrape de `OrdenFormModal`.

---

### Task 1: Lógica pura `estadoAtraso` (TDD)

**Files:**
- Create: `lib/requisicion-atraso.ts`
- Test: `tests/requisicion-atraso.test.ts`

**Interfaces:**
- Consumes: tipos `Requisicion`, `PrioridadRequisicion` de `@/lib/schemas`.
- Produces (Task 2 los usa con estas firmas exactas):
  - `type EstadoAtraso = { tipo: "a_tiempo" | "por_vencer" | "atrasada"; dias: number } | null`
  - `estadoAtraso(r: Pick<Requisicion, "estado" | "prioridad" | "fechaPedido">, hoy: string): EstadoAtraso`
  - `hoyLocal(): string` — fecha local del cliente como `YYYY-MM-DD`

- [ ] **Step 1: Escribir el test que falla — `tests/requisicion-atraso.test.ts`**

```ts
import { describe, expect, it } from "vitest"
import { estadoAtraso, hoyLocal } from "@/lib/requisicion-atraso"

// prioridad "3-5 dias" → límite = fechaPedido + 5 días = 2026-07-06
const base = {
  estado: "no_comprado",
  prioridad: "3-5 dias",
  fechaPedido: "2026-07-01",
} as const

describe("estadoAtraso", () => {
  it("a_tiempo con días restantes antes del límite", () => {
    expect(estadoAtraso(base, "2026-07-03")).toEqual({ tipo: "a_tiempo", dias: 3 })
  })

  it("por_vencer exactamente el día del límite", () => {
    expect(estadoAtraso(base, "2026-07-06")).toEqual({ tipo: "por_vencer", dias: 0 })
  })

  it("atrasada con días de atraso después del límite", () => {
    expect(estadoAtraso(base, "2026-07-10")).toEqual({ tipo: "atrasada", dias: 4 })
  })

  it("en_proceso también corre el reloj", () => {
    expect(estadoAtraso({ ...base, estado: "en_proceso" }, "2026-07-10")).toEqual({
      tipo: "atrasada",
      dias: 4,
    })
  })

  it("comprado y recibido no llevan semáforo", () => {
    expect(estadoAtraso({ ...base, estado: "comprado" }, "2026-07-10")).toBeNull()
    expect(estadoAtraso({ ...base, estado: "recibido" }, "2026-07-10")).toBeNull()
  })

  it("'cuando se pueda' y sin prioridad nunca vencen", () => {
    expect(estadoAtraso({ ...base, prioridad: "cuando se pueda" }, "2027-01-01")).toBeNull()
    expect(estadoAtraso({ ...base, prioridad: null }, "2027-01-01")).toBeNull()
  })

  it("límites por prioridad: 1-2 dias → 2, 7-14 dias → 14", () => {
    expect(estadoAtraso({ ...base, prioridad: "1-2 dias" }, "2026-07-03")).toEqual({
      tipo: "por_vencer",
      dias: 0,
    })
    expect(
      estadoAtraso({ ...base, prioridad: "7-14 dias", fechaPedido: "2026-06-25" }, "2026-07-10")
    ).toEqual({ tipo: "atrasada", dias: 1 })
  })

  it("fecha inválida devuelve null en lugar de lanzar", () => {
    expect(estadoAtraso({ ...base, fechaPedido: "no-fecha" }, "2026-07-10")).toBeNull()
    expect(estadoAtraso(base, "")).toBeNull()
  })
})

describe("hoyLocal", () => {
  it("devuelve YYYY-MM-DD", () => {
    expect(hoyLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/requisicion-atraso.test.ts`
Expected: FAIL — `Cannot find module '@/lib/requisicion-atraso'` (o equivalente).

- [ ] **Step 3: Implementación mínima — `lib/requisicion-atraso.ts`**

```ts
import type { PrioridadRequisicion, Requisicion } from "@/lib/schemas"

/** Resultado del semáforo: null = sin semáforo (ya comprada, sin prioridad, o dato inválido). */
export type EstadoAtraso =
  | { tipo: "a_tiempo" | "por_vencer" | "atrasada"; dias: number }
  | null

// Días máximos que otorga cada prioridad; null = nunca vence.
const LIMITE_DIAS: Record<PrioridadRequisicion, number | null> = {
  "1-2 dias": 2,
  "3-5 dias": 5,
  "7-14 dias": 14,
  "cuando se pueda": null,
}

const MS_DIA = 86_400_000

/** Parsea YYYY-MM-DD a epoch UTC; null si no tiene el formato exacto. */
function parseUTC(fecha: string): number | null {
  const m = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(t) ? null : t
}

export function estadoAtraso(
  r: Pick<Requisicion, "estado" | "prioridad" | "fechaPedido">,
  hoy: string
): EstadoAtraso {
  if (r.estado === "comprado" || r.estado === "recibido") return null
  if (!r.prioridad) return null
  const limite = LIMITE_DIAS[r.prioridad]
  if (limite === null) return null
  const pedido = parseUTC(r.fechaPedido)
  const hoyMs = parseUTC(hoy)
  if (pedido === null || hoyMs === null) return null
  const dias = Math.round((pedido + limite * MS_DIA - hoyMs) / MS_DIA)
  if (dias > 0) return { tipo: "a_tiempo", dias }
  if (dias === 0) return { tipo: "por_vencer", dias: 0 }
  return { tipo: "atrasada", dias: -dias }
}

/** Fecha local del cliente como YYYY-MM-DD (toISOString daría el día UTC, que se adelanta de noche en MX). */
export function hoyLocal(): string {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, "0")
  const dia = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${mes}-${dia}`
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/requisicion-atraso.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/requisicion-atraso.ts tests/requisicion-atraso.test.ts
git commit -m "feat: lógica pura estadoAtraso para semáforo de requisiciones"
```

---

### Task 2: Columna "Límite" con semáforo en la tabla

**Files:**
- Modify: `app/requisiciones/RequisicionesList.tsx`

**Interfaces:**
- Consumes: `estadoAtraso`, `hoyLocal`, `EstadoAtraso` de `@/lib/requisicion-atraso` (Task 1).
- Produces: nada nuevo para otras tasks.

- [ ] **Step 1: Agregar imports y constantes de estilo**

En `app/requisiciones/RequisicionesList.tsx`, junto a los imports existentes:

```tsx
import { estadoAtraso, hoyLocal, type EstadoAtraso } from '@/lib/requisicion-atraso'
```

Debajo de `PRIORIDAD_BADGE` agregar:

```tsx
const ATRASO_BADGE: Record<'a_tiempo' | 'por_vencer' | 'atrasada', string> = {
  a_tiempo: 'bg-green-50 text-green-700',
  por_vencer: 'bg-yellow-50 text-yellow-800',
  atrasada: 'bg-red-50 text-red-700',
}

function textoAtraso(a: NonNullable<EstadoAtraso>): string {
  if (a.tipo === 'por_vencer') return 'vence hoy'
  const unidad = a.dias === 1 ? 'día' : 'días'
  return a.tipo === 'a_tiempo' ? `${a.dias} ${unidad}` : `+${a.dias} ${unidad}`
}
```

- [ ] **Step 2: Calcular `hoy` una vez por render**

Dentro del componente `RequisicionesList`, junto a los `useState`:

```tsx
const hoy = hoyLocal()
```

- [ ] **Step 3: Agregar la columna al `<thead>` (solo tab general)**

Después del `<th>` de Prioridad/Parte # (el ternario `isAuto`) y ANTES del `<th>` de Empresa:

```tsx
{!isAuto && <th className="px-4 py-3 font-semibold whitespace-nowrap">Límite</th>}
```

- [ ] **Step 4: Agregar la celda al `<tbody>` en la misma posición**

Después de la celda de Prioridad/Parte # y antes de la de Empresa:

```tsx
{!isAuto && (
  <td className="px-4 py-3 whitespace-nowrap">
    {(() => {
      const a = estadoAtraso(r, hoy)
      if (!a) return <span className="text-xs text-gray-400">—</span>
      return (
        <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${ATRASO_BADGE[a.tipo]}`}>
          {textoAtraso(a)}
        </span>
      )
    })()}
  </td>
)}
```

- [ ] **Step 5: Verificar lint, tipos y suite completa**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: lint limpio; tsc sin errores nuevos; 204 + 9 tests en verde.

- [ ] **Step 6: Verificar en el navegador**

En `/requisiciones` tab "Compras generales": columna "Límite" visible; una requisición `no_comprado` con prioridad `1-2 dias` y fecha de hace una semana muestra badge rojo "+5 días"; una `comprado` muestra "—"; el tab "Automatización" NO tiene la columna.

- [ ] **Step 7: Commit**

```bash
git add app/requisiciones/RequisicionesList.tsx
git commit -m "feat: columna Límite con semáforo de atrasos en requisiciones generales"
```

---

### Task 3: Campo `link` en schema, tabla y modal de edición (TDD)

**Files:**
- Modify: `lib/schemas.ts` (RequisicionSchema), `app/requisiciones/RequisicionesList.tsx`, `app/requisiciones/RequisicionFormModal.tsx`
- Test: `tests/schemas.test.ts` (agregar casos)

**Interfaces:**
- Consumes: `RequisicionSchema` existente en `lib/schemas.ts`.
- Produces: `Requisicion.link: string | null` — Task 4 lo escribe desde el formulario. `NuevaRequisicionPayload` (Omit de `Requisicion`) lo incluye automáticamente.

- [ ] **Step 1: Test que falla — agregar al final de `tests/schemas.test.ts`**

```ts
describe("RequisicionSchema.link", () => {
  const baseReq = {
    id: "r1",
    solicitante: "Oscar",
    fechaPedido: "2026-07-01",
    tienda: null,
    descripcion: "Tornillos M6",
    cantidad: null,
    prioridad: null,
    empresa: null,
    ordenServicio: null,
    parteNumero: null,
    fechaEntregaEst: null,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  }

  it("default null cuando no viene (registros viejos)", () => {
    const r = RequisicionSchema.parse(baseReq)
    expect(r.link).toBeNull()
  })

  it("acepta un link string", () => {
    const r = RequisicionSchema.parse({ ...baseReq, link: "https://www.mcmaster.com/91290A115/" })
    expect(r.link).toBe("https://www.mcmaster.com/91290A115/")
  })
})
```

(Si `RequisicionSchema` no está importado en ese archivo, agregarlo al import existente de `@/lib/schemas`.)

Run: `npx vitest run tests/schemas.test.ts`
Expected: FAIL — `link` no existe en el tipo/parse.

- [ ] **Step 2: Agregar el campo en `lib/schemas.ts`**

En `RequisicionSchema`, después de la línea `descripcion: z.string().min(1),`:

```ts
  link: z.string().nullable().default(null), // URL del producto; la descripción queda como texto
```

Run: `npx vitest run tests/schemas.test.ts`
Expected: PASS.

Nota de runtime: el converter de Firestore (`makeDateConverter`) NO pasa por Zod, así que en docs viejos `r.link` llega como `undefined`. Todo consumo en UI debe ser truthy-check (`r.link ? ... : ...`), nunca `r.link === null`.

- [ ] **Step 3: Render del link en la tabla**

En `app/requisiciones/RequisicionesList.tsx`, reemplazar la celda de descripción:

```tsx
<td className="px-4 py-3 text-gray-900 min-w-[200px]">
  {r.link ? (
    <a
      href={r.link}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline"
    >
      {r.descripcion}
    </a>
  ) : /^https?:\/\//i.test(r.descripcion) ? (
    <a
      href={r.descripcion}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline break-all"
    >
      {r.descripcion}
    </a>
  ) : (
    r.descripcion
  )}
</td>
```

- [ ] **Step 4: Input "Link" en el modal de edición**

En `app/requisiciones/RequisicionFormModal.tsx`:

En el `useState` de `formData`, después de `descripcion: requisicionBase.descripcion,`:

```tsx
    link: requisicionBase.link || '',
```

En el objeto `cambios` de `handleSubmit`, después de `descripcion: ...`:

```tsx
        link: formData.link.trim() || null,
```

En el JSX, después del `<div className="flex gap-3">` que contiene descripción y solicitante, agregar:

```tsx
            <input
              type="url"
              placeholder="Link del producto (opcional)"
              value={formData.link}
              onChange={(e) => setFormData((f) => ({ ...f, link: e.target.value }))}
              className={`w-full ${INPUT_CLS}`}
            />
```

- [ ] **Step 5: Incluir `link` en el payload de alta del formulario inline**

En `app/requisiciones/RequisicionesList.tsx` — `emptyForm()` agrega `link: '',` y el `payload` de `handleSubmit` agrega `link: form.link.trim() || null,`. (Sin esto `tsc` falla porque `NuevaRequisicionPayload` ahora exige `link` — correcto y esperado.)

- [ ] **Step 6: Verificar lint, tipos y suite**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: todo verde, sin errores nuevos.

- [ ] **Step 7: Commit**

```bash
git add lib/schemas.ts tests/schemas.test.ts app/requisiciones/RequisicionesList.tsx app/requisiciones/RequisicionFormModal.tsx
git commit -m "feat: campo link en requisiciones — schema, tabla y modal de edición"
```

---

### Task 4: Botón "Autollenar" desde link en el formulario

**Files:**
- Modify: `app/requisiciones/RequisicionesList.tsx`

**Interfaces:**
- Consumes: `POST /api/scrape` (body `{ url: string }`, responde `{ title?: string; price?: number; provider?: string }` o `{ error: string }` con status ≥400); `getClienteAuth` de `@/lib/firebase`; campo `form.link` (Task 3).
- Produces: nada nuevo.

- [ ] **Step 1: Agregar import, estado y handler**

Import (junto a los existentes de `RequisicionesList.tsx`):

```tsx
import { Sparkles } from 'lucide-react'
import { getClienteAuth } from '@/lib/firebase'
```

Estado, junto a `const [saving, setSaving] = useState(false)`:

```tsx
const [scraping, setScraping] = useState(false)
const [scrapeError, setScrapeError] = useState<string | null>(null)
```

Handler, después de `handleSubmit` (patrón copiado de `OrdenFormModal.handleScrape`):

```tsx
async function handleAutollenar() {
  const url = form.descripcion.trim()
  setScraping(true)
  setScrapeError(null)
  try {
    const auth = getClienteAuth()
    const token = await auth.currentUser?.getIdToken()
    const res = await fetch('/api/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ url }),
    })
    const data = (await res.json()) as { title?: string; provider?: string; error?: string }
    if (!res.ok) throw new Error(data.error || 'No se pudo extraer la información')
    setForm((f) => ({
      ...f,
      descripcion: data.title || f.descripcion,
      tienda: f.tienda || data.provider || '',
      link: url,
    }))
  } catch (err) {
    setScrapeError(err instanceof Error ? err.message : 'No se pudo extraer la información')
  } finally {
    setScraping(false)
  }
}
```

- [ ] **Step 2: Botón condicional junto al input de descripción**

En el `<div className="flex gap-3">` del formulario, inmediatamente después del `<input>` de descripción:

```tsx
{/^https?:\/\//i.test(form.descripcion.trim()) && (
  <button
    type="button"
    onClick={handleAutollenar}
    disabled={scraping}
    className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors whitespace-nowrap"
  >
    {scraping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
    Autollenar
  </button>
)}
```

Y debajo del `<form>` (dentro del card), el error inline:

```tsx
{scrapeError && (
  <p className="mt-2 text-xs text-red-600">
    {scrapeError} — puedes guardar la requisición con el link tal cual.
  </p>
)}
```

- [ ] **Step 3: Verificar lint, tipos y suite**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: todo verde.

- [ ] **Step 4: Verificar en el navegador (requiere sesión real de Google)**

En `/requisiciones`: pegar `https://www.mcmaster.com/91290A115/` en descripción → aparece "Autollenar" → clic → descripción se vuelve el título del producto, tienda "McMaster-Carr", y al guardar la fila muestra la descripción como liga al link. Pegar una URL de un host NO permitido (p. ej. `https://example.com/x`) → error inline y el formulario queda intacto.

- [ ] **Step 5: Commit**

```bash
git add app/requisiciones/RequisicionesList.tsx
git commit -m "feat: botón Autollenar desde link con /api/scrape en requisiciones"
```
