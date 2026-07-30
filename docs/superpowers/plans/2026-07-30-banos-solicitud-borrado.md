# Solicitud de eliminación con motivo (Control de Baños) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the person who captured a `/banos` record request its deletion with a reason, auto-resolving obvious low-risk cases with deterministic rules and routing everything else to the super admin's existing `/notificaciones` inbox.

**Architecture:** A new Route Handler pair (`app/api/banos/solicitudes-borrado/*`) backed by the Firebase Admin SDK owns every state transition (create, auto-approve, manual approve/reject) so the actual delete never depends on the requester's own Firestore permissions. A small pure module (`lib/banos-solicitudes-borrado.ts`) holds the two deterministic auto-approval rules so they're testable without Firestore. The existing broadcast notifications system (`lib/notificaciones.ts`, `/notificaciones`) gets two new event types and, for super admins only, inline Aprobar/Rechazar buttons driven by a live subscription to pending requests.

**Tech Stack:** Next.js 16 Route Handlers, Firebase Admin SDK (Firestore), Firebase client SDK (Firestore, Auth), Zod, Vitest.

## Global Constraints

- Tipado estricto: prohibido `any` y `@ts-ignore` (CLAUDE.md).
- Toda entrada de formulario/API pasa por un schema de Zod antes de tocar Firestore (CLAUDE.md).
- Los componentes de UI no importan Firestore directamente; la lógica de datos vive en `lib/` (CLAUDE.md).
- Un fallo de red/sistema nunca rompe la UI visualmente — banners con reintento, nunca una pantalla en blanco (CLAUDE.md).
- No borres funciones/imports/variables existentes salvo que estén obsoletos; entrega archivos completos, sin `// resto del código aquí` (CLAUDE.md).
- `params` de Route Handlers dinámicos son `Promise` en Next.js 16 — siempre `await params` (CLAUDE.md).
- Timestamps en Firestore en UTC; formateo a hora local solo en cliente (CLAUDE.md).
- Solo quien creó un registro de baño (`creadoPorUid`) puede solicitar su eliminación; el súper admin conserva el borrado directo sin cambios (spec).
- El motor de "IA" son reglas deterministas en código, sin llamada a un LLM (spec).
- Todo borrado disparado por este feature (auto-aprobado o manual) pasa por el Route Handler con Admin SDK, nunca por una escritura directa del cliente (spec).

---

### Task 1: Esquemas Zod — solicitudes de borrado + extensión de notificaciones

**Files:**
- Modify: `lib/schemas.ts`
- Test: `tests/schemas-banos-solicitud-borrado.test.ts`

**Interfaces:**
- Produces: `RegistroBanoSchema` (extendido con `creadoPorUid?`, `creadoPorNombre?`, `solicitudBorradoEstado?`), `MotivoSolicitudBorradoBanoSchema`/`MotivoSolicitudBorradoBano`, `EstadoSolicitudBorradoBanoSchema`/`EstadoSolicitudBorradoBano`, `ReglaAutoAprobacionSchema`/`ReglaAutoAprobacion`, `RegistroResumenSolicitudSchema`/`RegistroResumenSolicitud`, `SolicitudBorradoBanoSchema`/`SolicitudBorradoBano`, `CrearSolicitudBorradoBanoInputSchema`/`CrearSolicitudBorradoBanoInput`. `TipoNotificacionSchema` gana `"banos_solicitud_creada"` y `"banos_solicitud_resuelta"`; `OrigenModuloNotificacionSchema` gana `"banos"`.

- [ ] **Step 1: Escribe el test que falla**

Crea `tests/schemas-banos-solicitud-borrado.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
  RegistroBanoSchema,
  CrearSolicitudBorradoBanoInputSchema,
  SolicitudBorradoBanoSchema,
  TipoNotificacionSchema,
  OrigenModuloNotificacionSchema,
} from "@/lib/schemas"

describe("RegistroBanoSchema retrocompatibilidad", () => {
  it("acepta un registro viejo sin los campos nuevos", () => {
    const registroViejo = {
      id: "r1",
      operador: "Juan Pérez",
      bano: "Baño #1" as const,
      horaEntrada: "10:00",
      horaLlegada: "10:07",
      fecha: "2026-07-30",
      tiempoMinutos: 7,
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    }
    expect(() => RegistroBanoSchema.parse(registroViejo)).not.toThrow()
  })

  it("acepta los campos nuevos cuando están presentes", () => {
    const registroNuevo = {
      id: "r2",
      operador: "Ana López",
      bano: "CNC" as const,
      horaEntrada: "11:00",
      horaLlegada: null,
      fecha: "2026-07-30",
      tiempoMinutos: null,
      creadoEn: new Date(),
      actualizadoEn: new Date(),
      creadoPorUid: "uid-1",
      creadoPorNombre: "Ana López",
      solicitudBorradoEstado: "pendiente" as const,
    }
    const parsed = RegistroBanoSchema.parse(registroNuevo)
    expect(parsed.solicitudBorradoEstado).toBe("pendiente")
  })
})

describe("CrearSolicitudBorradoBanoInputSchema", () => {
  it("acepta un motivo distinto de 'otro' sin nota", () => {
    expect(() =>
      CrearSolicitudBorradoBanoInputSchema.parse({ registroId: "r1", motivo: "duplicado" })
    ).not.toThrow()
  })

  it("rechaza motivo 'otro' sin nota", () => {
    expect(() =>
      CrearSolicitudBorradoBanoInputSchema.parse({ registroId: "r1", motivo: "otro" })
    ).toThrow()
  })

  it("acepta motivo 'otro' con nota", () => {
    expect(() =>
      CrearSolicitudBorradoBanoInputSchema.parse({
        registroId: "r1",
        motivo: "otro",
        nota: "Se registró en el baño equivocado por error de dedo",
      })
    ).not.toThrow()
  })
})

describe("SolicitudBorradoBanoSchema", () => {
  it("valida un documento completo", () => {
    const doc = {
      id: "s1",
      registroId: "r1",
      registroResumen: {
        operador: "Juan Pérez",
        bano: "Baño #1" as const,
        fecha: "2026-07-30",
        horaEntrada: "10:00",
        horaLlegada: "10:07",
        tiempoMinutos: 7,
      },
      motivo: "duplicado" as const,
      solicitadoPorUid: "uid-1",
      solicitadoPorNombre: "Ana López",
      estado: "pendiente" as const,
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    }
    expect(SolicitudBorradoBanoSchema.parse(doc).estado).toBe("pendiente")
  })
})

describe("Notificaciones extendidas", () => {
  it("acepta los tipos y origen de baños", () => {
    expect(TipoNotificacionSchema.parse("banos_solicitud_creada")).toBe("banos_solicitud_creada")
    expect(TipoNotificacionSchema.parse("banos_solicitud_resuelta")).toBe("banos_solicitud_resuelta")
    expect(OrigenModuloNotificacionSchema.parse("banos")).toBe("banos")
  })
})
```

- [ ] **Step 2: Corre el test y verifica que falla**

Run: `npx vitest run tests/schemas-banos-solicitud-borrado.test.ts`
Expected: FAIL — los símbolos nuevos no existen todavía en `lib/schemas.ts`.

- [ ] **Step 3: Implementa los schemas**

En `lib/schemas.ts`, localiza `RegistroBanoSchema` (cerca de la línea 509) y reemplázalo por:

```ts
export const RegistroBanoSchema = z.object({
  id: z.string(),
  operador: z.string(),
  bano: BanoSchema,
  horaEntrada: z.string(),
  horaLlegada: z.string().nullable(),
  fecha: z.string(),
  tiempoMinutos: z.number().nullable(),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
  creadoPorUid: z.string().optional(),
  creadoPorNombre: z.string().optional(),
  solicitudBorradoEstado: z.literal("pendiente").optional(),
})
export type RegistroBano = z.infer<typeof RegistroBanoSchema>

// ── Solicitudes de eliminación de registros de baño ───────────────────────────

export const MotivoSolicitudBorradoBanoSchema = z.enum([
  "accidental",
  "bano_equivocado",
  "operador_equivocado",
  "hora_mal_capturada",
  "duplicado",
  "otro",
])
export type MotivoSolicitudBorradoBano = z.infer<typeof MotivoSolicitudBorradoBanoSchema>

export const EstadoSolicitudBorradoBanoSchema = z.enum([
  "pendiente",
  "auto_aprobada",
  "aprobada",
  "rechazada",
])
export type EstadoSolicitudBorradoBano = z.infer<typeof EstadoSolicitudBorradoBanoSchema>

export const ReglaAutoAprobacionSchema = z.enum(["duplicado_10min", "arrepentimiento_2min"])
export type ReglaAutoAprobacion = z.infer<typeof ReglaAutoAprobacionSchema>

export const RegistroResumenSolicitudSchema = z.object({
  operador: z.string(),
  bano: BanoSchema,
  fecha: z.string(),
  horaEntrada: z.string(),
  horaLlegada: z.string().nullable(),
  tiempoMinutos: z.number().nullable(),
})
export type RegistroResumenSolicitud = z.infer<typeof RegistroResumenSolicitudSchema>

export const SolicitudBorradoBanoSchema = z.object({
  id: z.string(),
  registroId: z.string(),
  registroResumen: RegistroResumenSolicitudSchema,
  motivo: MotivoSolicitudBorradoBanoSchema,
  nota: z.string().optional(),
  solicitadoPorUid: z.string(),
  solicitadoPorNombre: z.string(),
  estado: EstadoSolicitudBorradoBanoSchema,
  reglaAutoAplicada: ReglaAutoAprobacionSchema.optional(),
  resueltoPorUid: z.string().optional(),
  resueltoPorNombre: z.string().optional(),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
})
export type SolicitudBorradoBano = z.infer<typeof SolicitudBorradoBanoSchema>

export const CrearSolicitudBorradoBanoInputSchema = z
  .object({
    registroId: z.string().min(1),
    motivo: MotivoSolicitudBorradoBanoSchema,
    nota: z.string().trim().max(280).optional(),
  })
  .refine((d) => d.motivo !== "otro" || (d.nota !== undefined && d.nota.length > 0), {
    message: "La nota es obligatoria cuando el motivo es 'Otro'",
    path: ["nota"],
  })
export type CrearSolicitudBorradoBanoInput = z.infer<typeof CrearSolicitudBorradoBanoInputSchema>
```

