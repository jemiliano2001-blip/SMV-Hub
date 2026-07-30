# Optimización de memoria del cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bajar el uso de RAM del cliente en SMV Hub cortando full-scans de Firestore al navegar (Fase 1) y cargando reportes/cotizaciones/proveedores por rango o página (Fase 2).

**Architecture:** Nuevas consultas acotadas en `lib/ordenes.ts` y `lib/cotizaciones.ts` (`listarOrdenesRecientes`, `listarOrdenesEnRango`, `obtenerPaginaCotizaciones`). Las páginas dejan de llamar `listarOrdenes()` / `cargarTodas` al montar; el historial completo queda como acción explícita. El helper SAT usable en cliente se separa del módulo que importa `catalogo.json`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript estricto, Firebase/Firestore v12 cliente, Vitest, Playwright E2E (`camino-dinero`).

**Spec:** `docs/superpowers/specs/2026-07-30-optimizacion-memoria-cliente-design.md`

## Global Constraints

- Prohibido `any` y `@ts-ignore`.
- UI no importa Firestore directo — solo `lib/*` y hooks.
- Multi-moneda: nunca sumar `total` entre MXN y USD.
- Reportes: si `fechaFactura` es null, usar `creadoEn` (`filtrarPorRango`).
- Sin fallback silencioso a `listarOrdenes()` / `listarCotizaciones()` completo cuando falle un índice o una query acotada.
- Medir memoria en build de producción / hosting (`npm run build` usa `--webpack`), no solo `next dev`.
- Defaults del spec: sugerencias = **últimas 200 órdenes**; scorecards = **últimos 12 meses**; cotizaciones página = **50**.
- `listarOrdenes()` y `cargarTodas` solo por acción explícita del usuario (o flujos SAT/lote ya gated por toast/botón).
- No recrear `/importar` ni Reabastecimiento ROP.
- Commits solo cuando el usuario lo pida (salvo que el usuario diga lo contrario en la sesión de ejecución).

## File map

| Archivo | Responsabilidad |
|---------|-----------------|
| `lib/ordenes.ts` | `listarOrdenesRecientes`, `listarOrdenesEnRango` (+ existentes) |
| `lib/cotizaciones.ts` | `obtenerPaginaCotizaciones` |
| `lib/hooks/useCotizaciones.ts` | Paginación Firestore en vez de colección entera |
| `lib/sat/historial-sat.ts` (nuevo) | `extraerEntradasHistorialSat` sin importar catálogo |
| `lib/sat/sugerir-clave.ts` | Re-export del helper; catálogo solo server |
| `app/nueva-compra/NuevaCompraForm.tsx` | Sugerencias con muestra reciente |
| `app/proveedores/page.tsx` | Scorecards con ventana 12 meses, sin `cargarTodas` al montar |
| `app/ordenes/OrdenesList.tsx` | No auto-`cargarTodas` en filtro de estado |
| `app/requisiciones/RequisicionesList.tsx` | Historial completo solo explícito |
| `app/reportes/ReporteView.tsx` | Carga por rango del período activo |
| `app/reportes/contable/ReporteContableView.tsx` | Pendientes/historial sin full-scan default |
| `app/ordenes/ModalSugerirClavesSat.tsx` | Import del helper liviano |
| `tests/lib-ordenes.test.ts` | Tests de nuevas queries |
| `tests/lib-cotizaciones*.test.ts` o nuevo | Tests paginación cotizaciones |
| `docs/testing/memoria-cliente-checklist.md` (nuevo) | Checklist baseline MB |

**Gate entre fases:** terminar Tasks 1–5 y re-medir antes de Tasks 6–11.

---

### Task 1: Checklist de baseline + `listarOrdenesRecientes`

**Files:**
- Create: `docs/testing/memoria-cliente-checklist.md`
- Modify: `lib/ordenes.ts`
- Modify: `tests/lib-ordenes.test.ts`

**Interfaces:**
- Consumes: `ordenesRef`, `orderBy`, `limit`, `getDocs`, `OrdenCompra`
- Produces:
  - `listarOrdenesRecientes(limite?: number): Promise<OrdenCompra[]>` — default `limite = 200`, `orderBy("creadoEn","desc")` + `limit(limite)`

- [ ] **Step 1: Write failing tests for `listarOrdenesRecientes`**

En `tests/lib-ordenes.test.ts`, añadir:

