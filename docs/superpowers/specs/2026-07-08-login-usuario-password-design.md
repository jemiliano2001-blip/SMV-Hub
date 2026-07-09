# Diseño: Login con usuario/contraseña + administración de roles dinámica

**Fecha:** 2026-07-08
**Módulos:** `/login`, `/usuarios` (nuevo), `lib/auth.ts`, `lib/roles.ts`, `lib/authorized-emails.ts`,
`lib/api-auth.ts`, `functions/src/auth.ts`
**Estado:** aprobado

---

## Problema

Hoy la única forma de entrar a SMV Hub es Google Sign-In (`lib/auth.ts`), y el correo
autorizado con su rol vive **hardcodeado en código** (`lib/authorized-emails.ts`,
`lib/roles.ts`, y una tercera copia duplicada en `functions/src/auth.ts`). Esto tiene dos
problemas:

1. El equipo de compras/almacén/diseño no necesariamente tiene cuentas de Google —
   necesitan poder entrar con usuario y contraseña.
2. Dar de alta, cambiar de rol o dar de baja a alguien requiere que un desarrollador edite
   código y redespliegue.

## Alcance

- Login combinado: botón de Google (como hoy) + formulario de correo/contraseña, ambos
  siempre visibles en `/login`.
- Pantalla `/usuarios`, solo para rol `admin`: crear cuentas, editar rol, activar/desactivar
  acceso, resetear contraseña.
- Los roles y el estado de autorización dejan de estar fijos en código y pasan a vivir en
  Firestore, con un único correo de respaldo (`jemiliano2001@gmail.com`, rol `admin`) fijo
  en código como red de seguridad ("break-glass").

Fuera de alcance: auto-registro público, cambio de contraseña por el propio usuario,
pruebas E2E con el emulador de Firebase Auth (no está configurado en el repo hoy).

---

## Modelo de datos

Colección `usuarios` en Firestore, documento `id` = `uid` de Firebase Auth:

```
usuarios/{uid}
  email: string
  rol: "admin" | "compras" | "diseno" | "almacen"
  activo: boolean
  proveedor: "google" | "password"
  creadoEn: timestamp
  actualizadoEn: timestamp
  creadoPor: string   // correo del admin que creó/editó el registro
```

Se migran como documentos semilla los correos que hoy están fijos en código:
`jemiliano2001@gmail.com` (admin), `lorena@smv.com` (compras), y los placeholders
`diseno@smv.com` / `almacen@smv.com` (se quedan como están hasta que el usuario dé los
correos reales — no es parte de este cambio).

`lib/roles.ts` y `lib/authorized-emails.ts` dejan de ser la fuente de verdad para
autorización general; se reducen a exponer únicamente el fallback fijo del correo admin
(`jemiliano2001@gmail.com` → rol `admin`, siempre autorizado), usado cuando el documento de
Firestore no existe o no se puede leer.

---

## Flujo de login (`/login`)

- Botón "Ingresar con Google" arriba (sin cambios en su lógica).
- Formulario correo + contraseña debajo, siempre visible.
- `lib/auth.ts` gana `iniciarSesionConEmailYPassword(email, password)` usando
  `signInWithEmailAndPassword` de `firebase/auth`.
- Ambos caminos confluyen en la misma verificación: se obtiene el `uid`, se lee
  `usuarios/{uid}` de Firestore, se exige `activo === true`, y `rol` determina qué rutas
  puede ver (`AuthGuard.tsx` + `lib/roles.ts`, mismo mecanismo de hoy pero leyendo de
  Firestore en vez del objeto estático). Si no existe el documento o `activo` es `false`,
  mismo mensaje de "no autorizado" que ya existe.
- Errores de Firebase se traducen a español: `auth/wrong-password`, `auth/user-not-found`,
  `auth/user-disabled`, `auth/too-many-requests`, siguiendo el patrón ya usado para
  `no_autorizado` en `MENSAJES_ERROR`.

---

## Pantalla de administración (`/usuarios`)

Ruta agregada a `PERMISOS_POR_ROL.admin` en `lib/roles.ts` (mismo patrón que `/auditoria`).

Tabla con correo, rol (select editable), proveedor, activo (toggle), y botón "Nuevo
usuario" (formulario: correo + rol).

| Acción | Comportamiento |
|---|---|
| Crear | Genera contraseña temporal aleatoria (`crypto`, 16+ caracteres), crea la cuenta en Firebase Auth con `emailVerified: true`, crea `usuarios/{uid}`, muestra la contraseña una sola vez en un banner con botón "copiar". |
| Editar rol | Actualiza `usuarios/{uid}.rol`. Aplica en la siguiente carga de página de esa persona — no requiere re-login porque el rol se lee de Firestore, no del token. |
| Desactivar / reactivar | Cambia `activo` en Firestore **y** deshabilita/habilita la cuenta en Firebase Auth (`disabled: true/false`) — doble candado: si a alguien le queda una sesión abierta, el siguiente refresh de token de Firebase también lo rechaza. |
| Resetear contraseña | Genera otra temporal aleatoria, la aplica en Firebase Auth, la muestra una sola vez. |

