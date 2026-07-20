# Diseño: Pedidos de almacén (captura móvil)

**Fecha:** 2026-07-20
**Módulo:** `/pedidos-almacen` (nuevo)
**Estado:** aprobado por el usuario (módulo nuevo y aislado, sin tocar `/requisiciones`, `/almacen`, `/ordenes`)
**Archivos afectados:** ver `docs/superpowers/plans/2026-07-20-pedidos-almacen.md`

---

## Problema

El encargado de almacén le pide verbalmente a Emiliano (dueño, rol `admin`/`compras`) que
compre herramientas u otras cosas para el taller. Como es verbal, Emiliano se le olvida o no
le da seguimiento. Se necesita que el encargado anote el pedido desde su celular en SMV Hub,
y que Emiliano lo vea después en la computadora.

## Objetivo

1. Captura mínima desde el celular: descripción libre (obligatoria) + urgente/normal + foto
   opcional. Nada de cantidad, proveedor ni SKU.
2. Lista visible para el dueño con lo pendiente, sin tener que preguntar.
3. Recordatorio ambiente (badge de pendientes) para que no dependa de acordarse de abrir la
   sección.
4. Camino claro para "ya lo compré" sin inventar datos de factura que no existen.
5. No modificar el comportamiento por defecto de ningún módulo existente.

## Investigación previa (por qué un módulo nuevo)

- **`/requisiciones`** tiene CRUD correcto pero el formulario pide 8–12 campos (varios
  selects) — no es "anotar rápido" desde el celular. El rol `almacen` tampoco tenía permiso
  para entrar ahí.
- **`/almacen`** modela entradas/salidas de material, sin concepto de "necesito que compres X".
- **`/ordenes`** nace obligatoriamente de una factura (proveedor + ítems + montos) — un pedido
  de almacén no trae esos datos todavía.
- El repo **no usa `onSnapshot`** en ningún hook existente (todos son fetch-on-mount +
  actualización optimista tras mutar). Se mantiene esa convención para la lista del módulo;
  el listener en tiempo real se reserva solo para el contador del badge, que es el único caso
  donde "en tiempo real" aporta valor real (verlo sin abrir la sección).

## Decisiones del usuario (brainstorming)

| Tema | Decisión |
|---|---|
| Quién captura | Encargado de almacén (rol `almacen`), nunca antes había entrado a SMV Hub |
| Formulario | Descripción libre + foto opcional + pill urgente/normal |
| Conversión a orden real | Botón "Comprar ahora" precarga `/nueva-compra` con la descripción; al guardar, el pedido se marca `comprado` y queda vinculado a la orden |
| Recordatorio | Sí — badge con conteo de pendientes en tiempo real, visible en NavBar y dashboard |
| Ubicación | Sección nueva en el menú (`/pedidos-almacen`), no dentro de módulos existentes |
| Quién gestiona estado | Solo `admin`/`compras` marcan comprado o cancelan; `almacen` solo crea |

## Arquitectura

### Datos

Colección Firestore `pedidos-almacen` (alineada con `almacen-entradas`/`almacen-salidas`).
Schema `PedidoAlmacenSchema` en `lib/schemas.ts`: `descripcion`, `urgente`, `imagenUrl`/
`imagenPath` opcionales, `estado` (`pendiente|comprado|cancelado`), `solicitadoPorUid`/
`solicitadoPorNombre`, `ordenIdVinculada` opcional, `creadoEn`/`actualizadoEn`. Sin campo de
"visto" — el contador de pendientes ya cumple esa función.

### Lógica

`lib/pedidos-almacen.ts` — CRUD siguiendo el estilo de `lib/requisiciones.ts` (mismo
`makeDateConverter`, `registrarAuditoria`). Sin borrado duro, solo cambio de `estado`.

### Roles y acceso

`lib/roles.ts` agrega `/pedidos-almacen` a `admin`, `compras`, `almacen`. `firestore.rules`
agrega `esPedidoAlmacenCreador()` (los 3 roles) y `esPedidoAlmacenGestor()` (solo
`admin`/`compras`) — create vs. update separados, igual que la UI.

### UI

Una sola pantalla (`app/pedidos-almacen/`) sirve para ambos casos de uso: captura rápida
arriba (patrón de pills + refocus de `/banos`), lista de tarjetas debajo (pendientes primero,
urgentes arriba; historial colapsado). Badge reutilizable (`PedidoAlmacenBadge.tsx`) con
`onSnapshot` en NavBar y dashboard.

### Integración con `/nueva-compra`

Solo activa si vienen `pedidoId`/`descripcion` en la URL — sin esos params el formulario se
comporta exactamente igual que hoy. `NuevaCompraForm` gana una prop opcional
`initialDescripcion` que solo siembra `defaultValues.items[0].descripcion`.

---

## Fuera de alcance

- Campo de "visto por el dueño" separado del estado.
- Vinculación manual a una orden ya existente (solo el camino "Comprar ahora" desde el pedido).
- Cantidad, proveedor, SKU o cualquier campo de captura adicional.
- Notificaciones push/email — el recordatorio es visual (badge) dentro de la app.

## Pruebas

| Tipo | Qué verificar |
|---|---|
| Unitario | CRUD de `lib/pedidos-almacen.ts` (`tests/pedidos-almacen.test.ts`) |
| Manual | Rol `almacen` solo ve `/`, `/almacen`, `/banos`, `/pedidos-almacen` |
| Manual | Captura con foto desde vista mobile, badge sube |
| Manual | "Comprar ahora" precarga `/nueva-compra`, guardar marca el pedido `comprado` |
| CI | `npm run lint`, `npm test`, `npm run build` sin regresiones |

## Criterios de aceptación

- [x] Encargado de almacén puede crear un pedido con descripción + urgente + foto opcional.
- [x] Dueño ve la lista en `/pedidos-almacen`, con badge de pendientes en NavBar y dashboard.
- [x] "Comprar ahora" precarga `/nueva-compra` y vincula la orden al guardar.
- [x] Rol `almacen` no gana acceso a ningún módulo existente.
- [x] `/requisiciones`, `/almacen`, `/ordenes`, `/nueva-compra` (sin los params nuevos) se
      comportan igual que antes.
