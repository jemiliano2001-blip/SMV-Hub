# Diseño — PDF del reporte de compras (impresión del navegador)

Fecha: 2026-06-26
Proyecto: SMV Hub (repo `compras-americanas`, Next.js 16 + React 19 + Tailwind v4)
Estado: aprobado (brainstorming)

## Objetivo

Mejorar la exportación a PDF del reporte en `/reportes` usando el flujo existente
(`window.print()` → "Guardar como PDF" en el navegador), con un layout pulido y
legible en papel carta horizontal, sin nuevas dependencias ni generación server-side.

## Decisiones (del brainstorming)

- **Enfoque A**: mejorar CSS de impresión + marcar elementos no imprimibles; no
  `jspdf`, `react-pdf`, ni Puppeteer.
- **Enfoque técnico**: hoja de estilos scoped bajo `.reporte-document` + clases
  `print:*` en componentes del reporte (enfoque 2 de tres opciones evaluadas).
- **Contenido**: misma tabla de 11 columnas que en pantalla; KPIs incluidos;
  aviso de efectivo excluido del PDF.
- **Papel**: carta horizontal (`letter landscape`), márgenes ~1 cm.

## Fuera de alcance (YAGNI)

- Descarga directa de archivo PDF sin diálogo de impresión.
- Columnas reducidas u ocultas solo en impresión.
- Incluir aviso "compras en efectivo" en el PDF.
- Cambios a `lib/reportes.ts` o lógica de agregación (solo presentación/print).

## Contenido del documento impreso

| Incluir | Excluir (`no-print`) |
|---------|----------------------|
| Logo SMV + título "Reporte de compras" + subtítulo (periodo) | Nav superior de la página (`page.tsx` header) |
| Franja de 4 KPIs (versión compacta) | Link "← Inicio" |
| Tabla agrupada completa (11 columnas, subtotales, total general) | Botón "Guardar PDF" |
| | Filtros (periodo, agrupación, moneda) |
| | Aviso de compras en efectivo |
| | Sección import/export Excel |
| | Sección órdenes recurrentes |

## Layout de impresión

### Página

- `@page { size: letter landscape; margin: 1cm; }` — scoped a impresión del reporte
  (reglas globales en `globals.css` se refinan bajo `.reporte-document` donde aplique).
- Fondo blanco, texto negro; sin sombras ni bordes decorativos en cards.

### Cabecera

- Logo y título en una sola bloque; sin botón de acción.
- Borde inferior simple para separar del contenido.

### KPIs

- En pantalla: grid de 4 cards (comportamiento actual).
- Al imprimir: fila horizontal compacta (4 celdas, tipografía pequeña, sin shadow/border
  pesado) para ahorrar espacio vertical antes de la tabla.

### Tabla

- Tipografía ~9–10px en celdas; encabezados en negrita.
- `thead { display: table-header-group }` para repetir encabezados en cada página.
- Descripción truncada en celda; texto completo disponible vía atributo `title` (ya existe).
- Encabezado de grupo (proveedor/destino/requisitor): fondo gris claro, legible en B/N.
- `break-inside: avoid` en filas de grupo, líneas del grupo y fila de subtotal.
- Total general siempre visible al final del documento (no cortar dentro de la fila).

### Contenedor de tabla

- Sin `overflow-x-auto` efectivo en print (tabla usa ancho completo del papel).
- Quitar padding/shadow del wrapper `rounded-xl border shadow-sm` al imprimir.

## Arquitectura de archivos

```
app/reportes/page.tsx          → no-print en <header>
app/reportes/ReporteView.tsx   → wrapper .reporte-document; no-print en pie
app/reportes/components/
  CabeceraReporte.tsx          → print: clases en título/logo
  FranjaKpis.tsx               → print: layout compacto
  TablaReporte.tsx             → print: tipografía y breaks
app/globals.css                → reglas @media print scoped + refinamiento global
```

No se crean componentes duplicados "solo print". Un solo árbol DOM, dos presentaciones
(screen vs print) vía CSS.

## Flujo del usuario

1. Usuario filtra periodo y agrupación en `/reportes`.
2. Clic en "Guardar PDF" → `window.print()`.
3. En el diálogo del navegador, el preview muestra solo el documento (sin nav ni filtros).
4. Usuario elige "Guardar como PDF" o imprime en papel.

## Manejo de errores

- Sin cambios: si no hay datos, la tabla muestra mensaje vacío (igual que en pantalla).
- Print CSS no debe ocultar el contenido del reporte por error de selectores.

## Verificación

- Manual: Print Preview en Chrome/Edge con periodo con datos (ej. junio 2026).
- Checklist:
  - [ ] Nav y filtros no aparecen.
  - [ ] KPIs en fila compacta.
  - [ ] 11 columnas legibles en landscape.
  - [ ] Encabezado de tabla se repite en páginas siguientes.
  - [ ] Subtotales por grupo y total general correctos.
  - [ ] Import/recurrentes no aparecen.
- Automatizado: no se agregan tests Vitest (CSS de impresión); `npm run lint` y
  `npm run build` deben pasar tras los cambios.

## Referencias

- Spec original del módulo: `docs/superpowers/specs/2026-06-18-reportes-compras-design.md`
- Botón actual: `app/reportes/components/CabeceraReporte.tsx` (`window.print()`)
