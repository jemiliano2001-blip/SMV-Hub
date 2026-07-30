# Diseño: Solicitudes de remisión/factura (documentos-venta)

**Fecha:** 2026-07-30  
**Módulo:** `/documentos-venta` (nuevo)  
**Estado:** aprobado en brainstorming (enfoque 1 — espejo Odoo + solicitudes Hub)  
**Plan:** `docs/superpowers/plans/2026-07-30-documentos-venta.md`

---

## Problema

Pedir remisiones o facturas a la persona de ventas por correo falla: no mira el mail,
tarda, y las partidas de entrega quedan ambiguas. Hoy el flujo similar vive en
SMV-VISION como `mailto:` a AMS sobre órdenes Suprajit; no hay cola ni chat en Hub.

## Objetivo (v1)

1. Sección en SMV Hub para **pedir remisión o factura** de una **orden de venta** Odoo
   (PO del cliente = `client_order_ref`), **todos los clientes**.
2. Ventas entra a Hub con cuenta propia, ve la cola, chatea y marca cumplimiento.
3. Remisión: seleccionar **líneas Odoo** (qty a entregar) + **nota libre**.
4. Notificaciones in-app al crear / cambiar estado (campanita existente).
5. Odoo **solo lectura** en v1 (ventas crea el documento en Odoo como hoy).

## Decisiones (brainstorming)

| Tema | Decisión |
|------|----------|
| Dominio | Órdenes de venta SMV (`sale.order`), no POs de compra |
| Quién atiende | Ventas con cuenta Hub (in-app) |
| Clientes | Todos (sync acotado a SO relevantes) |
| Escritura Odoo | No en v1; v2 fuera de alcance |
| Remisión | Líneas Odoo + nota libre |
| Permisos | Módulo `documentos-venta` + flag `atiendeDocumentosVenta` |
| Arquitectura | Espejo Firestore propio del Hub + solicitudes/chat |

## Arquitectura

```
Odoo (sale.order + lines + stock.picking outgoing)
  → CF syncVentasOdoo (scheduled + manual, read-only)
  → Firestore ventas_odoo_so + ventas_odoo_sync_state
  → UI /documentos-venta
  → solicitudes_documento + mensajes
  → notificaciones (tipos nuevos)
```

- UI **nunca** llama a Odoo.
- No reutilizar la colección `odooSaleOrders` de SMV-VISION (filtro Suprajit + app distinta).
- Credenciales: reutilizar secrets `FINANZAS_ODOO_*` del Hub (mismo ERP). Si hace falta
  aislamiento de API key, añadir override `VENTAS_ODOO_*` con el mismo patrón que
  `COMPRAS_ODOO_*` en el ETL de compras.
- Codebase Functions: `smv-hub` (nunca deploy global `--force`).

### Filtro de sync

Incluir SO con `state in ('sale', 'done')` y
`invoice_status in ('to invoice', 'upselling')` — misma ventana que la pestaña
Odoo «A facturar» y que SMV VISION. Las facturadas por completo (`invoiced`) no
entran al espejo (aunque tengan qty de entrega pendiente).

En cada línea se guarda la **Descripción** (`sale.order.line.name`), no el
producto genérico del catálogo. `productName` en el schema es ese texto de
descripción (legacy del nombre de campo).
IDs Firestore: `odoo_<id>` (o `/` → `_` si el name se usa como id).

Heartbeat en `ventas_odoo_sync_state/latest` (`ultimaSyncEn`, `filas`, `error` nullable).

---

## Modelo de datos

### `ventas_odoo_so/{id}` (espejo, solo Functions escribe)

| Campo | Tipo | Notas |
|-------|------|-------|
| `odooId` | number | id Odoo |
| `name` | string | SO00123 |
| `clientOrderRef` | string \| null | PO del cliente |
| `partnerId` | number | |
| `partnerName` | string | |
| `dateOrder` | string \| null | |
| `state` | string | |
| `invoiceStatus` | string | `to invoice` / `invoiced` / etc. |
| `lineas` | array | ver abajo |
| `remisiones` | array | resumen pickings outgoing |
| `sincronizadoEn` | timestamp | |

**Línea:**

| Campo | Tipo |
|-------|------|
| `odooLineId` | number |
| `productName` | string |
| `productDefaultCode` | string \| null |
| `qtyOrdered` | number |
| `qtyDelivered` | number |
| `qtyPending` | number | max(0, ordered − delivered) o desde stock.move |

**Remisión (resumen):** `name`, `state`, `dateDone` nullable.