Luego, en la sección de notificaciones (cerca de la línea 463), reemplaza:

```ts
export const TipoNotificacionSchema = z.enum([
  "pedido_almacen_creado",
  "pedido_almacen_estado",
  "requisicion_creada",
  "requisicion_estado",
])
export type TipoNotificacion = z.infer<typeof TipoNotificacionSchema>

export const OrigenModuloNotificacionSchema = z.enum(["pedidos-almacen", "requisiciones"])
export type OrigenModuloNotificacion = z.infer<typeof OrigenModuloNotificacionSchema>
```

por:

```ts
export const TipoNotificacionSchema = z.enum([
  "pedido_almacen_creado",
  "pedido_almacen_estado",
  "requisicion_creada",
  "requisicion_estado",
  "banos_solicitud_creada",
  "banos_solicitud_resuelta",
])
export type TipoNotificacion = z.infer<typeof TipoNotificacionSchema>

export const OrigenModuloNotificacionSchema = z.enum(["pedidos-almacen", "requisiciones", "banos"])
export type OrigenModuloNotificacion = z.infer<typeof OrigenModuloNotificacionSchema>
```

- [ ] **Step 4: Corre el test y verifica que pasa**

Run: `npx vitest run tests/schemas-banos-solicitud-borrado.test.ts`
Expected: PASS

- [ ] **Step 5: Verifica que no rompiste nada existente**

Run: `npx vitest run tests/notificaciones.test.ts tests/banos-captura.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/schemas.ts tests/schemas-banos-solicitud-borrado.test.ts
git commit -m "feat: agrega schemas de solicitud de borrado de baños"
```

---

### Task 2: Reglas fijas de auto-aprobación (lógica pura)

**Files:**
- Create: `lib/banos-solicitudes-borrado.ts`
- Test: `tests/banos-solicitudes-borrado.test.ts`

**Interfaces:**
- Consumes: `RegistroBano`, `RegistroResumenSolicitud`, `ReglaAutoAprobacion`, `MotivoSolicitudBorradoBano` de `@/lib/schemas` (Task 1).
- Produces: `MOTIVOS_SOLICITUD_BORRADO_BANO: { value: MotivoSolicitudBorradoBano; label: string }[]`, `evaluarReglaAutoAprobacion(registro: RegistroBano, registrosRelacionados: readonly RegistroBano[], solicitudCreadaEn: Date): ReglaAutoAprobacion | null`, `construirResumenRegistro(registro: RegistroBano): RegistroResumenSolicitud`.

- [ ] **Step 1: Escribe el test que falla**

Crea `tests/banos-solicitudes-borrado.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
  MOTIVOS_SOLICITUD_BORRADO_BANO,
  evaluarReglaAutoAprobacion,
  construirResumenRegistro,
} from "@/lib/banos-solicitudes-borrado"
import type { RegistroBano } from "@/lib/schemas"

function registro(overrides: Partial<RegistroBano> = {}): RegistroBano {
  return {
    id: "r1",
    operador: "Juan Pérez",
    bano: "Baño #1",
    horaEntrada: "10:00",
    horaLlegada: "10:07",
    fecha: "2026-07-30",
    tiempoMinutos: 7,
    creadoEn: new Date("2026-07-30T10:00:00Z"),
    actualizadoEn: new Date("2026-07-30T10:07:00Z"),
    ...overrides,
  }
}

describe("MOTIVOS_SOLICITUD_BORRADO_BANO", () => {
  it("trae las 6 opciones", () => {
    expect(MOTIVOS_SOLICITUD_BORRADO_BANO).toHaveLength(6)
    expect(MOTIVOS_SOLICITUD_BORRADO_BANO.map((m) => m.value)).toContain("otro")
  })
})

describe("evaluarReglaAutoAprobacion — duplicado_10min", () => {
  it("auto-aprueba si hay otro registro del mismo operador/baño/día a 10 min o menos", () => {
    const objetivo = registro({ id: "r1", horaEntrada: "10:00" })
    const relacionado = registro({ id: "r2", horaEntrada: "10:10" })
    const resultado = evaluarReglaAutoAprobacion(
      objetivo,
      [objetivo, relacionado],
      new Date("2026-07-30T14:00:00Z")
    )
    expect(resultado).toBe("duplicado_10min")
  })

  it("no aplica si el otro registro está a más de 10 min", () => {
    const objetivo = registro({ id: "r1", horaEntrada: "10:00" })
    const lejano = registro({ id: "r2", horaEntrada: "10:11" })
    const resultado = evaluarReglaAutoAprobacion(
      objetivo,
      [objetivo, lejano],
      new Date("2026-07-30T14:00:00Z")
    )
    expect(resultado).toBeNull()
  })

  it("ignora el propio registro al buscar duplicados", () => {
    const objetivo = registro({ id: "r1", horaEntrada: "10:00" })
    const resultado = evaluarReglaAutoAprobacion(
      objetivo,
      [objetivo],
      new Date("2026-07-30T14:00:00Z")
    )
    expect(resultado).toBeNull()
  })
})

describe("evaluarReglaAutoAprobacion — arrepentimiento_2min", () => {
  it("auto-aprueba si la solicitud se crea dentro de los 2 minutos de creadoEn", () => {
    const objetivo = registro({ creadoEn: new Date("2026-07-30T10:00:00Z") })
    const resultado = evaluarReglaAutoAprobacion(
      objetivo,
      [objetivo],
      new Date("2026-07-30T10:01:30Z")
    )
    expect(resultado).toBe("arrepentimiento_2min")
  })

  it("no aplica si pasaron más de 2 minutos y no hay duplicado", () => {
    const objetivo = registro({ creadoEn: new Date("2026-07-30T10:00:00Z") })
    const resultado = evaluarReglaAutoAprobacion(
      objetivo,
      [objetivo],
      new Date("2026-07-30T10:05:00Z")
    )
    expect(resultado).toBeNull()
  })
})

describe("construirResumenRegistro", () => {
  it("copia solo los campos relevantes para el snapshot", () => {
    const r = registro()
    expect(construirResumenRegistro(r)).toEqual({
      operador: "Juan Pérez",
      bano: "Baño #1",
      fecha: "2026-07-30",
      horaEntrada: "10:00",
      horaLlegada: "10:07",
      tiempoMinutos: 7,
    })
  })
})
```

- [ ] **Step 2: Corre el test y verifica que falla**

Run: `npx vitest run tests/banos-solicitudes-borrado.test.ts`
Expected: FAIL — `lib/banos-solicitudes-borrado.ts` no existe.

- [ ] **Step 3: Implementa la lógica pura**

Crea `lib/banos-solicitudes-borrado.ts`:

```ts
import type { MotivoSolicitudBorradoBano, ReglaAutoAprobacion, RegistroBano, RegistroResumenSolicitud } from "@/lib/schemas"

export const MOTIVOS_SOLICITUD_BORRADO_BANO: { value: MotivoSolicitudBorradoBano; label: string }[] = [
  { value: "accidental", label: "Agregado por accidente" },
  { value: "bano_equivocado", label: "Baño/área equivocada" },
  { value: "operador_equivocado", label: "Operador equivocado" },
  { value: "hora_mal_capturada", label: "Hora capturada mal" },
  { value: "duplicado", label: "Registro duplicado" },
  { value: "otro", label: "Otro" },
]

const VENTANA_DUPLICADO_MIN = 10
const VENTANA_ARREPENTIMIENTO_MIN = 2

function minutosEntreHoras(horaA: string, horaB: string): number {
  const [hA, mA] = horaA.split(":").map(Number)
  const [hB, mB] = horaB.split(":").map(Number)
  return Math.abs(hA * 60 + mA - (hB * 60 + mB))
}

/**
 * Reglas fijas y deterministas — no hay llamada a un modelo de IA. La primera
 * regla que aplique gana; si ninguna aplica, la solicitud queda pendiente.
 */
export function evaluarReglaAutoAprobacion(
  registro: RegistroBano,
  registrosRelacionados: readonly RegistroBano[],
  solicitudCreadaEn: Date
): ReglaAutoAprobacion | null {
  const hayDuplicadoCercano = registrosRelacionados.some(
    (otro) =>
      otro.id !== registro.id &&
      minutosEntreHoras(otro.horaEntrada, registro.horaEntrada) <= VENTANA_DUPLICADO_MIN
  )
  if (hayDuplicadoCercano) return "duplicado_10min"

  const minutosDesdeCreacion = (solicitudCreadaEn.getTime() - registro.creadoEn.getTime()) / 60000
  if (minutosDesdeCreacion <= VENTANA_ARREPENTIMIENTO_MIN) return "arrepentimiento_2min"

  return null
}

export function construirResumenRegistro(registro: RegistroBano): RegistroResumenSolicitud {
  return {
    operador: registro.operador,
    bano: registro.bano,
    fecha: registro.fecha,
    horaEntrada: registro.horaEntrada,
    horaLlegada: registro.horaLlegada,
    tiempoMinutos: registro.tiempoMinutos,
  }
}
```

- [ ] **Step 4: Corre el test y verifica que pasa**

