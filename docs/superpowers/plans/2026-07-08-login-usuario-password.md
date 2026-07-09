# Login usuario/contraseña + administración de roles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar login con correo/contraseña junto al Google Sign-In existente, y mover los roles/correos autorizados de código estático a una colección `usuarios` en Firestore administrable desde una pantalla `/usuarios` (solo admin).

**Architecture:** Firestore `usuarios/{uid}` es la fuente de verdad de rol + acceso (con un correo admin fijo en código como respaldo "break-glass"). El cliente lee su propio documento para calcular permisos de UI; toda mutación (crear/editar/desactivar/resetear password) pasa por Route Handlers (`app/api/usuarios/*`) que usan el Admin SDK, siguiendo el patrón ya establecido en el repo (`verificarUsuarioAutorizado` + `Authorization: Bearer <idToken>`).

**Tech Stack:** Next.js 16 (App Router, Route Handlers), Firebase v12 (client) + firebase-admin v13 (server), Zod, Vitest, Firebase Cloud Functions (firebase-functions v5).

## Global Constraints

- Tipado estricto: prohibido `any` y `@ts-ignore` (CLAUDE.md).
- Toda entrada de formulario pasa por un schema de Zod antes de tocar Firestore (CLAUDE.md).
- Componentes de UI no importan Firestore directamente para mutaciones sensibles — pasan por `lib/` o, en este caso, por Route Handlers (patrón ya usado por `/api/scrape`, `/api/extraer`).
- Ningún fallo de red/sistema rompe la UI visualmente — banners con mensaje claro y reintento (CLAUDE.md).
- `creadoEn`/`actualizadoEn` obligatorios y con audit trail en cualquier entidad nueva (CLAUDE.md).
- Next.js 16: `params` de rutas dinámicas son `Promise` — siempre `await params`.
- No se ejecuta `firebase deploy` como parte de este plan — las tareas que tocan `firestore.rules` y `functions/` terminan en verificación local (`npm run build` en `functions/`), y el despliegue real queda como paso manual del usuario (Task 10).

---

### Task 1: Esquemas Zod — `Rol` y `Usuario`

**Files:**
- Modify: `lib/schemas.ts` (agregar al final, después de la línea 261 `export type Operador = z.infer<typeof OperadorSchema>`)
- Test: `tests/schemas.test.ts` (agregar al final, después de la línea 333 `})` que cierra `describe("RequisicionSchema"...)`)

**Interfaces:**
- Produces: `RolSchema` (Zod enum), `type Rol`, `ProveedorAuthSchema` (Zod enum), `type ProveedorAuth`, `UsuarioSchema` (Zod object), `type Usuario` — usados por prácticamente todas las tareas siguientes.

- [ ] **Step 1: Escribir el test que falla**

Agregar al final de `tests/schemas.test.ts`:

```ts
// ── UsuarioSchema ────────────────────────────────────────────────────────────

describe("UsuarioSchema", () => {
  const baseUsuario = {
    id: "uid-123",
    email: "compras@ejemplo.com",
    rol: "compras" as const,
    activo: true,
    proveedor: "password" as const,
    creadoPor: "jemiliano2001@gmail.com",
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  }

  it("acepta un usuario válido", () => {
    const u = UsuarioSchema.parse(baseUsuario)
    expect(u.rol).toBe("compras")
    expect(u.proveedor).toBe("password")
  })

  it("rechaza un rol fuera del enum", () => {
    const result = UsuarioSchema.safeParse({ ...baseUsuario, rol: "gerente" })
    expect(result.success).toBe(false)
  })

  it("rechaza un proveedor fuera del enum", () => {
    const result = UsuarioSchema.safeParse({ ...baseUsuario, proveedor: "facebook" })
    expect(result.success).toBe(false)
  })

  it("activo por defecto es true si se omite", () => {
    const { activo, ...sinActivo } = baseUsuario
    void activo
    const u = UsuarioSchema.parse(sinActivo)
    expect(u.activo).toBe(true)
  })

  it("rechaza un email inválido", () => {
    const result = UsuarioSchema.safeParse({ ...baseUsuario, email: "no-es-correo" })
    expect(result.success).toBe(false)
  })
})
```

Y agregar el import correspondiente arriba del archivo junto a los demás imports de `@/lib/schemas` (revisar la línea 1 del archivo para ver el import existente y agregar `UsuarioSchema` a la lista).

- [ ] **Step 2: Correr el test para confirmar que falla**

Run: `npx vitest run tests/schemas.test.ts -t "UsuarioSchema"`
Expected: FAIL — `UsuarioSchema is not defined` (no existe todavía en `lib/schemas.ts`).

- [ ] **Step 3: Implementar los schemas**

Agregar al final de `lib/schemas.ts`:

```ts
// ── Usuarios (roles y acceso, administrados desde /usuarios) ──────────────────

export const RolSchema = z.enum(["admin", "compras", "diseno", "almacen"])
export type Rol = z.infer<typeof RolSchema>

export const ProveedorAuthSchema = z.enum(["google", "password"])
export type ProveedorAuth = z.infer<typeof ProveedorAuthSchema>

export const UsuarioSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  rol: RolSchema,
  activo: z.boolean().default(true),
  proveedor: ProveedorAuthSchema,
  creadoPor: z.string(),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
})
export type Usuario = z.infer<typeof UsuarioSchema>
```

- [ ] **Step 4: Correr el test para confirmar que pasa**

Run: `npx vitest run tests/schemas.test.ts -t "UsuarioSchema"`
Expected: PASS (5 tests)

- [ ] **Step 5: Correr toda la suite para verificar que no se rompió nada**

Run: `npm test`
Expected: todos los tests existentes siguen en PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/schemas.ts tests/schemas.test.ts
git commit -m "feat: agregar esquemas Rol y Usuario para roles dinámicos"
```

---

### Task 2: Autorización de servidor sobre Firestore — `usuarios-admin` + `api-auth`

**Files:**
- Modify: `lib/authorized-emails.ts` (reescritura completa, reemplaza las 35 líneas actuales)
- Create: `lib/usuarios-admin.ts`
- Modify: `lib/api-auth.ts` (reescritura completa, reemplaza las 79 líneas actuales)
- Test: Create `tests/usuarios-admin.test.ts`
- Test: Create `tests/api-auth.test.ts`

**Interfaces:**
- Consumes: `adminAuth`, `adminDb` de `lib/firebase-admin.ts` (ya existen); `RolSchema`, `type Rol` de `lib/schemas.ts` (Task 1).
- Produces: `CORREO_ADMIN_BREAK_GLASS: string`, `esCorreoBreakGlass(email): boolean` (de `authorized-emails.ts`); `generarPasswordTemporal(longitud?): string`, `obtenerUsuarioAdmin(uid, email): Promise<{rol: Rol; activo: boolean} | null>` (de `usuarios-admin.ts`); `verificarUsuarioAutorizado(request): Promise<ResultadoAuth>`, `verificarAdmin(request): Promise<ResultadoAuth>` (de `api-auth.ts`, misma forma de `ResultadoAuth` que ya existía). Usados por todas las Route Handlers (Task 8) y por `functions/src/auth.ts` (Task 5).

- [ ] **Step 1: Reescribir `lib/authorized-emails.ts`**

```ts
/**
 * Correo con acceso admin garantizado, fijo en código como red de seguridad:
 * si el documento de Firestore correspondiente en `usuarios` se borra o se
 * corrompe, este correo nunca pierde acceso a /usuarios. Todos los demás
 * roles y correos autorizados viven en Firestore, administrados desde la
 * pantalla /usuarios.
 */
export const CORREO_ADMIN_BREAK_GLASS = "jemiliano2001@gmail.com"

export function esCorreoBreakGlass(email: string | null | undefined): boolean {
  if (!email) return false
  return email.trim().toLowerCase() === CORREO_ADMIN_BREAK_GLASS
}
```

- [ ] **Step 2: Escribir el test que falla para `generarPasswordTemporal` y `obtenerUsuarioAdmin`**

Create `tests/usuarios-admin.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockDoc, mockGet } = vi.hoisted(() => ({
  mockDoc: vi.fn(),
  mockGet: vi.fn(),
}))

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: {},
  adminDb: {
    collection: vi.fn(() => ({ doc: mockDoc })),
  },
}))

import { generarPasswordTemporal, obtenerUsuarioAdmin } from "@/lib/usuarios-admin"
import { CORREO_ADMIN_BREAK_GLASS } from "@/lib/authorized-emails"

describe("generarPasswordTemporal", () => {
  it("genera una contraseña de 16 caracteres por defecto", () => {
    expect(generarPasswordTemporal()).toHaveLength(16)
  })

  it("respeta la longitud solicitada", () => {
    expect(generarPasswordTemporal(24)).toHaveLength(24)
  })

  it("no genera dos contraseñas iguales seguidas", () => {
    const a = generarPasswordTemporal()
    const b = generarPasswordTemporal()
    expect(a).not.toBe(b)
  })
})

