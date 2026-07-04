# NavBar Compartida Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una sola barra de navegación con grupos dropdown montada en el layout raíz, reemplazando los 10 headers duplicados de las páginas de módulo.

**Architecture:** Componente cliente `app/NavBar.tsx` renderizado una vez en `app/layout.tsx`. Usa `usePathname()` para ocultarse en `/login` y resaltar la ruta activa. Las páginas de módulo borran su `<header>` local.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, lucide-react. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-07-04-navbar-compartida-design.md`

## Global Constraints

- Prohibido `any` y `@ts-ignore` (CLAUDE.md).
- No eliminar funciones/imports existentes salvo los que queden huérfanos por el borrado del header — y solo esos.
- Sin menú móvil (decisión de spec: solo escritorio).
- Sin tests de Vitest para este plan (decisión de spec); verificación = `npm run lint` + `npx tsc --noEmit` + navegador.
- `npx tsc --noEmit` tiene errores PREEXISTENTES solo en `tests/reportes.test.ts` — ignóralos; el criterio es "cero errores fuera de `tests/`".
- El dev server del usuario ya corre en `http://localhost:3000` (HMR activo).

---

### Task 1: Crear `app/NavBar.tsx` y montarla en el layout

**Files:**
- Create: `app/NavBar.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `LogoSMV` (default export de `app/LogoSMV.tsx`, prop opcional `height`), `BotonSesion` (default export de `app/BotonSesion.tsx`, sin props).
- Produces: `NavBar` (default export, sin props) — Task 2 depende de que ya esté montada en el layout.

- [ ] **Step 1: Crear `app/NavBar.tsx` con este contenido completo**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import LogoSMV from '@/app/LogoSMV'
import BotonSesion from '@/app/BotonSesion'

type GrupoNav = { nombre: string; links: { href: string; label: string }[] }

const GRUPOS: GrupoNav[] = [
  {
    nombre: 'Compras',
    links: [
      { href: '/nueva-compra', label: 'Nueva compra' },
      { href: '/ordenes', label: 'Órdenes' },
      { href: '/importar', label: 'Importar' },
      { href: '/cotizaciones', label: 'Cotizaciones' },
      { href: '/requisiciones', label: 'Requisiciones' },
      { href: '/reportes', label: 'Reportes' },
    ],
  },
  {
    nombre: 'Operación',
    links: [
      { href: '/almacen', label: 'Almacén' },
      { href: '/ordenes-servicio', label: 'Órdenes de servicio' },
      { href: '/operadores', label: 'Operadores' },
    ],
  },
  {
    nombre: 'Personal',
    links: [
      { href: '/horas-extra', label: 'Horas extra' },
      { href: '/banos', label: 'Baños' },
    ],
  },
]

export default function NavBar() {
  const pathname = usePathname()
  const [abierto, setAbierto] = useState<string | null>(null)
  const navRef = useRef<HTMLElement>(null)

  // Cierra el dropdown con clic fuera o Escape.
  useEffect(() => {
    if (!abierto) return
    function onClickFuera(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setAbierto(null)
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(null)
    }
    document.addEventListener('mousedown', onClickFuera)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickFuera)
      document.removeEventListener('keydown', onEscape)
    }
  }, [abierto])

  // Cierra el dropdown al navegar.
  useEffect(() => {
    setAbierto(null)
  }, [pathname])

  if (pathname === '/login') return null

  return (
    <header ref={navRef} className="bg-white border-b border-[#E2E8F0] sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoSMV />
            <span className="text-gray-300 font-light">|</span>
            <span className="text-sm font-semibold text-[#0F172A]">Compras Americanas</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm font-medium">
            {GRUPOS.map((g) => {
              const activo = g.links.some((l) => pathname.startsWith(l.href))
              const desplegado = abierto === g.nombre
              return (
                <div key={g.nombre} className="relative">
                  <button
                    onClick={() => setAbierto(desplegado ? null : g.nombre)}
                    className={`flex items-center gap-1 rounded-lg px-3 py-2 transition-colors ${
                      activo ? 'text-[#0369A1] font-semibold' : 'text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    {g.nombre}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${desplegado ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {desplegado && (
                    <div className="absolute right-0 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                      {g.links.map((l) => (
                        <Link
                          key={l.href}
                          href={l.href}
                          className={`block px-4 py-2 text-sm transition-colors ${
                            pathname.startsWith(l.href)
                              ? 'bg-blue-50 text-[#0369A1] font-semibold'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {l.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            <div className="ml-4">
              <BotonSesion />
            </div>
          </nav>
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Montar NavBar en `app/layout.tsx`**

Agregar el import (después de la línea `import { AuthProvider } from "@/components/AuthProvider";`):

```tsx
import NavBar from "@/app/NavBar";
```

Y cambiar el body del return:

```tsx
        <AuthProvider>
          <NavBar />
          {children}
        </AuthProvider>
```

- [ ] **Step 3: Verificar lint y tipos**

Run: `npm run lint && npx tsc --noEmit`
Expected: lint sin errores; tsc solo con los errores preexistentes de `tests/reportes.test.ts`.

- [ ] **Step 4: Verificar en el navegador**

En `http://localhost:3000` (el dev server del usuario ya corre): la nav aparece arriba del hero del home; los 3 grupos abren su dropdown; clic fuera y Escape los cierran; navegar a `/ordenes` marca "Compras" en azul y "Órdenes" resaltado en el dropdown; `http://localhost:3000/login` NO muestra la nav.
Nota: en esta fase las páginas de módulo mostrarán DOS headers (el nuevo global + el viejo local) — es esperado hasta Task 2.

- [ ] **Step 5: Commit**

```bash
git add app/NavBar.tsx app/layout.tsx
git commit -m "feat: NavBar compartida con grupos dropdown montada en el layout raíz"
```

---

### Task 2: Borrar los 10 headers duplicados de las páginas de módulo

**Files:**
- Modify: `app/almacen/page.tsx`, `app/banos/page.tsx`, `app/cotizaciones/page.tsx`, `app/horas-extra/page.tsx`, `app/importar/page.tsx`, `app/operadores/page.tsx`, `app/ordenes/page.tsx`, `app/ordenes-servicio/page.tsx`, `app/reportes/page.tsx`, `app/requisiciones/page.tsx`

**Interfaces:**
- Consumes: `<NavBar />` ya montada en el layout (Task 1).
- Produces: nada nuevo — solo deleción.

- [ ] **Step 1: En cada uno de los 10 archivos, borrar el bloque `<header>...</header>` completo**

Cada página tiene un bloque que empieza en `<header className="bg-white border-b ...` y termina en `</header>` (algunas con un comentario `{/* Navigation Header */}` justo arriba — bórralo también). Ejemplo exacto con `app/requisiciones/page.tsx` — antes:

```tsx
import LogoSMV from "@/app/LogoSMV"
import Link from 'next/link'
import RequisicionesList from './RequisicionesList'
import AuthGuard from '../AuthGuard'
import BotonSesion from '../BotonSesion'

export default function RequisicionesPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white border-b border-[#E2E8F0] sticky top-0 z-10">
          {/* ... todo el header con LogoSMV, links y BotonSesion ... */}
        </header>

        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
```

Después:

```tsx
import RequisicionesList from './RequisicionesList'
import AuthGuard from '../AuthGuard'

export default function RequisicionesPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-gray-50 flex flex-col">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
```

El resto de cada archivo queda intacto. No tocar `app/page.tsx` (home, no tiene header de nav), `app/login/page.tsx` ni `app/nueva-compra/page.tsx` (no tiene header).

- [ ] **Step 2: Quitar los imports que quedaron huérfanos**

En cada archivo editado, borrar los imports que ya no se usan tras el borrado — típicamente `LogoSMV`, `BotonSesion` y, solo si la página no lo usa en su contenido, `Link` (ojo: `app/ordenes/page.tsx` y otras SÍ usan `Link` en el cuerpo — verificar con lint, no adivinar).

Run: `npm run lint`
Expected: eslint marca cada import sin uso (`no-unused-vars`); iterar hasta cero errores.

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: solo los errores preexistentes de `tests/reportes.test.ts`.

- [ ] **Step 4: Verificar en el navegador**

Visitar las 10 rutas (`/almacen`, `/banos`, `/cotizaciones`, `/horas-extra`, `/importar`, `/operadores`, `/ordenes`, `/ordenes-servicio`, `/reportes`, `/requisiciones`): un solo header (el global), dropdowns funcionando, grupo activo en azul, y el contenido de cada página intacto debajo.

- [ ] **Step 5: Commit**

```bash
git add app/almacen/page.tsx app/banos/page.tsx app/cotizaciones/page.tsx app/horas-extra/page.tsx app/importar/page.tsx app/operadores/page.tsx app/ordenes/page.tsx app/ordenes-servicio/page.tsx app/reportes/page.tsx app/requisiciones/page.tsx
git commit -m "refactor: eliminar headers duplicados; la navegación vive en NavBar global"
```
