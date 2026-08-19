# Flujo Integral de Abastecimiento — Implementation Plan (corregido)

> **Estado:** propuesta. No tocar código de producción hasta la aprobación de
> Emiliano. Este plan **reemplaza** la propuesta original de la sesión
> `/grill-me`, que no era construible tal como estaba escrita (ver
> "Correcciones sobre el plan original").

**Goal:** Cerrar el único tramo del ciclo de abastecimiento que hoy no existe —
**Compra ➔ Recepción en Almacén ➔ Aviso al solicitante** — y hacer visible de
punta a punta el ciclo completo con un stepper derivado, sin inventar estados
nuevos ni duplicar caminos de escritura que ya funcionan.

**Architecture:** La cascada de recepción vive en un **Route Handler con Admin
SDK** (`POST /api/ordenes/[id]/recibir`), no en el cliente: las colecciones que
toca tienen compuertas de permiso distintas y una transacción cliente fallaría
completa para el almacenista. `lib/abastecimiento.ts` queda como lógica **pura**
(derivación del stepper + consulta de pendientes); `lib/abastecimiento-server.ts`
concentra la orquestación con `adminDb`. La UI consume ambos por props/hooks,
sin importar Firestore directo.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript estricto, Zod,
Firebase 12 / Firestore + Admin SDK, shadcn/Base UI, Tailwind v4, Vitest,
Firestore Emulator.

**Spec:** este documento es autocontenido; si se requiere spec separada se
extrae la sección "Correcciones sobre el plan original" a
`docs/superpowers/specs/2026-08-19-flujo-abastecimiento-design.md`.

---

## Correcciones sobre el plan original

Verificado contra el código real antes de escribir este plan:

| # | Hallazgo en el plan original | Corrección |
|---|---|---|
| 1 | `recibirOrdenEnAlmacen()` como transacción **cliente** sobre 6 colecciones | Imposible: `almacen-entradas` exige `tieneModulo('almacen')` (rules:324), `pedidos-almacen` exige `esPedidoAlmacenGestor()` = `pedidos-almacen` **y** `nueva-compra` (rules:370), `endmills-medidas` exige `esUsuarioEndmills()` (rules:403). Una transacción es todo-o-nada ⇒ el almacenista falla la operación completa. **Se mueve a Route Handler con Admin SDK.** |
| 2 | Sumar `stockActual` de endmills desde la recepción de una orden | La regla (rules:458-472) hace `affectedKeys().hasOnly([...])` **y** `baseEndmillRespaldada(medidaId, ...)`: solo admite stock respaldado por partida de un pedido real. Además `registrarRecepcionPedidoEndmills()` (`lib/endmills.ts:472`) ya hace eso con partidas, recepción parcial e historial. Un segundo camino = **doble conteo**. **Endmills sale de la cascada.** |
| 3 | `estadoEntrega` nuevo en requisiciones y pedidos | Sería la **tercera** máquina de estados: ya existen `estado` (`no_comprado…recibido`) y `estatusFlujo` (`borrador…convertida_a_oc`). **Se elimina; el stepper se deriva de los campos existentes.** |
| 4 | Agregar `requisicionId` a la orden | **Ya existe** (`lib/schemas.ts:146`), y `generarOrdenCompraDesdeRequisicion()` ya lo escribe junto con `ordenCompraId` + `estatusFlujo: "convertida_a_oc"`. |
| 5 | Vincular pedidos de almacén a compra | **Ya existe**: `ordenIdVinculada` + `/nueva-compra?pedidoId=` en `NuevaCompraFormWrapper.tsx:56`. |
| 6 | Sin mención de `firestore.rules` ni `test:rules` | Cada campo nuevo pasa por `ordenValida` / `entradaAlmacenValida` y cada tipo de notificación por `notificacionValida`. **Se agregan como tareas de primera clase.** |
| 7 | `TablaOrdenes.tsx`, `OrdenSchema`, lógica en `page.tsx` | No existen. Los targets reales son `OrdenesList.tsx`, `OrdenCompraSchema`, `EndmillsView.tsx`, `RequisicionesList.tsx`, `PedidosAlmacenView.tsx`. |
| 8 | "notificar al solicitante" de una requisición | `RequisicionSchema.solicitante` es un **nombre (string), no un uid** — no hay a quién dirigir la notificación. `PedidoAlmacen.solicitadoPorUid` sí existe. **v1: pedidos-almacén notifica al solicitante; requisiciones notifica a la audiencia `requisiciones`.** Ver Tarea 9 (deuda). |