```ts
describe("listarOrdenesRecientes", () => {
  it("pide orderBy creadoEn desc y limit con default 200", async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as unknown as QuerySnapshot)
    await listarOrdenesRecientes()
    expect(orderBy).toHaveBeenCalledWith("creadoEn", "desc")
    expect(limit).toHaveBeenCalledWith(200)
  })

  it("respeta un limite custom y lo acota a max 500", async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as unknown as QuerySnapshot)
    await listarOrdenesRecientes(50)
    expect(limit).toHaveBeenCalledWith(50)
    await listarOrdenesRecientes(9999)
    expect(limit).toHaveBeenCalledWith(500)
  })
})
```

(Ajustar mocks al estilo existente del archivo — `limit` ya debe estar mockeado; si no, añadirlo como los demás de `firebase/firestore`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib-ordenes.test.ts -t "listarOrdenesRecientes"`  
Expected: FAIL (función no exportada).

- [ ] **Step 3: Implement `listarOrdenesRecientes`**

En `lib/ordenes.ts`, junto a `obtenerPaginaOrdenes`:

```ts
const LIMITE_RECIENTES_DEFAULT = 200
const LIMITE_RECIENTES_MAX = 500

export async function listarOrdenesRecientes(
  limite = LIMITE_RECIENTES_DEFAULT
): Promise<OrdenCompra[]> {
  const n = Number.isFinite(limite)
    ? Math.min(LIMITE_RECIENTES_MAX, Math.max(1, Math.trunc(limite)))
    : LIMITE_RECIENTES_DEFAULT
  const snap = await getDocs(
    query(ordenesRef(), orderBy("creadoEn", "desc"), limit(n))
  )
  return snap.docs.map((d) => d.data())
}
```

- [ ] **Step 4: Run tests — pass**

Run: `npx vitest run tests/lib-ordenes.test.ts`  
Expected: PASS (incluyendo paginación existente).

- [ ] **Step 5: Add measurement checklist**

Crear `docs/testing/memoria-cliente-checklist.md`:

```markdown
# Checklist memoria cliente SMV Hub

Medir en Chrome → More tools → Task manager (o Performance monitor), sobre
build de producción o `smv-hub.web.app` (no solo `next dev`).

## Flujo baseline
1. Abrir sesión limpia (pestaña nueva).
2. home → `/ordenes` → `/proveedores` → `/reportes` (tab gerencial) → home.
3. Anotar MB de la pestaña al final.
4. Repetir el ciclo 2 veces más; anotar si sigue subiendo.

| Momento | MB | Notas |
|---------|-----|-------|
| Baseline pre-fix | | |
| Post Fase 1 | | |
| Post Fase 2 | | |
```

Rellenar la fila Baseline al verificar (manual).

---

### Task 2: `/nueva-compra` usa muestra reciente

**Files:**
- Modify: `app/nueva-compra/NuevaCompraForm.tsx` (efecto ~L164–180)
- Test: reutilizar tests de `lib/sugerencias-compra` si existen; smoke manual

**Interfaces:**
- Consumes: `listarOrdenesRecientes` de `@/lib/ordenes`, `aplanarHistorial`
- Produces: historial de sugerencias acotado a 200 órdenes

- [ ] **Step 1: Replace `listarOrdenes` import/call**

En `NuevaCompraForm.tsx`:

```ts
import { buscarPorFacturaYProveedor, listarOrdenesRecientes } from '@/lib/ordenes'
```

En el `useEffect` de historial:

```ts
listarOrdenesRecientes(200)
  .then((ordenes) => {
    if (activo) historialRef.current = aplanarHistorial(ordenes)
  })
```

Comentario encima: historial acotado a propósito (spec memoria); la IA sigue teniendo prioridad.

- [ ] **Step 2: Confirm no remaining full-scan on mount**

Run: `rg "listarOrdenes\\(" app/nueva-compra`  
Expected: sin matches (salvo si queda en otro archivo no-mount).

- [ ] **Step 3: Typecheck / targeted tests**

Run: `npx tsc --noEmit`  
Run: `npx vitest run tests/sugerencias-compra.test.ts` (o el archivo que cubra `aplanarHistorial` si existe)  
Expected: PASS.

---

### Task 3: `/proveedores` — scorecards sin `cargarTodas` al montar

**Files:**
- Modify: `app/proveedores/page.tsx` (~L1140–1144 y uso de `ordenesScorecard`)
- Modify: `lib/ordenes.ts` (añadir `listarOrdenesEnRango` aquí si aún no está — ver Task 6; **si preferís no adelantar Fase 2**, usar `listarOrdenesRecientes(500)` temporalmente en esta task y sustituir en Task 6/8)

**Decisión de este plan:** implementar `listarOrdenesEnRango` en Task 3 (necesaria para ventana 12 meses) y reutilizarla en reportes (Task 7). Adelanta una pieza de Fase 2 de forma justificada.

**Interfaces:**
- Consumes / Produces (añadir en `lib/ordenes.ts`):

```ts
export async function listarOrdenesEnRango(
  desde: Date,
  hasta: Date
): Promise<OrdenCompra[]>
```

Query: `where("creadoEn", ">=", desde)`, `where("creadoEn", "<=", hasta)`, `orderBy("creadoEn", "desc")`.  
Después en cliente (callers de reportes): `filtrarPorRango` para fallback `fechaFactura`.  
Sin fallback a `listarOrdenes()`.

- [ ] **Step 1: Failing tests for `listarOrdenesEnRango`**

```ts
describe("listarOrdenesEnRango", () => {
  it("consulta creadoEn con cotas y orderBy desc", async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as unknown as QuerySnapshot)
    const desde = new Date("2025-07-30T00:00:00Z")
    const hasta = new Date("2026-07-30T23:59:59Z")
    await listarOrdenesEnRango(desde, hasta)
    expect(where).toHaveBeenCalledWith("creadoEn", ">=", desde)
    expect(where).toHaveBeenCalledWith("creadoEn", "<=", hasta)
    expect(orderBy).toHaveBeenCalledWith("creadoEn", "desc")
  })
})
```

- [ ] **Step 2: Implement `listarOrdenesEnRango`**

```ts
export async function listarOrdenesEnRango(
  desde: Date,
  hasta: Date
): Promise<OrdenCompra[]> {
  const snap = await getDocs(
    query(
      ordenesRef(),
      where("creadoEn", ">=", desde),
      where("creadoEn", "<=", hasta),
      orderBy("creadoEn", "desc")
    )
  )
  return snap.docs.map((d) => d.data())
}
```

Misma-field inequality + orderBy: índice de un solo campo (no requiere entrada nueva en `firestore.indexes.json`). Si Firestore exige compuesto en algún entorno, documentar y añadir índice — **nunca** caer a full-scan.

- [ ] **Step 3: Wire proveedores page**

Quitar:

```ts
const { ordenes: ordenesScorecard, cargarTodas: cargarTodasOrdenes } = useOrdenes()
useEffect(() => { void cargarTodasOrdenes() }, [cargarTodasOrdenes])
```

Reemplazar por estado local:

```ts
const [ordenesScorecard, setOrdenesScorecard] = useState<OrdenCompra[]>([])
const [cargandoScorecards, setCargandoScorecards] = useState(false)

