# Documentos de venta (remisión/factura) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Módulo `/documentos-venta` para pedir remisiones/facturas de órdenes de venta Odoo, con espejo read-only, solicitudes tipadas, chat in-app y notificaciones a ventas — sin escribir a Odoo.

**Architecture:** Cloud Function espeja `sale.order` (+ líneas + pickings) a `ventas_odoo_so`. La UI crea `solicitudes_documento` + subcolección `mensajes`, emite notificaciones in-app, y gatea atender con `atiendeDocumentosVenta` en `usuarios`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript estricto, Zod, Firestore, Firebase Functions (JSON-RPC Odoo como `odooSync.ts`), Vitest, Tailwind v4, lucide-react.

**Spec:** `docs/superpowers/specs/2026-07-30-documentos-venta-design.md`

## Global Constraints

- Prohibido `any` y `@ts-ignore`.
- UI no importa Firestore — solo `lib/` + hooks.
- Odoo **read-only** en v1 (no `create`/`write` en Odoo).
- Timestamps UTC en Firestore; formateo `es-MX` en cliente.
- Deploy Functions solo codebase `smv-hub`; nunca `firebase deploy --only functions --force`.
- Emisión de notificaciones best-effort (no tumba el CRUD).
- Multi-moneda N/A aquí; qty con números finitos ≥ 0.

---

## File map

| File | Responsibility |
|------|----------------|
| `lib/schemas.ts` | Schemas espejo SO, solicitud, mensaje, flag usuario, módulo, notifs |
| `lib/documentos-venta.ts` | CRUD solicitudes + mensajes + helpers estado/búsqueda |
| `lib/documentos-venta-odoo.ts` | Lectura cliente del espejo + sync state (no Odoo directo) |
| `lib/hooks/useDocumentosVenta.ts` | Suscripciones SO / solicitudes / mensajes |
| `lib/notificaciones.ts` | Tipos nuevos + títulos |
| `lib/roles.ts` | Ruta, plantillas, helpers permiso atender |
| `lib/usuarios-admin.ts` + API usuarios | Persistir `atiendeDocumentosVenta` |
| `functions/src/odoo-ventas-mapeo.ts` | Mapear raw Odoo → docs Firestore (testeable) |
| `functions/src/odoo-ventas-sync.ts` | Scheduled + manual sync |
| `functions/src/index.ts` | Re-export |
| `firestore.rules` | Colecciones nuevas + notifs |
| `app/documentos-venta/*` | Página, lista, modal nueva, detalle+chat, cola |
| `app/NavBar.tsx`, `app/page.tsx`, `app/AuthGuard.tsx` | Nav / home / gate |
| `app/usuarios/*` | Checkbox atender |
| `tests/documentos-venta*.test.ts` | Schema, transiciones, mapeo, búsqueda |

---

### Task 1: Schemas Zod + helpers puros + tests

**Files:**
- Modify: `lib/schemas.ts`
- Create: `lib/documentos-venta-helpers.ts` (puro, sin Firebase)
- Create: `tests/documentos-venta-helpers.test.ts`

**Interfaces:**
- Produces: `ModuloId` incluye `"documentos-venta"`; schemas abajo; `puedeTransicionarEstado`, `filtrarSoPorTexto`, `validarPartidasRemision`

- [ ] **Step 1: Extender `ModuloIdSchema`**

Añadir `"documentos-venta"` al enum junto a los existentes.

- [ ] **Step 2: Añadir schemas**

