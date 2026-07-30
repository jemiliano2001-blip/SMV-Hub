# Modo ventas simplificado + orden de compra — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modo ventas simple (Pendientes/Hechas + detalle + chat) solo para atendedores, y sync/UI de **Orden de compra** desde `sale.order.origin`.

**Architecture:** Ampliar el espejo Odoo y schemas con `ordenCompra`; helpers puros para efectivo, labels y tabs Pendientes/Hechas; notif `solicitud_documento_mensaje` al chatear; `DocumentosVentaView` enruta a `ModoVentasView` si `puedeAtenderDocumentosVenta`, si no deja el flujo taller.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript estricto, Zod, Firestore, Firebase Functions (`smv-hub`), Vitest, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-07-30-documentos-venta-modo-ventas-design.md`

## Global Constraints

- Prohibido `any` y `@ts-ignore`.
- UI no importa Firestore — solo `lib/` + hooks.
- Odoo **read-only** (no `create`/`write` en Odoo).
- Label visible: **Orden de compra** (no solo “PO”).
- Folio al completar: **opcional**.
- Deploy Functions solo `functions:smv-hub:syncOdooVentas*`; nunca `--force` global.
- Emisión de notificaciones best-effort (mensaje ya guardado no se revierte).

---

## File map

| File | Responsibility |
|------|----------------|
| `lib/schemas.ts` | `ordenCompra` en SO + solicitud; tipo notif mensaje |
| `lib/documentos-venta-helpers.ts` | `ordenCompraEfectiva`, filtro, labels estado, split pendientes/hechas |
| `lib/documentos-venta.ts` | Denormalizar `ordenCompra` al crear; notif al mensaje |
| `lib/documentos-venta-odoo.ts` | Parse `ordenCompra` del espejo |
| `lib/notificaciones.ts` | Título `solicitud_documento_mensaje` |
| `functions/src/odoo-ventas-mapeo.ts` | Mapear `origin` → `ordenCompra` |
| `functions/src/odoo-ventas-sync.ts` | Incluir `origin` en `CAMPOS_SO` |
| `app/documentos-venta/ModoVentasView.tsx` | Tabs Pendientes/Hechas + lista |
| `app/documentos-venta/DetalleVentasSimple.tsx` | Detalle + acciones + chat grande |
| `app/documentos-venta/DocumentosVentaView.tsx` | Branch por rol |
| `app/documentos-venta/NuevaSolicitudPanel.tsx` | Labels orden de compra |
| `tests/documentos-venta-helpers.test.ts` | Helpers nuevos |
| `tests/odoo-ventas-mapeo.test.ts` | `origin` |
| `tests/documentos-venta-notifs.test.ts` | Título mensaje |

---

### Task 1: Helpers + schemas (ordenCompra, labels, tabs)

**Files:**
- Modify: `lib/schemas.ts`
- Modify: `lib/documentos-venta-helpers.ts`
- Modify: `tests/documentos-venta-helpers.test.ts`
- Modify: `tests/documentos-venta-notifs.test.ts`
- Modify: `lib/notificaciones.ts`

**Interfaces:**
- Produces:
  - `ordenCompraEfectiva(so: { ordenCompra?: string | null; clientOrderRef?: string | null }): string | null`
  - `ordenCompraSolicitud(s: { ordenCompra?: string | null; clientOrderRef?: string | null }): string | null`
  - `etiquetaEstadoSolicitudDocumento(e: EstadoSolicitudDocumento): string`
  - `particionarSolicitudesVentas(rows: readonly SolicitudDocumento[]): { pendientes: SolicitudDocumento[]; hechas: SolicitudDocumento[] }`
  - `filtrarSoPorTexto` incluye `ordenCompra`
  - Schema: `VentaOdooSo.ordenCompra`, `SolicitudDocumento.ordenCompra`
  - `TipoNotificacion` + `solicitud_documento_mensaje`

- [ ] **Step 1: Write failing helper tests**

Append to `tests/documentos-venta-helpers.test.ts`:

```ts
import {
  ordenCompraEfectiva,
  ordenCompraSolicitud,
  etiquetaEstadoSolicitudDocumento,
  particionarSolicitudesVentas,
  filtrarSoPorTexto,
} from "@/lib/documentos-venta-helpers"