Run: `npx vitest run tests/banos-solicitudes-borrado.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/banos-solicitudes-borrado.ts tests/banos-solicitudes-borrado.test.ts
git commit -m "feat: reglas fijas de auto-aprobación para borrado de baños"
```

---

### Task 3: Emisor de notificaciones server-side + títulos nuevos

**Files:**
- Create: `lib/notificaciones-server.ts`
- Modify: `lib/notificaciones.ts:62-67` (mapa `TITULOS`)
- Test: `tests/notificaciones-server.test.ts`
- Test: modify `tests/notificaciones.test.ts`

**Interfaces:**
- Consumes: `NuevaNotificacion` de `@/lib/schemas` (Task 1); `adminDb` de `@/lib/firebase-admin`.
- Produces: `emitirNotificacionServer(payload: NuevaNotificacion): Promise<string | null>`.

- [ ] **Step 1: Escribe el test que falla (emisor server-side)**

Crea `tests/notificaciones-server.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockAdd } = vi.hoisted(() => ({ mockAdd: vi.fn() }))

vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn(() => ({ add: mockAdd })),
  },
}))

import { emitirNotificacionServer } from "@/lib/notificaciones-server"

describe("emitirNotificacionServer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("agrega el documento con timestamps de servidor y devuelve el id", async () => {
    mockAdd.mockResolvedValueOnce({ id: "notif-1" })
    const id = await emitirNotificacionServer({
      tipo: "banos_solicitud_creada",
      titulo: "Solicitud de borrado de baño",
      cuerpo: "Juan Pérez · Baño #1 (2026-07-30) — motivo: duplicado",
      origenModulo: "banos",
      origenId: "solicitud-1",
      href: "/banos",
      creadoPorUid: "uid-1",
      creadoPorNombre: "Juan Pérez",
    })
    expect(id).toBe("notif-1")
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "banos_solicitud_creada", origenModulo: "banos" })
    )
  })

  it("no lanza si falla la escritura; devuelve null", async () => {
    mockAdd.mockRejectedValueOnce(new Error("network"))
    const id = await emitirNotificacionServer({
      tipo: "banos_solicitud_resuelta",
      titulo: "x",
      cuerpo: "y",
      origenModulo: "banos",
      origenId: "solicitud-1",
      href: "/banos",
      creadoPorUid: "uid-1",
      creadoPorNombre: "Juan Pérez",
    })
    expect(id).toBeNull()
  })
})
```

- [ ] **Step 2: Corre el test y verifica que falla**

Run: `npx vitest run tests/notificaciones-server.test.ts`
Expected: FAIL — `lib/notificaciones-server.ts` no existe.

- [ ] **Step 3: Implementa el emisor server-side**

Crea `lib/notificaciones-server.ts`:

```ts
import { FieldValue } from "firebase-admin/firestore"
import { adminDb } from "@/lib/firebase-admin"
import type { NuevaNotificacion } from "@/lib/schemas"

/**
 * Equivalente Admin SDK de `emitirNotificacion` (lib/notificaciones.ts) para
 * usarse desde Route Handlers, donde no hay sesión de cliente de Firestore.
 * Best-effort: un fallo aquí nunca debe tumbar el flujo que lo llama.
 */
export async function emitirNotificacionServer(payload: NuevaNotificacion): Promise<string | null> {
  try {
    const ref = await adminDb.collection("notificaciones").add({
      ...payload,
      creadoEn: FieldValue.serverTimestamp(),
      actualizadoEn: FieldValue.serverTimestamp(),
    })
    return ref.id
  } catch (error) {
    console.error("No se pudo emitir notificación desde el servidor:", error)
    return null
  }
}
```

- [ ] **Step 4: Corre el test y verifica que pasa**

Run: `npx vitest run tests/notificaciones-server.test.ts`
Expected: PASS

- [ ] **Step 5: Agrega los títulos nuevos (test primero)**

En `tests/notificaciones.test.ts`, agrega dentro del `describe("tituloParaTipo", ...)` existente:

```ts
  it("devuelve títulos legibles para los tipos de baños", () => {
    expect(tituloParaTipo("banos_solicitud_creada")).toBe("Solicitud de borrado de baño")
    expect(tituloParaTipo("banos_solicitud_resuelta")).toBe("Solicitud de borrado resuelta")
  })
```

Run: `npx vitest run tests/notificaciones.test.ts`
Expected: FAIL — `TITULOS` no tiene esas claves todavía.

- [ ] **Step 6: Extiende el mapa TITULOS**

En `lib/notificaciones.ts:62-67`, reemplaza:

```ts
const TITULOS: Record<TipoNotificacion, string> = {
  pedido_almacen_creado: "Nuevo pedido de almacén",
  pedido_almacen_estado: "Pedido de almacén actualizado",
  requisicion_creada: "Nueva requisición",
  requisicion_estado: "Requisición actualizada",
}
```

por:

```ts
const TITULOS: Record<TipoNotificacion, string> = {
  pedido_almacen_creado: "Nuevo pedido de almacén",
  pedido_almacen_estado: "Pedido de almacén actualizado",
  requisicion_creada: "Nueva requisición",
  requisicion_estado: "Requisición actualizada",
  banos_solicitud_creada: "Solicitud de borrado de baño",
  banos_solicitud_resuelta: "Solicitud de borrado resuelta",
}
```

- [ ] **Step 7: Corre ambos tests y verifica que pasan**

Run: `npx vitest run tests/notificaciones.test.ts tests/notificaciones-server.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add lib/notificaciones-server.ts lib/notificaciones.ts tests/notificaciones-server.test.ts tests/notificaciones.test.ts
git commit -m "feat: emisor de notificaciones server-side y títulos de baños"
```

---

### Task 4: `lib/banos.ts` — capturar creador y suscripción a solicitudes pendientes

**Files:**
- Modify: `lib/banos.ts`
- Test: `tests/banos.test.ts`

**Interfaces:**
- Consumes: `SolicitudBorradoBano` de `@/lib/schemas` (Task 1).
- Produces: `crearRegistroBano` ahora incluye `creadoPorUid`/`creadoPorNombre` en el payload guardado (misma firma pública); `suscribirSolicitudesBorradoBanosPendientes(onData: (solicitudes: SolicitudBorradoBano[]) => void, onError?: (err: Error) => void): () => void`.

- [ ] **Step 1: Escribe el test que falla**

Crea `tests/banos.test.ts`:

```ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/firebase", () => ({
  db: { type: "mocked-db" },
  getClienteAuth: vi.fn(() => ({
    currentUser: { uid: "uid-1", email: "ana@smv.com", displayName: "Ana López" },
  })),
}))

vi.mock("@/lib/auditoria", () => ({
  registrarAuditoria: vi.fn().mockResolvedValue(undefined),
}))

const { mockAddDoc, mockOnSnapshot, mockWhere, mockCollectionRef } = vi.hoisted(() => ({
  mockAddDoc: vi.fn().mockResolvedValue({ id: "nuevo-1" }),
  mockOnSnapshot: vi.fn(),
  mockWhere: vi.fn(),
  mockCollectionRef: { withConverter: vi.fn().mockReturnThis() },
}))

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => mockCollectionRef),
  doc: vi.fn(() => ({})),
  addDoc: mockAddDoc,
  deleteDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn((...args: unknown[]) => ({ type: "query", args })),
  orderBy: vi.fn((...args: unknown[]) => ({ type: "orderBy", args })),
  where: mockWhere.mockImplementation((...args: unknown[]) => ({ type: "where", args })),
  onSnapshot: mockOnSnapshot,
}))

import { crearRegistroBano, suscribirSolicitudesBorradoBanosPendientes } from "@/lib/banos"

describe("crearRegistroBano", () => {
  beforeEach(() => vi.clearAllMocks())

  it("incluye creadoPorUid y creadoPorNombre del usuario actual", async () => {
    await crearRegistroBano({
      operador: "Juan Pérez",
      bano: "Baño #1",
      horaEntrada: "10:00",
      horaLlegada: null,
      fecha: "2026-07-30",
      tiempoMinutos: null,
    })

    expect(mockAddDoc).toHaveBeenCalledWith(
      mockCollectionRef,
      expect.objectContaining({
        creadoPorUid: "uid-1",
        creadoPorNombre: "Ana López",
      })
    )
  })
})

describe("suscribirSolicitudesBorradoBanosPendientes", () => {
  beforeEach(() => vi.clearAllMocks())

  it("consulta solo estado == pendiente", () => {
    mockOnSnapshot.mockReturnValue(() => {})
    const onData = vi.fn()
    suscribirSolicitudesBorradoBanosPendientes(onData)

    expect(mockWhere).toHaveBeenCalledWith("estado", "==", "pendiente")
    expect(mockOnSnapshot).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Corre el test y verifica que falla**

Run: `npx vitest run tests/banos.test.ts`
Expected: FAIL — falta `creadoPorUid`/`creadoPorNombre` en el payload y `suscribirSolicitudesBorradoBanosPendientes` no existe.

- [ ] **Step 3: Implementa los cambios en `lib/banos.ts`**

Reemplaza el archivo completo `lib/banos.ts` por:

```ts
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  where,
  onSnapshot,
} from "firebase/firestore"
import { db, getClienteAuth } from "@/lib/firebase"
import type { RegistroBano, SolicitudBorradoBano } from "@/lib/schemas"
import { makeDateConverter, actualizarDocumento } from "@/lib/firestore-helpers"
import { registrarAuditoria } from "@/lib/auditoria"

const banoConverter = makeDateConverter<RegistroBano>()
const banosRef = () => collection(db, "registros-bano").withConverter(banoConverter)

