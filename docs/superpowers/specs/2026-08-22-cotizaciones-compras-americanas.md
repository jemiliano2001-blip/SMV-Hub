# Diseño: Compras americanas buscables en Cotizaciones

**Fecha:** 2026-08-22
**Módulo:** `/cotizaciones` + `/nueva-compra`
**Estado:** aprobado por el usuario

## Problema

Las facturas de `/nueva-compra` viven en `ordenes`. `/cotizaciones` solo tiene lo cotizado
(CSV, IA, alta manual). Cuando alguien pide “eso que compramos hace meses”, hay que
recordar proveedor y fecha; el buscador de cotizaciones no sirve.

## Objetivo

Cada línea de una compra americana aparece como fila en cotizaciones, con badge
**Comprada**, para buscarla por descripción, proveedor, no. de parte o folio de factura.

## Decisiones

| Tema | Decisión |
|---|---|
| Fuente | Solo órdenes americanas (`/nueva-compra` → colección `ordenes`) |
| Persistencia | Upsert en `cotizaciones` (no merge en memoria al abrir la pantalla) |
| Clave de upsert | proveedor + pieza (sin fecha): una fila por pieza/proveedor; gana la compra más reciente |
| Histórico viejo | Script de backfill de una vez |
| Odoo | Fuera de alcance |
| Estatus | No se agrega `comprado`; se usa `origen: "compra"` |

## Flujo

1. Al guardar una orden, best-effort: crear/actualizar cotizaciones por ítem.
2. Si el upsert falla, la orden igual queda guardada.
3. Backfill recorre `ordenes` y aplica la misma regla.
4. Buscar o filtrar “Compradas” dispara carga del historial completo (la paginación
   de 50 docs no alcanza compras viejas).

## Fuera de alcance

- Compras Odoo, RFQ, autogenerar cotización desde captura IA de producto.
- Deep-link al modal de una orden concreta (el folio queda en `notas`).
