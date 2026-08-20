# Compras Odoo UX — Cotizaciones rápidas alineadas a RFQ

**Fecha:** 2026-08-20  
**Estado:** aprobado (opción B)  
**Ruta:** `/compras-odoo`

## Problema

La captura de cotizaciones rápidas funciona (Excel/IA → `purchase.order` draft en Odoo), pero:

1. La UI es HTML/Tailwind custom; no usa el sistema shadcn del resto de SMV Hub.
2. `notas` ya viaja en el payload y se mapea a Odoo `notes`, pero la UI lo deja en `useState('')` sin campo.
3. Falta fecha de recepción esperada (`date_planned` en Odoo), visible en el RFQ del ERP.
4. Crear en Odoo no pide confirmación explícita (riesgo de RFQs accidentales).
5. El historial no muestra errores al usuario (solo `console.error`) y no usa `Card`/`Empty`/`Skeleton`.

## Alcance

**Incluye**

- Migración de captura e historial a componentes shadcn existentes (`Card`, `Field`, `Input`, `Textarea`, `Select`, `Button`, `Alert`, `Empty`, `Skeleton`, `Badge`, `AlertDialog`, `Table`).
- Campo **Notas** editable → Odoo `notes`.
- Campo **Fecha de recepción** (`fechaRecepcion`, `YYYY-MM-DD`) → Odoo `date_planned`.
- `AlertDialog` de confirmación antes del POST a `/api/odoo/crear-cotizacion`.
- Validación visible: proveedor debe elegirse de sugerencias Odoo (`proveedorId` requerido para confirmar).
- Refactor de `CapturaOdooForm.tsx` en subcomponentes por sección.

**Excluye**

- Impuestos a nivel cabecera.
- Borrador `localStorage`.
- Wizard multi-paso.
- Chatter / adjuntos de Odoo.
- ETL de precios en `/proveedores` (`PanelComprasOdoo`).

## Mapeo Hub → Odoo

| Hub | Odoo `purchase.order` |
|-----|------------------------|
| `fecha` | `date_order` |
| `fechaRecepcion` | `date_planned` |
| `notas` | `notes` |
| `referenciaProveedor` | `partner_ref` |
| (existente) líneas | `order_line` |

## UX

Flujo de una sola página con cuatro cards numeradas (Datos → Autollenado → Entrada → Partidas). Un CTA primario abre el diálogo; al confirmar se crea la RFQ. Feedback con `Alert` / `Empty` / `Skeleton`. Tokens semánticos del design system (sin hex sueltos ni purple de marketing).

## Criterios de hecho

- Notas editables aparecen en Odoo `notes`.
- Fecha de recepción aparece como `date_planned`.
- No se crea PO sin pasar por `AlertDialog` (salvo cancelar).
- Captura e historial usan shadcn; paste Excel/IA/CSV sin regresión.
