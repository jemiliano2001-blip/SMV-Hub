# ETL Compras Odoo → USA Tooling

Fecha: 2026-07-21

## Problema

Las compras del taller (POs y facturas de proveedor) viven en Odoo
(`purchase.order`, `account.move` in_invoice), pero SMV Hub solo sincroniza
hoy facturas de **cliente** (AR) hacia `/finanzas`. El catálogo USA Tooling
(`/proveedores`) no tiene historial de costos de metales/herramientas/plásticos
desde la estación de compras de Odoo, ni rangos min/max/promedio por tipo de
metal y medida.

## Objetivo

1. ETL de **solo lectura** desde Odoo: Purchase Orders + Vendor Invoices.
2. Espejo crudo en Firestore (sin categorización).
3. Capa intermedia con SAT, taxonomía abierta y atributos de metal.
4. Upsert de proveedores MX/US desde `res.partner`.
5. UI en `/proveedores` (USA Tooling): sync + rango de precios de metales.

## Decisiones

- **No escribir en Odoo.** Solo `search_read` / JSON-RPC.
- **No mutar** docs crudos con SAT/categoría; eso vive en `compras_odoo_items`.
- **No mezclar** con `ordenes` ni `finanzas_facturas`.
- Taxonomía de producto = **strings abiertos** + registro extensible (no enum
  en la lógica core). El enum tooling del catálogo USA se conserva.
- Secrets: reutilizar `FINANZAS_ODOO_*` si el API user tiene lectura de Purchase;
  si no, `COMPRAS_ODOO_*` con el mismo patrón anti-colisión.
- Sync completo (ponytail) + prune de huérfanos + guard si Odoo devuelve 0.

## Colecciones Firestore

| Colección | Rol |
|-----------|-----|
| `compras_odoo_po` | Espejo crudo de POs/RFQs |
| `compras_odoo_facturas` | Espejo crudo de facturas de proveedor |
| `compras_odoo_items` | Ítems normalizados (SAT, categoría, metal, costo) |
| `compras_odoo_sync_state` | Estado de última corrida |
| `categorias_producto` | Seed opcional (registro también en código) |
| `proveedores` | Upsert con `odooPartnerId` |

## Fuera de alcance

- Escritura a Odoo, scraping de precios externos, reemplazo del enum tooling USA.
