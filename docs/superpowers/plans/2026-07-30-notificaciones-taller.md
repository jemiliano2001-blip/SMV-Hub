# Notificaciones in-app (Operación del Taller) — Implementation Plan

> **For agentic workers:** Execute task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Centro de alertas in-app con campanita global + `/notificaciones`, eventos desde pedidos de almacén y requisiciones, leído por usuario.

**Architecture:** Colección broadcast `notificaciones` escrita best-effort desde `lib/pedidos-almacen.ts` y `lib/requisiciones*.ts`. Leídos en `usuarios/{uid}/notificaciones_leidas`. UI vía `lib/notificaciones.ts` + hook; sin Firestore en componentes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript estricto, Zod, Firestore client SDK, Vitest, Tailwind v4, lucide-react, Sonner.

**Spec:** `docs/superpowers/specs/2026-07-30-notificaciones-taller-design.md`

## Global Constraints

- Prohibido `any` y `@ts-ignore`.
- UI no importa Firestore — solo `lib/notificaciones.ts` y hooks.
- Emisión best-effort: fallo al crear notificación no tumba el CRUD origen.
- Timestamps UTC en Firestore; formateo `es-MX` en cliente.
- Sin push/email/WhatsApp; no reemplazar `PedidoAlmacenBadge`.

---

## File map

| File | Responsibility |
|---|---|
| `lib/schemas.ts` | Schemas de notificación + `notificaciones` en `ModuloIdSchema` |
| `lib/notificaciones.ts` | Crear evento, listar/suscribir, marcar leída(s), merge, títulos |
| `lib/hooks/useNotificaciones.ts` | Suscripción + estado leída + acciones |
| `lib/roles.ts` | Ruta, plantillas, `puedeVerNotificaciones` |
| `firestore.rules` | `notificaciones` + subcolección leídas |
| `app/notificaciones/page.tsx` | Página lista + filtros |
| `app/notificaciones/NotificacionesView.tsx` | UI de la página |
| `app/notificaciones/NotificacionesBell.tsx` | Campanita + dropdown |
| `app/NavBar.tsx` | Bell + link Operación |
| `app/page.tsx` | Card en `operacion` |
| `app/AuthGuard.tsx` | Gate con `puedeVerNotificaciones` |
| `lib/pedidos-almacen.ts` | Emitir eventos |
| `lib/requisiciones.ts` | Emitir eventos |
| `lib/requisiciones-flujo.ts` | Emitir al crear flujo |
| `tests/notificaciones.test.ts` | Schema, merge, títulos |

---

### Task 1: Schema + helpers puros + tests

**Files:** `lib/schemas.ts`, `lib/notificaciones.ts` (helpers puros primero), `tests/notificaciones.test.ts`

- [ ] Añadir a `ModuloIdSchema`: `"notificaciones"`.
- [ ] Schemas:

```ts
export const TipoNotificacionSchema = z.enum([
  "pedido_almacen_creado",
  "pedido_almacen_estado",
  "requisicion_creada",
  "requisicion_estado",
])
export const OrigenModuloNotificacionSchema = z.enum(["pedidos-almacen", "requisiciones"])
export const NotificacionSchema = z.object({
  id: z.string(),
  tipo: TipoNotificacionSchema,
  titulo: z.string().min(1),
  cuerpo: z.string(),
  origenModulo: OrigenModuloNotificacionSchema,
  origenId: z.string().min(1),
  href: z.string().min(1),
  creadoEn: z.date(),
  creadoPorUid: z.string(),
  creadoPorNombre: z.string(),
})
```

- [ ] Helpers exportados: `tituloParaTipo`, `mergeNotificacionesConLeidas`, `contarNoLeidas`.
- [ ] Tests Vitest que pasen sin Firebase.

### Task 2: Capa Firestore `lib/notificaciones.ts`

- [ ] `crearNotificacion(payload)` → `addDoc`; captura errores y no relanza (o wrapper `emitirNotificacion` que swallow).
- [ ] `suscribirNotificaciones(onData, onError, limite=50)`.
- [ ] `marcarNotificacionLeida(uid, id)`, `marcarTodasNotificacionesLeidas(uid, ids)`.
- [ ] `suscribirNotificacionesLeidas(uid, ...)`.

### Task 3: Roles + rules

- [ ] `RUTA_POR_MODULO.notificaciones = "/notificaciones"`.
- [ ] Plantillas admin/compras/almacen incluyen `notificaciones`; PERMISOS_POR_ROL igual.
- [ ] `puedeVerNotificaciones(modulos)` → true si tiene `notificaciones` \| `pedidos-almacen` \| `requisiciones`.
- [ ] `tienePermiso`: para pathname `/notificaciones` usar `puedeVerNotificaciones`.
- [ ] `firestore.rules`: match `notificaciones` (read si puede ver; create si tiene módulo origen; no update/delete salvo super-admin opcional — preferir no delete).
- [ ] match `usuarios/{uid}/notificaciones_leidas/{id}` solo owner.

### Task 4: Hook + instrumentación CRUD

- [ ] `useNotificaciones()`: listas mergeadas, `noLeidas`, `marcarLeida`, `marcarTodas`.
- [ ] Pedidos: emitir tras crear / comprado / cancelado.
- [ ] Requisiciones: emitir tras crear; tras actualizar solo si `estado` cambia; flujo al crear.

### Task 5: UI

- [ ] `NotificacionesBell` en NavBar (si `puedeVerNotificaciones`).
- [ ] Página `/notificaciones` con filtros y marcar todas.
- [ ] Card home + link NavBar Operación.
- [ ] AuthGuard: `/notificaciones` vía `puedeVerNotificaciones`.

### Task 6: Verificar

- [ ] `npx vitest run tests/notificaciones.test.ts`
- [ ] `npx tsc --noEmit` (o lint de archivos tocados)
