# Plan: ETL Compras Odoo → USA Tooling

Fecha: 2026-07-21  
Spec: [2026-07-21-compras-odoo-etl-design.md](../specs/2026-07-21-compras-odoo-etl-design.md)

## Task 1 — Discovery

- Extender `scripts/odoo-discovery.mjs` para PO, líneas, in_invoice, product SAT, partner country.
- Salida en `data/odoo-discovery/` (gitignored).

## Task 2 — Schemas + registro categorías

- Zod en `lib/schemas.ts`: PO crudo, factura proveedor cruda, ítem intermedio, sync state.
- `lib/compras-odoo/categorias-registro.ts` + `resolverCategoriaProducto`.
- `odooPartnerId` opcional en `ProveedorSchema`.

## Task 3 — Parsers + mapeo + tests

- `parse-metal.ts`, `llave-item.ts`, `rangos.ts`, `construir-item.ts`, consolidación.
- `functions/src/odoo-compras-mapeo.ts` (headers crudos alineados a schemas).
- Tests Vitest: mixto, extensibilidad (`foam`), rangos, huérfanos.

## Task 4 — Cloud Function sync

- `functions/src/odoo-compras-sync.ts`: scheduled + manual.
- Export en `index.ts`.
- Upsert proveedores desde partners.

## Task 5 — Rules + lib lectura + UI

- `firestore.rules` para colecciones espejo.
- `lib/compras-odoo.ts` + hook + servicio sync.
- Tab “Compras Odoo” en `/proveedores` con filtros metal/medida.