async function cargarScorecardsVentana() {
  setCargandoScorecards(true)
  try {
    const hasta = new Date()
    const desde = new Date()
    desde.setFullYear(desde.getFullYear() - 1)
    setOrdenesScorecard(await listarOrdenesEnRango(desde, hasta))
  } catch (err) {
    console.error('[proveedores] scorecards:', err)
    // banner/toast existente del módulo si hay; no llamar listarOrdenes()
  } finally {
    setCargandoScorecards(false)
  }
}

useEffect(() => {
  void cargarScorecardsVentana()
}, [])
```

Añadir botón visible “Actualizar scorecards (12 meses)” que llame `cargarScorecardsVentana` (y opcional segundo botón “Historial completo…” solo si el producto lo pide — por defecto **no** exponer full-scan).

Asegurar imports: `listarOrdenesEnRango`, tipo `OrdenCompra`; quitar `useOrdenes` si ya no se usa en esa página.

- [ ] **Step 4: Tests + typecheck**

Run: `npx vitest run tests/lib-ordenes.test.ts`  
Run: `npx tsc --noEmit`  
Expected: PASS.

---

### Task 4: `/ordenes` y `/requisiciones` — sin auto-full-load por filtro

**Files:**
- Modify: `app/ordenes/OrdenesList.tsx` (~L356–400)
- Modify: `app/requisiciones/RequisicionesList.tsx` (~L471–475)

**Interfaces:**
- Consumes: `cargarTodas` / `cargarMas` existentes
- Produces: UX donde filtrar por estado **no** dispara `cargarTodas` automáticamente

- [ ] **Step 1: Órdenes — filtro de estado**

Cambiar:

```ts
setEstadoFiltro={(estado) => {
  setEstadoFiltro(estado)
  if (estado !== 'todos') void cargarTodas()
}}
```

Por:

```ts
setEstadoFiltro={(estado) => {
  setEstadoFiltro(estado)
}}
```

Mantener `onPrepararFiltros={() => void cargarTodas()}` solo en el control que el usuario usa conscientemente para “preparar historial” (si ese control es ambiguo, renombrar label a “Cargar historial completo para filtros”).

Para el modal SAT que ya hace `await cargarTodas()` con toast: **dejarlo** (acción explícita gated por toast).

- [ ] **Step 2: Requisiciones**

En chips/filtros, no llamar `prepararHistorialCompleto` al montar ni al cambiar chip por defecto. Solo en handlers de búsqueda avanzada / botón explícito. Verificar con:

```bash
rg "cargarTodas|prepararHistorialCompleto" app/requisiciones/RequisicionesList.tsx
```

- [ ] **Step 3: Manual smoke**

Abrir `/ordenes`, filtrar por estado con solo la primera página cargada: la lista puede mostrar subset; el usuario puede “Cargar más” / “Cargar historial completo”. No debe dispararse carga completa al solo cambiar el pill.

---

### Task 5: Gate Fase 1 — re-medir

**Files:**
- Modify: `docs/testing/memoria-cliente-checklist.md` (fila Post Fase 1)

- [ ] **Step 1: Build producción local o usar hosting preview**

Run: `npm run build` (ya usa `--webpack` + verify bundle).

- [ ] **Step 2: Repetir flujo baseline**

home → órdenes → proveedores → reportes → home (×2–3 ciclos). Anotar MB.

- [ ] **Step 3: Criterio de salida**

Memoria **estable** al repetir (no subir sin techo). Ideal ≤ ~50% del baseline o &lt; 700 MB si baseline era ~1.4 GB. Si no se cumple, no avanzar a Fase 2 sin ajustar hotspots restantes (`rg "listarOrdenes\\(|cargarTodas\\("` en `app/`).

---

### Task 6: `/reportes` carga por rango del período

**Files:**
- Modify: `app/reportes/ReporteView.tsx`
- Optional test: `tests/reportes.test.ts` (lógica ya cubierta; smoke de integración de carga)

**Interfaces:**
- Consumes: `listarOrdenesEnRango`, `filtrarPorRango`, `periodoPreset`
- Produces: `ordenes` en estado = resultado de rango (± margen) filtrado

- [ ] **Step 1: Helper de margen en el view (o lib)**

Para no perder órdenes con `fechaFactura` en el período pero `creadoEn` fuera, ensanchar la query 45 días:

```ts
function margenConsulta(desde: Date, hasta: Date): { desdeQ: Date; hastaQ: Date } {
  const desdeQ = new Date(desde)
  desdeQ.setDate(desdeQ.getDate() - 45)
  const hastaQ = new Date(hasta)
  hastaQ.setDate(hastaQ.getDate() + 45)
  return { desdeQ, hastaQ }
}
```

- [ ] **Step 2: Replace `listarOrdenes` in `cargar` and `useEffect`**

```ts
import { listarOrdenesEnRango } from "@/lib/ordenes"