### `solicitudes_documento/{id}`

| Campo | Tipo | Notas |
|-------|------|-------|
| `tipo` | `"factura"` \| `"remision"` | |
| `estado` | enum | ver estados |
| `odooSoId` | number | |
| `odooSoName` | string | denormalizado |
| `clientOrderRef` | string \| null | |
| `partnerName` | string | |
| `partidas` | array | vacío o ignorado si factura completa |
| `nota` | string | libre; puede ir vacío |
| `folioOdoo` | string \| null | WH/OUT/… o factura; al completar |
| `motivoRechazo` | string \| null | |
| `solicitadoPorUid` | string | |
| `solicitadoPorNombre` | string | |
| `atendidoPorUid` | string \| null | quien tomó / cerró |
| `atendidoPorNombre` | string \| null | |
| `creadoEn` / `actualizadoEn` | timestamp UTC | obligatorios |

**Partida (remisión):**

| Campo | Tipo |
|-------|------|
| `odooLineId` | number |
| `productName` | string |
| `qtySolicitada` | number | > 0, ≤ qtyPending al crear (validación cliente + Zod) |

### Estados

```
pendiente → en_proceso → completada
    ↓            ↓
 rechazada   rechazada
```

- `pendiente`: creada; visible en cola de ventas.
- `en_proceso`: ventas la tomó (opcional pero recomendado antes de completar).
- `completada`: documento hecho en Odoo; `folioOdoo` opcional pero preferido.
- `rechazada`: requiere `motivoRechazo` no vacío.

Transiciones permitidas (solo quien `atiendeDocumentosVenta` o super-admin, salvo que el
solicitante pueda cancelar su propia `pendiente` → `rechazada` con motivo “cancelada por
solicitante” — **sí en v1** para no dejar huérfanas).

### `solicitudes_documento/{id}/mensajes/{mensajeId}`

| Campo | Tipo |
|-------|------|
| `texto` | string min 1, max 4000 |
| `autorUid` | string |
| `autorNombre` | string |
| `creadoEn` | timestamp UTC |

Sin adjuntos en v1. Sin editar/borrar (append-only).

### Usuario

Añadir a `UsuarioSchema`:

```ts
atiendeDocumentosVenta: z.boolean().default(false)
```

Editable solo desde `/usuarios` (Admin SDK), igual que `esSuperAdmin` / `modulos`.

### Notificaciones

Extender:

- `TipoNotificacion`: `solicitud_documento_creada`, `solicitud_documento_estado`,
  `solicitud_documento_mensaje` (opcional v1: emitir mensaje solo si el autor no es el
  destinatario implícito; si complica, omitir tipo mensaje en v1 y solo crear/estado).
- `OrigenModuloNotificacion`: `"documentos-venta"`.

**v1 mínimo:** crear + cambio de estado. Chat se ve al abrir el detalle (tiempo real
Firestore); no spam por cada mensaje salvo que quepa fácil en el mismo patrón.

Emisión best-effort (mismo contrato que pedidos/requisiciones).

---

## Permisos y rules

### Módulo

- `ModuloId`: `"documentos-venta"` → `/documentos-venta`.
- Plantillas: `admin` y `compras` incluyen el módulo (pedir). `almacen` también (operación
  de piso pide remisiones). Ventas: módulo + `atiendeDocumentosVenta: true` (sin obligar
  plantilla nueva; se asigna en `/usuarios`).
- AuthGuard / NavBar / home: `tieneModulo('documentos-venta')`.

### Capacidades

| Acción | Quién |
|--------|--------|
| Leer espejo `ventas_odoo_so` | módulo `documentos-venta` |
| Crear solicitud + mensajes en solicitudes propias o abiertas | módulo |
| Listar cola completa + cambiar estado a no-propias | `atiendeDocumentosVenta` \| super-admin \| break-glass |
| Cancelar propia `pendiente` | solicitante |
| Sync manual CF | super-admin / admin (mismo patrón finanzas) |
| Escribir espejo | solo Admin SDK / Functions |

### Firestore rules (resumen)

- `ventas_odoo_so`, `ventas_odoo_sync_state`: read si módulo; write false.
- `solicitudes_documento`:
  - read: módulo y (es solicitante **o** `atiendeDocumentosVenta` **o** super-admin).
  - create: módulo; `solicitadoPorUid == auth.uid`; estado `pendiente`.
  - update estado: atendedor **o** (solicitante y solo `pendiente`→`rechazada`).
  - update otros campos de negocio: no (inmutables tras create, salvo campos de cierre).
