# Alineación de modelos Gemini — SMV Hub

Fecha: 2026-08-18 · Fuente de verdad: [ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models)

## Tabla de modelos por módulo

| Módulo | Variable de entorno | Default | Rol |
|--------|---------------------|---------|-----|
| Extracción facturas / lote | `GEMINI_MODEL` | `gemini-3.7-flash` | Visión + structured output |
| Lote `calidad=alta` | (param en form) | `gemini-3.1-pro-preview` | Tablas densas |
| Claves SAT (lite) | `GEMINI_MODEL_SAT` | `gemini-3.5-flash-lite` | Clasificación económica |
| Claves SAT (escalado) | `GEMINI_MODEL_SAT_ESCALADO` | `gemini-3.7-flash` | Casos ambiguos |
| Baños (borrado IA) | `GEMINI_MODEL_BANOS` | `gemini-3.7-flash` | Evaluación JSON |
| PO cliente | `GEMINI_MODEL_CLIENTE_PO` | `gemini-3.7-flash` | PDF/imagen multimodal |
| Clasificación Odoo | `GEMINI_MODEL_CLASIFICACION` | `gemini-3.5-flash-lite` | Batch JSON |
| Investigación precios | `GEMINI_MODEL_INVESTIGACION` | `gemini-3.7-flash` | Grounding + JSON |
| Búsqueda semántica (live) | `GEMINI_MODEL_EMBEDDING` | `gemini-embedding-2` | Query embedding |
| Índice semántico (Functions) | (constante) | `gemini-embedding-2` | Document embedding |

Secreto separado para indexación programada: `HUB_GEMINI_API_KEY` (Secret Manager, codebase `smv-hub`).

## Contrato `gemini-embedding-2`

Google **no soporta** `task_type` en Embeddings 2. Usar prefijos en el texto:

| Rol | Prefijo |
|-----|---------|
| Consulta (NavBar, búsqueda en vivo) | `task: search result \| query: {texto}` |
| Documento (índice, catálogo) | `title: {titulo} \| text: {texto}` |

Dimensión fija del índice SMV: **768** (`outputDimensionality: 768`). Cambiar modelo o dimensión **obliga reindexar** (`syncBusquedaIndiceManual`).

Migración desde `gemini-embedding-2-preview`: el preview tiene shutdown 2026-08-10; no mezclar vectores preview con GA en `busqueda_indice`.

## Follow-up (fuera de este pase)

### File Search (RAG gestionado)

Gemini File Search permite indexar PDFs/facturas en un store gestionado por Google. Útil para preguntas sobre historial de compras sin mantener `busqueda_indice` a mano. Requiere diseño de store, permisos y costo mensual aparte — no es un drop-in de cambio de modelo.

### Embeddings multimodales

`gemini-embedding-2` acepta imagen, PDF, audio y video. Caso SMV: buscar "esta fresa" subiendo foto. Requiere indexar blobs de Storage y pipeline de ingestión — costo y diseño aparte del índice textual actual.

### URL context vs `/api/scrape`

El scrape con cheerio + whitelist de hosts ya cubre extracción de precio por URL. Grounding/URL context no reemplaza ese flujo; evaluar solo si scrape falla en hosts nuevos.