const solicitudBorradoBanoConverter = makeDateConverter<SolicitudBorradoBano>()
const solicitudesBorradoBanoRef = () =>
  collection(db, "solicitudes_borrado_banos").withConverter(solicitudBorradoBanoConverter)

export type NuevoRegistroBanoPayload = Omit<RegistroBano, "id" | "creadoEn" | "actualizadoEn">

export async function listarRegistrosBano(mes?: string): Promise<RegistroBano[]> {
  let q = query(banosRef(), orderBy("fecha", "desc"), orderBy("horaEntrada", "desc"))

  if (mes) {
    // mes format: "YYYY-MM"
    const start = `${mes}-01`
    const end = `${mes}-31`
    q = query(
      banosRef(),
      where("fecha", ">=", start),
      where("fecha", "<=", end),
      orderBy("fecha", "desc"),
      orderBy("horaEntrada", "desc")
    )
  }

  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data())
}

export function suscribirRegistrosBano(
  onData: (registros: RegistroBano[]) => void,
  mes?: string,
  onError?: (err: Error) => void
): () => void {
  let q = query(banosRef(), orderBy("fecha", "desc"), orderBy("horaEntrada", "desc"))

  if (mes) {
    const start = `${mes}-01`
    const end = `${mes}-31`
    q = query(
      banosRef(),
      where("fecha", ">=", start),
      where("fecha", "<=", end),
      orderBy("fecha", "desc"),
      orderBy("horaEntrada", "desc")
    )
  }

  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data()))
    },
    (err) => {
      console.error("Error en suscripción a registros-bano:", err)
      onError?.(err)
    }
  )
}

export async function crearRegistroBano(payload: NuevoRegistroBanoPayload): Promise<string> {
  const ahora = new Date()
  const user = getClienteAuth().currentUser
  const ref = await addDoc(banosRef(), {
    ...payload,
    creadoPorUid: user?.uid,
    creadoPorNombre: user?.displayName || user?.email || undefined,
    creadoEn: ahora,
    actualizadoEn: ahora,
  } as RegistroBano)
  await registrarAuditoria(user?.email, "CREAR", "registros-bano", ref.id, `Registró baño de ${payload.operador} (${payload.bano})`)
  return ref.id
}

export async function actualizarRegistroBano(
  id: string,
  cambios: Partial<Omit<RegistroBano, "id" | "creadoEn">>
): Promise<void> {
  await actualizarDocumento("registros-bano", id, cambios as Record<string, unknown>)
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "EDITAR", "registros-bano", id, `Actualizó registro de baño: ${Object.keys(cambios).join(', ')}`)
}

export async function eliminarRegistroBano(id: string): Promise<void> {
  await deleteDoc(doc(db, "registros-bano", id))
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "BORRAR", "registros-bano", id, "Eliminó registro de baño")
}

/**
 * Solo super admin la usa (para pintar los botones Aprobar/Rechazar en
 * /notificaciones); ver firestore.rules — el resto de usuarios no tiene
 * permiso de lectura sobre esta colección.
 */
export function suscribirSolicitudesBorradoBanosPendientes(
  onData: (solicitudes: SolicitudBorradoBano[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(solicitudesBorradoBanoRef(), where("estado", "==", "pendiente"))
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data())),
    (err) => {
      console.error("Error en suscripción a solicitudes_borrado_banos:", err)
      onError?.(err)
    }
  )
}
```

- [ ] **Step 4: Corre el test y verifica que pasa**

Run: `npx vitest run tests/banos.test.ts`
Expected: PASS

- [ ] **Step 5: Verifica que no rompiste el hook que consume estas funciones**

Run: `npx vitest run tests/banos-captura.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/banos.ts tests/banos.test.ts
git commit -m "feat: captura creadoPorUid en registros de baño y suscripción a solicitudes pendientes"
```

---

### Task 5: Route Handler — crear solicitud de borrado

**Files:**
- Create: `app/api/banos/solicitudes-borrado/route.ts`
- Test: `tests/banos-solicitudes-borrado-route.test.ts`

**Interfaces:**
- Consumes: `verificarUsuarioAutorizado` (`@/lib/api-auth`), `obtenerUsuarioAdmin` (`@/lib/usuarios-admin`), `adminDb` (`@/lib/firebase-admin`), `registrarAuditoriaServer` (`@/lib/auditoria-server`, Task existente), `emitirNotificacionServer` (`@/lib/notificaciones-server`, Task 3), `evaluarReglaAutoAprobacion`/`construirResumenRegistro` (`@/lib/banos-solicitudes-borrado`, Task 2), `CrearSolicitudBorradoBanoInputSchema` (`@/lib/schemas`, Task 1).
- Produces: `POST` handler. Respuestas: `201 { estado: "auto_aprobada", regla }` / `201 { estado: "pendiente" }` / `400` / `403` / `404` / `409`.

- [ ] **Step 1: Escribe el test que falla**

Crea `tests/banos-solicitudes-borrado-route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  mockVerificarUsuarioAutorizado,
  mockObtenerUsuarioAdmin,
  mockRegistrarAuditoriaServer,
  mockEmitirNotificacionServer,
} = vi.hoisted(() => ({
  mockVerificarUsuarioAutorizado: vi.fn(),
  mockObtenerUsuarioAdmin: vi.fn(),
  mockRegistrarAuditoriaServer: vi.fn().mockResolvedValue(undefined),
  mockEmitirNotificacionServer: vi.fn().mockResolvedValue("notif-1"),
}))

vi.mock("@/lib/api-auth", () => ({ verificarUsuarioAutorizado: mockVerificarUsuarioAutorizado }))
vi.mock("@/lib/usuarios-admin", () => ({ obtenerUsuarioAdmin: mockObtenerUsuarioAdmin }))
vi.mock("@/lib/auditoria-server", () => ({ registrarAuditoriaServer: mockRegistrarAuditoriaServer }))
vi.mock("@/lib/notificaciones-server", () => ({ emitirNotificacionServer: mockEmitirNotificacionServer }))

class FakeTimestamp {
  constructor(private fecha: Date) {}
  toDate() {
    return this.fecha
  }
}

function fakeRegistroDoc(id: string, overrides: Record<string, unknown> = {}) {
  return {
    exists: true,
    id,
    data: () => ({
      operador: "Juan Pérez",
      bano: "Baño #1",
      horaEntrada: "10:00",
      horaLlegada: "10:07",
      fecha: "2026-07-30",
      tiempoMinutos: 7,
      creadoEn: new FakeTimestamp(new Date("2026-07-30T10:00:00Z")),
      actualizadoEn: new FakeTimestamp(new Date("2026-07-30T10:07:00Z")),
      creadoPorUid: "user-1",
      creadoPorNombre: "Juan Pérez",
      ...overrides,
    }),
  }
}

function makeQueryChain(result: { empty: boolean; docs?: unknown[] }) {
  const chain: any = {
    get: vi.fn().mockResolvedValue({ empty: result.empty, docs: result.docs ?? [] }),
  }
  chain.where = vi.fn(() => chain)
  chain.limit = vi.fn(() => chain)
  return chain
}

function makeFakeAdminDb(opts: {
  registroDoc?: ReturnType<typeof fakeRegistroDoc> | { exists: false }
  relacionados?: ReturnType<typeof fakeRegistroDoc>[]
  yaPendiente?: boolean
}) {
  const registroDocRef = {
    get: vi.fn().mockResolvedValue(opts.registroDoc ?? fakeRegistroDoc("registro-1")),
    delete: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
  }
  const nuevaSolicitudRef = { id: "solicitud-1", set: vi.fn().mockResolvedValue(undefined) }
  const relacionadosChain = makeQueryChain({ empty: !(opts.relacionados && opts.relacionados.length > 0), docs: opts.relacionados })
  const pendienteChain = makeQueryChain({ empty: !opts.yaPendiente })

  return {
    collection: vi.fn((name: string) => {
      if (name === "registros-bano") {
        return { doc: vi.fn(() => registroDocRef), where: relacionadosChain.where }
      }
      if (name === "solicitudes_borrado_banos") {
        return { doc: vi.fn(() => nuevaSolicitudRef), where: pendienteChain.where }
      }
      throw new Error(`colección no mockeada en test: ${name}`)
    }),
    __registroDocRef: registroDocRef,
    __nuevaSolicitudRef: nuevaSolicitudRef,
  }
}

let fakeAdminDb: ReturnType<typeof makeFakeAdminDb>

vi.mock("@/lib/firebase-admin", () => ({
  get adminDb() {
    return fakeAdminDb
  },
}))

import { POST } from "@/app/api/banos/solicitudes-borrado/route"

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/banos/solicitudes-borrado", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