```ts
export const TipoSolicitudDocumentoSchema = z.enum(["factura", "remision"])
export type TipoSolicitudDocumento = z.infer<typeof TipoSolicitudDocumentoSchema>

export const EstadoSolicitudDocumentoSchema = z.enum([
  "pendiente",
  "en_proceso",
  "completada",
  "rechazada",
])
export type EstadoSolicitudDocumento = z.infer<typeof EstadoSolicitudDocumentoSchema>

export const PartidaSolicitudDocumentoSchema = z.object({
  odooLineId: z.number().int().positive(),
  productName: z.string().min(1),
  qtySolicitada: z.number().positive(),
})

export const SolicitudDocumentoSchema = z.object({
  id: z.string(),
  tipo: TipoSolicitudDocumentoSchema,
  estado: EstadoSolicitudDocumentoSchema,
  odooSoId: z.number().int().positive(),
  odooSoName: z.string().min(1),
  clientOrderRef: z.string().nullable(),
  partnerName: z.string().min(1),
  partidas: z.array(PartidaSolicitudDocumentoSchema).default([]),
  nota: z.string().default(""),
  folioOdoo: z.string().nullable(),
  motivoRechazo: z.string().nullable(),
  solicitadoPorUid: z.string().min(1),
  solicitadoPorNombre: z.string().min(1),
  atendidoPorUid: z.string().nullable(),
  atendidoPorNombre: z.string().nullable(),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
})
export type SolicitudDocumento = z.infer<typeof SolicitudDocumentoSchema>

export const NuevaSolicitudDocumentoSchema = SolicitudDocumentoSchema.omit({
  id: true,
  creadoEn: true,
  actualizadoEn: true,
  estado: true,
  folioOdoo: true,
  motivoRechazo: true,
  atendidoPorUid: true,
  atendidoPorNombre: true,
}).extend({
  estado: z.literal("pendiente").default("pendiente"),
})
export type NuevaSolicitudDocumento = z.infer<typeof NuevaSolicitudDocumentoSchema>

export const MensajeSolicitudDocumentoSchema = z.object({
  id: z.string(),
  texto: z.string().min(1).max(4000),
  autorUid: z.string().min(1),
  autorNombre: z.string().min(1),
  creadoEn: z.date(),
})
export type MensajeSolicitudDocumento = z.infer<typeof MensajeSolicitudDocumentoSchema>

export const VentaOdooLineaSchema = z.object({
  odooLineId: z.number().int().positive(),
  productName: z.string(),
  productDefaultCode: z.string().nullable(),
  qtyOrdered: z.number().nonnegative(),
  qtyDelivered: z.number().nonnegative(),
  qtyPending: z.number().nonnegative(),
})

export const VentaOdooRemisionSchema = z.object({
  name: z.string(),
  state: z.string(),
  dateDone: z.string().nullable(),
})

export const VentaOdooSoSchema = z.object({
  id: z.string(),
  odooId: z.number().int().positive(),
  name: z.string().min(1),
  clientOrderRef: z.string().nullable(),
  partnerId: z.number().int(),
  partnerName: z.string(),
  dateOrder: z.string().nullable(),
  state: z.string(),
  invoiceStatus: z.string(),
  lineas: z.array(VentaOdooLineaSchema),
  remisiones: z.array(VentaOdooRemisionSchema),
  sincronizadoEn: z.date(),
})
export type VentaOdooSo = z.infer<typeof VentaOdooSoSchema>
```

En `UsuarioSchema` añadir:

```ts
atiendeDocumentosVenta: z.boolean().default(false),
```

Extender notifs:

```ts
// TipoNotificacionSchema — añadir:
"solicitud_documento_creada",
"solicitud_documento_estado",

// OrigenModuloNotificacionSchema — añadir:
"documentos-venta",
```

- [ ] **Step 3: Helpers puros en `lib/documentos-venta-helpers.ts`**

```ts
export function puedeTransicionarEstado(
  desde: EstadoSolicitudDocumento,
  hacia: EstadoSolicitudDocumento,
  opts: { esAtendedor: boolean; esSolicitante: boolean }
): boolean {
  if (desde === hacia) return false
  if (desde === "completada" || desde === "rechazada") return false
  if (hacia === "rechazada" && desde === "pendiente" && opts.esSolicitante) return true
  if (!opts.esAtendedor) return false
  if (desde === "pendiente" && (hacia === "en_proceso" || hacia === "completada" || hacia === "rechazada")) return true
  if (desde === "en_proceso" && (hacia === "completada" || hacia === "rechazada")) return true
  return false
}

export function filtrarSoPorTexto(sos: readonly VentaOdooSo[], q: string): VentaOdooSo[] {
  const n = q.trim().toLowerCase()
  if (!n) return [...sos]
  return sos.filter((s) => {
    const hay = [s.name, s.partnerName, s.clientOrderRef ?? ""].join(" ").toLowerCase()
    return hay.includes(n)
  })
}

export function validarPartidasRemision(
  tipo: TipoSolicitudDocumento,
  partidas: readonly { odooLineId: number; qtySolicitada: number }[],
  lineasSo: readonly { odooLineId: number; qtyPending: number }[]
): string | null {
  if (tipo === "factura") return null
  if (partidas.length === 0) return "Selecciona al menos una partida"
  const byId = new Map(lineasSo.map((l) => [l.odooLineId, l]))
  for (const p of partidas) {
    const l = byId.get(p.odooLineId)
    if (!l) return `Línea ${p.odooLineId} no pertenece a la SO`
    if (!(p.qtySolicitada > 0) || p.qtySolicitada > l.qtyPending + 1e-9) {
      return `Cantidad inválida para ${p.odooLineId}`
    }
  }
  return null
}
```