Lo que sí se conserva del plan original: separar `estadoRecepcion` de `estado`
(correcto, porque `ordenValida` fija `estado` a tres valores), la colección
`almacen-entradas`, y la captura bidireccional origen ↔ compra.

---

## Restricciones globales

- No tocar producción ni desplegar reglas antes de la aprobación del plan.
- Prohibido `any`, `@ts-ignore`, stubs y datos demo.
- La UI no importa Firestore directo; la lógica vive en `lib/`.
- **Endmills conserva `registrarRecepcionPedidoEndmills` como único dueño de
  `stockActual`.** Ninguna tarea de este plan escribe en `endmills-medidas`.
- No se agregan campos de estado nuevos a `requisiciones` ni a `pedidos-almacen`.
- Retrocompatibilidad: toda orden histórica sin `estadoRecepcion` se lee como
  `"pendiente"` (default del schema), sin backfill obligatorio.
- Implementar y probar contra `smv-brain-dev`.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `lib/schemas.ts` | `estadoRecepcion`/`fechaRecepcion`/`recibidoPor`/`entradaAlmacenId` en `OrdenCompraSchema`; FKs en `EntradaAlmacenSchema`; tipo de notificación nuevo |
| `lib/notificaciones.ts` | Entrada nueva en el `Record` exhaustivo `TITULOS` (obligatorio para que compile) |
| `lib/abastecimiento.ts` | **Puro**: `derivarPasosAbastecimiento()`, `listarPendientesAbastecimiento()` |
| `lib/abastecimiento-server.ts` | Orquestación de la cascada con `adminDb` |
| `app/api/ordenes/[id]/recibir/route.ts` | Endpoint autenticado que ejecuta la cascada |
| `lib/services/recepcion-almacen.ts` | Cliente autenticado (`fetch` + ID token) |
| `lib/almacen.ts` | `crearEntrada` acepta `ordenId`/`proveedor`; listado de órdenes por recibir |
| `components/abastecimiento/StepperAbastecimiento.tsx` | Stepper derivado + badges clickables |
| `components/abastecimiento/ModalRecibirOrdenAlmacen.tsx` | Diálogo de recepción |
| `components/abastecimiento/DrawerPendientesAbastecimiento.tsx` | Asistente de pendientes |
| `app/ordenes/OrdenesList.tsx` | Badge de stepper + acción "Recibir en Almacén" |
| `app/almacen/page.tsx` + nuevo `OrdenesPorRecibir.tsx` | Tab de recepción del almacenista |
| `app/requisiciones/RequisicionesList.tsx` | Stepper + botones "Comprar" / "Cotizar en Odoo" |
| `app/pedidos-almacen/PedidosAlmacenView.tsx` | Stepper de entrega |
| `app/endmills/InventarioEndmills.tsx` | Banner de stock crítico + reorden en lote |
| `firestore.rules` | Validadores de orden/entrada + tipo de notificación |
| `tests/abastecimiento.test.ts` | Lógica pura del stepper y de pendientes |
| `tests/recibir-orden-route.test.ts` | Route Handler con `adminDb` mockeado |

---

## Tareas

### Fase 1 — Modelo y reglas (sin UI)

#### Tarea 1 — Campos de recepción en los schemas

`lib/schemas.ts`:

- `OrdenCompraSchema` += `estadoRecepcion: z.enum(["pendiente","parcial","recibida"]).default("pendiente")`, `fechaRecepcion: z.string().nullable().optional()` (YYYY-MM-DD), `recibidoPor: z.string().nullable().optional()`, `entradaAlmacenId: z.string().nullable().optional()`.
  - `"parcial"` queda **reservado sin escritor**: ninguna ruta de v1 lo produce y la UI no lo ofrece (ver Tarea 9). Se documenta con comentario en el schema para que nadie construya un segundo camino de recepción creyendo que falta cablearlo.