describe("POST /api/banos/solicitudes-borrado", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerificarUsuarioAutorizado.mockResolvedValue({ ok: true, uid: "user-1", email: "juan@smv.com" })
    mockObtenerUsuarioAdmin.mockResolvedValue({ activo: true, esSuperAdmin: false, modulos: ["banos"] })
    fakeAdminDb = makeFakeAdminDb({})
  })

  it("retorna 401 si no está autorizado", async () => {
    mockVerificarUsuarioAutorizado.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: "No autorizado" }, { status: 401 }),
    })
    const res = await POST(makeRequest({ registroId: "registro-1", motivo: "duplicado" }))
    expect(res.status).toBe(401)
  })

  it("retorna 400 si el motivo es 'otro' sin nota", async () => {
    const res = await POST(makeRequest({ registroId: "registro-1", motivo: "otro" }))
    expect(res.status).toBe(400)
  })

  it("retorna 404 si el registro no existe", async () => {
    fakeAdminDb = makeFakeAdminDb({ registroDoc: { exists: false } as any })
    const res = await POST(makeRequest({ registroId: "registro-1", motivo: "duplicado" }))
    expect(res.status).toBe(404)
  })

  it("retorna 403 si quien solicita no es el creador ni súper admin", async () => {
    fakeAdminDb = makeFakeAdminDb({ registroDoc: fakeRegistroDoc("registro-1", { creadoPorUid: "otro-uid" }) })
    const res = await POST(makeRequest({ registroId: "registro-1", motivo: "duplicado" }))
    expect(res.status).toBe(403)
  })

  it("retorna 409 si ya hay una solicitud pendiente para ese registro", async () => {
    fakeAdminDb = makeFakeAdminDb({ yaPendiente: true })
    const res = await POST(makeRequest({ registroId: "registro-1", motivo: "duplicado" }))
    expect(res.status).toBe(409)
  })

  it("auto-aprueba y borra cuando hay un duplicado a menos de 10 min", async () => {
    fakeAdminDb = makeFakeAdminDb({
      relacionados: [
        fakeRegistroDoc("registro-1"),
        fakeRegistroDoc("registro-2", { horaEntrada: "10:05" }),
      ],
    })
    const res = await POST(makeRequest({ registroId: "registro-1", motivo: "duplicado" }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toEqual({ estado: "auto_aprobada", regla: "duplicado_10min" })
    expect(fakeAdminDb.__registroDocRef.delete).toHaveBeenCalled()
    expect(mockRegistrarAuditoriaServer).toHaveBeenCalled()
    expect(mockEmitirNotificacionServer).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "banos_solicitud_resuelta", origenModulo: "banos" })
    )
  })

  it("auto-aprueba por arrepentimiento inmediato (registro creado hace segundos)", async () => {
    fakeAdminDb = makeFakeAdminDb({
      registroDoc: fakeRegistroDoc("registro-1", { creadoEn: new FakeTimestamp(new Date()) }),
    })
    const res = await POST(makeRequest({ registroId: "registro-1", motivo: "accidental" }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toEqual({ estado: "auto_aprobada", regla: "arrepentimiento_2min" })
    expect(fakeAdminDb.__registroDocRef.delete).toHaveBeenCalled()
  })

  it("deja pendiente cuando ninguna regla aplica, y marca el registro", async () => {
    const res = await POST(makeRequest({ registroId: "registro-1", motivo: "bano_equivocado" }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toEqual({ estado: "pendiente" })
    expect(fakeAdminDb.__registroDocRef.delete).not.toHaveBeenCalled()
    expect(fakeAdminDb.__registroDocRef.update).toHaveBeenCalledWith({ solicitudBorradoEstado: "pendiente" })
    expect(mockEmitirNotificacionServer).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "banos_solicitud_creada" })
    )
  })
})
```

- [ ] **Step 2: Corre el test y verifica que falla**

Run: `npx vitest run tests/banos-solicitudes-borrado-route.test.ts`
Expected: FAIL — la ruta no existe.

- [ ] **Step 3: Implementa el Route Handler**

Crea `app/api/banos/solicitudes-borrado/route.ts`:

```ts
import { FieldValue } from "firebase-admin/firestore"
import { verificarUsuarioAutorizado } from "@/lib/api-auth"
import { adminDb } from "@/lib/firebase-admin"
import { obtenerUsuarioAdmin } from "@/lib/usuarios-admin"
import { registrarAuditoriaServer } from "@/lib/auditoria-server"
import { emitirNotificacionServer } from "@/lib/notificaciones-server"
import { evaluarReglaAutoAprobacion, construirResumenRegistro } from "@/lib/banos-solicitudes-borrado"
import { CrearSolicitudBorradoBanoInputSchema, type RegistroBano } from "@/lib/schemas"

function registroDesdeSnapshot(id: string, data: Record<string, any>): RegistroBano {
  return {
    id,
    operador: data.operador,
    bano: data.bano,
    horaEntrada: data.horaEntrada,
    horaLlegada: data.horaLlegada ?? null,
    fecha: data.fecha,
    tiempoMinutos: data.tiempoMinutos ?? null,
    creadoEn: data.creadoEn.toDate(),
    actualizadoEn: data.actualizadoEn.toDate(),
    creadoPorUid: data.creadoPorUid,
    creadoPorNombre: data.creadoPorNombre,
  }
}

export async function POST(request: Request) {
  const auth = await verificarUsuarioAutorizado(request)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json().catch(() => null)
    const parsed = CrearSolicitudBorradoBanoInputSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "Datos inválidos" }, { status: 400 })
    }
    const { registroId, motivo, nota } = parsed.data

    const registroSnap = await adminDb.collection("registros-bano").doc(registroId).get()
    if (!registroSnap.exists) {
      return Response.json({ error: "El registro ya no existe" }, { status: 404 })
    }
    const registro = registroDesdeSnapshot(registroSnap.id, registroSnap.data() as Record<string, any>)

    const infoUsuario = await obtenerUsuarioAdmin(auth.uid, auth.email)
    const esSuperAdmin = infoUsuario?.esSuperAdmin === true
    if (registro.creadoPorUid !== auth.uid && !esSuperAdmin) {
      return Response.json(
        { error: "Solo quien creó el registro puede solicitar su eliminación" },
        { status: 403 }
      )
    }

    const yaPendiente = await adminDb
      .collection("solicitudes_borrado_banos")
      .where("registroId", "==", registroId)
      .where("estado", "==", "pendiente")
      .limit(1)
      .get()
    if (!yaPendiente.empty) {
      return Response.json({ error: "Ya hay una solicitud pendiente para este registro" }, { status: 409 })
    }

    const relacionadosSnap = await adminDb
      .collection("registros-bano")
      .where("operador", "==", registro.operador)
      .where("bano", "==", registro.bano)
      .where("fecha", "==", registro.fecha)
      .get()
    const relacionados = relacionadosSnap.docs.map((d: any) => registroDesdeSnapshot(d.id, d.data()))

    const ahora = new Date()
    const regla = evaluarReglaAutoAprobacion(registro, relacionados, ahora)
    const registroResumen = construirResumenRegistro(registro)
    const solicitudRef = adminDb.collection("solicitudes_borrado_banos").doc()
    const solicitadoPorNombre = auth.email

    if (regla) {
      await solicitudRef.set({
        registroId,
        registroResumen,
        motivo,
        ...(nota ? { nota } : {}),
        solicitadoPorUid: auth.uid,
        solicitadoPorNombre,
        estado: "auto_aprobada",
        reglaAutoAplicada: regla,
        creadoEn: FieldValue.serverTimestamp(),
        actualizadoEn: FieldValue.serverTimestamp(),
      })
      await adminDb.collection("registros-bano").doc(registroId).delete()
      await registrarAuditoriaServer(
        auth.email,
        "BORRAR",
        "registros-bano",
        registroId,
        `Auto-aprobado (${regla}): eliminó registro de ${registro.operador}, solicitado por ${solicitadoPorNombre}`
      )
      await emitirNotificacionServer({
        tipo: "banos_solicitud_resuelta",
        titulo: "Solicitud de borrado auto-aprobada",
        cuerpo: `${registro.operador} · ${registro.bano} (${registro.fecha}) se borró automáticamente — regla: ${regla}`,
        origenModulo: "banos",
        origenId: solicitudRef.id,
        href: "/banos",
        creadoPorUid: auth.uid,
        creadoPorNombre: solicitadoPorNombre,
      })
      return Response.json({ estado: "auto_aprobada", regla }, { status: 201 })
    }

    await solicitudRef.set({
      registroId,
      registroResumen,
      motivo,
      ...(nota ? { nota } : {}),
      solicitadoPorUid: auth.uid,
      solicitadoPorNombre,
      estado: "pendiente",
      creadoEn: FieldValue.serverTimestamp(),
      actualizadoEn: FieldValue.serverTimestamp(),
    })
    await adminDb.collection("registros-bano").doc(registroId).update({ solicitudBorradoEstado: "pendiente" })
    await emitirNotificacionServer({
      tipo: "banos_solicitud_creada",
      titulo: "Solicitud de borrado de baño",
      cuerpo: `${registro.operador} · ${registro.bano} (${registro.fecha}) — motivo: ${motivo}${nota ? `: ${nota}` : ""}`,
      origenModulo: "banos",
      origenId: solicitudRef.id,
      href: "/banos",
      creadoPorUid: auth.uid,
      creadoPorNombre: solicitadoPorNombre,
    })
    return Response.json({ estado: "pendiente" }, { status: 201 })
  } catch (error: unknown) {
    console.error("Error creando solicitud de borrado de baño:", error instanceof Error ? error.message : "error desconocido")
    return Response.json({ error: "No se pudo crear la solicitud" }, { status: 500 })
  }
}
```

- [ ] **Step 4: Corre el test y verifica que pasa**

Run: `npx vitest run tests/banos-solicitudes-borrado-route.test.ts`
Expected: PASS

- [ ] **Step 5: Verifica tipos**

Run: `npx tsc --noEmit`
Expected: PASS (sin errores nuevos)

- [ ] **Step 6: Commit**

```bash
git add app/api/banos/solicitudes-borrado/route.ts tests/banos-solicitudes-borrado-route.test.ts
git commit -m "feat: endpoint para crear solicitudes de borrado de baños con auto-aprobación"
```

---

### Task 6: Route Handler — resolver solicitud (aprobar/rechazar)

**Files:**
- Create: `app/api/banos/solicitudes-borrado/[id]/resolver/route.ts`
- Test: `tests/banos-solicitudes-borrado-resolver-route.test.ts`

**Interfaces:**
- Consumes: `verificarSuperAdmin` (`@/lib/api-auth`), `adminDb` (`@/lib/firebase-admin`), `registrarAuditoriaServer`, `emitirNotificacionServer`.
- Produces: `POST` handler con `params: Promise<{ id: string }>`. Respuestas: `200 { estado: "aprobada" | "rechazada" }` / `400` / `403` / `404` / `409`.

- [ ] **Step 1: Escribe el test que falla**

Crea `tests/banos-solicitudes-borrado-resolver-route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockVerificarSuperAdmin, mockRegistrarAuditoriaServer, mockEmitirNotificacionServer } = vi.hoisted(() => ({
  mockVerificarSuperAdmin: vi.fn(),
  mockRegistrarAuditoriaServer: vi.fn().mockResolvedValue(undefined),
  mockEmitirNotificacionServer: vi.fn().mockResolvedValue("notif-1"),
}))