describe("obtenerUsuarioAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDoc.mockReturnValue({ get: mockGet })
  })

  it("devuelve rol admin para el correo break-glass sin consultar Firestore", async () => {
    const info = await obtenerUsuarioAdmin("uid-1", CORREO_ADMIN_BREAK_GLASS)
    expect(info).toEqual({ rol: "admin", activo: true })
    expect(mockGet).not.toHaveBeenCalled()
  })

  it("devuelve null si el documento no existe", async () => {
    mockGet.mockResolvedValue({ exists: false })
    const info = await obtenerUsuarioAdmin("uid-2", "compras@ejemplo.com")
    expect(info).toBeNull()
  })

  it("devuelve rol y activo desde Firestore", async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ rol: "compras", activo: true }),
    })
    const info = await obtenerUsuarioAdmin("uid-3", "compras@ejemplo.com")
    expect(info).toEqual({ rol: "compras", activo: true })
  })

  it("devuelve activo:false si el documento tiene activo:false", async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ rol: "compras", activo: false }),
    })
    const info = await obtenerUsuarioAdmin("uid-4", "compras@ejemplo.com")
    expect(info).toEqual({ rol: "compras", activo: false })
  })

  it("devuelve null si el rol guardado no es válido", () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ rol: "gerente", activo: true }),
    })
    return expect(obtenerUsuarioAdmin("uid-5", "raro@ejemplo.com")).resolves.toBeNull()
  })
})
```

- [ ] **Step 3: Correr el test para confirmar que falla**

Run: `npx vitest run tests/usuarios-admin.test.ts`
Expected: FAIL — no se puede resolver `@/lib/usuarios-admin` (el archivo no existe todavía).

- [ ] **Step 4: Crear `lib/usuarios-admin.ts` (parte 1: password + lectura)**

```ts
import { randomInt } from "node:crypto"
import { adminAuth, adminDb } from "@/lib/firebase-admin"
import { RolSchema, type Rol } from "@/lib/schemas"
import { CORREO_ADMIN_BREAK_GLASS } from "@/lib/authorized-emails"

const COLECCION = "usuarios"
const ALFABETO_PASSWORD =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%"

/** Genera una contraseña temporal aleatoria criptográficamente segura. */
export function generarPasswordTemporal(longitud = 16): string {
  let password = ""
  for (let i = 0; i < longitud; i++) {
    password += ALFABETO_PASSWORD[randomInt(ALFABETO_PASSWORD.length)]
  }
  return password
}

export interface InfoUsuarioAdmin {
  rol: Rol
  activo: boolean
}

/**
 * Resuelve rol + estado de acceso de un usuario. El correo break-glass
 * siempre resuelve a admin activo sin tocar Firestore (red de seguridad).
 */
export async function obtenerUsuarioAdmin(
  uid: string,
  email: string | null | undefined
): Promise<InfoUsuarioAdmin | null> {
  if (email && email.trim().toLowerCase() === CORREO_ADMIN_BREAK_GLASS) {
    return { rol: "admin", activo: true }
  }

  const snap = await adminDb.collection(COLECCION).doc(uid).get()
  if (!snap.exists) return null

  const data = snap.data()
  const rolParseado = RolSchema.safeParse(data?.rol)
  if (!rolParseado.success) return null

  return { rol: rolParseado.data, activo: data?.activo === true }
}
```

- [ ] **Step 5: Correr el test para confirmar que pasa**

Run: `npx vitest run tests/usuarios-admin.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 6: Escribir el test que falla para `verificarUsuarioAutorizado` y `verificarAdmin`**

Create `tests/api-auth.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockVerifyIdToken, mockObtenerUsuarioAdmin } = vi.hoisted(() => ({
  mockVerifyIdToken: vi.fn(),
  mockObtenerUsuarioAdmin: vi.fn(),
}))

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: { verifyIdToken: mockVerifyIdToken },
  adminDb: {},
}))

vi.mock("@/lib/usuarios-admin", () => ({
  obtenerUsuarioAdmin: mockObtenerUsuarioAdmin,
}))

import { verificarUsuarioAutorizado, verificarAdmin } from "@/lib/api-auth"

function makeRequest(authHeader?: string): Request {
  return new Request("http://localhost/api/test", {
    headers: authHeader ? { Authorization: authHeader } : {},
  })
}

describe("verificarUsuarioAutorizado", () => {
  beforeEach(() => vi.clearAllMocks())

  it("retorna 401 si no hay header Authorization", async () => {
    const res = await verificarUsuarioAutorizado(makeRequest())
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(401)
  })

  it("retorna 403 si el correo no está verificado", async () => {
    mockVerifyIdToken.mockResolvedValue({ email: "a@b.com", email_verified: false, uid: "u1" })
    const res = await verificarUsuarioAutorizado(makeRequest("Bearer token"))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(403)
  })

  it("retorna 403 si el usuario no existe en Firestore", async () => {
    mockVerifyIdToken.mockResolvedValue({ email: "a@b.com", email_verified: true, uid: "u1" })
    mockObtenerUsuarioAdmin.mockResolvedValue(null)
    const res = await verificarUsuarioAutorizado(makeRequest("Bearer token"))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(403)
  })

  it("retorna 403 si el usuario está desactivado", async () => {
    mockVerifyIdToken.mockResolvedValue({ email: "a@b.com", email_verified: true, uid: "u1" })
    mockObtenerUsuarioAdmin.mockResolvedValue({ rol: "compras", activo: false })
    const res = await verificarUsuarioAutorizado(makeRequest("Bearer token"))
    expect(res.ok).toBe(false)
  })

  it("retorna ok:true con uid y email si el usuario está activo", async () => {
    mockVerifyIdToken.mockResolvedValue({ email: "a@b.com", email_verified: true, uid: "u1" })
    mockObtenerUsuarioAdmin.mockResolvedValue({ rol: "compras", activo: true })
    const res = await verificarUsuarioAutorizado(makeRequest("Bearer token"))
    expect(res).toEqual({ ok: true, uid: "u1", email: "a@b.com" })
  })

  it("retorna 401 si verifyIdToken lanza (token inválido/expirado)", async () => {
    mockVerifyIdToken.mockRejectedValue(new Error("invalid token"))
    const res = await verificarUsuarioAutorizado(makeRequest("Bearer token"))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(401)
  })
})

describe("verificarAdmin", () => {
  beforeEach(() => vi.clearAllMocks())

  it("retorna 403 si el usuario está activo pero no es admin", async () => {
    mockVerifyIdToken.mockResolvedValue({ email: "a@b.com", email_verified: true, uid: "u1" })
    mockObtenerUsuarioAdmin.mockResolvedValue({ rol: "compras", activo: true })
    const res = await verificarAdmin(makeRequest("Bearer token"))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(403)
  })

  it("retorna ok:true si el usuario es admin activo", async () => {
    mockVerifyIdToken.mockResolvedValue({ email: "a@b.com", email_verified: true, uid: "u1" })
    mockObtenerUsuarioAdmin.mockResolvedValue({ rol: "admin", activo: true })
    const res = await verificarAdmin(makeRequest("Bearer token"))
    expect(res).toEqual({ ok: true, uid: "u1", email: "a@b.com" })
  })
})
```

- [ ] **Step 7: Correr el test para confirmar que falla**

Run: `npx vitest run tests/api-auth.test.ts`
Expected: FAIL — `verificarAdmin` no existe todavía en `lib/api-auth.ts`.

- [ ] **Step 8: Reescribir `lib/api-auth.ts`**

```ts
import { adminAuth } from "@/lib/firebase-admin"
import { obtenerUsuarioAdmin } from "@/lib/usuarios-admin"

type ResultadoAuth =
  | {
      ok: true
      uid: string
      email: string
    }
  | {
      ok: false
      response: Response
    }

function respuestaError(status: number, error: string): Response {
  return Response.json(
    { error },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  )
}

export async function verificarUsuarioAutorizado(request: Request): Promise<ResultadoAuth> {
  const authHeader = request.headers.get("Authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return {
      ok: false,
      response: respuestaError(401, "No autorizado"),
    }
  }

  const token = authHeader.slice("Bearer ".length).trim()
  if (!token) {
    return {
      ok: false,
      response: respuestaError(401, "No autorizado"),
    }
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token)
    const email = decodedToken.email

    if (!email || decodedToken.email_verified !== true) {
      return {
        ok: false,
        response: respuestaError(403, "Correo no verificado"),
      }
    }

    const info = await obtenerUsuarioAdmin(decodedToken.uid, email)
    if (!info || !info.activo) {
      return {
        ok: false,
        response: respuestaError(
          403,
          `Tu correo (${email}) no está autorizado para usar esta función`
        ),
      }
    }

    return {
      ok: true,
      uid: decodedToken.uid,
      email,
    }
  } catch {
    return {
      ok: false,
      response: respuestaError(401, "Token inválido o expirado"),
    }
  }
}

/** Igual que verificarUsuarioAutorizado, pero además exige rol admin. */
export async function verificarAdmin(request: Request): Promise<ResultadoAuth> {
  const base = await verificarUsuarioAutorizado(request)
  if (!base.ok) return base

  const info = await obtenerUsuarioAdmin(base.uid, base.email)
  if (!info || info.rol !== "admin") {
    return {
      ok: false,
      response: respuestaError(403, "Se requiere rol de administrador"),
    }
  }

  return base
}
```

Nota: se elimina `export { CORREOS_AUTORIZADOS } from "@/lib/authorized-emails"` — ya no existe esa constante y no tiene otros importadores (verificado con grep antes de este plan).

- [ ] **Step 9: Correr los tests para confirmar que pasan**

Run: `npx vitest run tests/api-auth.test.ts tests/usuarios-admin.test.ts`
Expected: PASS (8 + 9 tests)

- [ ] **Step 10: Typecheck y suite completa**

Run: `npm run lint && npm test`
Expected: sin errores. (El resto de rutas que importan `verificarUsuarioAutorizado` — `/api/extraer`, `/api/scrape`, etc. — no cambian su firma, así que siguen compilando.)