- `EntradaAlmacenSchema` += `ordenId: z.string().nullable().default(null)`, `proveedor: z.string().nullable().default(null)`.
- `TipoNotificacionSchema` += `"orden_recibida_almacen"`.
- **`lib/notificaciones.ts`**: agregar la entrada correspondiente al `Record<TipoNotificacion, string>` de `TITULOS` (línea 67). Es obligatorio, no opcional: el Record es exhaustivo, así que el enum nuevo sin su título **no compila**.
- **No** se toca `EstadoOrdenSchema`, `RequisicionSchema` ni `PedidoAlmacenSchema`.
- **No** se agrega `pedidoAlmacenId` a la orden: el vínculo ya existe en sentido inverso (`pedidos-almacen.ordenIdVinculada`) y duplicarlo crea dos fuentes de verdad que se pueden desincronizar. La consecuencia es que el server hace una consulta inversa — está escrito explícitamente en la Tarea 4.

*Verificación:* `npx tsc --noEmit` + `npm test`.

#### Tarea 2 — Reglas de Firestore

`firestore.rules`:

- `ordenValida(d)`: `(!d.keys().hasAny(['estadoRecepcion']) || d.estadoRecepcion in ['pendiente','parcial','recibida'])` — opcional para no romper históricos.
- `entradaAlmacenValida(d)`: aceptar `ordenId`/`proveedor` string o null.
- `notificacionValida(d)`: agregar `'orden_recibida_almacen'` al allowlist de tipos. **Aclaración:** esto **no** es lo que desbloquea la emisión — el Admin SDK ignora las reglas al crear, así que la notificación se escribiría igual. Se agrega para mantener reglas y cliente sincronizados (norma del proyecto) y para no bloquear una emisión cliente futura. Lo que de verdad rompería la campana es el `Record` de `TITULOS` de la Tarea 1.
- La audiencia sigue siendo `pedidos-almacen`/`requisiciones` (ya legibles por `puedeVerNotificacion`, rules:593), así que **no** se agrega audiencia nueva ni se toca `lib/roles.ts`.
- **Verificado, no requiere cambio:** `requisicionValida` (rules:154) ya admite `estado: 'recibido'`, así que la escritura del server no deja la requisición en un estado que el cliente luego no pueda editar.

*Verificación:* `npx firebase-tools emulators:exec --only firestore "npm run test:emulator"`, con casos: almacenista actualiza `estadoRecepcion`; usuario intenta `estadoRecepcion` inválido (debe fallar); cliente edita una requisición ya marcada `recibido` (debe pasar).

#### Tarea 3 — Lógica pura del stepper

`lib/abastecimiento.ts` (sin imports de Firestore):

```ts
derivarPasosAbastecimiento(input: {
  origen: { tipo: "requisicion" | "pedido-almacen"; id: string; folio: string } | null
  orden: { id: string; estado: EstadoOrden; estadoRecepcion: EstadoRecepcion } | null
  entradaAlmacenId: string | null
}): PasoAbastecimiento[]
```

Devuelve 3 pasos (`Solicitado` / `Comprado` / `Recibido`) con
`estado: "pendiente" | "actual" | "completo"`, etiqueta y `href`. **Deriva** de
`estatusFlujo`, `estado`, `ordenCompraId`, `ordenIdVinculada` y
`estadoRecepcion` — no inventa campos.

*Verificación:* `tests/abastecimiento.test.ts` con casos por combinación, incluidos históricos sin `estadoRecepcion`.

### Fase 2 — Cascada de recepción (el tramo que falta)

#### Tarea 4 — Orquestador server

`lib/abastecimiento-server.ts` → `recibirOrdenEnAlmacen({ ordenId, uid, email, nombre, notas })`:

**Fase de lectura (antes del batch, porque el batch no puede consultar):**

1. Lee la orden con `adminDb`; 404 si no existe; 409 si `estadoRecepcion === "recibida"` (idempotencia, como el precedente de baños).
2. **Consulta inversa del origen**, ya que la orden no guarda `pedidoAlmacenId`:
   `adminDb.collection("pedidos-almacen").where("ordenIdVinculada","==",ordenId).limit(1).get()`.
   De ahí sale `solicitadoPorUid`, que es el destinatario del aviso — sin este paso, el paso 6 no tiene a quién notificar. Es igualdad sobre un solo campo, así que la cubre el índice automático de Firestore: **no** hace falta entrada en `firestore.indexes.json` (verificado: `pedidos-almacen` no tiene `fieldOverrides` que exenten el campo).
3. Si `orden.requisicionId`, lee la requisición para el nombre del solicitante.

**Fase de escritura (`adminDb.batch()`, atómica):**