### Backend

Se sigue el patrón existente del repo (Route Handlers + `verificarUsuarioAutorizado`, no
Server Actions):

- `app/api/usuarios/route.ts` — `GET` (listar), `POST` (crear).
- `app/api/usuarios/[uid]/route.ts` — `PATCH` (rol/activo).
- `app/api/usuarios/[uid]/reset-password/route.ts` — `POST` (resetear contraseña).
- `lib/api-auth.ts` gana `verificarAdmin(request)`: además de lo que ya hace
  `verificarUsuarioAutorizado`, confirma que `rol === 'admin'` en Firestore (con el mismo
  fallback fijo para el correo admin).

### Correcciones necesarias en código existente

1. **`emailVerified`** — `verificarUsuarioAutorizado` (usado por `/api/extraer`,
   `/api/scrape`, `/api/extraer-lote`, `/api/claves-sat`, `/api/sugerir-clave-sat`) y las
   Cloud Functions (`assertAuthorizedCallable` en `functions/src/auth.ts`) rechazan tokens
   sin `email_verified === true`. Las cuentas creadas desde `/usuarios` nunca pasan por el
   flujo normal de verificación de correo, así que el endpoint de creación las marca
   `emailVerified: true` explícitamente al crearlas (el admin ya está dando fe del correo).
   Sin este ajuste, cualquier persona con login de usuario/contraseña entraría a la app pero
   se le rechazarían todas las llamadas a esos endpoints.
2. **Lista duplicada en Cloud Functions** — `functions/src/auth.ts` tiene su propio
   `ALLOWED_EMAILS` hardcodeado, independiente de `lib/authorized-emails.ts`. Se actualiza
   `assertAuthorizedCallable` para consultar la colección `usuarios` de Firestore vía Admin
   SDK (mismo fallback fijo para el correo admin), para que alguien autorizado por
   usuario/contraseña no sea rechazado por `recommendProvider`, `autoPurchase`,
   `sheetsSync` o `excelSync`.

---

## Reglas de Firestore

`usuarios/{uid}`:
- Lectura: cualquier usuario autenticado puede leer **su propio** documento
  (`request.auth.uid == uid`) — es lo que usa `AuthGuard` para calcular su rol. El listado
  completo para la pantalla de admin se sirve desde el Route Handler `GET
  /api/usuarios` (Admin SDK, bypassa las reglas), no con una lectura directa de colección
  desde el cliente.
- Escritura: denegada desde el cliente. Todas las mutaciones pasan por los Route Handlers
  de admin, que usan el Admin SDK. Así el único camino para crear/editar/desactivar
  usuarios es la pantalla `/usuarios`, nunca directo desde el navegador de otra persona.

---

## Seguridad

- **Break-glass admin:** `jemiliano2001@gmail.com` con rol `admin` queda fijo en código
  además de estar en Firestore — si el documento se borra o corrompe, el admin nunca se
  queda fuera de `/usuarios`.
- Contraseñas temporales nunca se persisten en texto plano — Firebase Auth las hashea al
  crearse la cuenta; solo existen en memoria del navegador mientras el banner "cópiala
  ahora" está visible, y no se vuelven a mostrar.
- Los endpoints `/api/usuarios*` quedan cubiertos por el mismo App Check que ya protege el
  resto de los Route Handlers.

## Manejo de errores

Regla del repo: ningún fallo rompe la UI visualmente — banners con mensaje claro y botón de
reintento.

- `/login`: errores de Firebase traducidos a español (ver arriba).
- `/usuarios`: si falla crear/editar/desactivar, banner de error con reintento. Si el
  `createUser` de Firebase Auth tiene éxito pero falla el `set` en Firestore, se muestra la
  contraseña temporal de todas formas (para no dejar una cuenta huérfana sin forma de
  entregarle acceso) junto con un error indicando que hay que reintentar guardar el rol.
- Correo duplicado al crear: se traduce `auth/email-already-exists` a un mensaje claro en
  vez de mostrar el error crudo de Firebase.

## Pruebas (Vitest)

- Lógica pura nueva (generación de contraseña temporal, validaciones de formulario) en
  `lib/`, con tests en `tests/` siguiendo el patrón 1:1 existente.
- `verificarAdmin`: casos de rechazo (no-admin, `activo: false`) y de aceptación (rol admin
  en Firestore, y el fallback de break-glass).
- Route Handlers de `/api/usuarios*` probados mockeando `firebase-admin`, igual que
  `extraer-route.test.ts` / `extraer-lote.test.ts`.
- Fuera de alcance: pruebas E2E con el emulador de Firebase Auth.