- [ ] **Step 11: Commit**

```bash
git add lib/authorized-emails.ts lib/usuarios-admin.ts lib/api-auth.ts tests/usuarios-admin.test.ts tests/api-auth.test.ts
git commit -m "feat: mover autorización de servidor a Firestore (usuarios-admin + api-auth)"
```

---

### Task 3: Login combinado (Google + correo/contraseña)

**Files:**
- Create: `lib/usuarios.ts`
- Modify: `lib/auth.ts` (agregar función nueva después de `iniciarSesionConGoogle`, líneas 42-46)
- Modify: `app/login/page.tsx` (reescritura completa, reemplaza las 106 líneas actuales)

**Interfaces:**
- Consumes: `esCorreoBreakGlass` de `lib/authorized-emails.ts` (Task 2), `RolSchema`/`type Rol` de `lib/schemas.ts` (Task 1), `db` de `lib/firebase.ts`, `getClienteAuth` de `lib/firebase.ts`.
- Produces: `obtenerRolUsuario(uid, email): Promise<Rol | null>` (de `lib/usuarios.ts`, también usado por el hook `useRol` en Task 6); `iniciarSesionConEmailYPassword(email, password): Promise<User>` (de `lib/auth.ts`).

- [ ] **Step 1: Escribir el test que falla para `obtenerRolUsuario`**

Create `tests/usuarios.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockGetDoc } = vi.hoisted(() => ({ mockGetDoc: vi.fn() }))

vi.mock("@/lib/firebase", () => ({ db: { type: "mocked-db" } }))

vi.mock("firebase/firestore", () => ({
  doc: vi.fn((...args: unknown[]) => ({ type: "docRef", args })),
  getDoc: mockGetDoc,
}))

import { obtenerRolUsuario } from "@/lib/usuarios"

describe("obtenerRolUsuario", () => {
  beforeEach(() => vi.clearAllMocks())

  it("devuelve admin para el correo break-glass sin leer Firestore", async () => {
    const rol = await obtenerRolUsuario("uid-1", "jemiliano2001@gmail.com")
    expect(rol).toBe("admin")
    expect(mockGetDoc).not.toHaveBeenCalled()
  })

  it("devuelve null si el documento no existe", async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false })
    const rol = await obtenerRolUsuario("uid-2", "compras@ejemplo.com")
    expect(rol).toBeNull()
  })

  it("devuelve null si el usuario está desactivado", async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ rol: "compras", activo: false }),
    })
    const rol = await obtenerRolUsuario("uid-3", "compras@ejemplo.com")
    expect(rol).toBeNull()
  })

  it("devuelve el rol si el usuario está activo", async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ rol: "diseno", activo: true }),
    })
    const rol = await obtenerRolUsuario("uid-4", "diseno@ejemplo.com")
    expect(rol).toBe("diseno")
  })
})
```

- [ ] **Step 2: Correr el test para confirmar que falla**

Run: `npx vitest run tests/usuarios.test.ts`
Expected: FAIL — no se puede resolver `@/lib/usuarios`.

- [ ] **Step 3: Crear `lib/usuarios.ts`**

```ts
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { RolSchema, type Rol } from "@/lib/schemas"
import { esCorreoBreakGlass } from "@/lib/authorized-emails"

/**
 * Resuelve el rol de un usuario autenticado leyendo su propio documento en
 * Firestore. Devuelve null si no tiene acceso (documento inexistente,
 * desactivado, o rol inválido) — el llamador debe tratar null como "sin
 * autorización".
 */
export async function obtenerRolUsuario(
  uid: string,
  email: string | null | undefined
): Promise<Rol | null> {
  if (esCorreoBreakGlass(email)) return "admin"

  const snap = await getDoc(doc(db, "usuarios", uid))
  if (!snap.exists()) return null

  const data = snap.data()
  if (data.activo !== true) return null

  const rolParseado = RolSchema.safeParse(data.rol)
  return rolParseado.success ? rolParseado.data : null
}
```

- [ ] **Step 4: Correr el test para confirmar que pasa**

Run: `npx vitest run tests/usuarios.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Agregar `iniciarSesionConEmailYPassword` a `lib/auth.ts`**

Insertar después de la función `iniciarSesionConGoogle` (después de la línea 46 `}` que la cierra) en `lib/auth.ts`, y agregar `signInWithEmailAndPassword` al import de `firebase/auth` en la línea 4-10:

```ts
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth"
```

```ts
export async function iniciarSesionConEmailYPassword(
  email: string,
  password: string
): Promise<User> {
  const result = await signInWithEmailAndPassword(getClienteAuth(), email, password)
  return result.user
}
```

- [ ] **Step 6: Reescribir `app/login/page.tsx`**

```tsx
'use client'

import LogoSMV from "@/app/LogoSMV"
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { iniciarSesionConGoogle, iniciarSesionConEmailYPassword, cerrarSesion } from '@/lib/auth'
import { obtenerRolUsuario } from '@/lib/usuarios'
import { LogIn, AlertCircle, Mail, Lock } from 'lucide-react'

const MENSAJES_ERROR: Record<string, string> = {
  no_autorizado:
    'Tu cuenta no está autorizada para SMV Hub. Contacta al administrador para solicitar acceso.',
}

const MENSAJES_ERROR_FIREBASE: Record<string, string> = {
  'auth/wrong-password': 'Contraseña incorrecta. Intenta de nuevo.',
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/user-not-found': 'No existe una cuenta con ese correo.',
  'auth/user-disabled': 'Esta cuenta fue desactivada. Contacta al administrador.',
  'auth/too-many-requests': 'Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.',
}

function mensajeErrorFirebase(err: unknown): string {
  const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : ''
  return MENSAJES_ERROR_FIREBASE[code] ?? 'Ocurrió un error al intentar iniciar sesión. Por favor, intenta nuevamente.'
}

function LoginForm() {
  const searchParams = useSearchParams()
  const codigoError = searchParams.get('error')
  const errorDesdeQuery =
    codigoError && MENSAJES_ERROR[codigoError] ? MENSAJES_ERROR[codigoError] : null

  const [error, setError] = useState<string | null>(null)
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [loadingPassword, setLoadingPassword] = useState(false)
  const [correo, setCorreo] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()

  const mensajeError = error ?? errorDesdeQuery

  async function entrarSiAutorizado(uid: string, email: string | null): Promise<void> {
    const rol = await obtenerRolUsuario(uid, email)
    if (!rol) {
      await cerrarSesion()
      setError(MENSAJES_ERROR.no_autorizado)
      return
    }
    router.push('/')
  }

  const handleLoginGoogle = async () => {
    try {
      setLoadingGoogle(true)
      setError(null)
      const usuario = await iniciarSesionConGoogle()
      await entrarSiAutorizado(usuario.uid, usuario.email)
    } catch (err: unknown) {
      console.error("Error al iniciar sesión con Google:", err instanceof Error ? err.message : "error desconocido")
      setError(mensajeErrorFirebase(err))
    } finally {
      setLoadingGoogle(false)
    }
  }

  const handleLoginPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoadingPassword(true)
      setError(null)
      const usuario = await iniciarSesionConEmailYPassword(correo, password)
      await entrarSiAutorizado(usuario.uid, usuario.email)
    } catch (err: unknown) {
      console.error("Error al iniciar sesión con correo:", err instanceof Error ? err.message : "error desconocido")
      setError(mensajeErrorFirebase(err))
    } finally {
      setLoadingPassword(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-8">

        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <LogoSMV height={44} />
          </div>
          <h1 className="text-xl font-semibold text-[#0F172A] tracking-tight mb-2">
            SMV Hub
          </h1>
          <p className="text-[#64748B] text-sm leading-relaxed">
            Inicia sesión para acceder a la plataforma interna del taller.
          </p>
        </div>

        {/* Error Message */}
        {mensajeError && (
          <div className="mb-6 p-4 bg-red-50 rounded-lg flex items-start gap-3 border border-red-100">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{mensajeError}</p>
          </div>
        )}

        {/* Google Sign-In */}
        <button
          onClick={handleLoginGoogle}
          disabled={loadingGoogle || loadingPassword}
          className="w-full flex items-center justify-center gap-3 bg-[#0F172A] hover:bg-[#1E293B] text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingGoogle ? (
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
          ) : (
            <LogIn className="h-5 w-5" />
          )}
          <span>{loadingGoogle ? 'Iniciando sesión...' : 'Ingresar con Google'}</span>
        </button>

        {/* Separator */}
        <div className="flex items-center gap-3 my-6">
          <div className="h-px flex-1 bg-[#E2E8F0]" />
          <span className="text-xs text-[#94A3B8]">o con tu usuario</span>
          <div className="h-px flex-1 bg-[#E2E8F0]" />
        </div>

        {/* Email/Password form */}
        <form onSubmit={handleLoginPassword} className="space-y-3">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
            <input
              type="email"
              required
              autoComplete="username"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="correo@ejemplo.com"
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#0369A1]"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#0369A1]"
            />
          </div>
          <button
            type="submit"
            disabled={loadingGoogle || loadingPassword}
            className="w-full flex items-center justify-center gap-2 bg-white hover:bg-[#F8FAFC] text-[#0F172A] px-6 py-2.5 rounded-lg font-medium border border-[#E2E8F0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingPassword && (
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-[#0F172A]"></div>
            )}
            <span>{loadingPassword ? 'Iniciando sesión...' : 'Ingresar'}</span>
          </button>
        </form>

      </div>

      <p className="mt-8 text-xs text-[#94A3B8]">
        Acceso restringido · SMV Maquinados
      </p>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0369A1]" />
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
```

- [ ] **Step 7: Typecheck y suite completa**

Run: `npm run lint && npm test`
Expected: sin errores.

- [ ] **Step 8: Commit**

```bash
git add lib/usuarios.ts lib/auth.ts app/login/page.tsx tests/usuarios.test.ts
git commit -m "feat: agregar login con correo/contraseña junto a Google"
```

---

### Task 4: Reglas de Firestore — colección `usuarios` y `esUsuarioAutorizado()` dinámico

**Files:**
- Modify: `firestore.rules`

**Interfaces:**
- No expone interfaces de TypeScript — es configuración de seguridad de Firestore que todas las demás colecciones (`ordenes`, `cotizaciones`, etc.) siguen usando a través de `esUsuarioAutorizado()`.

- [ ] **Step 1: Reemplazar el helper `correosAutorizados()` + `esUsuarioAutorizado()` (líneas 13-36)**

Reemplazar:

```
    // Lista blanca de correos autorizados del equipo SMV.
    // IMPORTANTE: mientras esté vacía, se permite a CUALQUIER cuenta con correo
    // verificado. Rellénala con los correos del equipo para cerrar el acceso.
    function correosAutorizados() {
      return [
        'ordenes@smv.com',
        'lorena@smv.com',
        'jemiliano2001@gmail.com',
        'diseno@smv.com',
        'almacen@smv.com',
      ];
    }

    // App Check: el cliente web debe enviar token válido (reCAPTCHA v3 + debug en dev).
    function appCheckValido() {
      return request.app != null;
    }

    function esUsuarioAutorizado() {
      return estaAutenticado() &&
        appCheckValido() &&
        (correosAutorizados().size() == 0 ||
         request.auth.token.email in correosAutorizados());
    }
