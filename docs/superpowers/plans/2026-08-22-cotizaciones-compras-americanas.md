# Plan: Compras americanas buscables en Cotizaciones

## Task 1: Lógica pura + schema

- `lib/cotizaciones-desde-ordenes.ts`: filtrar ruido, clave upsert, payloads.
- `CotizacionSchema`: `origen`, `ordenIdOrigen`, `claveUpsertCompra` opcionales.
- Tests: `tests/cotizaciones-desde-ordenes.test.ts` + schema.

## Task 2: Persistencia al guardar

- `buscarCotizacionPorClaveUpsert` + `upsertCotizacionesDesdeOrden` en `lib/cotizaciones.ts`.
- `NuevaCompraFormWrapper` llama el upsert best-effort tras `crearOrden`.
- `crearCotizacion` / lote rellenan `claveUpsertCompra`.

## Task 3: UI Consultar

- Badge Comprada, filtro origen, búsqueda incluye `notas`.
- Al buscar o filtrar Compradas: `cargarTodas()`.
- Copy del header.

## Task 4: Backfill

- `scripts/backfill-cotizaciones-desde-ordenes.mjs` (`--dry-run`, `--proyecto=`).
- `npm run cotizaciones:backfill-ordenes`.