4. Crea `almacen-entradas` (con `ordenId`, `proveedor`, `recibio`, `estatus: "entregado"`) y actualiza la orden (`estadoRecepcion: "recibida"`, `fechaRecepcion`, `recibidoPor`, `entradaAlmacenId`, `actualizadoEn`).
5. Si hubo requisición: `requisiciones/{id}.estado = "recibido"` + `recibio`. Si hubo pedido (ya en `"comprado"`): solo `actualizadoEn`.

**Después del commit (no atómico, y está bien que no lo sea):**

6. `emitirNotificacionServer()` — audiencia `pedidos-almacen` con `destinatarioUid` del solicitante, o audiencia `requisiciones` con `destinatarioUid: null`.
7. `registrarAuditoriaServer(email, "ACTUALIZAR", "ordenes", ordenId, ...)`.

Si 6 o 7 fallan, la recepción **ya quedó**: se registra el error en consola y se
responde 200. Un aviso perdido no debe revertir material que físicamente ya
llegó al almacén.

**Nada de endmills aquí.**

*Verificación:* unitaria con `adminDb` mockeado, incluyendo el caso "orden sin origen" (ni requisición ni pedido ⇒ entrada creada, sin notificación).

#### Tarea 5 — Route Handler

`app/api/ordenes/[id]/recibir/route.ts`, calcado de
`app/api/banos/solicitudes-borrado/[id]/resolver/route.ts`:
`verificarUsuarioAutorizado(request)` → `obtenerUsuarioAdmin(uid, email)` →
exigir `esSuperAdmin` **o** módulo `almacen`/`compras` → `params` es Promise
(Next 16) → llama la Tarea 4 → responde `{ estadoRecepcion, entradaId }`.
Errores: 401/403/404/409/500 con mensaje claro, nunca stack al cliente.

`lib/services/recepcion-almacen.ts`: cliente con `getIdToken()` en
`Authorization: Bearer`.

*Verificación:* `tests/recibir-orden-route.test.ts` (sin token → 401; sin módulo → 403; doble llamada → 409). Manual en `localhost` — el service account local existe, así que el Admin SDK sí corre en dev.

### Fase 3 — UI

#### Tarea 6 — `StepperAbastecimiento` + `ModalRecibirOrdenAlmacen`

Componentes en `components/abastecimiento/`, primitivas de `components/ui/`,
tokens de `smv-frontend-design`. Estados de carga/error con banner y reintento
(nunca romper la vista). El stepper recibe los pasos ya derivados por props.

#### Tarea 7 — Enganche en pantallas

- `app/ordenes/OrdenesList.tsx`: columna de stepper + acción "Recibir en Almacén" cuando `estado === "aprobada"` y `estadoRecepcion !== "recibida"`.
- `app/almacen/` nuevo `OrdenesPorRecibir.tsx` + tab en `page.tsx`.
- `RequisicionesList.tsx` y `PedidosAlmacenView.tsx`: stepper (los botones "Comprar" reutilizan el patrón `?pedidoId=` ya existente, extendido a `?requisicionId=`).

*Verificación:* `npm run lint`, `npx tsc --noEmit`, `npm run build`, recorrido manual del camino completo.

#### Tarea 8 — Drawer de pendientes + banner de endmills

- `DrawerPendientesAbastecimiento` en `/nueva-compra` y `/compras-odoo`, alimentado por `listarPendientesAbastecimiento()` (consultas acotadas, **nunca** `listarOrdenes()` completo).
- Banner de stock crítico en `InventarioEndmills.tsx` que llama a
  `reordenarMedidasEndmills()` — la función que **ya existe** — en vez de crear un camino nuevo.

### Fase 4 — Deuda registrada (no se implementa en v1)

#### Tarea 9 — Documentar, no construir

Anotar en `PROJECT.md`:

1. `RequisicionSchema` no tiene uid de solicitante ⇒ no hay aviso dirigido. Agregar `solicitanteUid` requiere migración de históricos: decisión aparte.
2. Recepción parcial (`estadoRecepcion: "parcial"`) queda en el schema pero sin UI en v1.
3. Vincular una orden a un pedido de endmills es v2, y debe pasar por `registrarRecepcionPedidoEndmills`, nunca por esta cascada.

---

## Plan de verificación

