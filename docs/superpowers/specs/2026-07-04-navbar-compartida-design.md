# NavBar compartida para toda la app

**Fecha:** 2026-07-04
**Estado:** aprobado por el usuario (Enfoque A — NavBar única en el layout raíz)
**Contexto de la serie:** primer sub-proyecto de "mejoras masivas". Cola acordada:
1) esta NavBar, 2) importar histórico del Excel a requisiciones, 3) home dashboard.
El respaldo remoto + CI quedó fuera por decisión del usuario (recomendación vigente).

## Problema

Cada una de las 11 páginas de módulo copia su propio `<header>`:

- Un cambio trivial (p. ej. el logo) toca 11+ archivos.
- Los menús son inconsistentes: desde `/requisiciones` no se puede navegar a almacén,
  reportes ni órdenes de servicio; cada página muestra links distintos.

## Diseño

### Componente `app/NavBar.tsx` (cliente)

Mismo look del header actual: fondo blanco, `border-b border-[#E2E8F0]`, sticky top,
`h-16`, contenido en `max-w-7xl`.

- **Izquierda:** `LogoSMV` + "SMV Hub", como link a `/`.
- **Grupos dropdown:**
  - **Compras:** Nueva compra `/nueva-compra`, Órdenes `/ordenes`, Importar `/importar`,
    Cotizaciones `/cotizaciones`, Requisiciones `/requisiciones`, Reportes `/reportes`
  - **Operación:** Almacén `/almacen`, Órdenes de servicio `/ordenes-servicio`,
    Operadores `/operadores`
  - **Personal:** Horas extra `/horas-extra`, Baños `/banos`
- **Derecha:** `BotonSesion` existente (email + cerrar sesión).
- **Dropdowns:** `useState` con el grupo abierto; cierre con clic fuera y con Escape.
  Sin dependencias nuevas.
- **Estado activo:** `usePathname()`. El grupo que contiene la ruta actual se pinta azul
  (`text-[#0369A1]`); dentro del dropdown, el link de la ruta actual va resaltado.
  Coincidencia por prefijo (`pathname.startsWith(href)`).
- **Login:** si `pathname === '/login'`, el componente devuelve `null`.

### Integración

- `app/layout.tsx` renderiza `<NavBar />` una sola vez, antes de `{children}`.
- Las 11 páginas de módulo eliminan su `<header>` completo y los imports huérfanos
  (`LogoSMV`, `BotonSesion`, `Link` si ya no se usa). Deleción neta ~300 líneas.
- El home (`app/page.tsx`) no tiene header que borrar; gana la nav sobre su hero.
- `AuthGuard` no cambia: sigue envolviendo el contenido de cada página. La nav queda
  fuera del guard — se alcanza a ver un instante sin sesión antes del redirect a
  `/login`; aceptado como inofensivo.

### Solo escritorio

Decisión del usuario: el equipo usa PCs. No hay menú hamburguesa; el header solo debe
degradarse decente al encoger (los grupos pueden envolver).

## Manejo de errores

Componente puro de UI, sin red ni datos. No aplica.

## Verificación

Sin lógica de negocio nueva → sin tests de Vitest. Verificación: `npm run lint`,
`npx tsc --noEmit` (sin errores nuevos), build, y click por las 11 páginas comprobando
nav consistente, dropdowns y estado activo; `/login` sin nav.

## Fuera de alcance (deliberado)

- Menú móvil/hamburguesa.
- Route group `app/(app)/` con layout autenticado (Enfoque C) — reconsiderar tras el
  respaldo remoto.
- Cambios de contenido en las páginas más allá de borrar el header.