vi.mock("@/lib/api-auth", () => ({ verificarSuperAdmin: mockVerificarSuperAdmin }))
vi.mock("@/lib/auditoria-server", () => ({ registrarAuditoriaServer: mockRegistrarAuditoriaServer }))
vi.mock("@/lib/notificaciones-server", () => ({ emitirNotificacionServer: mockEmitirNotificacionServer }))

function fakeSolicitudDoc(overrides: Record<string, unknown> = {}) {
  return {
    exists: true,
    data: () => ({
      registroId: "registro-1",
      registroResumen: {
        operador: "Juan Pérez",
        bano: "Baño #1",
        fecha: "2026-07-30",
        horaEntrada: "10:00",
        horaLlegada: "10:07",
        tiempoMinutos: 7,
      },
      motivo: "bano_equivocado",
      solicitadoPorUid: "user-1",
      solicitadoPorNombre: "juan@smv.com",
      estado: "pendiente",
      ...overrides,
    }),
  }
}

function makeFakeAdminDb(opts: { solicitudDoc?: ReturnType<typeof fakeSolicitudDoc> | { exists: false } }) {
  const solicitudDocRef = {
    get: vi.fn().mockResolvedValue(opts.solicitudDoc ?? fakeSolicitudDoc()),
    update: vi.fn().mockResolvedValue(undefined),
  }
  const registroDocRef = { delete: vi.fn().mockResolvedValue(undefined), update: vi.fn().mockResolvedValue(undefined) }

  return {
    collection: vi.fn((name: string) => {
      if (name === "solicitudes_borrado_banos") return { doc: vi.fn(() => solicitudDocRef) }
      if (name === "registros-bano") return { doc: vi.fn(() => registroDocRef) }
      throw new Error(`colección no mockeada en test: ${name}`)
    }),
    __solicitudDocRef: solicitudDocRef,
    __registroDocRef: registroDocRef,
  }
}

let fakeAdminDb: ReturnType<typeof makeFakeAdminDb>

vi.mock("@/lib/firebase-admin", () => ({
  get adminDb() {
    return fakeAdminDb
  },
}))

import { POST } from "@/app/api/banos/solicitudes-borrado/[id]/resolver/route"

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/banos/solicitudes-borrado/solicitud-1/resolver", {
    method: "POST",
    body: JSON.stringify(body),
  })
}
function ctx(id = "solicitud-1") {
  return { params: Promise.resolve({ id }) }
}

describe("POST /api/banos/solicitudes-borrado/[id]/resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerificarSuperAdmin.mockResolvedValue({ ok: true, uid: "admin-1", email: "emiliano@smv.com" })
    fakeAdminDb = makeFakeAdminDb({})
  })

  it("retorna 403 si no es súper admin", async () => {
    mockVerificarSuperAdmin.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: "Se requiere acceso de super-administrador" }, { status: 403 }),
    })
    const res = await POST(makeRequest({ decision: "aprobar" }), ctx())
    expect(res.status).toBe(403)
  })

  it("retorna 400 con una decisión inválida", async () => {
    const res = await POST(makeRequest({ decision: "tal-vez" }), ctx())
    expect(res.status).toBe(400)
  })

  it("retorna 404 si la solicitud no existe", async () => {
    fakeAdminDb = makeFakeAdminDb({ solicitudDoc: { exists: false } as any })
    const res = await POST(makeRequest({ decision: "aprobar" }), ctx())
    expect(res.status).toBe(404)
  })

  it("retorna 409 si la solicitud ya fue resuelta", async () => {
    fakeAdminDb = makeFakeAdminDb({ solicitudDoc: fakeSolicitudDoc({ estado: "rechazada" }) })
    const res = await POST(makeRequest({ decision: "aprobar" }), ctx())
    expect(res.status).toBe(409)
  })

  it("aprobar borra el registro y marca la solicitud como aprobada", async () => {
    const res = await POST(makeRequest({ decision: "aprobar" }), ctx())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ estado: "aprobada" })
    expect(fakeAdminDb.__registroDocRef.delete).toHaveBeenCalled()
    expect(fakeAdminDb.__solicitudDocRef.update).toHaveBeenCalledWith(
      expect.objectContaining({ estado: "aprobada", resueltoPorUid: "admin-1" })
    )
    expect(mockRegistrarAuditoriaServer).toHaveBeenCalled()
    expect(mockEmitirNotificacionServer).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "banos_solicitud_resuelta" })
    )
  })

  it("rechazar conserva el registro y limpia el badge pendiente", async () => {
    const res = await POST(makeRequest({ decision: "rechazar" }), ctx())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ estado: "rechazada" })
    expect(fakeAdminDb.__registroDocRef.delete).not.toHaveBeenCalled()
    expect(fakeAdminDb.__registroDocRef.update).toHaveBeenCalled()
    expect(fakeAdminDb.__solicitudDocRef.update).toHaveBeenCalledWith(
      expect.objectContaining({ estado: "rechazada" })
    )
  })
})
```

- [ ] **Step 2: Corre el test y verifica que falla**

Run: `npx vitest run tests/banos-solicitudes-borrado-resolver-route.test.ts`
Expected: FAIL — la ruta no existe.

- [ ] **Step 3: Implementa el Route Handler**

Crea `app/api/banos/solicitudes-borrado/[id]/resolver/route.ts`:

```ts
import { FieldValue } from "firebase-admin/firestore"
import { z } from "zod"
import { verificarSuperAdmin } from "@/lib/api-auth"
import { adminDb } from "@/lib/firebase-admin"
import { registrarAuditoriaServer } from "@/lib/auditoria-server"
import { emitirNotificacionServer } from "@/lib/notificaciones-server"

const ResolverSolicitudInputSchema = z.object({
  decision: z.enum(["aprobar", "rechazar"]),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verificarSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await params

  try {
    const body = await request.json().catch(() => null)
    const parsed = ResolverSolicitudInputSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "Decisión inválida" }, { status: 400 })
    }

    const solicitudRef = adminDb.collection("solicitudes_borrado_banos").doc(id)
    const solicitudSnap = await solicitudRef.get()
    if (!solicitudSnap.exists) {
      return Response.json({ error: "Solicitud no encontrada" }, { status: 404 })
    }
    const solicitud = solicitudSnap.data() as Record<string, any>
    if (solicitud.estado !== "pendiente") {
      return Response.json({ error: "Esta solicitud ya fue resuelta" }, { status: 409 })
    }

    const nuevoEstado = parsed.data.decision === "aprobar" ? "aprobada" : "rechazada"

    if (nuevoEstado === "aprobada") {
      await adminDb.collection("registros-bano").doc(solicitud.registroId).delete()
      await registrarAuditoriaServer(
        auth.email,
        "BORRAR",
        "registros-bano",
        solicitud.registroId,
        `Aprobó solicitud de ${solicitud.solicitadoPorNombre}: eliminó registro de ${solicitud.registroResumen.operador}`
      )
    } else {
      await adminDb
        .collection("registros-bano")
        .doc(solicitud.registroId)
        .update({ solicitudBorradoEstado: FieldValue.delete() })
    }

    await solicitudRef.update({
      estado: nuevoEstado,
      resueltoPorUid: auth.uid,
      resueltoPorNombre: auth.email,
      actualizadoEn: FieldValue.serverTimestamp(),
    })

    await emitirNotificacionServer({
      tipo: "banos_solicitud_resuelta",
      titulo:
        nuevoEstado === "aprobada" ? "Solicitud de borrado aprobada" : "Solicitud de borrado rechazada",
      cuerpo: `${solicitud.registroResumen.operador} · ${solicitud.registroResumen.bano} (${solicitud.registroResumen.fecha}) — ${
        nuevoEstado === "aprobada" ? "se eliminó" : "se conserva"
      }`,
      origenModulo: "banos",
      origenId: id,
      href: "/banos",
      creadoPorUid: auth.uid,
      creadoPorNombre: auth.email,
    })

    return Response.json({ estado: nuevoEstado })
  } catch (error: unknown) {
    console.error("Error resolviendo solicitud de borrado de baño:", error instanceof Error ? error.message : "error desconocido")
    return Response.json({ error: "No se pudo resolver la solicitud" }, { status: 500 })
  }
}
```

- [ ] **Step 4: Corre el test y verifica que pasa**

Run: `npx vitest run tests/banos-solicitudes-borrado-resolver-route.test.ts`
Expected: PASS

- [ ] **Step 5: Verifica tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add "app/api/banos/solicitudes-borrado/[id]/resolver/route.ts" tests/banos-solicitudes-borrado-resolver-route.test.ts
git commit -m "feat: endpoint para aprobar/rechazar solicitudes de borrado de baños"
```

---

### Task 7: Firestore Rules — cerrar el borrado directo y proteger la colección nueva

**Files:**
- Modify: `firestore.rules`

**Interfaces:**
- No produce símbolos de TypeScript; solo reglas de seguridad consumidas por el cliente Firestore.

- [ ] **Step 1: Cierra el borrado directo de `registros-bano`**

