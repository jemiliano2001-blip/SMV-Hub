# Diseño: Mejoras en tabla de Órdenes de compra

**Fecha:** 2026-07-06  
**Módulo:** `/ordenes`  
**Estado:** aprobado  
**Archivos afectados:** `lib/ordenes-display.ts` (nuevo), `lib/ordenes.ts`, `lib/hooks/useOrdenes.ts`, `app/ordenes/OrdenesList.tsx`, `tests/ordenes-display.test.ts` (nuevo)

---

## Problema

La tabla principal de `/ordenes` muestra columnas poco útiles para el día a día (ID de Firestore, Orden de trabajo casi vacía) y carece de datos operativos visibles (no. de factura, cuenta cargo, SAT pendiente). La fecha mostrada es `creadoEn`, no la de la factura. Aprobar o rechazar requiere abrir el modal de detalle. Hay dos CTAs de creación confusos.

## Objetivo

1. Quitar **ID** y **Orden de trabajo** de la tabla (conservarlos en modal detalle/edición).
2. Añadir **No. factura**, **Cuenta cargo** e **indicador SAT** pendiente.
3. Fecha dual: `fechaFactura` principal; `creadoEn` secundario atenuado.
4. Aprobación **inline** por fila y **bulk** para selección múltiple.
5. Un solo CTA de creación: **"+ Nueva compra"** en el header de página.

**Fuera de alcance:** paginación, ordenamiento por columna, búsqueda multi-token.

---

## Decisiones del brainstorming

| Tema | Decisión |
|------|----------|
| Quitar de tabla | ID, Orden de trabajo |
| Columnas nuevas | No. factura, Cuenta cargo, indicador SAT |
| Fecha | `fechaFactura` + `creadoEn` secundario |
| Aprobación | Por fila + bulk |
| CTAs crear | Solo "+ Nueva compra"; quitar "+ Añadir Orden" |
| ID / OT en detalle | Se mantienen en el modal |

---

## Arquitectura (Enfoque 2)

| Módulo | Responsabilidad |
|--------|-----------------|
| `lib/ordenes-display.ts` | `formatFechaOrden`, `cuentaCargoEfectiva`, `ordenTieneSatPendiente` |
| `lib/ordenes.ts` | `actualizarOrdenesEstadoLote` vía `actualizarLote` |
| `lib/hooks/useOrdenes.ts` | `handleCambiarEstadoLote` |
| `app/ordenes/OrdenesList.tsx` | UI de tabla, acciones inline/bulk |

---

## Columnas finales

```
[☐] | Proveedor (+SAT) | Requisitor | No. factura | Empresa | Cuenta cargo | Total | Fecha | Estado | Acciones
```

### Acciones por fila

- Pendiente: Aprobar (sin confirm), Rechazar (confirm), Ver, Eliminar
- Otros estados: Ver, Eliminar

### Bulk (selección activa)

1. Sugerir claves SAT
2. Aprobar seleccionadas (confirm)
3. Rechazar seleccionadas (confirm explícito)
4. Eliminar seleccionadas

---

## Criterios de aceptación

1. Tabla sin columnas ID ni Orden de trabajo.
2. Tabla con No. factura, Cuenta cargo e icono SAT cuando aplica.
3. Fecha dual según reglas de `formatFechaOrden`.
4. Aprobar/rechazar inline y bulk funcionan.
5. Solo "+ Nueva compra" como CTA de creación.
6. Búsqueda incluye `cuentaCargo`; placeholder actualizado.
7. `npm run lint`, `npm test`, `npm run build` pasan.