```

Por:

```
    // App Check: el cliente web debe enviar token válido (reCAPTCHA v3 + debug en dev).
    function appCheckValido() {
      return request.app != null;
    }

    // Correo con acceso admin garantizado, fijo como red de seguridad — debe
    // coincidir con CORREO_ADMIN_BREAK_GLASS en lib/authorized-emails.ts.
    function esCorreoBreakGlass() {
      return request.auth.token.email == 'jemiliano2001@gmail.com';
    }

    // Autorización real vive en la colección `usuarios` (administrada desde
    // /usuarios): el documento con id = uid debe existir y tener activo == true.
    function esUsuarioAutorizado() {
      return estaAutenticado() &&
        appCheckValido() &&
        (
          esCorreoBreakGlass() ||
          (
            exists(/databases/$(database)/documents/usuarios/$(request.auth.uid)) &&
            get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.activo == true
          )
        );
    }
```

- [ ] **Step 2: Agregar el match block de la colección `usuarios`**

Insertar justo después del bloque de helpers de autorización (después del cierre de `esUsuarioAutorizado()` del Step 1, antes de la sección `// ── Validación de datos...`):

```
    // ── Usuarios (roles y acceso, administrados desde /usuarios) ─────────────

    match /usuarios/{uid} {
      // Cada quien puede leer su propio documento — AuthGuard/NavBar lo usan
      // para calcular su rol. El listado completo para /usuarios se sirve vía
      // Route Handler con Admin SDK, no lectura directa de colección.
      allow read: if estaAutenticado() && appCheckValido() && request.auth.uid == uid;
      // Todas las escrituras pasan por app/api/usuarios/* (Admin SDK, que
      // ignora estas reglas) — nunca directo desde el navegador.
      allow write: if false;
    }
```

- [ ] **Step 3: Verificar sintaxis con el emulador (dry-run, no requiere desplegar)**

Run: `npx firebase-tools@latest deploy --only firestore:rules --dry-run --project smv-brain`

Si el CLI de Firebase no está instalado/logueado en este entorno, como alternativa mínima: revisar visualmente que cada `{` tiene su `}` y que no quedaron referencias a `correosAutorizados()` (`grep -n "correosAutorizados" firestore.rules` no debe devolver nada).

Expected: sin errores de sintaxis reportados; el grep no encuentra ocurrencias de `correosAutorizados`.

- [ ] **Step 4: Commit**

```bash
git add firestore.rules
git commit -m "feat: autorización de Firestore vía colección usuarios (con fallback break-glass)"
```

---

### Task 5: Cloud Functions — `assertAuthorizedCallable` sobre Firestore

**Files:**
- Modify: `functions/src/auth.ts` (reescritura completa, reemplaza las 52 líneas actuales)
- Modify: `functions/src/recommendation.ts:42`
- Modify: `functions/src/sheetsSync.ts:26` y `:86`
- Modify: `functions/src/excelSync.ts:47`

**Interfaces:**
- Produces: `assertAuthorizedCallable(context): Promise<string>` — **cambia de síncrona a async** respecto a la versión actual; todos los call sites deben usar `await`.

- [ ] **Step 1: Reescribir `functions/src/auth.ts`**

```ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Correo con acceso garantizado, fijo como red de seguridad — debe coincidir
 * con CORREO_ADMIN_BREAK_GLASS en lib/authorized-emails.ts (app Next.js).
 */
const CORREO_ADMIN_BREAK_GLASS = 'jemiliano2001@gmail.com';

/** Verifica App Check en callables. Activar enforcement en Firebase Console → App Check. */
export function assertAppCheckCallable(context: functions.https.CallableContext): void {
  const enforce = process.env.APP_CHECK_ENFORCE !== 'false';
  if (enforce && context.app == undefined) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'App Check verification failed.'
    );
  }
}

async function usuarioActivo(uid: string, email: string): Promise<boolean> {
  if (email === CORREO_ADMIN_BREAK_GLASS) return true;
  const snap = await admin.firestore().collection('usuarios').doc(uid).get();
  return snap.exists && snap.data()?.activo === true;
}

export async function assertAuthorizedCallable(
  context: functions.https.CallableContext
): Promise<string> {
  assertAppCheckCallable(context);

  const email = context.auth?.token.email?.toLowerCase();
  const emailVerified = context.auth?.token.email_verified === true;
  const uid = context.auth?.uid;

  if (!email || !emailVerified || !uid) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated with a verified email.');
  }

  if (!(await usuarioActivo(uid, email))) {
    throw new functions.https.HttpsError('permission-denied', 'User is not authorized for this operation.');
  }

  return email;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
```

- [ ] **Step 2: Agregar `await` en los 4 call sites**

En `functions/src/recommendation.ts:42`, cambiar:
```ts
  assertAuthorizedCallable(context);
```
por:
```ts
  await assertAuthorizedCallable(context);
```

En `functions/src/sheetsSync.ts:26` y `functions/src/sheetsSync.ts:86`, mismo cambio: `assertAuthorizedCallable(context);` → `await assertAuthorizedCallable(context);`

En `functions/src/excelSync.ts:47`, mismo cambio: `assertAuthorizedCallable(context);` → `await assertAuthorizedCallable(context);`

- [ ] **Step 3: Typecheck del proyecto de functions**

Run: `cd functions && npm run build`
Expected: compila sin errores (`tsc` no reporta funciones async sin `await` como error, pero confirma que no se rompió ningún tipo).

- [ ] **Step 4: Commit**

```bash
git add functions/src/auth.ts functions/src/recommendation.ts functions/src/sheetsSync.ts functions/src/excelSync.ts
git commit -m "feat: Cloud Functions verifican autorización contra Firestore usuarios"
```

---

### Task 6: Hook de rol + `AuthGuard` + `NavBar`

**Files:**
- Create: `lib/hooks/useRol.ts`
- Modify: `lib/roles.ts` (reescritura completa, reemplaza las 54 líneas actuales)
- Modify: `app/AuthGuard.tsx` (reescritura completa, reemplaza las 38 líneas actuales)
- Modify: `app/NavBar.tsx:10`, `:47`, `:95-100`

**Interfaces:**
- Consumes: `obtenerRolUsuario` de `lib/usuarios.ts` (Task 3), `type Rol` de `lib/schemas.ts` (Task 1), `useUsuario` de `lib/auth.ts` (existente, sin cambios).
- Produces: `useRol(usuario: User | null): { rol: Rol | null; cargando: boolean }` — usado por `AuthGuard.tsx` y `NavBar.tsx`. `PERMISOS_POR_ROL` y `tienePermiso(rol, pathname)` se mantienen igual que hoy más la ruta `/usuarios`.

- [ ] **Step 1: Crear `lib/hooks/useRol.ts`**

```ts
import { useEffect, useState } from "react"
import type { User } from "firebase/auth"
import { obtenerRolUsuario } from "@/lib/usuarios"
import type { Rol } from "@/lib/schemas"

export interface EstadoRol {
  rol: Rol | null
  cargando: boolean
}

/** Resuelve el rol del usuario autenticado leyendo su documento en Firestore. */
export function useRol(usuario: User | null): EstadoRol {
  const [rol, setRol] = useState<Rol | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!usuario) {
      setRol(null)
      setCargando(false)
      return
    }

    let cancelado = false
    setCargando(true)
    obtenerRolUsuario(usuario.uid, usuario.email)
      .then((r) => {
        if (!cancelado) setRol(r)
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })

    return () => {
      cancelado = true
    }
  }, [usuario])

  return { rol, cargando }
}
```