En `firestore.rules:405-417`, localiza el bloque:

```
    match /registros-bano/{banoId} {
      allow read: if esUsuarioAutorizado();

      allow create: if esUsuarioAutorizado()
                    && registroBanoValido(request.resource.data);

      allow update: if esUsuarioAutorizado()
                    && registroBanoValido(request.resource.data)
                    && request.resource.data.creadoEn == resource.data.creadoEn
                    && request.resource.data.actualizadoEn >= resource.data.actualizadoEn;

      allow delete: if esUsuarioAutorizado();
    }
```

Reemplaza únicamente la línea `allow delete` por:

```
      // Antes cualquier usuario autorizado podía borrar directo — la UI ya
      // ocultaba el botón a quien no fuera súper admin, pero la regla no lo
      // exigía. El flujo de solicitud de borrado (Route Handler + Admin SDK)
      // solo tiene sentido si esto queda cerrado también aquí.
      allow delete: if esUsuarioAutorizado() && (esSuperAdminDoc() || esCorreoBreakGlass());
```

> Nota: este es un cambio de seguridad real (antes cualquiera podía borrar vía SDK aunque la UI lo ocultara). Avísale a Emiliano cuando termines este task para que lo tenga presente antes de desplegar `firestore:rules`.

- [ ] **Step 2: Agrega la colección de solicitudes de borrado**

Inmediatamente después del bloque `match /registros-bano/{banoId} { ... }` (antes de la sección `// ── Horas Extra`), agrega:

```
    // ── Solicitudes de eliminación de registros de baño ──────────────────────
    // Toda escritura (crear, auto-aprobar, aprobar, rechazar) pasa por
    // app/api/banos/solicitudes-borrado/* con Admin SDK, que ignora estas
    // reglas — por eso el write queda cerrado también desde el cliente.
    match /solicitudes_borrado_banos/{solicitudId} {
      allow read: if esUsuarioAutorizado() && (esSuperAdminDoc() || esCorreoBreakGlass());
      allow write: if false;
    }
```

- [ ] **Step 3: Deja que los usuarios con módulo `banos` vean el feed de notificaciones**

En `firestore.rules:347-354`, reemplaza:

```
    function puedeVerNotificaciones() {
      return esUsuarioAutorizado() && (
        esCorreoBreakGlass() ||
        tieneModulo('notificaciones') ||
        tieneModulo('pedidos-almacen') ||
        tieneModulo('requisiciones')
      );
    }
```

por:

```
    function puedeVerNotificaciones() {
      return esUsuarioAutorizado() && (
        esCorreoBreakGlass() ||
        tieneModulo('notificaciones') ||
        tieneModulo('pedidos-almacen') ||
        tieneModulo('requisiciones') ||
        tieneModulo('banos')
      );
    }
```

- [ ] **Step 4: Revisión manual de sintaxis**

Abre `firestore.rules` completo y confirma que las llaves están balanceadas alrededor de los tres bloques tocados (no hay forma de correr un linter de reglas sin el emulador en este repo; `tests/firestore-rules-emulator.test.ts` y `tests/firestore-security.test.ts` cubren otras colecciones, no ésta).

- [ ] **Step 5: Corre la suite completa para confirmar que nada más se rompió**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add firestore.rules
git commit -m "fix: cierra el borrado directo de registros-bano y protege solicitudes_borrado_banos"
```

---

### Task 8: Hook de suscripción a solicitudes pendientes (para el súper admin)

**Files:**
- Create: `lib/hooks/useBanosSolicitudesBorrado.ts`

**Interfaces:**
- Consumes: `suscribirSolicitudesBorradoBanosPendientes` (`@/lib/banos`, Task 4), `SolicitudBorradoBano` (`@/lib/schemas`, Task 1).
- Produces: `useSolicitudesBorradoBanosPendientes(enabled: boolean): Map<string, SolicitudBorradoBano>`.

- [ ] **Step 1: Implementa el hook**

Crea `lib/hooks/useBanosSolicitudesBorrado.ts`:

```ts
import { useEffect, useState } from "react"
import { suscribirSolicitudesBorradoBanosPendientes } from "@/lib/banos"
import type { SolicitudBorradoBano } from "@/lib/schemas"

/**
 * Solo debe habilitarse (`enabled: true`) para súper admin — es lo único que
 * puede leer `solicitudes_borrado_banos` según firestore.rules. Se usa para
 * saber, dentro de /notificaciones, si una solicitud sigue pendiente y así
 * mostrar (o esconder) los botones Aprobar/Rechazar.
 */
export function useSolicitudesBorradoBanosPendientes(
  enabled: boolean
): Map<string, SolicitudBorradoBano> {
  const [porId, setPorId] = useState<Map<string, SolicitudBorradoBano>>(new Map())

  useEffect(() => {
    if (!enabled) {
      setPorId(new Map())
      return
    }
    const unsub = suscribirSolicitudesBorradoBanosPendientes(
      (items) => setPorId(new Map(items.map((s) => [s.id, s]))),
      (err) => console.error("Error suscribiendo a solicitudes de borrado de baños:", err)
    )
    return unsub
  }, [enabled])

  return porId
}
```

Este archivo es un wrapper delgado de estado sobre una función ya probada en Task 4 — no necesita su propio test unitario (no tiene lógica propia más allá de `useState`/`useEffect`); se verifica junto con la UI en Task 10.

- [ ] **Step 2: Verifica tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/hooks/useBanosSolicitudesBorrado.ts
git commit -m "feat: hook para solicitudes de borrado de baños pendientes"
```

---

### Task 9: UI `/banos` — botón "Solicitar eliminación", badge y modal

**Files:**
- Modify: `app/banos/RegistroBanoList.tsx`

**Interfaces:**
- Consumes: `MOTIVOS_SOLICITUD_BORRADO_BANO` (`@/lib/banos-solicitudes-borrado`, Task 2), `MotivoSolicitudBorradoBano` (`@/lib/schemas`, Task 1).

- [ ] **Step 1: Agrega los imports nuevos**

En `app/banos/RegistroBanoList.tsx`, junto a los imports existentes (línea 1-14), agrega:

```tsx
import { MOTIVOS_SOLICITUD_BORRADO_BANO } from '@/lib/banos-solicitudes-borrado'
import type { MotivoSolicitudBorradoBano } from '@/lib/schemas'
```

- [ ] **Step 2: Agrega el estado del modal de solicitud**

Junto a los otros `useState` del componente (cerca de la línea 61-65, después del bloque de edición de horario), agrega:

```tsx
  // Estado para modal de solicitud de eliminación (almacén)
  const [solicitandoRegistro, setSolicitandoRegistro] = useState<RegistroBano | null>(null)
  const [motivoSolicitud, setMotivoSolicitud] = useState<MotivoSolicitudBorradoBano | null>(null)
  const [notaSolicitud, setNotaSolicitud] = useState('')
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false)
  const [errorSolicitud, setErrorSolicitud] = useState<string | null>(null)

  function abrirModalSolicitud(r: RegistroBano) {
    setSolicitandoRegistro(r)
    setMotivoSolicitud(null)
    setNotaSolicitud('')
    setErrorSolicitud(null)
  }

  async function handleEnviarSolicitud(e: React.FormEvent) {
    e.preventDefault()
    if (!solicitandoRegistro || !motivoSolicitud) return
    if (motivoSolicitud === 'otro' && !notaSolicitud.trim()) {
      setErrorSolicitud('Escribe una nota para el motivo "Otro".')
      return
    }

    setEnviandoSolicitud(true)
    setErrorSolicitud(null)
    try {
      const token = await usuario?.getIdToken()
      const res = await fetch('/api/banos/solicitudes-borrado', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          registroId: solicitandoRegistro.id,
          motivo: motivoSolicitud,
          nota: notaSolicitud.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorSolicitud(data.error || 'No se pudo enviar la solicitud.')
        return
      }
      setMensajeExito(
        data.estado === 'auto_aprobada'
          ? `Se eliminó automáticamente el registro de ${solicitandoRegistro.operador}.`
          : 'Solicitud enviada. Un súper admin la revisará pronto.'
      )
      setSolicitandoRegistro(null)
    } catch (err) {
      console.error('Error enviando solicitud de borrado:', err)
      setErrorSolicitud('No se pudo enviar la solicitud. Intenta de nuevo.')
    } finally {
      setEnviandoSolicitud(false)
    }
  }
```

- [ ] **Step 3: Reemplaza la celda de acciones de "Completados hoy"**

Localiza, dentro del `<td>` de acciones de la tabla "Completados hoy" (cerca de la línea 425-446), el bloque:

```tsx
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => abrirModalEditar(r)}
                            title="Editar hora que llegó / horario"
                            className="text-xs font-semibold text-[#0369A1] bg-sky-50 hover:bg-sky-100 border border-sky-200/80 px-2 py-0.5 rounded-md inline-flex items-center gap-1 transition-colors"
                          >
                            <Pencil className="h-3 w-3" />
                            Editar
                          </button>
                          {puedeEliminar && (
                            <button
                              type="button"
                              onClick={() => handleEliminar(r.id, r.operador)}
                              title="Eliminar registro (Solo Super Admin)"
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
```

Reemplázalo por:

```tsx
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => abrirModalEditar(r)}
                            title="Editar hora que llegó / horario"
                            className="text-xs font-semibold text-[#0369A1] bg-sky-50 hover:bg-sky-100 border border-sky-200/80 px-2 py-0.5 rounded-md inline-flex items-center gap-1 transition-colors"
                          >
                            <Pencil className="h-3 w-3" />
                            Editar
                          </button>
                          {puedeEliminar && (
                            <button
                              type="button"
                              onClick={() => handleEliminar(r.id, r.operador)}
                              title="Eliminar registro (Solo Super Admin)"
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {!puedeEliminar && !!usuario?.uid && r.creadoPorUid === usuario.uid && (
                            r.solicitudBorradoEstado === 'pendiente' ? (
                              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md whitespace-nowrap">
                                Pendiente de revisión
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => abrirModalSolicitud(r)}
                                title="Solicitar eliminación (un súper admin la revisará)"
                                className="text-[10px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md transition-colors whitespace-nowrap"
                              >
                                Solicitar eliminación
                              </button>
                            )
                          )}
                        </div>
                      </td>
```

- [ ] **Step 4: Agrega el modal de solicitud**

Justo después del cierre del modal de edición de horario existente (después de la línea `)}` que cierra el bloque `{editandoRegistro && ( ... )}`, antes del cierre final `</div>` / `)` del componente), agrega:

```tsx
      {/* Modal de solicitud de eliminación */}
      {solicitandoRegistro && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Solicitar eliminación</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {solicitandoRegistro.operador} — <span className="font-medium text-slate-700">{solicitandoRegistro.bano}</span> ({solicitandoRegistro.fecha})
                </p>
              </div>
              <button
                onClick={() => setSolicitandoRegistro(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {errorSolicitud && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-lg text-xs">
                {errorSolicitud}
              </div>
            )}

            <form onSubmit={handleEnviarSolicitud} className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {MOTIVOS_SOLICITUD_BORRADO_BANO.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMotivoSolicitud(m.value)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                      motivoSolicitud === m.value
                        ? 'bg-[#0369A1] text-white border-[#0369A1]'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-[#0369A1]/50'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {motivoSolicitud === 'otro' && (
                <textarea
                  required
                  value={notaSolicitud}
                  onChange={(e) => setNotaSolicitud(e.target.value)}
                  placeholder="Explica brevemente el motivo..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0369A1]/20 focus:border-[#0369A1]"
                />
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSolicitandoRegistro(null)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviandoSolicitud || !motivoSolicitud}
                  className="px-4 py-1.5 text-xs font-semibold bg-[#0369A1] hover:bg-[#0284C7] text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {enviandoSolicitud ? 'Enviando...' : 'Enviar solicitud'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
```

- [ ] **Step 5: Verifica tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS

- [ ] **Step 6: Prueba manual en el navegador**

Run: `npm run dev`

1. Inicia sesión con una cuenta que **no** sea súper admin y tenga el módulo `banos`.
2. Registra una entrada de baño, márcala "Llegó".
3. Confirma que ves el botón **"Solicitar eliminación"** (no el ícono de basura) en esa fila.
4. Ábrelo, elige un motivo, envíalo — confirma el toast/mensaje según auto-aprobado o pendiente.
5. Si quedó pendiente, confirma el badge "Pendiente de revisión" y que el botón desaparece/deshabilita.
6. Con una cuenta súper admin, confirma que el ícono de basura sigue funcionando igual que antes.

- [ ] **Step 7: Commit**

```bash
git add app/banos/RegistroBanoList.tsx
git commit -m "feat: solicitud de eliminación con motivo en /banos para almacén"
```

---

### Task 10: UI `/notificaciones` — filtro de Baños + Aprobar/Rechazar

**Files:**
- Modify: `lib/hooks/useNotificaciones.ts` (agrega `"banos"` al filtro de origen — ya cubierto por `OrigenModuloNotificacion`, revisar que no haya `as` restrictivo)
- Modify: `app/notificaciones/NotificacionesView.tsx`

**Interfaces:**
- Consumes: `useSolicitudesBorradoBanosPendientes` (`@/lib/hooks/useBanosSolicitudesBorrado`, Task 8), `usePermisos`/`useUsuario`/`authBypassActivo` (ya usados en `RegistroBanoList.tsx`).

- [ ] **Step 1: Confirma que el filtro de origen ya acepta "banos"**

`FiltroOrigen` en `lib/hooks/useNotificaciones.ts:15` es `"todos" | OrigenModuloNotificacion`, y `OrigenModuloNotificacionSchema` ya incluye `"banos"` desde Task 1 — no se necesita cambio en este archivo. Confírmalo leyendo el archivo; si por algún motivo quedó un tipo literal distinto, ajústalo para que siga derivando de `OrigenModuloNotificacion`.

- [ ] **Step 2: Agrega el pill de filtro "Baños"**

En `app/notificaciones/NotificacionesView.tsx`, dentro del array de pills de origen (cerca de la línea 75-94):

```tsx
          {(
            [
              ['todos', 'Todos'],
              ['pedidos-almacen', 'Pedidos'],
              ['requisiciones', 'Requisiciones'],
            ] as const
          ).map(([value, label]) => (
```

Reemplázalo por:

```tsx
          {(
            [
              ['todos', 'Todos'],
              ['pedidos-almacen', 'Pedidos'],
              ['requisiciones', 'Requisiciones'],
              ['banos', 'Baños'],
            ] as const
          ).map(([value, label]) => (
```

- [ ] **Step 3: Agrega el badge de origen "baño" en la card**

Localiza (cerca de la línea 162-164):

```tsx
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {n.origenModulo === 'pedidos-almacen' ? 'pedido' : 'requisición'}
                    </Badge>
```

Reemplázalo por:

```tsx
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {n.origenModulo === 'pedidos-almacen'
                        ? 'pedido'
                        : n.origenModulo === 'banos'
                          ? 'baño'
                          : 'requisición'}
                    </Badge>
```

- [ ] **Step 4: Agrega permisos y la suscripción a pendientes**

Al inicio del componente `NotificacionesView`, junto a los otros hooks (cerca de la línea 24-28), agrega:

```tsx
import { authBypassActivo, useUsuario } from '@/lib/auth'
import { usePermisos } from '@/lib/hooks/useRol'
import { useSolicitudesBorradoBanosPendientes } from '@/lib/hooks/useBanosSolicitudesBorrado'
```

y dentro de la función:

```tsx
  const { usuario } = useUsuario()
  const { esSuperAdmin } = usePermisos(authBypassActivo() ? null : usuario)
  const pendientesBanos = useSolicitudesBorradoBanosPendientes(esSuperAdmin)
  const [resolviendoId, setResolviendoId] = useState<string | null>(null)

  async function onResolverSolicitud(solicitudId: string, decision: 'aprobar' | 'rechazar') {
    setResolviendoId(solicitudId)
    try {
      const token = await usuario?.getIdToken()
      const res = await fetch(`/api/banos/solicitudes-borrado/${solicitudId}/resolver`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ decision }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'No se pudo resolver la solicitud')
        return
      }
      toast.success(decision === 'aprobar' ? 'Solicitud aprobada' : 'Solicitud rechazada')
    } catch {
      toast.error('No se pudo resolver la solicitud')
    } finally {
      setResolviendoId(null)
    }
  }
```

- [ ] **Step 5: Renderiza los botones Aprobar/Rechazar dentro de la card**

Dentro del `<li>` de cada notificación, después del párrafo `<p className="text-xs text-slate-600 mt-1">{n.cuerpo}</p>` (cerca de la línea 166), agrega:

```tsx
                  {n.origenModulo === 'banos' &&
                    n.tipo === 'banos_solicitud_creada' &&
                    esSuperAdmin &&
                    pendientesBanos.has(n.origenId) && (
                      <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          disabled={resolviendoId === n.origenId}
                          onClick={() => void onResolverSolicitud(n.origenId, 'aprobar')}
                          className="text-[11px] font-semibold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-2.5 py-1 rounded-md disabled:opacity-50"
                        >
                          Aprobar
                        </button>
                        <button
                          type="button"
                          disabled={resolviendoId === n.origenId}
                          onClick={() => void onResolverSolicitud(n.origenId, 'rechazar')}
                          className="text-[11px] font-semibold bg-red-100 text-red-700 hover:bg-red-200 px-2.5 py-1 rounded-md disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                      </div>
                    )}
```

> `n.origenId` es el id de la solicitud (`solicitudes_borrado_banos/{id}`), que es exactamente el `id` que espera `/api/banos/solicitudes-borrado/[id]/resolver`.

- [ ] **Step 6: Verifica tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS

- [ ] **Step 7: Prueba manual en el navegador**

Run: `npm run dev`

1. Con la cuenta de almacén, genera una solicitud que quede **pendiente** (motivo distinto a duplicado/arrepentimiento inmediato).
2. Con la cuenta súper admin, ve a `/notificaciones`, filtra por "Baños", confirma que ves motivo/nota y los botones Aprobar/Rechazar.
3. Aprueba una y confirma que el registro desaparece de `/banos` y aparece una notificación de resuelta.
4. Repite generando otra solicitud y esta vez Rechaza — confirma que el registro sigue en `/banos` sin el badge "Pendiente de revisión".
5. Con la cuenta de almacén, confirma que ve las notificaciones de resuelto pero nunca botones de acción.

- [ ] **Step 8: Commit**

```bash
git add lib/hooks/useNotificaciones.ts app/notificaciones/NotificacionesView.tsx
git commit -m "feat: aprobar/rechazar solicitudes de borrado de baños desde /notificaciones"
```

---

## Verificación final

- [ ] **Suite completa:** `npm test` — todo verde.
- [ ] **Tipos:** `npx tsc --noEmit` — sin errores.
- [ ] **Lint:** `npm run lint` — sin errores.
- [ ] **Build:** `npm run build` (usa `--webpack` + `verificar-bundle-firebase.mjs`, según AGENTS.md) — exitoso.
- [ ] **Flujo E2E manual:** repetir los pasos de los Steps 6-7 de Tasks 9 y 10 de punta a punta con dos cuentas reales (almacén + súper admin) en `smv-brain-dev`.