it("ordenCompraEfectiva prefiere origin sobre clientOrderRef", () => {
  expect(ordenCompraEfectiva({ ordenCompra: "PO.1", clientOrderRef: "X" })).toBe("PO.1")
  expect(ordenCompraEfectiva({ ordenCompra: null, clientOrderRef: "X" })).toBe("X")
  expect(ordenCompraEfectiva({ ordenCompra: null, clientOrderRef: null })).toBeNull()
})

it("filtrarSoPorTexto matchea ordenCompra", () => {
  const sos = [
    {
      id: "1",
      odooId: 1,
      name: "2026/S01126",
      clientOrderRef: null,
      ordenCompra: "PO.20263330",
      partnerId: 1,
      partnerName: "OHD",
      dateOrder: null,
      state: "sale",
      invoiceStatus: "to invoice",
      lineas: [],
      remisiones: [],
      sincronizadoEn: new Date(),
    },
  ]
  expect(filtrarSoPorTexto(sos, "20263330")).toHaveLength(1)
})

it("etiquetaEstadoSolicitudDocumento en español claro", () => {
  expect(etiquetaEstadoSolicitudDocumento("pendiente")).toBe("Por atender")
  expect(etiquetaEstadoSolicitudDocumento("en_proceso")).toBe("En proceso")
  expect(etiquetaEstadoSolicitudDocumento("completada")).toBe("Lista")
  expect(etiquetaEstadoSolicitudDocumento("rechazada")).toBe("Cancelada")
})