const cargar = useCallback(async () => {
  setCargando(true)
  setError(null)
  try {
    const { desdeQ, hastaQ } = margenConsulta(periodo.desde, periodo.hasta)
    const brutas = await listarOrdenesEnRango(desdeQ, hastaQ)
    setOrdenes(filtrarPorRango(brutas, periodo.desde, periodo.hasta))
  } catch {
    setError(MSG_ERROR)
  } finally {
    setCargando(false)
  }
}, [periodo.desde, periodo.hasta])
```

Recargar cuando cambie el período (`useEffect` deps: `periodo.desde`, `periodo.hasta`, `initialTab`).  
**Prohibido:** al fallar, llamar `listarOrdenes()`.

Quitar el `useEffect` que hace `listarOrdenes()` una vez; unificar en `cargar` disparado al entrar a tab gerencial y al cambiar preset.

- [ ] **Step 3: Verify multi-moneda path unchanged**

`lineasTodas` / filtro `monedaActiva` se quedan igual.  
Run: `npx vitest run tests/reportes.test.ts`

---

### Task 7: `/reportes/contable` sin full-scan default

**Files:**
- Modify: `app/reportes/contable/ReporteContableView.tsx`
- Possibly: `lib/ordenes.ts` si hace falta `listarOrdenesPendientesContables` — preferir query por ventana + filtro cliente

**Interfaces:**
- Tab pendientes: órdenes de **últimos 12 meses** sin `reporteContableId` (filtro cliente `!o.reporteContableId`)
- Tab historial: órdenes del lote seleccionado — idealmente leer IDs del lote (`listarLotesContables`) y `getDoc`/`where("reporteContableId","==",loteId)` si el campo está indexado; si no, ventana 12 meses filtrada por `reporteContableId === loteSeleccionado`

- [ ] **Step 1: Replace `listarOrdenes()` in `cargar`**

```ts
const hasta = new Date()
const desde = new Date()
desde.setFullYear(desde.getFullYear() - 1)
const ords = await listarOrdenesEnRango(desde, hasta)
setOrdenes(ords)
```

Mantener `listarLotesContables()`. Empty state si no hay pendientes en la ventana; texto: “No hay pendientes en los últimos 12 meses”. Botón opcional “Buscar más atrás (6 meses adicionales)” que **extiende** el `desde` — no full-scan.

- [ ] **Step 2: Keep SAT historial helper import fix deferred to Task 9**

No cambiar aún el import de `extraerEntradasHistorialSat` aquí (Task 9).

- [ ] **Step 3: Smoke contable + E2E awareness**

Run: `npx tsc --noEmit`  
Si hay tests de contable: `npx vitest run tests/reportes-contables*.test.ts`  
E2E `camino-dinero` puede tocar contable: no romper contratos de UI.

---

### Task 8: Paginación Firestore en cotizaciones

**Files:**
- Modify: `lib/cotizaciones.ts`
- Modify: `lib/hooks/useCotizaciones.ts`
- Modify: `app/cotizaciones/CotizacionesList.tsx` (adaptar a `cargarMas` / `hayMas`)
- Create or modify: `tests/lib-cotizaciones-paginacion.test.ts` (o sección en test existente)

**Interfaces:**
- Produces:

```ts
export type CursorCotizaciones = QueryDocumentSnapshot<Cotizacion>
export interface PaginaCotizaciones {
  items: Cotizacion[]
  siguienteCursor: CursorCotizaciones | null
  hayMas: boolean
}
export async function obtenerPaginaCotizaciones(
  tamano = 50,
  cursor?: CursorCotizaciones | null
): Promise<PaginaCotizaciones>
```

Espejo de `obtenerPaginaOrdenes` (`orderBy("creadoEn","desc")`, `limit(n+1)`, `startAfter`).  
`listarCotizaciones()` permanece para import/dedup/`clavesExistentes` y acciones explícitas — **no** usarla en el hook de lista al montar.

- [ ] **Step 1: Failing tests for `obtenerPaginaCotizaciones`**

Misma forma que tests de paginación de órdenes en `tests/lib-ordenes.test.ts`.

- [ ] **Step 2: Implement in `lib/cotizaciones.ts`**

Copiar patrón de `obtenerPaginaOrdenes` (imports `limit`, `startAfter`, `QueryConstraint`).

- [ ] **Step 3: Rewrite `useCotizaciones`**

Estado: `cotizaciones`, `cursor`, `hayMas`, `cargandoMas`, `loading`, `error`, `cargarMas`, `fetchCotizaciones` (primera página).  
**No** llamar `listarCotizaciones()` en el `useEffect` inicial.

- [ ] **Step 4: Adapt `CotizacionesList`**

La paginación UI actual (`lib/cotizaciones-tabla.ts`) opera sobre el array en memoria. Opciones compatibles con el spec:

**A (recomendada en este plan):** el hook acumula páginas con “Cargar más” (como órdenes); la tabla cliente sigue filtrando/ordenando sobre lo cargado; mostrar aviso “Mostrando X cargadas — Cargar más del servidor”.

**B:** solo una página server + filtros server (más trabajo, fuera si B no cabe en el slice).

Implementar **A**. Botón “Cargar historial completo” → `listarCotizaciones()` explícito (toast/confirm).

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/cotizaciones-tabla.test.ts tests/lib-cotizaciones-paginacion.test.ts`  
Run: `npx tsc --noEmit`

