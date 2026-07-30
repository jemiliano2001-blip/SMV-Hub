# Diseño: Solicitud de eliminación con motivo (Control de Baños)

**Fecha:** 2026-07-30
**Módulo:** `/banos` (extensión) + `/notificaciones` (extensión)
**Estado:** aprobado en brainstorming; pendiente de plan de implementación
**Relacionado:** `docs/superpowers/specs/2026-07-30-notificaciones-taller-design.md` (infraestructura de notificaciones que este diseño reutiliza)

---

## Problema

Hoy el botón de borrar en `/banos` (tabla "Completados hoy") solo lo ve el súper admin
(`puedeEliminar = esSuperAdmin || authBypassActivo()`, `app/banos/RegistroBanoList.tsx:34`).
Esto evita que almacén borre en masa por accidente, pero cuando alguien de almacén comete un
error real de captura (registro accidental, baño equivocado, operador equivocado, etc.) no
tiene forma de corregirlo — depende de pedirle al súper admin por fuera del sistema.

## Objetivo

1. Permitir que la persona que **creó** un registro de baño pida su eliminación indicando un
   motivo, sin poder borrar directamente.
2. Auto-resolver automáticamente los casos obviamente de bajo riesgo mediante **reglas fijas
   y deterministas** (no un modelo de IA real) para no generarle trabajo al súper admin en
   casos evidentes.
3. Enrutar todo lo demás a una bandeja de revisión que el súper admin ya usa hoy:
   `/notificaciones`.
4. Mantener trazabilidad completa (auditoría) de quién pidió qué, por qué, y quién/qué lo
   resolvió.

## Decisiones (brainstorming)

| Tema | Decisión |
|---|---|
| Quién puede solicitar | Solo quien creó el registro (nuevo campo `creadoPorUid`) |
| Motivos | Set detallado de 6: accidental, baño/área equivocada, operador equivocado, hora capturada mal, duplicado, otro (nota obligatoria) |
| Resolución | Híbrida: reglas fijas auto-aprueban casos obvios; el resto va a bandeja del súper admin |
| Motor de reglas | Deterministas en código, sin llamada a un LLM (transparente, gratis, auditable) |
| Bandeja de revisión | Integrada a `/notificaciones` (campanita + página), con botones Aprobar/Rechazar solo para súper admin |
| Estado visual en `/banos` | El registro se queda visible en la tabla con badge "Pendiente de revisión"; no se puede duplicar la solicitud mientras esté activa |
| Ejecución del borrado auto-aprobado | Route Handler + Firebase Admin SDK (server-side), no Cloud Function ni reglas de Firestore complejas |

## Arquitectura

### Datos

**Extensión de `RegistroBanoSchema`** (`lib/schemas.ts`), campos opcionales y retrocompatibles:

| Campo | Tipo | Notas |
|---|---|---|
| `creadoPorUid` | `string?` | uid de quien capturó el registro; ausente en registros previos a este feature |
| `creadoPorNombre` | `string?` | displayName/email, para mostrar en UI sin resolver el uid |
| `solicitudBorradoEstado` | `"pendiente"?` | presente únicamente mientras hay una solicitud activa sin resolver; se limpia (se borra el campo) al resolver |

Los registros sin `creadoPorUid` (capturados antes de este cambio) no pueden generar una
solicitud — solo el súper admin puede borrarlos directo, como ya funciona hoy. Esto es una
limitación aceptada, no un bug: no hay forma de reconstruir retroactivamente quién los creó.

**Nueva colección** `solicitudes_borrado_banos/{id}`:

| Campo | Tipo | Notas |
|---|---|---|
| `registroId` | string | id del doc en `registros-bano` |
| `registroResumen` | object | snapshot `{ operador, bano, fecha, horaEntrada, horaLlegada, tiempoMinutos }` — sobrevive aunque el registro original se borre |
| `motivo` | enum | `"accidental" \| "bano_equivocado" \| "operador_equivocado" \| "hora_mal_capturada" \| "duplicado" \| "otro"` |
| `nota` | `string?` | obligatoria si `motivo === "otro"` |
| `solicitadoPorUid` | string | |
| `solicitadoPorNombre` | string | |
| `estado` | enum | `"pendiente" \| "auto_aprobada" \| "aprobada" \| "rechazada"` |
| `reglaAutoAplicada` | `string?` | `"duplicado_10min"` \| `"arrepentimiento_2min"`, solo si `estado` es `auto_aprobada` |
| `resueltoPorUid` / `resueltoPorNombre` | `string?` | quien resolvió manualmente (vacío si fue auto-aprobada) |
| `creadoEn` / `actualizadoEn` | Date | |

Schema Zod en `lib/schemas.ts`. Lógica pura (reglas + validaciones) en
`lib/banos-solicitudes-borrado.ts`, testeable sin Firestore real. CRUD/Admin SDK en el Route
Handler.

### Reglas fijas de auto-aprobación

Evaluadas en orden al crear la solicitud; la primera que aplique gana:

1. **`duplicado_10min`** — existe otro registro del mismo `operador` + mismo `bano` + misma
   `fecha`, con `horaEntrada` dentro de ±10 minutos del registro a borrar.
2. **`arrepentimiento_2min`** — la solicitud se crea dentro de los 2 minutos posteriores al
   `creadoEn` del registro (sin importar el motivo elegido).
3. Si ninguna aplica → `estado: "pendiente"`, va a la bandeja del súper admin.

### Endpoints

**`POST /api/banos/solicitudes-borrado`** (crear solicitud)
- Verifica token + usuario activo vía `lib/api-auth.ts`.
- Valida que `solicitadoPorUid` (del token) coincide con `registro.creadoPorUid`, o que el
  usuario es súper admin.