- [ ] **Step 4: Tests Vitest**

Casos: transiciones atendedor/solicitante; filtro texto; partidas vacías en remisión; qty > pending.

- [ ] **Step 5: Correr** `npx vitest run tests/documentos-venta-helpers.test.ts`

---

### Task 2: Roles + plantillas + AuthGuard gate

**Files:**
- Modify: `lib/roles.ts`
- Modify: `app/AuthGuard.tsx` (si usa `rutaAModulo` / `tienePermiso` genérico, suele bastar con roles)

**Interfaces:**
- Produces: `RUTA_POR_MODULO["documentos-venta"] = "/documentos-venta"`; módulo en plantillas admin/compras/almacen; `puedeAtenderDocumentosVenta(usuario)`

- [ ] **Step 1: `lib/roles.ts`**

```ts
// RUTA_POR_MODULO
"documentos-venta": "/documentos-venta",

// GRUPOS_MODULOS → Operación
{ id: "documentos-venta", label: "Documentos de venta" },

// PLANTILLA_ADMIN, PLANTILLA_COMPRAS, PLANTILLA_ALMACEN: incluir "documentos-venta"
```

```ts
export function puedeAtenderDocumentosVenta(u: {
  atiendeDocumentosVenta?: boolean
  esSuperAdmin?: boolean
} | null | undefined): boolean {
  if (!u) return false
  return u.esSuperAdmin === true || u.atiendeDocumentosVenta === true
}
```

- [ ] **Step 2: Verificar** `tienePermiso` / `rutaAModulo` resuelven `/documentos-venta` vía el mapa (sin hardcode extra si ya es genérico).

---

### Task 3: Capa Firestore solicitudes + mensajes + notifs

**Files:**
- Create: `lib/documentos-venta.ts`
- Modify: `lib/notificaciones.ts` (TITULOS)
- Create: `tests/documentos-venta-notifs.test.ts` (títulos)

**Interfaces:**
- Consumes: schemas Task 1; `emitirNotificacion` / `crearNotificacion` existente
- Produces: `crearSolicitudDocumento`, `suscribirSolicitudesDocumento`, `actualizarEstadoSolicitudDocumento`, `agregarMensajeSolicitud`, `suscribirMensajesSolicitud`

- [ ] **Step 1: Converter + CRUD en `lib/documentos-venta.ts`**

Patrón igual a `lib/pedidos-almacen.ts` / `lib/notificaciones.ts` (`Timestamp`, `withConverter`).

```ts
export async function crearSolicitudDocumento(
  data: NuevaSolicitudDocumento
): Promise<string> {
  // Validar con NuevaSolicitudDocumentoSchema + validarPartidasRemision si tienes líneas SO a mano (caller pasa check)
  // addDoc → id
  // emitirNotificacion tipo solicitud_documento_creada, origenModulo documentos-venta, href `/documentos-venta?solicitud=${id}`
}

export async function actualizarEstadoSolicitudDocumento(args: {
  id: string
  desde: EstadoSolicitudDocumento
  hacia: EstadoSolicitudDocumento
  esAtendedor: boolean
  esSolicitante: boolean
  uid: string
  nombre: string
  folioOdoo?: string | null
  motivoRechazo?: string | null
}): Promise<void> {
  if (!puedeTransicionarEstado(args.desde, args.hacia, { esAtendedor: args.esAtendedor, esSolicitante: args.esSolicitante })) {
    throw new Error("Transición de estado no permitida")
  }
  if (args.hacia === "rechazada" && !(args.motivoRechazo ?? "").trim()) {
    throw new Error("Motivo de rechazo requerido")
  }
  // updateDoc estado, actualizadoEn, atendidoPor*, folio/motivo
  // emitirNotificacion solicitud_documento_estado
}

export function suscribirSolicitudesDocumento(
  onData: (rows: SolicitudDocumento[]) => void,
  onError: (e: Error) => void
): () => void { /* orderBy creadoEn desc, limit 200 */ }

export async function agregarMensajeSolicitud(
  solicitudId: string,
  texto: string,
  autorUid: string,
  autorNombre: string
): Promise<string> { /* addDoc subcollection mensajes */ }

export function suscribirMensajesSolicitud(
  solicitudId: string,
  onData: (rows: MensajeSolicitudDocumento[]) => void,
  onError: (e: Error) => void
): () => void { /* orderBy creadoEn asc */ }
```

- [ ] **Step 2: Títulos en `lib/notificaciones.ts`**

```ts
solicitud_documento_creada: "Nueva solicitud de documento",
solicitud_documento_estado: "Solicitud de documento actualizada",
```

