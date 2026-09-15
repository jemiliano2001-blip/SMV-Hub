# Plan: Endmills extracción + ranking de compras

**Fecha:** 2026-09-14  
**Spec:** [2026-09-14-endmills-ranking-compras.md](../specs/2026-09-14-endmills-ranking-compras.md)

## Tasks

### 1. Fix auth extracción IA

- [x] `ModalImportadorIA.tsx`: Bearer en FormData y JSON
- [x] `HistorialPedidosEndmills.tsx`: Bearer en packing list

### 2. Ranking puro + tests

- [x] `agregarRankingComprasEndmills` en `lib/endmills-calculos.ts`
- [x] Tests en `tests/endmills-calculos.test.ts`

### 3. Query Firestore

- [x] `listarPartidasCatalogadasEndmills` en `lib/endmills.ts`

### 4. UI tab Análisis

- [x] `AnalisisComprasEndmills.tsx`
- [x] Tab en `EndmillsView.tsx` (lazy mount)

### 5. Docs

- [x] Spec + este plan

## Fuera de alcance

Uso/consumo, landed MX, backfill masivo de historial.
