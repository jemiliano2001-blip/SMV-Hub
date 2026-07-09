# Reporte PDF Impresión — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pulir el PDF del reporte de compras vía `window.print()` con CSS scoped, ocultando chrome de la app y optimizando KPIs y tabla para carta horizontal.

**Architecture:** Un solo DOM en `ReporteView`; wrapper `.reporte-document` delimita el documento imprimible. Clases Tailwind `print:*` en componentes de presentación; reglas `@media print` en `globals.css` scoped bajo `.reporte-document`. Sin cambios en `lib/reportes.ts`.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4, TypeScript strict.

## Global Constraints

- Tailwind v4 — config en `globals.css` con `@theme`; sin `tailwind.config.js`.
- Path alias `@/*` → raíz del repo.
- Montos con `Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda })`.
- No nuevas dependencias npm para PDF.
- Preservar botón "Guardar PDF" y `window.print()` en `CabeceraReporte`.
- `no-print` oculta elementos en `@media print` (ya definido en `globals.css`).

---

## File Map

| Acción | Archivo | Responsabilidad |
|--------|---------|-----------------|
| Modificar | `app/reportes/page.tsx` | `no-print` en header de navegación |
| Modificar | `app/reportes/ReporteView.tsx` | Wrapper `.reporte-document`; `no-print` en sección inferior |
| Modificar | `app/reportes/components/CabeceraReporte.tsx` | Clases print en cabecera |
| Modificar | `app/reportes/components/FranjaKpis.tsx` | KPIs compactos al imprimir |
| Modificar | `app/reportes/components/TablaReporte.tsx` | Tipografía y breaks al imprimir |
| Modificar | `app/globals.css` | Reglas print scoped + thead repeat |

---

### Task 1: Ocultar chrome de la app al imprimir

**Files:**
- Modify: `app/reportes/page.tsx`
- Modify: `app/reportes/ReporteView.tsx`

**Interfaces:**
- Produces: wrapper `reporte-document` envolviendo cabecera + KPIs + tabla; secciones no imprimibles marcadas.

- [ ] **Step 1: Marcar nav superior como no-print**

En `app/reportes/page.tsx`, agregar `no-print` al `<header>`:

```tsx
<header className="no-print bg-white border-b border-[#E2E8F0] sticky top-0 z-10">
```

- [ ] **Step 2: Envolver documento imprimible y ocultar pie**

En `app/reportes/ReporteView.tsx`, envolver desde `CabeceraReporte` hasta el div de la tabla:

```tsx
<div className="reporte-document">
  <CabeceraReporte ... />
  {lineas.length > 0 && (
    <div className="mb-6">
      <FranjaKpis kpis={kpis} moneda={monedaActiva} />
    </div>
  )}
  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm print:rounded-none print:border-0 print:shadow-none print:p-0">
    <TablaReporte grupos={grupos} totalGeneral={totalGeneral} moneda={monedaActiva} />
  </div>
</div>
```

Mantener `FiltrosReporte` y `AvisoPendientes` **fuera** de `.reporte-document` (ya tienen `no-print` en sus wrappers o componentes).

Agregar `no-print` al grid de automatización:

```tsx
<div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8 no-print">
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: compila sin errores.

---

### Task 2: CSS scoped de impresión en globals.css

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: elementos con clase `reporte-document` de Task 1.

- [ ] **Step 1: Agregar reglas scoped dentro del bloque `@media print` existente**

Después de las reglas globales actuales, agregar:

```css
  /* Documento del reporte — scoped */
  .reporte-document {
    max-width: none !important;
    padding: 0 !important;
  }

  .reporte-document table {
    width: 100% !important;
    min-width: 0 !important;
    font-size: 9px;
    line-height: 1.3;
  }

  .reporte-document thead {
    display: table-header-group;
  }

  .reporte-document th {
    font-size: 8px;
    padding-bottom: 4px;
  }

  .reporte-document td {
    padding: 2px 4px !important;
    vertical-align: top;
  }

  .reporte-document .overflow-x-auto {
    overflow: visible !important;
  }

  /* Grupos: evitar cortes */
  .reporte-document tr.grupo-header,
  .reporte-document tr.grupo-subtotal,
  .reporte-document tr.grupo-linea {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .reporte-document tr.total-general {
    break-inside: avoid;
    page-break-inside: avoid;
  }
```

- [ ] **Step 2: Ajustar regla global `tr { break-inside: avoid }`**

Reemplazar el selector global `tr` (demasiado agresivo — evita cortes en cada fila y
puede dejar páginas en blanco) por los selectores scoped de `.reporte-document` del Step 1.
Eliminar o comentar:

```css
  tr {
    break-inside: avoid;
  }
```

---

### Task 3: Cabecera y KPIs para print

**Files:**
- Modify: `app/reportes/components/CabeceraReporte.tsx`
- Modify: `app/reportes/components/FranjaKpis.tsx`

- [ ] **Step 1: CabeceraReporte — clases print**

```tsx
<div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 print:mb-4 print:pb-2">
  <div className="flex items-center gap-4">
    <Image
      ...
      className="object-contain print:h-8"
    />
    <div>
      <h1 className="text-xl font-bold text-gray-900 print:text-lg">{titulo}</h1>
      <p className="text-sm text-gray-500 print:text-xs">{subtitulo}</p>
    </div>
  </div>
  ...
</div>
```

- [ ] **Step 2: FranjaKpis — grid compacto al imprimir**

En `KpiCard`:

```tsx
<div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm print:rounded-none print:shadow-none print:border print:border-gray-300 print:p-2 print:bg-white">
  <p className="text-xs text-gray-500 mb-1 print:text-[9px] print:mb-0">{titulo}</p>
  <p className="text-2xl font-bold text-gray-900 tabular-nums leading-tight print:text-sm print:leading-snug">{valor}</p>
  {subtitulo && <p className="text-xs text-gray-400 mt-1 print:text-[8px] print:mt-0">{subtitulo}</p>}
</div>
```

En el contenedor grid:

```tsx
<div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 print:grid-cols-4 print:gap-2 print:mb-4">
```

---

### Task 4: Tabla con clases de grupo para breaks

**Files:**
- Modify: `app/reportes/components/TablaReporte.tsx`

- [ ] **Step 1: Agregar clases de fila para CSS print**

```tsx
<tr className="bg-blue-50 print:bg-gray-100 grupo-header">
```

```tsx
<tr
  key={`${grupo.clave}-${i}`}
  className="border-b border-gray-100 hover:bg-gray-50 grupo-linea print:hover:bg-transparent"
>
```

```tsx
<tr className="border-t border-gray-300 bg-gray-50 grupo-subtotal print:bg-gray-50">
```

```tsx
<tr className="border-t-2 border-gray-900 total-general">
```

- [ ] **Step 2: Clases print en tabla y celdas**

```tsx
<div className="overflow-x-auto print:overflow-visible">
  <table className="w-full text-sm border-collapse min-w-[900px] print:min-w-0 print:text-[9px]">
```

En celda de descripción:

```tsx
<td className="py-1.5 pr-3 max-w-[200px] truncate print:max-w-[120px] print:text-[8px]" title={linea.descripcion}>
```

- [ ] **Step 3: Verificar lint y build**

Run: `npm run lint && npm run build`
Expected: sin errores.

---

### Task 5: Verificación manual en Print Preview

**Files:** ninguno (solo QA manual)

- [ ] **Step 1: Arrancar dev server**

Run: `npm run dev`

- [ ] **Step 2: Abrir `/reportes` con datos en el periodo**

Navegar a `http://localhost:3000/reportes`, seleccionar "Este mes" o periodo con órdenes.

- [ ] **Step 3: Print Preview**

Clic "Guardar PDF" → en el diálogo de impresión, verificar checklist del spec:
- Nav, filtros, aviso efectivo, import/recurrentes: **no visibles**
- Logo, título, periodo, KPIs compactos, tabla 11 columnas legible en landscape
- Encabezado de tabla repetido en página 2+ si hay suficientes filas
- Subtotales y total general presentes

- [ ] **Step 4: Guardar PDF de prueba**

"Guardar como PDF" y abrir el archivo para confirmar fidelidad.

---

## Plan Self-Review

| Spec requirement | Task |
|------------------|------|
| no-print nav/filtros/pie | Task 1 |
| `.reporte-document` scoped CSS | Task 2 |
| KPIs compactos | Task 3 |
| Tabla 11 cols, thead repeat, breaks | Task 2 + Task 4 |
| letter landscape | globals.css (existente) |
| Manual verification | Task 5 |
| lint/build | Tasks 1–4 |

No placeholders; no cambios en `lib/reportes.ts`.