```bash
npx tsc --noEmit
npm run lint
npm test
npx vitest run tests/abastecimiento.test.ts tests/recibir-orden-route.test.ts
npx firebase-tools emulators:exec --only firestore "npm run test:emulator"
npm run build
```

(borrar `firestore-debug.log` que deja el emulador).

**Manual end-to-end (contra `smv-brain-dev`):**

1. Crear un pedido en `/pedidos-almacen` con un usuario no-admin.
2. `/nueva-compra` → drawer de pendientes → importar → guardar la orden.
3. Confirmar `ordenIdVinculada` en el pedido y el stepper en paso 2.
4. Entrar con un usuario **solo módulo `almacen`** y apretar "Recibir en Almacén" — este es el caso que el plan original no soportaba.
5. Validar: entrada creada en `/almacen`, orden en `estadoRecepcion: "recibida"`, stepper en paso 3, campana del solicitante con el aviso.
6. Repetir el paso 4 (debe responder 409 sin duplicar la entrada).

**Deploy (solo tras aprobación):** `firestore:rules` primero, luego
`npm run deploy:hosting`. Nunca `firebase deploy --only functions --force`.

---

## Criterios de aceptación (checklist de revisión)

Esta sección existe para que la implementación se pueda autoevaluar antes de
pasar a revisión. Cada punto es verificable con un comando o un grep, no con
criterio subjetivo. **Un "no" en cualquiera de los cinco primeros es rechazo,
no observación** — son los que corrompen datos o rompen el flujo en producción.

### Bloqueantes

1. **La cascada no corre en el cliente.**
   `grep -rn "firebase/firestore" lib/abastecimiento-server.ts` no devuelve nada,
   y `lib/abastecimiento.ts` no importa Firestore (ni cliente ni admin).
   Existe `app/api/ordenes/[id]/recibir/route.ts`. Si la recepción quedó como
   `runTransaction` del SDK cliente, el almacenista no puede usarla: rechazo.

2. **Nadie escribe `stockActual` fuera de endmills.**
   `grep -rn "endmills-medidas\|stockActual" lib/abastecimiento*.ts app/api/ordenes/`
   no devuelve nada. `registrarRecepcionPedidoEndmills` sigue siendo el único
   dueño del stock.

3. **No aparece `estadoEntrega` en ningún lado.**
   `grep -rn "estadoEntrega" lib/ app/ firestore.rules` no devuelve nada.
   (Venía del plan original; si se re-alimenta ese texto a un agente, tiende a
   volver a colarse.)

4. **`params` se espera con `await`** en el Route Handler — Next 16, no la firma
   síncrona vieja. Lo caza `npx tsc --noEmit`, pero se revisa a ojo también.

5. **Idempotencia real:** segunda llamada al endpoint devuelve 409 y **no** crea
   una segunda entrada de almacén. Se prueba, no se asume.

### Correctitud

6. La consulta inversa a `pedidos-almacen` ocurre **antes** del `batch()`, nunca
   dentro (un batch de Firestore no lee).
7. La notificación y la auditoría se emiten **después** del `commit()`, y su
   fallo no revierte la recepción ni devuelve 500.
8. `firestore.rules` incluye la validación de `estadoRecepcion` y el tipo de
   notificación nuevo. **Ojo:** omitirlo no rompe nada visible — la escritura
   pasa igual porque `ordenValida` no es `hasOnly`. Es un fallo silencioso; hay
   que verificarlo leyendo el archivo, no probando la app.
9. `lib/notificaciones.ts` tiene la entrada nueva en `TITULOS` (esto sí lo caza
   el compilador).
10. El drawer de pendientes usa consultas acotadas. `grep -rn "listarOrdenes()"`
    en los componentes nuevos no devuelve nada — el historial completo no se
    monta en pantalla (norma de AGENTS.md).

### Calidad (norma del repo)

11. Cero `any`, cero `@ts-ignore`, cero stubs o `// resto del código aquí`.
12. Ningún componente de UI importa Firestore directo.
13. Pasan: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`, y las
    reglas contra el emulador.
14. `firestore-debug.log` borrado si corrió el emulador.

### Cómo entregar para revisión

Por fases, no todo junto. **Fases 1 y 2 (schemas + reglas + server) primero** —
ahí está todo el riesgo real. La Fase 3 es UI y se revisa rápido. Con
`git diff` sobre la rama basta; no hace falta describir los cambios.
