---
title: Evidencia local del repositorio
date: 2026-07-22
status: inventario
---

# Evidencia local del repositorio

## Tamaño y forma

| Área | Archivos aproximados | Líneas aproximadas |
|---|---:|---:|
| `app` | 106 | 22,968 |
| `components` | 34 | 2,832 |
| `lib` | 104 | 14,001 |
| `functions/src` | 14 | 1,764 |

La aplicación ya es un sistema grande. Esto hace que la consistencia de contratos y estados sea más importante que una colección adicional de componentes visuales.

## Complejidad concentrada

- `app/proveedores/page.tsx`: más de 1,500 líneas.
- `app/requisiciones/RequisicionesList.tsx`: aproximadamente 1,100 líneas.
- `lib/schemas.ts`: aproximadamente 770 líneas.
- `lib/proveedores-inteligencia-cruzada.ts`: aproximadamente 726 líneas.
- Varios formularios, listas y páginas financieras están entre 600 y 665 líneas.

Estos archivos mezclan carga, filtros, mutaciones, diálogos y representación. Son candidatos para división por función, no solo por tamaño.

## Fronteras de renderizado

- 95 de 140 archivos TSX declaran `use client` (aproximadamente 68%).
- No hay `loading.tsx`, `error.tsx` ni `not-found.tsx` en `app`.
- No se encontró uso de `next/dynamic`, `React.lazy` o importación diferida en código de producción.
- `xlsx` se importa de forma estática en tres vistas de reportes, aunque solo se necesita al exportar.

## Feedback y accesibilidad

- Se encontraron 36 usos de `alert()` o `confirm()` en flujos de usuario.
- Ya existen `components/ui/alert-dialog.tsx`, Sonner y un `Toaster` global.
- Proveedores ya muestra un ejemplo correcto de `AlertDialog`, por lo que existe un patrón interno para migrar.
- La ausencia de estados de ruta obliga a que cada pantalla resuelva carga/error por separado y de forma desigual.

## Consultas y escalabilidad

Hay numerosas consultas `getDocs(query(collection(...), orderBy(...)))` sin `limit()` o cursor en Almacén, Cotizaciones, Finanzas, Ordenes, Requisiciones, Ordenes de Servicio y vinculación de Proveedores. No se encontró `startAfter()`.

Solo se observó una lista claramente limitada en `lib/reportes-contables.ts` con `limit(50)`. Esto indica que la paginación no es todavía un contrato transversal.

## Duplicación de infraestructura cliente

Hooks como `useOrdenes`, `useRequisiciones` y `useProveedores` repiten estados manuales de loading/error y operaciones CRUD. La mejora correcta es compartir primitivas de consulta y mutación conservando reglas de negocio específicas.

## Bundles

Los chunks compartidos generados incluyen archivos brutos de aproximadamente 195–270 KB. Entre los chunks de ruta observados:

- Proveedores: aproximadamente 112 KB.
- Requisiciones: aproximadamente 74 KB.
- Ordenes: aproximadamente 65 KB.
- Caja Chica: aproximadamente 56 KB.
- Cotizaciones: aproximadamente 48 KB.

Son tamaños brutos, no gzip. Sirven como línea base comparativa, no como tamaño exacto transferido.

## Pruebas y seguridad de cambio

- La validación previa ejecutó 52 archivos de prueba y 591 pruebas exitosas.
- La cobertura de líneas fue aproximadamente 65.42%.
- No existe una configuración E2E propia con Playwright ni pruebas axe del producto.
- La raíz aún reporta vulnerabilidades de dependencias; `xlsx` no tiene corrección upstream conocida en el árbol actual y debe aislarse/cargarse bajo demanda mientras se evalúa reemplazo.

## Deriva documental

- `CLAUDE.md` conserva referencias a servicios y Functions genéricas ya retiradas.
- La documentación de bypass de autenticación contradice la preferencia actual por Google Sign-In real.
- La ruta legacy `/importar` fue retirada tras la investigación. `lib/importar.ts` se conserva porque Nueva Compra y Cotizaciones reutilizan sus parsers y validaciones.