---

### Task 9: SAT — sacar `extraerEntradasHistorialSat` del módulo con catálogo

**Files:**
- Create: `lib/sat/historial-sat.ts`
- Modify: `lib/sat/sugerir-clave.ts` (re-export o mover función)
- Modify: `app/ordenes/ModalSugerirClavesSat.tsx`
- Modify: `app/reportes/contable/ReporteContableView.tsx`
- Modify tests que importen solo el helper si hace falta

**Por qué:** `sugerir-clave.ts` importa `catalogo` → ~10 MB JSON en el bundle del cliente cuando el modal/contable lo importan.

- [ ] **Step 1: Move pure helper**

Copiar `extraerEntradasHistorialSat` y tipos mínimos que necesite a `lib/sat/historial-sat.ts` **sin** importar `catalogo` ni `buscar`.

En `sugerir-clave.ts`:

```ts
export { extraerEntradasHistorialSat } from "@/lib/sat/historial-sat"
```

(o import interno desde historial-sat para no duplicar).

- [ ] **Step 2: Client imports**

```ts
// ModalSugerirClavesSat.tsx y ReporteContableView.tsx
import { extraerEntradasHistorialSat } from '@/lib/sat/historial-sat'
```

- [ ] **Step 3: Verify client graph**

Run: `rg "from ['\\\"]@/lib/sat/sugerir-clave" app/`  
Expected: sin imports desde `app/` (solo API routes / server).  
Run: `rg "from ['\\\"]@/lib/sat/catalogo" app/`  
Expected: vacío.

