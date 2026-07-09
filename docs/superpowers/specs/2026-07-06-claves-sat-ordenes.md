# Asignación automática de claves SAT en órdenes existentes

Fecha: 2026-07-06

## Problema

Las órdenes de compra americanas tienen descripciones de ítems en **inglés**, pero el
catálogo SAT local (`data/sat/catalogo.json`) está en **español**. El campo `claveProdServ`
ya existe en `ItemFacturaSchema` pero no hay UI en `/ordenes` para asignarlo, y al editar
una orden se pierde el valor existente.

## Objetivo

Permitir asignar claves SAT a órdenes ya capturadas (masivo y por orden) con vista previa
antes de guardar, traduciendo descripciones en inglés cuando la búsqueda local no alcanza.

## Pipeline de sugerencia (por ítem)

1. **Historial** — misma descripción normalizada con clave ya asignada → confianza `alta`.
2. **Búsqueda local** — solo descripciones en español; umbral con heurística de gap de score.
3. **Glosario industrial** — traducción determinística EN→ES (`lib/sat/glosario-industrial.ts`) → `buscarClavesSat` sin tokens.
4. **Caché en memoria** — reutiliza sugerencias por descripción+proveedor (TTL 24h).
5. **Gemini SAT** — una sola llamada fusionada (`traducirYElegirClaveSat`) con top 3 candidatos; modelo `GEMINI_MODEL_SAT` (default `gemini-3.1-flash-lite`).

Lotes deduplican descripciones iguales antes de llamar a Gemini.

## API

`POST /api/sugerir-clave-sat` (autenticada). Request: `{ items: [{ descripcion, proveedor? }], historial?: boolean }`.
Response: `{ sugerencias: SugerenciaClaveSat[] }`.

## UI

- Columna Clave SAT + badge `Sin clave SAT` en detalle de orden.
- Botón "Sugerir clave SAT" en modal de detalle (una orden).
- Botón "Sugerir claves SAT" masivo con órdenes seleccionadas.
- Modal de vista previa editable antes de persistir.

## Persistencia

`actualizarClavesSatLote()` en `lib/ordenes.ts` con `writeBatch` en chunks de 400.

## Fuera de alcance v1

- Clave SAT en reportes PDF/correo.
- Sugerencia automática en `/nueva-compra`.
