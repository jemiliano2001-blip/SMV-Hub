# Reporte contable: traducción + clave SAT en un clic

Fecha: 2026-07-14

## Problema

En `/reportes/contable`, el botón "Traducir faltantes" llama a `POST /api/retro-traducir-lote`,
que tiene tres problemas:

1. **Prompt pobre** — una línea genérica ("asistente para una contadora") que no produce el
   formato estándar de descripciones que ya se usa en el taller (ej. "Terminales de crimpado
   tipo ferrul blanco 22 AWG (1000 pzas)").
2. **No asigna claves SAT** — la columna Clave SAT queda en "—" para todas las líneas; el
   botón "Sugerir clave SAT" por orden nunca se corrió para el backlog (~274 líneas).
3. **Sin autenticación** — el endpoint escribe a Firestore con el Admin SDK sin verificar
   token ni usuario autorizado (todos los demás endpoints sí lo hacen). Además usa `any`.

Emiliano diseñó un prompt de traducción técnica industrial (limpieza de ruido de marcas,
formato estándar de taller, no desviarse por palabras secundarias) que hoy solo puede usarse
a mano fuera de la app.

## Objetivo

Un solo clic en el reporte contable deja las líneas pendientes con **descripción simplificada
en formato estándar** y **clave SAT validada contra el catálogo**, con progreso visible,
proceso reanudable y el endpoint asegurado.

## Decisiones tomadas (con Emiliano, 2026-07-14)

- **Un paso, no dos**: el mismo botón traduce y asigna claves.
- **Regla de confianza**: claves con confianza `alta`/`media` se escriben
  (`satPendiente: false`); `baja` o sin match no escriben clave (`satPendiente: true`) y la
  línea queda resaltada para revisión manual.
- **Sin descripción corta**: el prompt original generaba un nombre de 3-4 palabras; se
  descarta (YAGNI). Solo se persiste `descripcionSimplificada`.
- **La clave SAT nunca la inventa el LLM**: se reutiliza el pipeline validado de
  `lib/sat/sugerir-clave.ts` (historial → glosario → candidatos reales del catálogo →
  Gemini elige entre candidatos con `validarClaveEnCandidatos`). El prompt de Emiliano se usa
  solo para la traducción.
- **Arquitectura por chunks**: requests cortos de pocas órdenes con progreso en el cliente,
  en lugar de un POST gigante (timeout casi seguro con 274 líneas).

## Arquitectura

### `lib/reportes-contables-ia.ts` (nuevo, lógica pura)

- `construirPromptTraduccionLote(descripciones: string[]): string` — prompt adaptado del de
  Emiliano: rol de traductor técnico industrial para taller de maquinados en México, reglas
  críticas de análisis (el objeto principal manda: "HARFINGTON Sheet Metal Punch" es un
  punzón, no lámina; "Wiha Screwdriver Set" es un juego de destornilladores, no "precisión"),
  limpieza de ruido (marcas, cantidades masivas, códigos internos), y los 3 ejemplos reales
  como estándar de formato. Salida: JSON array de strings en el mismo orden.
- `parsearRespuestaTraduccion(texto: string, esperadas: number): string[]` — valida longitud
  y tipos; error controlado si no cuadra.
- `aplicarReglaConfianza(sugerencia)` — mapea `alta`/`media` → `{ claveProdServ, satPendiente: false }`;
  `baja`/`null` → `{ claveProdServ: null, satPendiente: true }`.
- `armarChunksOrdenes(ordenes, maxOrdenes = 5, maxLineas = 15)` — agrupa órdenes con líneas
  faltantes en chunks; una orden nunca se parte en dos chunks (evita que dos requests
  escriban la misma orden).

### `POST /api/retro-traducir-lote` (reescrito, mismo path)

- Autenticación con `verificarUsuarioAutorizado` (Bearer token), igual que
  `/api/sugerir-clave-sat`.
- Request (Zod): `{ ordenesIds: string[] (1–5), historialEntradas?: [{ descripcion, claveProdServ }] }`.
  El servidor lee cada orden con Admin SDK y detecta él mismo qué ítems carecen de
  `descripcionSimplificada` o `claveProdServ` — no confía en payload del navegador.
- Por orden: (a) una llamada Gemini para traducir todos sus ítems faltantes
  (`responseSchema` array de strings, mismo orden; modelo `GEMINI_MODEL_SAT`, default
  `gemini-3.1-flash-lite`); (b) `sugerirClavesSatLote` con historial del cliente + mapeos de
  Firestore; (c) regla de confianza; (d) una sola escritura de la orden con `items`
  actualizados y `actualizadoEn`.
- Response: `{ resumen: { procesadas, traducidas, clavesAsignadas, clavesPendientes, ordenesFallidas: string[] } }`.
- Sin `any`; tipos derivados de los schemas.

### Mejora al pipeline SAT

`ItemParaSugerirSat` acepta `terminosPrevios?: string`: la descripción simplificada en
español recién generada se inyecta como query prioritaria en `obtenerQueriesCandidatos`
(el catálogo SAT está en español, así que mejora los candidatos sin llamadas extra).

### Cliente (`ReporteContableView.tsx`)

- Botón renombrado a **"Completar faltantes (N)"**; N = líneas sin traducción **o** sin clave.
- Orquestación: arma chunks con `armarChunksOrdenes`, extrae `historialEntradas` de las
  órdenes ya cargadas (`extraerEntradasHistorialSat`), manda chunks en secuencia con el ID
  token en `Authorization`, acumula el resumen.
- Progreso visible durante el proceso ("Procesando 120/274…") y banner final:
  "274 traducidas · 248 claves asignadas · 26 pendientes de revisar".
- Toda línea sin `claveProdServ` en el tab de pendientes (haya pasado o no por el proceso)
  muestra badge ámbar "Revisar" en la columna Clave SAT; se resuelven con el botón
  "Sugerir clave SAT" por orden antes de cerrar el lote.

## Manejo de errores

- Orden cuya traducción falla → se reporta en `ordenesFallidas` y el chunk continúa.
- Falla de sugerencia SAT en una línea → la línea queda pendiente; nunca rompe el proceso.
- Cliente: 1 reintento automático por chunk fallido; si reincide, se detiene con banner
  "Se procesaron X de Y — Reintentar". Todo lo escrito queda guardado; re-correr el botón
  procesa solo lo faltante (idempotente).
- 401/403 → mensaje de no autorizado consistente con el resto de la app.

## Pruebas

- `tests/reportes-contables-ia.test.ts`: prompt (incluye reglas y ejemplos; N entradas),
  parseo con longitud incorrecta, regla de confianza (alta/media/baja/null), chunks que no
  parten órdenes y respetan límites.
- Route handler con Gemini y auth mockeados (patrón `extraer-route.test.ts`): sin token →
  401; chunk válido → escribe items esperados y devuelve resumen; orden fallida no tumba el
  chunk.
- `terminosPrevios` en el pipeline SAT: caso en los tests existentes de `lib/sat`.

## Fuera de alcance

- Flujo de `/nueva-compra` y extracción de facturas (sus prompts no se tocan).
- Botón "Sugerir clave SAT" por orden (sigue igual).
- Persistir la "justificación" del LLM o escribir a `sat_asignaciones` desde el proceso
  automático (la validación manual sigue siendo la fuente de mapeos curados).
- Reglas de Firestore/Storage e infra.
