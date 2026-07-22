# Diseño: Permisos personalizados por usuario (módulos)

**Fecha:** 2026-07-21  
**Módulo:** `/usuarios` + autorización global  
**Estado:** aprobado (brainstorming)

---

## Problema

SMV Hub solo tiene 4 roles fijos (`admin`, `compras`, `diseno`, `almacen`). Cada rol abre un
paquete cerrado de rutas. No se puede dar a una persona acceso a un módulo puntual sin
cambiar el mapa global del rol. La UI de `/usuarios` habla de “matriz” pero solo cambia el rol.

Además, en `/almacen` el tab **Reabastecimiento ROP** muestra precios e inversión sugerida;
el encargado de almacén no debería verlo — solo Entradas/Salidas.

## Objetivo

1. Asignar módulos (sí/no) por persona, con plantillas rápidas basadas en los roles actuales.
2. Solo super-admin edita usuarios y matrices.
3. UI (AuthGuard, NavBar, home) respeta `modulos[]` en todas las rutas.
4. Firestore estricto solo en colecciones sensibles: finanzas, caja-chica, usuarios, auditoría.
5. Separar acceso a ROP del acceso operativo a almacén.

## Decisiones

| Tema | Decisión |
|---|---|
| Modelo | `modulos[]` = fuente de verdad; `plantilla` = atajo que rellena checkboxes |
| Granularidad | Sí/no por módulo (sin ver/editar) |
| Enforcement | UI en todos; Firestore solo en sensibles |
| Quién edita | Solo `esSuperAdmin` (+ break-glass) |
| Almacén | `almacen` = Entradas/Salidas; `reabastecimiento-rop` = tab ROP |
| Legacy | Docs con solo `rol` siguen funcionando (derivación); backfill escribe campos nuevos |

## Modelo de datos

Documento `usuarios/{uid}`:

- `modulos: ModuloId[]` — permisos efectivos
- `plantilla?: admin\|compras\|diseno\|almacen` — atajo de UI
- `esSuperAdmin: boolean` — puede entrar a `/usuarios` y mutar matrices
- `rol` — legacy; al escribir se sincroniza con `plantilla`
- `activo`, `email`, `proveedor`, timestamps — sin cambio

### Catálogo de módulos

`nueva-compra`, `ordenes`, `claves-sat`, `cotizaciones`, `requisiciones`, `proveedores`,
`reportes`, `caja-chica`, `almacen`, `reabastecimiento-rop`, `pedidos-almacen`,
`ordenes-servicio`, `operadores`, `horas-extra`, `banos`, `finanzas`, `auditoria`, `usuarios`

Home (`/`) siempre visible si el usuario está activo. `/importar` sigue fuera.

### Plantillas

Mapeo equivalente a `PERMISOS_POR_ROL` actual, más:

- `admin` / `compras` → incluyen `almacen` **y** `reabastecimiento-rop`
- `almacen` → solo `almacen` (sin ROP), más `pedidos-almacen` y `banos` como hoy

## Autorización

```
Login → usuarios/{uid} → { modulos, esSuperAdmin, activo }
  → AuthGuard / NavBar / Home
  → /almacen (tab ROP gated)
  → /api/usuarios (verificarSuperAdmin)
  → firestore.rules (solo sensibles)
```

- `/usuarios` y APIs de admin: requieren `esSuperAdmin` (no basta el checkbox `usuarios`).
- ROP no tiene ruta propia; vive en `/almacen` y se oculta sin el módulo.

## UI `/usuarios`

Modal/panel por usuario: select de plantilla + checkboxes agrupados + toggle
`esSuperAdmin` + badge “personalizado” si la matriz difiere de la plantilla. Protección:
no quitar el último super-admin.

## Migración

Script Admin `scripts/backfill-modulos-usuarios.mjs`: `rol` → `plantilla` + `modulos`;
`rol === "admin"` → `esSuperAdmin: true`. Idempotente. Compat de lectura en código hasta
correr el backfill.

## Fuera de scope

Custom claims de módulos; permisos ver/editar; rules en todas las colecciones; `/importar`.

## Archivos principales

- `lib/schemas.ts`, `lib/roles.ts`, `lib/usuarios.ts`, `lib/usuarios-admin.ts`
- `lib/hooks/useRol.ts` / `usePermisos`
- `app/AuthGuard.tsx`, `app/NavBar.tsx`, `app/page.tsx`, `app/usuarios/page.tsx`
- `app/almacen/page.tsx`
- `firestore.rules`
- `scripts/backfill-modulos-usuarios.mjs`
- `tests/` (Vitest)
