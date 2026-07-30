# Diseño: Notificaciones in-app (Operación del Taller)

**Fecha:** 2026-07-30  
**Módulo:** `/notificaciones` (nuevo) + campanita global en NavBar  
**Estado:** aprobado en brainstorming; implementación según plan adjunto  
**Archivos afectados:** ver `docs/superpowers/plans/2026-07-30-notificaciones-taller.md`

---

## Problema

Hoy el taller depende de badges sueltos (p. ej. pedidos pendientes) y de abrir cada módulo
para enterarse de cambios. No hay una bandeja única de avisos del sistema ni leído/no leído
por persona.

## Objetivo

1. Centro de alertas in-app: campanita global + página `/notificaciones`.
2. Eventos v1 desde **pedidos de almacén** y **requisiciones** (CRUD clásico + flujo).
3. Feed **broadcast** (todos ven los mismos avisos) con **leído por usuario**.
4. Card en home bajo Operación del Taller y link en el grupo Operación del NavBar.
5. Sin push, email ni WhatsApp en v1.

## Decisiones (brainstorming)

| Tema | Decisión |
|---|---|
| Propósito | Centro de alertas in-app generadas por el sistema |
| Alcance eventos | Pedidos de almacén + requisiciones |
| Audiencia | Broadcast a quien opera el taller |
| Entrada UI | Campanita global + página `/notificaciones` |
| Leído | Por usuario (badge personal) |
| Arquitectura | Colección `notificaciones` escrita desde `lib/` |

## Arquitectura

### Datos

**Colección** `notificaciones/{id}`:

| Campo | Tipo | Notas |
|---|---|---|
| `tipo` | enum | `pedido_almacen_creado`, `pedido_almacen_estado`, `requisicion_creada`, `requisicion_estado` |
| `titulo` | string | Corto y legible |
| `cuerpo` | string | Detalle (descripción, estado anterior→nuevo, etc.) |
| `origenModulo` | `"pedidos-almacen"` \| `"requisiciones"` | |
| `origenId` | string | Id del documento fuente |
| `href` | string | Deep link a la pantalla origen |
| `creadoEn` | timestamp UTC | |
| `creadoPorUid` | string | |
| `creadoPorNombre` | string | displayName/email |

**Leído por usuario** `usuarios/{uid}/notificaciones_leidas/{notificacionId}`:

| Campo | Tipo |
|---|---|
| `leidoEn` | timestamp UTC |

Schema Zod en `lib/schemas.ts`. CRUD/helpers en `lib/notificaciones.ts`. Hook
`lib/hooks/useNotificaciones.ts`. Componentes no importan Firestore.

### Emisión (best-effort)

Tras éxito del CRUD origen; si falla la escritura de la notificación, se loguea y **no** se
revierte la operación:

| Origen | Función | Evento |
|---|---|---|
| Pedidos | `crearPedidoAlmacen` | `pedido_almacen_creado` |
| Pedidos | `marcarPedidoAlmacenComprado` / `cancelarPedidoAlmacen` | `pedido_almacen_estado` |
| Requisiciones | `crearRequisicion`, `crearRequisicionFlujo` | `requisicion_creada` |
| Requisiciones | `actualizarRequisicion` solo si cambia `estado` | `requisicion_estado` |

### Permisos

- Módulo nuevo `notificaciones` en plantillas `admin`, `compras`, `almacen` (y quien ya
  tenga `requisiciones` vía diseño también ve el feed por el OR de lectura).
- Lectura del feed / ruta `/notificaciones`: tiene `notificaciones` **o**
  `pedidos-almacen` **o** `requisiciones`.
- Create en `notificaciones`: usuario autenticado activo con permiso de escribir el módulo
  origen (`pedidos-almacen` o `requisiciones`).
- `notificaciones_leidas`: solo el dueño (`uid`).
- Rules en `firestore.rules`; gating en AuthGuard, NavBar y home.

### UI

- **Campanita** en NavBar: badge de no leídas; dropdown ~10; click marca leída + navega;
  “Ver todas” → `/notificaciones`. Independiente de `PedidoAlmacenBadge`.
- **Página** `/notificaciones`: lista cronológica, filtros por origen y leída/no leída,
  marcar una / todas; empty state; banner + reintento ante error de red.
- Home: card en sección `operacion`.

### Pruebas

Vitest: schema, merge leída/conteo, títulos por tipo. Sin E2E de campanita en v1.

## Fuera de alcance v1

Push, email, WhatsApp, órdenes de servicio, entradas/salidas de almacén, Cloud Function
triggers, reemplazar el badge de pedidos pendientes.

## Criterios de éxito

1. Crear un pedido de almacén genera un aviso visible en campanita y en `/notificaciones`.
2. Cambiar estado de pedido o requisición genera aviso de estado.
3. Marcar leído solo afecta al usuario actual; otro usuario sigue viéndolo no leído.
4. Fallo al escribir la notificación no impide guardar el pedido/requisición.
5. Usuarios sin `notificaciones` / `pedidos-almacen` / `requisiciones` no ven campanita ni
   entran a `/notificaciones`.