- `mensajes`: read mismas reglas que padre; create si puede leer el padre y
  `autorUid == auth.uid`.
- Extender read/create de `notificaciones` para origen `documentos-venta`.

Claims: si se usa `smvHubModulos` en storage, incluir el nuevo módulo en el backfill;
no requerido para esta feature si solo usa Firestore rules + `modulos[]`.

---

## UI

### Rutas / nav

- Página `/documentos-venta`.
- Card en home (grupo Operación o Finanzas — **Operación del taller**, junto a
  notificaciones).
- Link NavBar grupo Operación.
- Deep link notifs: `/documentos-venta?solicitud={id}`.

### Pantalla principal (tabs o segmentos)

1. **Buscar / Nueva solicitud**  
   - Buscador: empresa, PO (`clientOrderRef`), nombre SO.  
   - Lista de SO del espejo (chip de sync stale si `ultimaSyncEn` > N horas).  
   - Al elegir SO → modal/panel: tipo Factura | Remisión.  
   - Remisión: checkboxes líneas con qty editable (default = `qtyPending`), nota libre.  
   - Factura: nota opcional; sin partidas (o partidas vacías).  
   - Confirmar → crea solicitud + notif.

2. **Mis solicitudes**  
   - Filtro por estado; cards con tipo, partner, PO, estado, fecha.

3. **Cola ventas** (solo si `atiendeDocumentosVenta`)  
   - Pendientes primero; acciones Tomar (`en_proceso`), Completar (folio), Rechazar (motivo).

### Detalle (modal o ruta)

- Cabecera: tipo, SO, PO, partner, estado, partidas, nota, folio.
- Timeline de estado.
- **Chat:** lista cronológica + input; suscripción `onSnapshot` a mensajes.
- Banner error + reintento; empty states claros.

### `/usuarios`

- Checkbox “Atiende documentos de venta” junto a la matriz de módulos.
- Al guardar, persiste `atiendeDocumentosVenta`.

### Sync

- Botón “Actualizar desde Odoo” visible a admin/super-admin (callable), mismo patrón
  que finanzas/compras.
- Chip “Última sync: …” para todos los del módulo.

---

## Errores, edge cases y pruebas

### Errores

- Fallo de red al listar SO / solicitudes: banner + reintento; no romper layout.
- Sync Odoo falla: escribe `error` en `ventas_odoo_sync_state`; UI muestra mensaje; datos
  previos se conservan.
- Crear solicitud con qty > pending: Zod + UI bloquean.
- Notificación falla: log; solicitud/mensaje ya guardados no se revierten.
- Usuario sin flag intenta update de estado ajeno: rules deniegan; UI no muestra botones.

### Edge cases

- SO sin `clientOrderRef`: se puede solicitar igual; mostrar “Sin PO”.
- Varias solicitudes abiertas sobre la misma SO: permitido (entregas parciales sucesivas).
- Espejo desactualizado tras completar en Odoo: próxima sync actualiza qty; la solicitud
  Hub ya está `completada` por acción humana.
- Odoo 0 resultados: no purge masivo.

### Pruebas (Vitest)

- Mapeo Odoo → `ventas_odoo_so` (líneas, qtyPending, filtro inclusión).
- Schema solicitud: partidas, transiciones inválidas (helper puro
  `puedeTransicionarEstado`).
- Helpers de búsqueda/filtro por texto (empresa/PO/SO).
- Títulos de tipos de notificación nuevos.
- Sin E2E Playwright obligatorio en v1 (camino dinero no aplica); smoke manual en
  `smv-brain-dev`.

---

## Fuera de alcance v1

- Crear `stock.picking` / `account.move` desde Hub.
- WhatsApp / SMS / email / Discord.
- Adjuntos PDF en chat.
- Reutilizar sync VISION.
- Multi-company Odoo compleja.
- Push FCM.

## Criterios de éxito

1. Buscar una SO por PO/empresa y crear solicitud de remisión con partidas + nota.
2. Ventas con el flag ve la cola, chatea, marca completada con folio opcional.
3. Solicitante ve el cambio de estado (lista + notif in-app).
4. Espejo se actualiza por schedule/manual sin escritura a Odoo.
5. Usuarios sin módulo no entran a `/documentos-venta`.
6. Usuarios con módulo pero sin flag no ven botones de atender ni la cola completa.

## v2 (no implementar ahora)

Automatizar creación de remisión/factura en Odoo al aceptar, enlazando `folioOdoo`
desde la respuesta API.