- [ ] **Step 3: Test** títulos incluyen las claves nuevas.

---

### Task 4: Lectura espejo cliente

**Files:**
- Create: `lib/documentos-venta-odoo.ts`
- Create: `lib/hooks/useDocumentosVenta.ts`
- Create: `lib/services/ventas-odoo-sync.ts` (cliente callable, espejo de `lib/services/finanzas-sync.ts`)

**Interfaces:**
- Produces: `suscribirVentasOdooSo`, `suscribirVentasOdooSyncState`, `dispararSyncVentasOdooManual`, hook `useDocumentosVenta`

- [ ] **Step 1: `lib/documentos-venta-odoo.ts`**

Suscripción a `ventas_odoo_so` (orderBy `sincronizadoEn` o `name`) y doc `ventas_odoo_sync_state/latest`.

- [ ] **Step 2: Callable client**

```ts
// lib/services/ventas-odoo-sync.ts
// httpsCallable('syncOdooVentasManual') con auth — mismo patrón finanzas-sync.ts
```

- [ ] **Step 3: Hook**

```ts
export function useDocumentosVenta(opts: {
  uid: string | null
  atiende: boolean
}) {
  // sos, syncState, solicitudes (filtrar "mías" vs todas si atiende), loading, error, refetch helpers
  // selectedSolicitudId + mensajes
}
```

---

### Task 5: Mapeo Odoo + Cloud Function sync

**Files:**
- Create: `functions/src/odoo-ventas-mapeo.ts`
- Create: `functions/src/odoo-ventas-sync.ts`
- Modify: `functions/src/index.ts`
- Create: `tests/odoo-ventas-mapeo.test.ts`

**Locked:** mapeo puro en `functions/src/odoo-ventas-mapeo.ts`; el test root importa `../functions/src/odoo-ventas-mapeo` igual que `tests/odoo-sync-mapeo.test.ts` importa `odoo-mapeo`.

- [ ] **Step 1: Leer** `tests/odoo-sync-mapeo.test.ts` y `functions/src/odoo-mapeo.ts` como plantilla.

- [ ] **Step 2: Implementar mapeo**

```ts
export type OdooSaleOrderRaw = { /* id, name, client_order_ref, partner_id, date_order, state, invoice_status, order_line */ }
export type OdooSaleLineRaw = { /* id, product_id, name, product_uom_qty, qty_delivered */ }
export type OdooPickingRaw = { /* id, name, state, date_done, origin */ }

export function qtyPendingLinea(ordered: number, delivered: number): number {
  return Math.max(0, ordered - delivered)
}

export function soDebeIncluirse(so: { state: string; invoiceStatus: string; lineas: { qtyPending: number }[] }): boolean {
  if (so.state !== "sale" && so.state !== "done") return false
  if (so.invoiceStatus !== "invoiced") return true
  return so.lineas.some((l) => l.qtyPending > 0)
}

export function mapearVentaOdooSo(...): Record<string, unknown> { /* campos Firestore sin id */ }
```

- [ ] **Step 3: Sync `odoo-ventas-sync.ts`**

- Secrets: `FINANZAS_ODOO_*` (mismos que `odooSync.ts`).
- `search_read` sale.order filtrado state in sale/done.
- Batch read lines + pickings `picking_type_code=outgoing` origin in SO names.
- Upsert `ventas_odoo_so` en chunks 400.
- Orphan delete solo si `registros.length > 0`.
- Update `ventas_odoo_sync_state/latest`.
- Exports: `syncOdooVentasScheduled` (cada 2h), `syncOdooVentasManual` (callable auth admin/super-admin / módulo documentos-venta + esSuperAdmin — alinear con finanzas manual).

- [ ] **Step 4: Export en `functions/src/index.ts`**

```ts
export { syncOdooVentasScheduled, syncOdooVentasManual } from "./odoo-ventas-sync";
```

- [ ] **Step 5: Tests de mapeo** qtyPending, soDebeIncluirse, mapear campos.

---

### Task 6: Firestore rules

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Helpers**

```
function atiendeDocumentosVenta() {
  return esCorreoBreakGlass() || esSuperAdminDoc() ||
    (exists(...usuarios/uid) && docUsuario().atiendeDocumentosVenta == true);
}
function esDocumentosVentaAutorizado() {
  return esUsuarioAutorizado() && (esCorreoBreakGlass() || tieneModulo('documentos-venta'));
}
```

- [ ] **Step 2: Matches**