- [ ] **Step 2: Reescribir `lib/roles.ts`**

```ts
import type { Rol } from "@/lib/schemas"

export type { Rol }

// Rutas permitidas para cada rol (rutas base).
// Nota: '/login' está permitido para todos los que no tienen sesión en AuthGuard.
export const PERMISOS_POR_ROL: Record<Rol, string[]> = {
  admin: [
    '/',
    '/nueva-compra', '/ordenes', '/importar', '/claves-sat', '/cotizaciones', '/requisiciones', '/reportes',
    '/almacen', '/ordenes-servicio', '/operadores',
    '/horas-extra', '/banos',
    '/auditoria', // Pantalla exclusiva
    '/usuarios', // Administración de accesos y roles
  ],
  compras: [
    '/',
    '/nueva-compra', '/importar', '/cotizaciones', '/requisiciones',
    '/almacen', '/ordenes-servicio', '/operadores',
    '/horas-extra', '/banos'
    // Excluidos: /ordenes, /claves-sat, /reportes, /auditoria, /usuarios
  ],
  diseno: [
    '/',
    '/cotizaciones', '/requisiciones', '/horas-extra'
  ],
  almacen: [
    '/',
    '/almacen', '/banos'
  ]
}

export function tienePermiso(rol: Rol | null, pathname: string): boolean {
  if (!rol) return false
  if (pathname === '/') return true // Todo usuario con rol puede ver la raíz

  const rutasPermitidas = PERMISOS_POR_ROL[rol]
  return rutasPermitidas.some(ruta =>
    ruta !== '/' && (pathname === ruta || pathname.startsWith(`${ruta}/`))
  )
}
```

- [ ] **Step 3: Reescribir `app/AuthGuard.tsx`**

```tsx
'use client'

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useUsuario } from "@/lib/auth"
import { useRol } from "@/lib/hooks/useRol"
import { tienePermiso } from "@/lib/roles"

// Protege rutas: solo renderiza children cuando hay usuario autenticado y con
// rol válido. Mientras carga muestra un placeholder; si no hay sesión o rol,
// redirige a /login o /.
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { usuario, cargando: cargandoAuth } = useUsuario()
  const { rol, cargando: cargandoRol } = useRol(usuario)
  const router = useRouter()
  const pathname = usePathname()
  const cargando = cargandoAuth || cargandoRol

  useEffect(() => {
    if (!cargando) {
      if (!usuario) {
        router.replace("/login")
        return
      }

      if (!tienePermiso(rol, pathname)) {
        router.replace("/")
      }
    }
  }, [cargando, usuario, rol, router, pathname])

  if (cargando || !usuario) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Cargando…</p>
      </div>
    )
  }

  return <>{children}</>
}
```

- [ ] **Step 4: Actualizar `app/NavBar.tsx`**

Reemplazar la línea 10:
```tsx
import { obtenerRol, tienePermiso } from '@/lib/roles'
```
por:
```tsx
import { tienePermiso } from '@/lib/roles'
import { useRol } from '@/lib/hooks/useRol'
```

Reemplazar la línea 47:
```tsx
  const rol = obtenerRol(usuario?.email)
```
por:
```tsx
  const { rol } = useRol(usuario)
```

Reemplazar las líneas 95-100:
```tsx
              if (rol === 'admin') {
                gruposFiltrados.push({
                  nombre: 'Administración',
                  links: [{ href: '/auditoria', label: 'Auditoría' }]
                })
              }
```
por:
```tsx
              if (rol === 'admin') {
                gruposFiltrados.push({
                  nombre: 'Administración',
                  links: [
                    { href: '/auditoria', label: 'Auditoría' },
                    { href: '/usuarios', label: 'Usuarios' },
                  ]
                })
              }
```

- [ ] **Step 5: Typecheck y suite completa**

Run: `npm run lint && npm test`
Expected: sin errores. (No hay tests automatizados de componentes React en este repo — CLAUDE.md confirma que los tests cubren lógica pura y Route Handlers, no componentes.)

- [ ] **Step 6: Commit**

```bash
git add lib/hooks/useRol.ts lib/roles.ts app/AuthGuard.tsx app/NavBar.tsx
git commit -m "feat: AuthGuard y NavBar leen rol desde Firestore vía useRol"
```

---

### Task 7: Completar `lib/usuarios-admin.ts` — crear, editar, resetear, listar

**Files:**
- Modify: `lib/usuarios-admin.ts` (agregar al final del archivo creado en Task 2)
- Modify: `tests/usuarios-admin.test.ts` (agregar al final)

**Interfaces:**
- Consumes: `adminAuth`, `adminDb` de `lib/firebase-admin.ts`; `type Usuario`, `type Rol` de `lib/schemas.ts`.
- Produces: `crearUsuarioAdmin(payload): Promise<{uid: string; tempPassword: string}>`, `actualizarUsuarioAdmin(uid, cambios): Promise<void>`, `resetearPasswordAdmin(uid): Promise<string>`, `listarUsuariosAdmin(): Promise<Usuario[]>` — usados por las Route Handlers de Task 8.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `tests/usuarios-admin.test.ts` (ajustar el mock de `adminDb`/`adminAuth` del `vi.mock("@/lib/firebase-admin", ...)` en la cabecera del archivo, agregando los métodos que faltan):

Reemplazar el bloque `vi.mock("@/lib/firebase-admin", ...)` existente (del Step 2 de Task 2) por:

```ts
const {
  mockDoc,
  mockGet,
  mockSet,
  mockUpdate,
  mockCreateUser,
  mockUpdateUser,
  mockOrderBy,
  mockCollectionGet,
} = vi.hoisted(() => ({
  mockDoc: vi.fn(),
  mockGet: vi.fn(),
  mockSet: vi.fn(),
  mockUpdate: vi.fn(),
  mockCreateUser: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockOrderBy: vi.fn(),
  mockCollectionGet: vi.fn(),
}))

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: {
    createUser: mockCreateUser,
    updateUser: mockUpdateUser,
  },
  adminDb: {
    collection: vi.fn(() => ({
      doc: mockDoc,
      orderBy: mockOrderBy,
    })),
  },
}))
```

Y agregar al final del archivo:

```ts
import {
  crearUsuarioAdmin,
  actualizarUsuarioAdmin,
  resetearPasswordAdmin,
  listarUsuariosAdmin,
} from "@/lib/usuarios-admin"

describe("crearUsuarioAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDoc.mockReturnValue({ set: mockSet, update: mockUpdate })
  })

  it("crea la cuenta en Auth con emailVerified:true y el documento en Firestore", async () => {
    mockCreateUser.mockResolvedValue({ uid: "uid-nuevo" })
    const resultado = await crearUsuarioAdmin({
      email: "nuevo@ejemplo.com",
      rol: "compras",
      creadoPor: "jemiliano2001@gmail.com",
    })

    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "nuevo@ejemplo.com", emailVerified: true })
    )
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "nuevo@ejemplo.com",
        rol: "compras",
        activo: true,
        proveedor: "password",
        creadoPor: "jemiliano2001@gmail.com",
      })
    )
    expect(resultado.uid).toBe("uid-nuevo")
    expect(resultado.tempPassword).toHaveLength(16)
  })
})

describe("actualizarUsuarioAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDoc.mockReturnValue({ update: mockUpdate })
  })

  it("actualiza el rol en Firestore sin tocar Auth", async () => {
    await actualizarUsuarioAdmin("uid-1", { rol: "diseno" })
    expect(mockUpdateUser).not.toHaveBeenCalled()
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ rol: "diseno" }))
  })

  it("al desactivar, deshabilita la cuenta en Auth y activo:false en Firestore", async () => {
    await actualizarUsuarioAdmin("uid-1", { activo: false })
    expect(mockUpdateUser).toHaveBeenCalledWith("uid-1", { disabled: true })
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ activo: false }))
  })

  it("al reactivar, habilita la cuenta en Auth y activo:true en Firestore", async () => {
    await actualizarUsuarioAdmin("uid-1", { activo: true })
    expect(mockUpdateUser).toHaveBeenCalledWith("uid-1", { disabled: false })
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ activo: true }))
  })
})

describe("resetearPasswordAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDoc.mockReturnValue({ update: mockUpdate })
  })

  it("genera una nueva contraseña temporal y la aplica en Auth", async () => {
    const tempPassword = await resetearPasswordAdmin("uid-1")
    expect(tempPassword).toHaveLength(16)
    expect(mockUpdateUser).toHaveBeenCalledWith("uid-1", { password: tempPassword })
  })
})

describe("listarUsuariosAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOrderBy.mockReturnValue({ get: mockCollectionGet })
  })

  it("mapea los documentos de Firestore a Usuario[]", async () => {
    const ahora = new Date("2026-07-08T12:00:00Z")
    mockCollectionGet.mockResolvedValue({
      docs: [
        {
          id: "uid-1",
          data: () => ({
            email: "compras@ejemplo.com",
            rol: "compras",
            activo: true,
            proveedor: "password",
            creadoPor: "jemiliano2001@gmail.com",
            creadoEn: { toDate: () => ahora },
            actualizadoEn: { toDate: () => ahora },
          }),
        },
      ],
    })

    const usuarios = await listarUsuariosAdmin()
    expect(usuarios).toHaveLength(1)
    expect(usuarios[0]).toMatchObject({ id: "uid-1", email: "compras@ejemplo.com", rol: "compras" })
  })
})
```

- [ ] **Step 2: Correr los tests para confirmar que fallan**