- [ ] **Step 4: Tests SAT**

Run: `npx vitest run tests/sat-sugerir-clave.test.ts tests/sat-buscar.test.ts`  
Expected: PASS.

---

### Task 10: Proveedores — histórico de cotizaciones bajo demanda

**Files:**
- Modify: `app/proveedores/page.tsx` (flujo `conceptoHistorico` / `listarCotizaciones` ~L1192)

- [ ] **Step 1: Gate the full cotizaciones fetch**

Solo llamar `listarCotizaciones()` cuando el usuario ejecuta la búsqueda de histórico (submit), no al montar la sección. Si ya es así, documentar en comentario y skip.

Si al abrir la sección se precarga todo el histórico, eliminar esa precarga.

- [ ] **Step 2: Prefer sample when possible**

Si el comparador puede trabajar con `obtenerPaginaCotizaciones` + filtro local del concepto, usarlo primero; full list solo si la búsqueda lo exige y el usuario confirma.

---

### Task 11: Verificación final + E2E

**Files:**
- Modify: `docs/testing/memoria-cliente-checklist.md` (Post Fase 2)

- [ ] **Step 1: Full unit suite relevant**

Run:

```bash
npx vitest run tests/lib-ordenes.test.ts tests/reportes.test.ts tests/cotizaciones-tabla.test.ts tests/sat-sugerir-clave.test.ts
npx tsc --noEmit
npm run lint
```

- [ ] **Step 2: E2E money path (si hay credenciales)**

Run: `npm run test:e2e`  
Requiere `E2E_TEST_USER_PASSWORD` y `smv-brain-dev` según `docs/testing/e2e.md`. Si no hay credenciales en la sesión, anotar skip y pedir al usuario.

- [ ] **Step 3: Re-measure baseline flow**

Completar checklist Post Fase 2. Confirmar: sin auto `listarOrdenes(` / `cargarTodas(` en mount paths:

```bash
rg "listarOrdenes\\(|cargarTodas\\(|listarCotizaciones\\(" app/ --glob "*.tsx"
```

Revisar cada hit: debe ser acción explícita o path justificado.

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Fase 1 cortar auto-full-load proveedores/nueva-compra/órdenes/requisiciones | 2, 3, 4 |
| Medición baseline / estabilidad | 1, 5, 11 |
| Reportes por rango + filtrarPorRango | 6 (usa `listarOrdenesEnRango` de 3) |
| Contable sin universo completo | 7 |
| Cotizaciones paginación Firestore | 8 |
| Proveedores ventana 12 meses / histórico bajo demanda | 3, 10 |
| SAT sin catalogo.json en cliente | 9 |
| Sin fallback full-scan | Constraints + Tasks 3, 6, 7 |
| E2E / multi-moneda / fechaFactura null | Global + 6, 11 |
| Enfoque 3 out of scope | No tasks for aggregates/virtualization |

Placeholders: none intentional.  
Types: `listarOrdenesRecientes`, `listarOrdenesEnRango`, `obtenerPaginaCotizaciones` naming consistent across tasks.