- `ventas_odoo_so`, `ventas_odoo_sync_state`: read si `esDocumentosVentaAutorizado()`; write false.
- `solicitudes_documento/{id}`:
  - read: autorizado y (`resource.data.solicitadoPorUid == auth.uid` || atiendeDocumentosVenta()).
  - create: autorizado; `solicitadoPorUid == auth.uid`; estado `pendiente`; keys/tipos básicos.
  - update: atiende **o** (solicitante y solo transición a rechazada desde pendiente); validar campos.
  - delete: false (preferir rechazo).
- `mensajes/{mid}`: read si puede leer padre; create si lee padre y `autorUid == auth.uid`.
- Extender create/read `notificaciones` para origen `documentos-venta` + módulo.

- [ ] **Step 3: Validar** con Firebase MCP / `firebase_validate_security_rules` si disponible.

---

### Task 7: UI `/documentos-venta`

**Files:**
- Create: `app/documentos-venta/page.tsx`
- Create: `app/documentos-venta/DocumentosVentaView.tsx`
- Create: `app/documentos-venta/NuevaSolicitudPanel.tsx`
- Create: `app/documentos-venta/SolicitudDetalleModal.tsx`
- Create: `app/documentos-venta/ColaVentasPanel.tsx`
- Modify: `app/NavBar.tsx`, `app/page.tsx`

**Interfaces:**
- Consumes: hook Task 4, helpers Task 1, `puedeAtenderDocumentosVenta`, `useUsuario`

- [ ] **Step 1: Page shell** con AuthGuard implícito vía layout; título “Documentos de venta”.

- [ ] **Step 2: `DocumentosVentaView`**

Tabs: Nueva | Mis solicitudes | Cola (si atiende). Leer `?solicitud=` para abrir detalle.

Chip sync + botón refrescar Odoo (solo super-admin/admin según callable).

Banner error + Reintentar.

- [ ] **Step 3: `NuevaSolicitudPanel`**

Buscador → lista SO → elegir tipo → remisión: checkboxes + qty + nota → submit `crearSolicitudDocumento`.

- [ ] **Step 4: `SolicitudDetalleModal`**

Cabecera, partidas, acciones estado, chat (input + lista mensajes).

- [ ] **Step 5: Home card + NavBar link** en grupo Operación.

- [ ] **Step 6: Buscador global** (si `BuscadorGlobalCommand` indexa módulos): añadir entrada `documentos-venta`.

---

### Task 8: Flag en `/usuarios`

**Files:**
- Modify: `lib/usuarios-admin.ts`, `lib/schemas` ya tiene el campo
- Modify: `app/api/usuarios/**` payloads
- Modify: UI de edición de usuario (checkbox)

- [ ] **Step 1: Persistir `atiendeDocumentosVenta` en create/update admin** (default false).

- [ ] **Step 2: Checkbox** en el form de usuarios, visible junto a módulos; label “Atiende documentos de venta (cola remisión/factura)”.

- [ ] **Step 3: Asegurar** que `useUsuario` / AuthProvider expone el flag al cliente (lectura del doc propio).

---

### Task 9: Verificación final

- [ ] `npx vitest run tests/documentos-venta-helpers.test.ts tests/odoo-ventas-mapeo.test.ts`
- [ ] `npx tsc --noEmit`
- [ ] `npm run lint` (archivos tocados)
- [ ] Smoke manual en `smv-brain-dev`: sync manual → buscar SO → crear remisión → chat → completar como ventas
- [ ] Deploy rules cuando se active en prod: `firebase deploy --only firestore:rules --project smv-brain` (solo tras OK)
- [ ] Deploy functions Hub: desde `functions/` con codebase `smv-hub` (script del repo), no `--force` global

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Espejo sale.order + lines + pickings | 5 |
| Filtro SO / orphan guard | 5 |
| Solicitud factura/remisión + partidas + nota | 1, 3, 7 |
| Chat subcollection | 3, 7 |
| Estados + cancel solicitante | 1, 3 |
| Módulo + flag atender | 1, 2, 8 |
| Notifs crear/estado | 3 |
| Rules | 6 |
| UI tabs / cola / detalle | 7 |
| Sync schedule + manual | 5 |
| Sin write Odoo | 5 (solo search_read) |
| Tests | 1, 5, 9 |
| `/usuarios` checkbox | 8 |

## Execution handoff

Plan listo en `docs/superpowers/plans/2026-07-30-documentos-venta.md`.

**Opciones:**

1. **Subagent-Driven (recomendado)** — un subagente por task + review entre tasks  
2. **Inline Execution** — ejecutar en esta sesión con checkpoints  

¿Cuál approach?