Run: `npx vitest run tests/usuarios-admin.test.ts`
Expected: FAIL — `crearUsuarioAdmin`, `actualizarUsuarioAdmin`, `resetearPasswordAdmin`, `listarUsuariosAdmin` no existen todavía.

- [ ] **Step 3: Agregar las funciones a `lib/usuarios-admin.ts`**

Agregar al final del archivo (después de `obtenerUsuarioAdmin`), y agregar `type Usuario` al import de `@/lib/schemas` en la cabecera:

```ts
import { RolSchema, type Rol, type Usuario } from "@/lib/schemas"
```

```ts
export interface NuevoUsuarioPayload {
  email: string
  rol: Rol
  creadoPor: string
}

export interface UsuarioCreado {
  uid: string
  tempPassword: string
}

/** Crea la cuenta en Firebase Auth (con contraseña temporal y correo ya
 * verificado, porque el admin da fe del correo) y su documento en Firestore. */
export async function crearUsuarioAdmin(payload: NuevoUsuarioPayload): Promise<UsuarioCreado> {
  const tempPassword = generarPasswordTemporal()
  const cuenta = await adminAuth.createUser({
    email: payload.email,
    password: tempPassword,
    emailVerified: true,
  })

  const ahora = new Date()
  await adminDb.collection(COLECCION).doc(cuenta.uid).set({
    email: payload.email,
    rol: payload.rol,
    activo: true,
    proveedor: "password",
    creadoPor: payload.creadoPor,
    creadoEn: ahora,
    actualizadoEn: ahora,
  })

  return { uid: cuenta.uid, tempPassword }
}

export interface CambiosUsuarioAdmin {
  rol?: Rol
  activo?: boolean
}

/** Actualiza rol y/o estado de acceso. Al cambiar `activo`, además
 * habilita/deshabilita la cuenta en Firebase Auth (doble candado: aunque a
 * alguien le quede una sesión abierta, el siguiente refresh de token falla). */
export async function actualizarUsuarioAdmin(
  uid: string,
  cambios: CambiosUsuarioAdmin
): Promise<void> {
  if (cambios.activo !== undefined) {
    await adminAuth.updateUser(uid, { disabled: !cambios.activo })
  }

  await adminDb.collection(COLECCION).doc(uid).update({
    ...cambios,
    actualizadoEn: new Date(),
  })
}

/** Genera y aplica una nueva contraseña temporal. Se muestra una sola vez al
 * admin — no se persiste en texto plano en ningún lado. */
export async function resetearPasswordAdmin(uid: string): Promise<string> {
  const tempPassword = generarPasswordTemporal()
  await adminAuth.updateUser(uid, { password: tempPassword })
  await adminDb.collection(COLECCION).doc(uid).update({ actualizadoEn: new Date() })
  return tempPassword
}

export async function listarUsuariosAdmin(): Promise<Usuario[]> {
  const snap = await adminDb.collection(COLECCION).orderBy("email", "asc").get()
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      email: data.email,
      rol: data.rol,
      activo: data.activo,
      proveedor: data.proveedor,
      creadoPor: data.creadoPor,
      creadoEn: data.creadoEn?.toDate?.() ?? new Date(),
      actualizadoEn: data.actualizadoEn?.toDate?.() ?? new Date(),
    } as Usuario
  })
}
```

- [ ] **Step 4: Correr los tests para confirmar que pasan**

Run: `npx vitest run tests/usuarios-admin.test.ts`
Expected: PASS (9 + 8 tests)

- [ ] **Step 5: Suite completa**

