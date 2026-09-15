# Endmills China — extracción IA + ranking de compras (fase 1)

**Fecha:** 2026-09-14  
**Estado:** implementado en código

## Qué y por qué

La extracción multimodal de proformas/packing lists en `/endmills` fallaba con **401 "No autorizado"** porque el cliente no enviaba el Firebase ID token. Además se necesita un seguimiento simple de **qué medidas se compran más**, sin todavía modelar uso en taller ni precio landed en México.

## Alcance

### Incluye

1. Auth Bearer en llamadas a `POST /api/endmills/extraer-pedido`.
2. Tab **Análisis** con ranking agregado desde `endmills-pedido-partidas` (catalogadas), excluyendo pedidos cancelados.

### Fuera (fases posteriores)

- Ranking de **más usadas** (requiere ledger de consumo / salidas con `medidaId`).
- Precio **landed MX** (tipo de cambio, aranceles, flete prorrateado).
- Import / backfill masivo de compras históricas fuera del flujo de pedidos actual.

## Diseño del ranking

- Fuente: partidas `tipo === "catalogada"` con `medidaId`.
- Agregados por medida: piezas pedidas/recibidas, USD (`subtotalUSD`), # pedidos distintos, última `fechaPedido`.
- Orden: piezas pedidas desc; empate por USD desc.
- UI: KPIs (top, piezas, USD) + tabla; carga lazy al visitar el tab.

## Verificación

- Subir imagen/PDF de Rita → extracción con sesión activa (sin 401).
- Tab Análisis muestra ranking del seed / pedidos confirmados.