it("particionarSolicitudesVentas separa pendientes y hechas", () => {
  const base = {
    tipo: "remision" as const,
    odooSoId: 1,
    odooSoName: "S1",
    clientOrderRef: null,
    ordenCompra: "PO.1",
    partnerName: "C",
    partidas: [],
    nota: "",
    folioOdoo: null,
    motivoRechazo: null,
    solicitadoPorUid: "u",
    solicitadoPorNombre: "U",
    atendidoPorUid: null,
    atendidoPorNombre: null,
    creadoEn: new Date("2026-07-01T00:00:00Z"),
    actualizadoEn: new Date("2026-07-01T00:00:00Z"),
  }
  const rows = [
    { ...base, id: "a", estado: "pendiente" as const },
    { ...base, id: "b", estado: "en_proceso" as const },
    { ...base, id: "c", estado: "completada" as const },
    { ...base, id: "d", estado: "rechazada" as const },
  ]
  const { pendientes, hechas } = particionarSolicitudesVentas(rows)
  expect(pendientes.map((s) => s.id).sort()).toEqual(["a", "b"])
  expect(hechas.map((s) => s.id).sort()).toEqual(["c", "d"])
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run tests/documentos-venta-helpers.test.ts`

- [ ] **Step 3: Extend schemas**

In `lib/schemas.ts`:

- Add `"solicitud_documento_mensaje"` to `TipoNotificacionSchema`.
- Add `ordenCompra: z.string().nullable()` to `VentaOdooSoSchema` (after `clientOrderRef`).
- Add `ordenCompra: z.string().nullable()` to `SolicitudDocumentoSchema` (after `clientOrderRef`).  
  For old docs without the field, in converters use `?? null` (Task 3); Zod parse on create must send it.

In `lib/notificaciones.ts` TITULOS:

```ts
solicitud_documento_mensaje: "Nuevo mensaje en solicitud",
```

Update `tests/documentos-venta-notifs.test.ts` to expect the new title.

- [ ] **Step 4: Implement helpers**

In `lib/documentos-venta-helpers.ts`:

```ts
export function ordenCompraEfectiva(so: {
  ordenCompra?: string | null
  clientOrderRef?: string | null
}): string | null {
  const a = so.ordenCompra?.trim()
  if (a) return a
  const b = so.clientOrderRef?.trim()
  if (b) return b
  return null
}

export function ordenCompraSolicitud(s: {
  ordenCompra?: string | null
  clientOrderRef?: string | null
}): string | null {
  return ordenCompraEfectiva(s)
}

export function etiquetaEstadoSolicitudDocumento(
  e: EstadoSolicitudDocumento
): string {
  switch (e) {
    case "pendiente":
      return "Por atender"
    case "en_proceso":
      return "En proceso"
    case "completada":
      return "Lista"
    case "rechazada":
      return "Cancelada"
  }
}

export function particionarSolicitudesVentas(
  rows: readonly SolicitudDocumento[]
): { pendientes: SolicitudDocumento[]; hechas: SolicitudDocumento[] } {
  const pendientes: SolicitudDocumento[] = []
  const hechas: SolicitudDocumento[] = []
  for (const s of rows) {
    if (s.estado === "pendiente" || s.estado === "en_proceso") pendientes.push(s)
    else hechas.push(s)
  }
  const byCreadoDesc = (a: SolicitudDocumento, b: SolicitudDocumento) =>
    b.creadoEn.getTime() - a.creadoEn.getTime()
  pendientes.sort((a, b) => {
    const rank = (e: string) => (e === "pendiente" ? 0 : 1)
    const d = rank(a.estado) - rank(b.estado)
    return d !== 0 ? d : byCreadoDesc(a, b)
  })
  hechas.sort(byCreadoDesc)
  return { pendientes, hechas }
}
```

Update `filtrarSoPorTexto`:

```ts
const hay = [s.name, s.partnerName, s.ordenCompra ?? "", s.clientOrderRef ?? ""]
  .join(" ")
  .toLowerCase()
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `npx vitest run tests/documentos-venta-helpers.test.ts tests/documentos-venta-notifs.test.ts`

- [ ] **Step 6: Commit**

```bash
git add lib/schemas.ts lib/documentos-venta-helpers.ts lib/notificaciones.ts tests/documentos-venta-helpers.test.ts tests/documentos-venta-notifs.test.ts
git commit -m "feat(documentos-venta): helpers orden de compra y labels modo ventas"
```

---

### Task 2: Sync Odoo `origin` → `ordenCompra`

**Files:**
- Modify: `functions/src/odoo-ventas-mapeo.ts`
- Modify: `functions/src/odoo-ventas-sync.ts`
- Modify: `tests/odoo-ventas-mapeo.test.ts`

**Interfaces:**
- Consumes: Task 1 field name `ordenCompra`
- Produces: `OdooSaleOrderRaw.origin`; `VentaOdooSoNormalizada.ordenCompra`

- [ ] **Step 1: Failing test**

In `tests/odoo-ventas-mapeo.test.ts`, extend SO fixture with `origin: "PO.20263330"` and assert:

```ts
expect(so.ordenCompra).toBe("PO.20263330")
```

Also: `origin: false` → `ordenCompra` null.

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/odoo-ventas-mapeo.test.ts`

- [ ] **Step 3: Implement mapeo + campos sync**

`OdooSaleOrderRaw`:

```ts
origin: string | false
```

`VentaOdooSoNormalizada`:

```ts
ordenCompra: string | null
```

In `mapearVentaOdooSo`:

```ts
ordenCompra: textoOrNull(raw.origin),
clientOrderRef: textoOrNull(raw.client_order_ref),
```

In `odoo-ventas-sync.ts` `CAMPOS_SO`, add `'origin'`.

- [ ] **Step 4: Run — expect PASS** + build functions

Run:

```bash
npx vitest run tests/odoo-ventas-mapeo.test.ts
cd functions && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add functions/src/odoo-ventas-mapeo.ts functions/src/odoo-ventas-sync.ts tests/odoo-ventas-mapeo.test.ts
git commit -m "feat(odoo-ventas): sincroniza origin como ordenCompra"
```

---

### Task 3: Cliente espejo + crear solicitud + notif mensaje

**Files:**
- Modify: `lib/documentos-venta-odoo.ts`
- Modify: `lib/documentos-venta.ts`
- Modify: `app/documentos-venta/NuevaSolicitudPanel.tsx` (pasar `ordenCompra` al crear)

**Interfaces:**
- Consumes: `ordenCompraEfectiva`, tipo notif
- Produces: mirror parse; `crearSolicitudDocumento` guarda `ordenCompra`; `agregarMensajeSolicitud` emite notif

- [ ] **Step 1: Parse espejo**

In `documentos-venta-odoo.ts` `fromFirestore`:

```ts
clientOrderRef: d.clientOrderRef ?? null,
ordenCompra: d.ordenCompra ?? null,
```

- [ ] **Step 2: Denormalizar al crear**

In `NuevaSolicitudPanel` when building `NuevaSolicitudDocumento`, set:

```ts
ordenCompra: ordenCompraEfectiva(so),
clientOrderRef: so.clientOrderRef,
```

Ensure `crearSolicitudDocumento` persists `ordenCompra` (already via parse of Nueva schema — include field in schema omit/extend so it's required on create as nullable).

If `NuevaSolicitudDocumentoSchema` inherits `ordenCompra`, callers must pass it.

- [ ] **Step 3: Notif al mensaje**

Replace `agregarMensajeSolicitud` body after `addDoc` with:

```ts
export async function agregarMensajeSolicitud(
  solicitudId: string,
  texto: string,
  autorUid: string,
  autorNombre: string
): Promise<string> {
  const parsed = MensajeSolicitudDocumentoSchema.omit({ id: true, creadoEn: true }).parse({
    texto,
    autorUid,
    autorNombre,
  })

  const ahora = new Date()
  const ref = await addDoc(mensajesRef(solicitudId), {
    ...parsed,
    id: "",
    creadoEn: ahora,
  } as MensajeSolicitudDocumento)

  try {
    const snap = await getDoc(doc(db, COLECCION, solicitudId).withConverter(solicitudConverter))
    const sol = snap.data()
    if (sol) {
      const actor = actorNotificacion()
      const etiqueta = sol.tipo === "factura" ? "Factura" : "Remisión"
      await emitirNotificacion({
        tipo: "solicitud_documento_mensaje",
        titulo: tituloParaTipo("solicitud_documento_mensaje"),
        cuerpo: `Nuevo mensaje · ${etiqueta} ${sol.odooSoName}`,
        origenModulo: "documentos-venta",
        origenId: solicitudId,
        href: `/documentos-venta?solicitud=${solicitudId}`,
        creadoPorUid: actor.uid || autorUid,
        creadoPorNombre: actor.nombre || autorNombre,
      })
    }
  } catch (err) {
    console.error("Notif mensaje solicitud_documento falló:", err)
  }

  return ref.id
}
```

Note: existing `emitirNotificacion` fans out like other tipos (campanita module-wide). Spec accepts same pattern as `solicitud_documento_creada` for taller→ventas; ventas→taller still gets module audience — acceptable v1 if fan-out is how Hub notifs work today. Do **not** invent per-uid targeting unless `emitirNotificacion` already supports it; check `lib/notificaciones.ts` and match `solicitud_documento_creada` behavior.

- [ ] **Step 4: Taller labels**

In `NuevaSolicitudPanel` list rows, replace `PO ${...}` / `Sin PO` with:

```tsx
{ordenCompraEfectiva(s) ? `Orden de compra ${ordenCompraEfectiva(s)}` : "Sin orden de compra"}
```

Placeholder búsqueda: `Ej. OHD, PO.20263330, 2026/S01126`.

- [ ] **Step 5: Smoke typecheck**

Run: `npx tsc --noEmit` (or project’s usual check). Fix schema/UI type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/documentos-venta-odoo.ts lib/documentos-venta.ts app/documentos-venta/NuevaSolicitudPanel.tsx
git commit -m "feat(documentos-venta): ordenCompra en espejo/solicitudes y notif de chat"
```

---

### Task 4: UI Modo ventas (`ModoVentasView` + `DetalleVentasSimple`)

**Files:**
- Create: `app/documentos-venta/ModoVentasView.tsx`
- Create: `app/documentos-venta/DetalleVentasSimple.tsx`
- Modify: `app/documentos-venta/DocumentosVentaView.tsx`

**Interfaces:**
- Consumes: `particionarSolicitudesVentas`, `etiquetaEstadoSolicitudDocumento`, `ordenCompraSolicitud`, hooks CRUD existentes
- Produces: ventas-only UX; taller path unchanged when `!atiende`

- [ ] **Step 1: `DetalleVentasSimple.tsx`**

Props mirror the subset of `SolicitudDetalleModal` needed:

```tsx
type Props = {
  solicitud: SolicitudDocumento
  mensajes: MensajeSolicitudDocumento[]
  uid: string
  nombre: string
  onClose: () => void
  onActualizarEstado: (args: {
    id: string
    desde: EstadoSolicitudDocumento
    hacia: EstadoSolicitudDocumento
    esAtendedor: boolean
    esSolicitante: boolean
    uid: string
    nombre: string
    folioOdoo?: string | null
    motivoRechazo?: string | null
  }) => Promise<void>
  onEnviarMensaje: (
    solicitudId: string,
    texto: string,
    autorUid: string,
    autorNombre: string
  ) => Promise<string>
}
```

UI requirements (spec):
- Large header: tipo, partner, SO, `ordenCompraSolicitud(solicitud) ?? "Sin orden de compra"`.
- Partidas: descripción (`productName`) + `qtySolicitada` only.
- Nota if non-empty.
- Buttons: pendiente → **Atender**; en_proceso → **Listo** (folio input optional, empty OK) + **Cancelar** (short motivo).
- Chat: message list + large textarea + **Enviar**; keep draft on error; show banner.
- Call `onActualizarEstado` with `esAtendedor: true`.

- [ ] **Step 2: `ModoVentasView.tsx`**

```tsx
type Props = {
  solicitudes: SolicitudDocumento[]
  mensajes: MensajeSolicitudDocumento[]
  uid: string
  nombre: string
  solicitudId: string | null
  onAbrir: (id: string) => void
  onCerrarDetalle: () => void
  onActualizarEstado: ... // same as Detalle
  onEnviarMensaje: ...
}
```

- Local tab state: `"pendientes" | "hechas"`.
- Optional search filters list by partner / SO / ordenCompra / tipo text.
- Use `particionarSolicitudesVentas`.
- Rows: tipo · partner · orden compra · SO · solicitadoPor · `etiquetaEstadoSolicitudDocumento`.
- Open `DetalleVentasSimple` when `solicitudId` matches.

- [ ] **Step 3: Wire `DocumentosVentaView`**

If `atiende`:

```tsx
return (
  <div className="space-y-4">
    {/* keep sync bar for admin sync button */}
    <ModoVentasView
      solicitudes={solicitudes}
      mensajes={mensajes}
      uid={...}
      nombre={...}
      solicitudId={solicitudId}
      onAbrir={setSolicitudId}
      onCerrarDetalle={() => setSolicitudId(null)}
      onActualizarEstado={actualizarEstado}
      onEnviarMensaje={agregarMensaje}
    />
  </div>
)
```

Else: existing taller UI (Nueva / Mías only — remove Cola tab for non-atendedores if still present; atendedores no longer see taller tabs).

Deep link `?solicitud=` still opens detalle in modo ventas.

- [ ] **Step 4: Manual / lint**

Run: `npx tsc --noEmit` and `npm run lint` on touched files.

- [ ] **Step 5: Commit**

```bash
git add app/documentos-venta/ModoVentasView.tsx app/documentos-venta/DetalleVentasSimple.tsx app/documentos-venta/DocumentosVentaView.tsx
git commit -m "feat(documentos-venta): UI modo ventas simplificado"
```

---

### Task 5: Deploy + verificación

**Files:** none new (ops)

- [ ] **Step 1: Deploy Functions ventas**

```bash
cd functions && npm run build
cd ..
npx --yes firebase-tools@15.24.0 deploy --project smv-brain --only "functions:smv-hub:syncOdooVentasScheduled,functions:smv-hub:syncOdooVentasManual"
```

- [ ] **Step 2: Deploy Hosting**

```bash
npm run deploy:hosting
```

- [ ] **Step 3: Smoke checklist**

1. Admin: **Actualizar desde Odoo** en `/documentos-venta`.
2. Taller: buscar por número de orden de compra (`origin`); crear solicitud.
3. Usuario con `atiendeDocumentosVenta`: ve Pendientes/Hechas; Atender → chat → Listo sin folio y con folio.
4. Campanita: mensaje genera notif `solicitud_documento_mensaje`.

- [ ] **Step 4: Commit deploy notes only if AGENTS/spec plan link updated**

Update spec header `**Plan:** docs/superpowers/plans/2026-07-30-documentos-venta-modo-ventas.md`.

```bash
git add docs/superpowers/specs/2026-07-30-documentos-venta-modo-ventas-design.md
git commit -m "docs: enlaza plan modo ventas"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Sync `origin` → `ordenCompra` | 2 |
| Fallback UI `clientOrderRef` | 1, 3, 4 |
| Label Orden de compra + búsqueda | 1, 3 |
| Modo ventas solo atendedor | 4 |
| Tabs Pendientes/Hechas | 1, 4 |
| Detalle simple + folio opcional | 4 |
| Chat notif mensaje | 1, 3 |
| Taller flujo intacto | 4 |
| Deploy functions + hosting | 5 |

No placeholders left; names `ordenCompra` / `ordenCompraEfectiva` / `particionarSolicitudesVentas` consistent across tasks.
