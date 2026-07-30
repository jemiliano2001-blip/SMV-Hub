# Diseño: Modo ventas simplificado + orden de compra

**Fecha:** 2026-07-30  
**Módulo:** `/documentos-venta` (evolución UX + sync)  
**Estado:** aprobado en brainstorming (enfoque 1 — vista dual por rol)  
**Base:** `docs/superpowers/specs/2026-07-30-documentos-venta-design.md`  
**Plan:** `docs/superpowers/plans/2026-07-30-documentos-venta-modo-ventas.md`

---

## Problema

1. En Odoo la **Orden de compra** es el campo `sale.order.origin`, no
   `client_order_ref`. Hub solo sincronizaba `client_order_ref`, así que muchas SO
   salían “Sin PO” y no se podían buscar como en el taller/Odoo.
2. La persona de ventas no es cómoda con UIs densas. La pantalla actual (tabs
   Nueva / Mías / Cola + detalle con muchos controles) frena adopción. Necesita
   algo familiar, con pocas acciones y chat fácil.

## Objetivo

1. Sincronizar y mostrar **orden de compra** (`origin`) con búsqueda usable.
2. **Modo ventas** simplificado solo para quien atiende (`atiendeDocumentosVenta`
   o super-admin): lista Pendientes/Hechas, detalle mínimo, chat grande.
3. El taller **sin** el flag conserva el flujo actual de crear solicitudes.
4. Folio Odoo al completar: **opcional**.
5. Notificación in-app al enviar un mensaje de chat (al otro lado).

## Decisiones (brainstorming)

| Tema | Decisión |
|------|----------|
| Quién ve modo simple | Solo ventas (flag `atiendeDocumentosVenta` / super-admin) |
| Detalle ventas | Cliente, SO, orden de compra, descripción + cantidad, Atender → Listo/Cancelar, chat abajo |
| Entrada ventas | Tabs **Pendientes** / **Hechas** |
| Folio al Listo | Opcional |
| Arquitectura UI | Vista dual por rol (enfoque 1), no toggle global ni forzar simple a todos |
| Campo Odoo PO | `origin` → `ordenCompra`; fallback UI a `clientOrderRef` si `origin` vacío |

## Datos y sync

### Espejo `ventas_odoo_so`

- Ampliar lectura Odoo: campo `origin` en `CAMPOS_SO`.
- Nuevo campo Firestore/schema: `ordenCompra: string | null` (desde `origin`).
- Conservar `clientOrderRef` (`client_order_ref`) por compatibilidad.
- Valor efectivo para UI/búsqueda:
  `ordenCompraEfectiva = ordenCompra ?? clientOrderRef ?? null`.
- Label visible: **Orden de compra** (no solo “PO”).
- `filtrarSoPorTexto` (y filtros de lista de solicitudes): incluir
  `ordenCompra` / efectivo además de SO y cliente.
- En `SolicitudDocumento`: agregar `ordenCompra: string | null` (denormalizado al
  crear con el efectivo). Mantener `clientOrderRef` por docs ya guardados.
- UI de listas/detalle: `solicitud.ordenCompra ?? solicitud.clientOrderRef`.
- No backfill masivo obligatorio; docs nuevos llevan `ordenCompra`.

### Completar

- `folioOdoo` sigue opcional al pasar a `completada`.

## Pantallas

### Routing por rol en `DocumentosVentaView`

| Condición | UI |
|-----------|-----|
| `atiendeDocumentosVenta` \|\| `esSuperAdmin` | **ModoVentasView** (default; sin tabs Nueva/Mías/Cola) |
| resto con módulo | UI taller actual (Nueva / Mis solicitudes; sin Cola) |

Super-admin que también crea solicitudes: en v1 entra a modo ventas; si necesita
crear, se puede añadir después un enlace “Crear solicitud” — **fuera de v1**
salvo que sea trivial (link a panel taller). Preferencia v1: modo ventas puro
para atendedores; taller sin flag crea.

### Modo ventas — lista

- Tabs grandes: **Pendientes** (`pendiente`, `en_proceso`) y **Hechas**
  (`completada`, `rechazada`; orden por fecha desc, historial reciente suficiente).
- Fila: tipo (Remisión/Factura), cliente, orden de compra, SO, solicitado por.
- Estados en español: Por atender / En proceso / Lista / Cancelada.
- Buscador opcional que filtra la lista visible.

### Modo ventas — detalle

1. Cabecera: tipo, cliente, SO, orden de compra.
2. Partidas read-only: descripción + cantidad.
3. Nota del taller si existe.
4. Acciones grandes:
   - `pendiente` → **Atender** → `en_proceso`
   - `en_proceso` → **Listo** (input folio opcional) / **Cancelar** (motivo corto)
5. Chat: mensajes cronológicos + textarea grande + **Enviar**.

Reutilizar lógica de `actualizarEstadoSolicitud` / `agregarMensajeSolicitud`;
nueva presentación (`ModoVentasView` + `DetalleVentasSimple`), no duplicar rules.

### Taller

- Misma UI de creación; labels **Orden de compra**; búsqueda con `origin`.
- Detalle/chat pueden quedar como hoy o heredar tipografía más clara si es barato;
  no es el foco.

## Chat y notificaciones

- Tras `agregarMensajeSolicitud`, emitir notif con tipo nuevo
  `solicitud_documento_mensaje` (añadir a `TipoNotificacion` + títulos) hacia el
  otro lado:
  - autor = solicitante → notificar atendedores (mismo patrón que
    `solicitud_documento_creada`: destinatarios con flag / módulo ventas, según
    helper existente de notifs del módulo);
  - autor = atendedor → notificar a `solicitadoPorUid`.
- Título/cuerpo cortos: “Nuevo mensaje · Remisión {SO}”.
- Sin adjuntos en este slice.
- Fallo de notif: log; el mensaje ya guardado no se revierte.

## Errores

- Red al cambiar estado o enviar chat: banner + reintento; no limpiar el draft
  del input.
- SO sin `origin` ni `client_order_ref`: “Sin orden de compra”.
- Permisos: sin cambios de rules salvo lo que exija el tipo de notif nuevo si
  aún no está en schema/rules de notificaciones.

## Pruebas

- Vitest: mapeo `origin` → `ordenCompra`; efectivo con fallback;
  `filtrarSoPorTexto`; partición Pendientes/Hechas; labels de estado.
- Vitest: emitir mensaje dispara notif al destinatario correcto (mock).
- Smoke: ventas Pendientes → Atender → chat → Listo con/sin folio; taller busca
  por número de orden de compra.

## Fuera de alcance

- Escritura a Odoo / crear remisión automática.
- Toggle Simple/Completo global.
- Adjuntos en chat.
- Rediseño profundo del flujo de creación del taller.
- Forzar modo simple a usuarios sin flag.

## Criterios de éxito

1. Ventas con flag ve solo Pendientes/Hechas + detalle simple + chat usable.
2. Buscar por el valor de Orden de compra de Odoo (`origin`) encuentra la SO /
   solicitud.
3. Listo funciona con folio vacío u opcional lleno.
4. Mensaje de chat genera notif in-app al interlocutor.
5. Taller sin flag sigue creando solicitudes como antes.