- Rechaza si ya existe una solicitud `pendiente` para ese `registroId`.
- Corre las reglas fijas (`lib/banos-solicitudes-borrado.ts`).
- Si auto-aprueba: borra el registro (Admin SDK), marca `estado: "auto_aprobada"`, registra
  auditoría (`registrarAuditoria`, acción `BORRAR`), emite notificación `banos_solicitud_creada`
  informativa (sin botones de acción).
- Si no: crea la solicitud con `estado: "pendiente"`, marca `solicitudBorradoEstado: "pendiente"`
  en el registro, emite notificación `banos_solicitud_creada` accionable.

**`POST /api/banos/solicitudes-borrado/[id]/resolver`** (aprobar/rechazar)
- Exige súper admin explícitamente (403 si no) — no depende únicamente de reglas de Firestore.
- Body: `{ decision: "aprobar" | "rechazar" }`.
- Aprobar: borra el registro (Admin SDK), marca `estado: "aprobada"`, `resueltoPorUid/Nombre`,
  registra auditoría.
- Rechazar: marca `estado: "rechazada"`, `resueltoPorUid/Nombre`, limpia
  `solicitudBorradoEstado` del registro.
- En ambos casos emite notificación `banos_solicitud_resuelta` (broadcast, visible también para
  quien la pidió, ya que almacén tiene acceso a `/notificaciones` vía `PLANTILLA_ALMACEN`).

### UI — `/banos` (`RegistroBanoList.tsx`)

- En la fila de "Completados hoy": si `registro.creadoPorUid === uid` y el usuario no es súper
  admin → botón **"Solicitar eliminación"** en vez del ícono de basura (el súper admin conserva
  su botón de borrado directo sin cambios).
- Si `solicitudBorradoEstado === "pendiente"` → badge ámbar "Pendiente de revisión"; el botón de
  solicitar se deshabilita (no se permite una segunda solicitud activa sobre el mismo registro).
- Modal de solicitud: pills de motivo (mismo estilo visual que los pills de "Baño / Área" ya
  existentes) + textarea de nota (obligatoria solo si el motivo es "Otro") + botón "Enviar
  solicitud".
- Feedback tras enviar: toast distinto según resultado — auto-aprobada ("Se borró
  automáticamente: duplicado detectado" / "arrepentimiento") vs. pendiente ("Solicitud enviada,
  en revisión").

### UI — `/notificaciones`

- Nuevos tipos añadidos a `TITULOS` (`lib/notificaciones.ts`): `banos_solicitud_creada`,
  `banos_solicitud_resuelta`.
- Nuevo filtro de origen "Baños" en `NotificacionesView.tsx`, junto a "Pedidos"/"Requisiciones".
- Card de una solicitud `pendiente`: operador, baño, fecha/hora, motivo, nota, quién la pidió, y
  — solo si `esSuperAdmin` — botones **Aprobar** / **Rechazar** que llaman al endpoint de
  resolución. El resto de usuarios ve la misma card sin botones (informativa).
- Las cards con acción pendiente cuentan igual que cualquier no-leída para el badge de la
  campanita.

### Permisos

- `firestore.rules`: `registros-bano` sigue permitiendo `delete` solo a súper admin, sin
  cambios — el Admin SDK del backend no pasa por reglas de cliente.
- `solicitudes_borrado_banos`: `create` permitido a usuario activo con módulo `banos` (más
  validación server-side de que es su propio registro); ninguna escritura de `estado` /
  resolución permitida desde el cliente — solo vía Route Handler con Admin SDK.
- Auditoría (`registrarAuditoria`) se dispara igual que el borrado manual de hoy, tanto para
  auto-aprobación como para aprobación manual.

## Pruebas

- `lib/banos-solicitudes-borrado.ts`: reglas fijas puras — casos límite de la ventana de ±10 min
  y de los 2 min, sin Firestore real.
- Route Handlers (`app/api/banos/solicitudes-borrado/*`): mock de `firebase-admin`; casos
  auto-aprobación, pendiente, rechazo por no ser el creador ni súper admin, doble solicitud
  sobre el mismo registro.
- Schema: `RegistroBanoSchema` extendido no rompe registros sin los campos nuevos
  (retrocompatibilidad).
- Sin E2E nuevo en v1 (se apoya en `e2e/` existente solo si se decide más adelante).

## Fuera de alcance v1

- Generalizar el patrón de "solicitud de borrado" a otros módulos (órdenes, almacén
  entradas/salidas, etc.) — esto es específico de `/banos`.
- Revertir una solicitud ya resuelta.
- Editar el motivo/nota de una solicitud ya enviada (si se equivocó, que mande otra tras el
  rechazo, o el súper admin la rechaza y explica por qué).
- Notificaciones push/email/WhatsApp — se apoya en el mismo alcance que
  `2026-07-30-notificaciones-taller-design.md`.
- Un LLM real evaluando las solicitudes — deliberadamente se usan reglas deterministas.

## Criterios de éxito

1. Almacén ve "Solicitar eliminación" solo en registros que él mismo creó, nunca el ícono de
   borrar directo.
2. Un duplicado evidente (mismo operador/baño/día, ±10 min) se borra solo, sin intervención del
   súper admin, y queda auditado.
3. Una solicitud pedida a los pocos segundos de crear el registro se auto-aprueba.
4. Cualquier otro caso llega a `/notificaciones` con motivo y nota visibles, y solo el súper
   admin puede aprobar/rechazar.
5. Rechazar una solicitud no borra nada y el registro pierde el badge "Pendiente de revisión".
6. No se puede crear una segunda solicitud activa sobre el mismo registro mientras la primera
   sigue pendiente.
