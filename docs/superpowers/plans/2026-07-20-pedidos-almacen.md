# Pedidos de Almacén — Implementation Plan

**Goal:** Módulo nuevo `/pedidos-almacen` para que el encargado de almacén anote desde su
celular qué necesita que se compre, visible para el dueño en la computadora, con badge de
pendientes y conversión a orden real vía `/nueva-compra`.

**Architecture:** Colección Firestore aislada `pedidos-almacen`, CRUD en `lib/pedidos-almacen.ts`
(mismo patrón que `lib/requisiciones.ts`), UI mobile-first en `app/pedidos-almacen/` (patrón de
pills/refocus de `/banos`), badge realtime (`onSnapshot`, único caso del repo) en NavBar y
dashboard, integración aditiva en `/nueva-compra` vía query params opcionales.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript estricto, Zod, Firestore client SDK,
Vitest, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-07-20-pedidos-almacen-design.md`

## Global Constraints

- Prohibido `any` y `@ts-ignore` (CLAUDE.md).
- Componentes UI no importan Firestore directamente — solo `lib/pedidos-almacen.ts` y los hooks.
- Sin borrado duro — solo cambio de `estado` (Trazabilidad, CLAUDE.md).
- `/requisiciones`, `/almacen`, `/ordenes` y `/nueva-compra` (sin los query params nuevos) deben
  comportarse exactamente igual que antes de este cambio.
- Reparto de permisos en dos capas: UI (oculta botones) **y** `firestore.rules` (rechaza la
  escritura) — nunca solo frontend.

---

## File map

| File | Responsibility |
|---|---|
| `lib/schemas.ts` | `PedidoAlmacenSchema`, `NuevoPedidoAlmacenSchema`, `EstadoPedidoAlmacenSchema` |
| `lib/pedidos-almacen.ts` | CRUD: crear, listar, marcar comprado, cancelar |
| `lib/storage.ts` | `subirImagenPedidoAlmacen` |
| `lib/hooks/usePedidosAlmacen.ts` | Hook fetch-on-mount para la lista (estilo `useRequisiciones`) |
| `lib/hooks/usePedidosAlmacenPendientesCount.ts` | Hook `onSnapshot` solo para el conteo del badge |
| `lib/roles.ts` | `/pedidos-almacen` en `PERMISOS_POR_ROL` de `admin`/`compras`/`almacen` |
| `firestore.rules` | `esPedidoAlmacenCreador`/`esPedidoAlmacenGestor`, match `/pedidos-almacen` |
| `storage.rules` | match `/pedidos-almacen/{imagen=**}` |
| `app/pedidos-almacen/page.tsx` | Contenedor + `AuthGuard` |
| `app/pedidos-almacen/PedidosAlmacenView.tsx` | Captura rápida + lista de tarjetas |
| `app/pedidos-almacen/PedidoAlmacenBadge.tsx` | Badge reutilizable (NavBar + dashboard) |
| `app/NavBar.tsx` | Link + badge en grupo Operación |
| `app/page.tsx` | Tarjeta nueva en `NAV_CARDS` + badge |
| `app/nueva-compra/page.tsx`, `NuevaCompraFormWrapper.tsx`, `NuevaCompraForm.tsx` | Precarga opcional vía `pedidoId`/`descripcion` |
| `tests/pedidos-almacen.test.ts` | CRUD de `lib/pedidos-almacen.ts` |

---

### Task 1: Schema y capa de datos — `[x]` completado

**Files:** `lib/schemas.ts`, `lib/pedidos-almacen.ts`, `lib/storage.ts`

- [x] `PedidoAlmacenSchema`/`NuevoPedidoAlmacenSchema`/`EstadoPedidoAlmacenSchema` en
      `lib/schemas.ts`, junto a la sección de Almacén.
- [x] `lib/pedidos-almacen.ts`: `crearPedidoAlmacen`, `listarPedidosAlmacen`,
      `marcarPedidoAlmacenComprado(id, ordenId)`, `cancelarPedidoAlmacen(id)` — todas registran
      auditoría vía `registrarAuditoria`.
- [x] `subirImagenPedidoAlmacen` en `lib/storage.ts`, path `pedidos-almacen/{id}.{ext}`.

### Task 2: Hooks — `[x]` completado

**Files:** `lib/hooks/usePedidosAlmacen.ts`, `lib/hooks/usePedidosAlmacenPendientesCount.ts`

- [x] `usePedidosAlmacen`: fetch-on-mount + `agregarPedido`/`marcarComprado`/`cancelarPedido`
      con actualización optimista local (mismo patrón que `useRequisiciones`).
- [x] `usePedidosAlmacenPendientesCount`: único hook del repo con `onSnapshot`, filtra
      `estado == 'pendiente'`, devuelve solo el número.

### Task 3: Roles y reglas de seguridad — `[x]` completado

**Files:** `lib/roles.ts`, `firestore.rules`, `storage.rules`

- [x] `/pedidos-almacen` agregado a `admin`, `compras`, `almacen` en `PERMISOS_POR_ROL`.
- [x] `firestore.rules`: `esPedidoAlmacenCreador()` (los 3 roles, create) y
      `esPedidoAlmacenGestor()` (solo `admin`/`compras`, update); sin `delete`.
- [x] `storage.rules`: bloque `pedidos-almacen/{imagen=**}` calcado de `ordenes/`.

### Task 4: UI del módulo — `[x]` completado

**Files:** `app/pedidos-almacen/page.tsx`, `PedidosAlmacenView.tsx`, `PedidoAlmacenBadge.tsx`

- [x] Captura rápida: textarea autofocus, pills Normal/Urgente, input de foto con
      `capture="environment"`, refocus tras guardar (patrón `/banos`).
- [x] Lista de tarjetas: pendientes (urgentes primero) + historial colapsado (`<details>`).
- [x] Acciones "Comprar ahora"/"Cancelar" solo visibles para `admin`/`compras`.
- [x] Badge reutilizable con `onSnapshot`, oculto cuando el conteo es 0.

### Task 5: Integración en NavBar y dashboard — `[x]` completado

**Files:** `app/NavBar.tsx`, `app/page.tsx`

- [x] Link "Pedidos de almacén" en el grupo Operación, filtrado por `tienePermiso` (ya existente).
- [x] Badge visible tanto en el botón del grupo (colapsado) como en el link dentro del dropdown.
- [x] Tarjeta nueva en `NAV_CARDS` del dashboard con el mismo badge.

### Task 6: Integración con `/nueva-compra` — `[x]` completado

**Files:** `app/nueva-compra/page.tsx`, `NuevaCompraFormWrapper.tsx`, `NuevaCompraForm.tsx`

- [x] `page.tsx` lee `searchParams` (`pedidoId`, `descripcion`) y los pasa como props.
- [x] `NuevaCompraFormWrapper` acepta props opcionales; tras `crearOrden` exitoso, si hay
      `pedidoId` llama `marcarPedidoAlmacenComprado` en `try/catch` que no bloquea la
      navegación si falla.
- [x] `NuevaCompraForm` acepta `initialDescripcion` opcional, solo siembra
      `defaultValues.items[0].descripcion` — sin params, comportamiento idéntico al anterior.

### Task 7: Pruebas — `[x]` completado

**Files:** `tests/pedidos-almacen.test.ts`

- [x] `crearPedidoAlmacen`, `listarPedidosAlmacen`, `marcarPedidoAlmacenComprado`,
      `cancelarPedidoAlmacen` — mocking de `firebase/firestore` igual que
      `tests/lib-ordenes.test.ts`.

### Task 8: Verificación CI y manual

**Files:** Verify only

- [ ] `npm run lint`
- [ ] `npm test` (suite completa, sin regresiones en `tests/schemas.test.ts`, `tests/ordenes.test.ts`, `tests/lib-ordenes.test.ts`)
- [ ] `npx vitest run tests/pedidos-almacen.test.ts`
- [ ] `npm run build`
- [ ] Manual: alta de usuario `almacen` en `/usuarios` si no existe, login, confirmar rutas
      visibles, crear pedido con foto en vista mobile, login `admin`, ver lista + badge,
      "Comprar ahora" → guardar orden → pedido pasa a `comprado`, cancelar pedido pendiente.

---

## Spec coverage (self-review)

| Spec requirement | Task |
|---|---|
| Captura mínima (descripción + urgente + foto opcional) | Task 4 |
| Lista visible para el dueño | Task 4 |
| Badge de pendientes en tiempo real | Task 2, 4, 5 |
| "Comprar ahora" sin inventar datos de factura | Task 6 |
| No modificar comportamiento existente | Task 3, 5, 6 (todo aditivo) |
| Reparto de permisos en 2 capas (UI + rules) | Task 3, 4 |
| Tests CRUD | Task 7 |
| lint / test / build | Task 8 |