Run: `npm run lint && npm test`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/usuarios-admin.ts tests/usuarios-admin.test.ts
git commit -m "feat: CRUD admin de usuarios (crear, editar, resetear password, listar)"
```

---

### Task 8: Route Handlers de administración — `app/api/usuarios/*`

**Files:**
- Create: `app/api/usuarios/route.ts`
- Create: `app/api/usuarios/[uid]/route.ts`
- Create: `app/api/usuarios/[uid]/reset-password/route.ts`
- Test: Create `tests/api-usuarios.test.ts`
- Test: Create `tests/api-usuarios-uid.test.ts`

**Interfaces:**
- Consumes: `verificarAdmin` de `lib/api-auth.ts` (Task 2); `crearUsuarioAdmin`, `actualizarUsuarioAdmin`, `resetearPasswordAdmin`, `listarUsuariosAdmin` de `lib/usuarios-admin.ts` (Tasks 2 y 7); `RolSchema` de `lib/schemas.ts`.
- Produces: contrato HTTP consumido por el hook `useUsuarios` (Task 9):
  - `GET /api/usuarios` → `{ usuarios: Array<Usuario con creadoEn/actualizadoEn como string ISO> }`
  - `POST /api/usuarios` con `{ email: string; rol: Rol }` → `{ uid: string; tempPassword: string }` (201)
  - `PATCH /api/usuarios/{uid}` con `{ rol?: Rol; activo?: boolean }` → `{ ok: true }`
  - `POST /api/usuarios/{uid}/reset-password` → `{ tempPassword: string }`

- [ ] **Step 1: Escribir el test que falla para `GET`/`POST /api/usuarios`**

Create `tests/api-usuarios.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockVerificarAdmin, mockListar, mockCrear } = vi.hoisted(() => ({
  mockVerificarAdmin: vi.fn(),
  mockListar: vi.fn(),
  mockCrear: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({ verificarAdmin: mockVerificarAdmin }))
vi.mock("@/lib/usuarios-admin", () => ({
  listarUsuariosAdmin: mockListar,
  crearUsuarioAdmin: mockCrear,
}))

import { GET, POST } from "@/app/api/usuarios/route"

function makeRequest(method: string, body?: unknown): Request {
  return new Request("http://localhost/api/usuarios", {
    method,
    headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe("GET /api/usuarios", () => {
  beforeEach(() => vi.clearAllMocks())

  it("retorna 403 si no es admin", async () => {
    mockVerificarAdmin.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Se requiere rol de administrador" }, { status: 403 }),
    })
    const res = await GET(makeRequest("GET"))
    expect(res.status).toBe(403)
    expect(mockListar).not.toHaveBeenCalled()
  })

  it("retorna la lista de usuarios si es admin", async () => {
    mockVerificarAdmin.mockResolvedValue({ ok: true, uid: "u1", email: "jemiliano2001@gmail.com" })
    mockListar.mockResolvedValue([
      {
        id: "uid-1",
        email: "compras@ejemplo.com",
        rol: "compras",
        activo: true,
        proveedor: "password",
        creadoPor: "jemiliano2001@gmail.com",
        creadoEn: new Date("2026-07-08T00:00:00Z"),
        actualizadoEn: new Date("2026-07-08T00:00:00Z"),
      },
    ])
    const res = await GET(makeRequest("GET"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.usuarios).toHaveLength(1)
    expect(body.usuarios[0].email).toBe("compras@ejemplo.com")
  })
})

describe("POST /api/usuarios", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerificarAdmin.mockResolvedValue({ ok: true, uid: "u1", email: "jemiliano2001@gmail.com" })
  })

  it("retorna 403 si no es admin", async () => {
    mockVerificarAdmin.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Se requiere rol de administrador" }, { status: 403 }),
    })
    const res = await POST(makeRequest("POST", { email: "a@b.com", rol: "compras" }))
    expect(res.status).toBe(403)
  })

  it("retorna 400 si el body es inválido", async () => {
    const res = await POST(makeRequest("POST", { email: "no-es-correo", rol: "compras" }))
    expect(res.status).toBe(400)
    expect(mockCrear).not.toHaveBeenCalled()
  })

  it("crea el usuario y retorna 201 con la contraseña temporal", async () => {
    mockCrear.mockResolvedValue({ uid: "uid-nuevo", tempPassword: "abc123" })
    const res = await POST(makeRequest("POST", { email: "nuevo@ejemplo.com", rol: "compras" }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toEqual({ uid: "uid-nuevo", tempPassword: "abc123" })
    expect(mockCrear).toHaveBeenCalledWith({
      email: "nuevo@ejemplo.com",
      rol: "compras",
      creadoPor: "jemiliano2001@gmail.com",
    })
  })

  it("retorna 409 con mensaje claro si el correo ya existe", async () => {
    mockCrear.mockRejectedValue(Object.assign(new Error("exists"), { code: "auth/email-already-exists" }))
    const res = await POST(makeRequest("POST", { email: "repetido@ejemplo.com", rol: "compras" }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/ya tiene cuenta/i)
  })
})
```

- [ ] **Step 2: Correr el test para confirmar que falla**

Run: `npx vitest run tests/api-usuarios.test.ts`
Expected: FAIL — no se puede resolver `@/app/api/usuarios/route`.

- [ ] **Step 3: Crear `app/api/usuarios/route.ts`**

```ts
import { z } from "zod"
import { verificarAdmin } from "@/lib/api-auth"
import { listarUsuariosAdmin, crearUsuarioAdmin } from "@/lib/usuarios-admin"
import { RolSchema } from "@/lib/schemas"

const NuevoUsuarioSchema = z.object({
  email: z.string().email(),
  rol: RolSchema,
})

export async function GET(request: Request) {
  const auth = await verificarAdmin(request)
  if (!auth.ok) return auth.response

  const usuarios = await listarUsuariosAdmin()
  return Response.json({
    usuarios: usuarios.map((u) => ({
      ...u,
      creadoEn: u.creadoEn.toISOString(),
      actualizadoEn: u.actualizadoEn.toISOString(),
    })),
  })
}

export async function POST(request: Request) {
  const auth = await verificarAdmin(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  const parseResult = NuevoUsuarioSchema.safeParse(body)
  if (!parseResult.success) {
    return Response.json({ error: "Correo o rol inválido" }, { status: 400 })
  }

  try {
    const resultado = await crearUsuarioAdmin({
      ...parseResult.data,
      creadoPor: auth.email,
    })
    return Response.json(resultado, { status: 201 })
  } catch (error: unknown) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : ""
    if (code === "auth/email-already-exists") {
      return Response.json({ error: "Ese correo ya tiene cuenta" }, { status: 409 })
    }
    console.error("Error creando usuario:", error instanceof Error ? error.message : "error desconocido")
    return Response.json({ error: "No se pudo crear el usuario" }, { status: 500 })
  }
}
```

- [ ] **Step 4: Correr el test para confirmar que pasa**

Run: `npx vitest run tests/api-usuarios.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Escribir el test que falla para `PATCH` y `reset-password`**

Create `tests/api-usuarios-uid.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockVerificarAdmin, mockActualizar, mockResetear } = vi.hoisted(() => ({
  mockVerificarAdmin: vi.fn(),
  mockActualizar: vi.fn(),
  mockResetear: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({ verificarAdmin: mockVerificarAdmin }))
vi.mock("@/lib/usuarios-admin", () => ({
  actualizarUsuarioAdmin: mockActualizar,
  resetearPasswordAdmin: mockResetear,
}))

import { PATCH } from "@/app/api/usuarios/[uid]/route"
import { POST as resetPassword } from "@/app/api/usuarios/[uid]/reset-password/route"

function makeRequest(method: string, body?: unknown): Request {
  return new Request("http://localhost/api/usuarios/uid-1", {
    method,
    headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
}

const params = Promise.resolve({ uid: "uid-1" })

describe("PATCH /api/usuarios/[uid]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerificarAdmin.mockResolvedValue({ ok: true, uid: "admin-1", email: "jemiliano2001@gmail.com" })
  })

  it("retorna 403 si no es admin", async () => {
    mockVerificarAdmin.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Se requiere rol de administrador" }, { status: 403 }),
    })
    const res = await PATCH(makeRequest("PATCH", { rol: "diseno" }), { params })
    expect(res.status).toBe(403)
  })

  it("retorna 400 si el body no tiene rol ni activo", async () => {
    const res = await PATCH(makeRequest("PATCH", {}), { params })
    expect(res.status).toBe(400)
    expect(mockActualizar).not.toHaveBeenCalled()
  })

  it("actualiza el rol", async () => {
    const res = await PATCH(makeRequest("PATCH", { rol: "diseno" }), { params })
    expect(res.status).toBe(200)
    expect(mockActualizar).toHaveBeenCalledWith("uid-1", { rol: "diseno" })
  })

  it("actualiza activo", async () => {
    const res = await PATCH(makeRequest("PATCH", { activo: false }), { params })
    expect(res.status).toBe(200)
    expect(mockActualizar).toHaveBeenCalledWith("uid-1", { activo: false })
  })
})

describe("POST /api/usuarios/[uid]/reset-password", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerificarAdmin.mockResolvedValue({ ok: true, uid: "admin-1", email: "jemiliano2001@gmail.com" })
  })

  it("retorna 403 si no es admin", async () => {
    mockVerificarAdmin.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Se requiere rol de administrador" }, { status: 403 }),
    })
    const res = await resetPassword(makeRequest("POST"), { params })
    expect(res.status).toBe(403)
  })

  it("resetea la contraseña y la retorna", async () => {
    mockResetear.mockResolvedValue("nueva-temp-123")
    const res = await resetPassword(makeRequest("POST"), { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ tempPassword: "nueva-temp-123" })
    expect(mockResetear).toHaveBeenCalledWith("uid-1")
  })
})
```

- [ ] **Step 6: Correr el test para confirmar que falla**

Run: `npx vitest run tests/api-usuarios-uid.test.ts`
Expected: FAIL — no se pueden resolver las rutas `[uid]`.

- [ ] **Step 7: Crear `app/api/usuarios/[uid]/route.ts`**

```ts
import { z } from "zod"
import { verificarAdmin } from "@/lib/api-auth"
import { actualizarUsuarioAdmin } from "@/lib/usuarios-admin"
import { RolSchema } from "@/lib/schemas"

const CambiosUsuarioSchema = z
  .object({
    rol: RolSchema.optional(),
    activo: z.boolean().optional(),
  })
  .refine((c) => c.rol !== undefined || c.activo !== undefined, {
    message: "Debe incluir rol y/o activo",
  })

export async function PATCH(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const auth = await verificarAdmin(request)
  if (!auth.ok) return auth.response

  const { uid } = await params
  const body = await request.json().catch(() => null)
  const parseResult = CambiosUsuarioSchema.safeParse(body)
  if (!parseResult.success) {
    return Response.json({ error: "Debe incluir rol y/o activo" }, { status: 400 })
  }

  try {
    await actualizarUsuarioAdmin(uid, parseResult.data)
    return Response.json({ ok: true })
  } catch (error: unknown) {
    console.error("Error actualizando usuario:", error instanceof Error ? error.message : "error desconocido")
    return Response.json({ error: "No se pudo actualizar el usuario" }, { status: 500 })
  }
}
```

- [ ] **Step 8: Crear `app/api/usuarios/[uid]/reset-password/route.ts`**

```ts
import { verificarAdmin } from "@/lib/api-auth"
import { resetearPasswordAdmin } from "@/lib/usuarios-admin"

export async function POST(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const auth = await verificarAdmin(request)
  if (!auth.ok) return auth.response

  const { uid } = await params
  try {
    const tempPassword = await resetearPasswordAdmin(uid)
    return Response.json({ tempPassword })
  } catch (error: unknown) {
    console.error("Error reseteando password:", error instanceof Error ? error.message : "error desconocido")
    return Response.json({ error: "No se pudo resetear la contraseña" }, { status: 500 })
  }
}
```

- [ ] **Step 9: Correr los tests para confirmar que pasan**

Run: `npx vitest run tests/api-usuarios-uid.test.ts tests/api-usuarios.test.ts`
Expected: PASS (6 + 6 tests)

- [ ] **Step 10: Suite completa**

Run: `npm run lint && npm test`
Expected: sin errores.

- [ ] **Step 11: Commit**

```bash
git add app/api/usuarios tests/api-usuarios.test.ts tests/api-usuarios-uid.test.ts
git commit -m "feat: Route Handlers de administración de usuarios (/api/usuarios)"
```

---

### Task 9: Pantalla de administración `/usuarios`

**Files:**
- Create: `lib/hooks/useUsuarios.ts`
- Create: `app/usuarios/page.tsx`

**Interfaces:**
- Consumes: `getClienteAuth` de `lib/firebase.ts`; contrato HTTP de `/api/usuarios*` (Task 8); `type Rol` de `lib/schemas.ts`.
- Produces: página `/usuarios` — protegida por `AuthGuard` + `PERMISOS_POR_ROL.admin` (ya incluye `/usuarios` desde Task 6), sin exports consumidos por otras tareas.

- [ ] **Step 1: Crear `lib/hooks/useUsuarios.ts`**

```ts
import { useState, useEffect, useCallback } from "react"
import { getClienteAuth } from "@/lib/firebase"
import type { Rol } from "@/lib/schemas"

export interface UsuarioAdmin {
  id: string
  email: string
  rol: Rol
  activo: boolean
  proveedor: "google" | "password"
  creadoPor: string
  creadoEn: string
  actualizadoEn: string
}

async function headersAutenticados(): Promise<HeadersInit> {
  const token = await getClienteAuth().currentUser?.getIdToken()
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsuarios = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/usuarios", { headers: await headersAutenticados() })
      if (!res.ok) throw new Error("No se pudo cargar la lista de usuarios")
      const data = await res.json()
      setUsuarios(data.usuarios)
    } catch (err) {
      console.error("Error cargando usuarios:", err)
      setError("No se pudo cargar la lista de usuarios. Intenta de nuevo.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsuarios()
  }, [fetchUsuarios])

  async function crearUsuario(email: string, rol: Rol): Promise<string> {
    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: await headersAutenticados(),
      body: JSON.stringify({ email, rol }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "No se pudo crear el usuario")
    await fetchUsuarios()
    return data.tempPassword as string
  }

  async function cambiarRol(uid: string, rol: Rol): Promise<void> {
    const res = await fetch(`/api/usuarios/${uid}`, {
      method: "PATCH",
      headers: await headersAutenticados(),
      body: JSON.stringify({ rol }),
    })
    if (!res.ok) throw new Error("No se pudo cambiar el rol")
    await fetchUsuarios()
  }

  async function cambiarActivo(uid: string, activo: boolean): Promise<void> {
    const res = await fetch(`/api/usuarios/${uid}`, {
      method: "PATCH",
      headers: await headersAutenticados(),
      body: JSON.stringify({ activo }),
    })
    if (!res.ok) throw new Error("No se pudo cambiar el acceso")
    await fetchUsuarios()
  }

  async function resetearPassword(uid: string): Promise<string> {
    const res = await fetch(`/api/usuarios/${uid}/reset-password`, {
      method: "POST",
      headers: await headersAutenticados(),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "No se pudo resetear la contraseña")
    return data.tempPassword as string
  }

  return {
    usuarios,
    loading,
    error,
    fetchUsuarios,
    crearUsuario,
    cambiarRol,
    cambiarActivo,
    resetearPassword,
  }
}
```

- [ ] **Step 2: Crear `app/usuarios/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { UserPlus, Copy, Check, AlertCircle } from 'lucide-react'
import { useUsuarios, type UsuarioAdmin } from '@/lib/hooks/useUsuarios'
import type { Rol } from '@/lib/schemas'

const ROLES: Rol[] = ['admin', 'compras', 'diseno', 'almacen']

function BannerPasswordTemporal({ password, onClose }: { password: string; onClose: () => void }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    await navigator.clipboard.writeText(password)
    setCopiado(true)
  }

  return (
    <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
      <p className="text-sm text-blue-900 mb-2">
        Contraseña temporal — cópiala ahora, no se vuelve a mostrar:
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-white px-3 py-2 rounded border border-blue-200 text-sm font-mono">
          {password}
        </code>
        <button
          onClick={copiar}
          className="flex items-center gap-1 px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
        >
          {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copiado ? 'Copiada' : 'Copiar'}
        </button>
        <button onClick={onClose} className="px-3 py-2 text-sm text-blue-700 hover:underline">
          Cerrar
        </button>
      </div>
    </div>
  )
}

function FormNuevoUsuario({ onCrear }: { onCrear: (email: string, rol: Rol) => Promise<void> }) {
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState<Rol>('compras')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      await onCrear(email, rol)
      setEmail('')
      setRol('compras')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el usuario')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-8 p-4 bg-white rounded-lg border border-gray-200 flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[220px]">
        <label className="block text-xs font-medium text-gray-500 mb-1">Correo</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="persona@gmail.com"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Rol</label>
        <select
          value={rol}
          onChange={(e) => setRol(e.target.value as Rol)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={enviando}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0F172A] hover:bg-[#1E293B] text-white text-sm font-medium disabled:opacity-50"
      >
        <UserPlus className="h-4 w-4" />
        {enviando ? 'Creando...' : 'Nuevo usuario'}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  )
}

function FilaUsuario({
  usuario,
  onCambiarRol,
  onCambiarActivo,
  onResetearPassword,
}: {
  usuario: UsuarioAdmin
  onCambiarRol: (uid: string, rol: Rol) => Promise<void>
  onCambiarActivo: (uid: string, activo: boolean) => Promise<void>
  onResetearPassword: (uid: string) => Promise<void>
}) {
  return (
    <tr className="border-b border-gray-100">
      <td className="px-4 py-3 text-sm text-gray-900">{usuario.email}</td>
      <td className="px-4 py-3">
        <select
          value={usuario.rol}
          onChange={(e) => onCambiarRol(usuario.id, e.target.value as Rol)}
          className="text-sm rounded border border-gray-200 px-2 py-1"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">{usuario.proveedor}</td>
      <td className="px-4 py-3">
        <button
          onClick={() => onCambiarActivo(usuario.id, !usuario.activo)}
          className={`text-xs font-medium px-2 py-1 rounded-full ${
            usuario.activo ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {usuario.activo ? 'Activo' : 'Desactivado'}
        </button>
      </td>
      <td className="px-4 py-3">
        {usuario.proveedor === 'password' && (
          <button
            onClick={() => onResetearPassword(usuario.id)}
            className="text-xs text-[#0369A1] hover:underline"
          >
            Resetear contraseña
          </button>
        )}
      </td>
    </tr>
  )
}

export default function UsuariosPage() {
  const { usuarios, loading, error, crearUsuario, cambiarRol, cambiarActivo, resetearPassword } = useUsuarios()
  const [passwordTemporal, setPasswordTemporal] = useState<string | null>(null)

  async function handleCrear(email: string, rol: Rol) {
    const tempPassword = await crearUsuario(email, rol)
    setPasswordTemporal(tempPassword)
  }

  async function handleResetPassword(uid: string) {
    const tempPassword = await resetearPassword(uid)
    setPasswordTemporal(tempPassword)
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-xl font-semibold text-[#0F172A] mb-1">Usuarios</h1>
      <p className="text-sm text-[#64748B] mb-6">Administra quién puede entrar a SMV Hub y qué ve cada quien.</p>

      {passwordTemporal && (
        <BannerPasswordTemporal password={passwordTemporal} onClose={() => setPasswordTemporal(null)} />
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 rounded-lg flex items-start gap-3 border border-red-100">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <FormNuevoUsuario onCrear={handleCrear} />

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500">
              <th className="px-4 py-3">Correo</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Proveedor</th>
              <th className="px-4 py-3">Acceso</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">Cargando…</td></tr>
            ) : usuarios.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">Sin usuarios todavía.</td></tr>
            ) : (
              usuarios.map((u) => (
                <FilaUsuario
                  key={u.id}
                  usuario={u}
                  onCambiarRol={cambiarRol}
                  onCambiarActivo={cambiarActivo}
                  onResetearPassword={handleResetPassword}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Verificar que la ruta está protegida**

Revisar `app/layout.tsx` (o el layout que envuelve las páginas) para confirmar que `AuthGuard` envuelve todas las rutas salvo `/login` — si es así, `/usuarios` ya queda protegida automáticamente y `tienePermiso('compras', '/usuarios')` (Task 6) la bloquea para no-admins sin cambios adicionales.

- [ ] **Step 4: Typecheck y suite completa**

Run: `npm run lint && npm test`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add lib/hooks/useUsuarios.ts app/usuarios
git commit -m "feat: pantalla /usuarios para administrar accesos y roles"
```

---

### Task 10: Verificación manual end-to-end y checklist de despliegue

**Files:** ninguno (solo verificación manual — no se ejecutan comandos de despliegue en esta tarea).

- [ ] **Step 1: Suite completa una última vez**

Run: `npm run lint && npm test`
Expected: sin errores, todos los tests en PASS.

- [ ] **Step 2: Levantar el servidor de desarrollo**

Run: `npm run dev`
Abrir `http://localhost:3000/login` en el navegador.

- [ ] **Step 3: Verificar login con Google (tu cuenta admin)**

Entrar con Google (`jemiliano2001@gmail.com`). Debe redirigir a `/` y el NavBar debe mostrar el grupo "Administración" con los links "Auditoría" y "Usuarios".

- [ ] **Step 4: Verificar la pantalla `/usuarios`**

Entrar a `/usuarios`. Debe listar tu propio usuario (vía el fallback break-glass, no necesariamente un documento en Firestore). Crear un usuario de prueba con un correo Gmail real que puedas controlar y rol `compras` — debe aparecer el banner con la contraseña temporal.

- [ ] **Step 5: Verificar login con usuario/contraseña**

En una ventana de incógnito, ir a `/login` y entrar con el correo y la contraseña temporal del usuario de prueba. Debe redirigir a `/` y el NavBar debe mostrar solo los módulos permitidos para `compras` (sin "Administración").

- [ ] **Step 6: Verificar desactivar/reactivar**

Desde `/usuarios` (con tu cuenta admin), desactivar al usuario de prueba. En la ventana de incógnito, refrescar cualquier página — debe expulsar a `/login` (o fallar el siguiente intento de login). Reactivarlo y confirmar que puede volver a entrar.

- [ ] **Step 7: Verificar resetear contraseña**

Desde `/usuarios`, resetear la contraseña del usuario de prueba. Confirmar en incógnito que la contraseña anterior ya no funciona y la nueva sí.

- [ ] **Step 8: Prerequisito de consola — Email/Password provider**

Si el Step 5 falla con `auth/operation-not-allowed`: ir a Firebase Console → proyecto `smv-brain` → Authentication → Sign-in method → habilitar **Email/Password**. Esto es un prerequisito de configuración que no se puede activar por código.

- [ ] **Step 9: Checklist de despliegue (a ejecutar manualmente por el usuario, fuera de este plan)**

```bash
# Reglas de Firestore (Task 4)
firebase deploy --only firestore:rules --project smv-brain

# Cloud Functions (Task 5)
cd functions && npm run build && cd ..
firebase deploy --only functions --project smv-brain

# App Next.js (hosting site smv-hub)
npm run build
firebase deploy --only hosting:smv-hub --project smv-brain
```

- [ ] **Step 10: Migrar los usuarios existentes a Firestore**

`jemiliano2001@gmail.com` no requiere acción — queda cubierto por el fallback break-glass sin necesidad de documento en Firestore.

`lorena@smv.com` ya inició sesión con Google antes de este cambio, así que ya tiene una cuenta en Firebase Auth — la pantalla `/usuarios` **no sirve para darla de alta** (su botón "Nuevo usuario" llama `crearUsuarioAdmin`, que falla con `auth/email-already-exists` si la cuenta ya existe). Para migrarla:
1. Firebase Console → Authentication → Users → buscar `lorena@smv.com` → copiar su `User UID`.
2. Firestore Database → colección `usuarios` → crear documento nuevo con **ID = ese UID** y campos: `email: "lorena@smv.com"`, `rol: "compras"`, `activo: true`, `proveedor: "google"`, `creadoPor: "jemiliano2001@gmail.com"`, `creadoEn`/`actualizadoEn`: timestamp actual.

Los placeholders `diseno@smv.com` / `almacen@smv.com` no requieren acción hasta tener los correos reales del equipo — cuando los tengas, si son personas que nunca han entrado, créalas directamente como usuario/contraseña desde `/usuarios` (Task 9); si alguna ya entró antes con Google, repite el procedimiento manual de este mismo paso.
