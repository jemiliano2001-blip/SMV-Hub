# Spec — Búsqueda semántica sobre datos reales de SMV

Fecha: 2026-08-17 · Estado: **aprobado** — pendiente el checkpoint de Fase 0 (costo + calidad) del
plan · Autor: Claude Opus 5

## Problema

Hoy el buscador global (Cmd+K) muestra un bloque titulado "Resultados Inteligentes IA
(Catálogo & Refacciones)" con un badge de "% afinidad". Detrás no hay datos de SMV:
`lib/busqueda-semantica-catalogo.ts` contiene `CATALOGO_BASE_SMV`, **15 ítems escritos a mano**
(fresas, aluminio 6061, Delrin, sensores…) cuyo `urlDestino` apunta a un módulo. Buscar
"inserto CNMG" no dice quién te lo vendió, a cuánto, ni cuándo — solo te manda a `/proveedores`.

Es el mismo patrón por el que se retiró el tab Reabastecimiento ROP el 2026-07-24: una superficie
que se presenta como inteligencia sobre datos reales, corriendo sobre datos inventados.

## Qué queremos

Que buscar en lenguaje natural — en español o inglés, sin acertar el término exacto — encuentre
**cosas que realmente existen en SMV**:

- "brocas para barrenado profundo" → las órdenes donde se compraron, con proveedor y precio.
- "quién me vende Delrin" → proveedores reales del catálogo, con su mercado y lead time.
- "endmill 1/4 4 filos" → la medida en inventario de endmills, con stock y objetivo par.

El valor está en el cruce que hoy no existe: **el usuario describe lo que necesita y el sistema
le dice dónde ya lo compró antes**. Eso es lo que un buscador léxico no logra, porque las
descripciones de factura vienen en inglés abreviado y la búsqueda del usuario viene en español.

## Alcance propuesto

### Fuentes a indexar (en orden de valor)

| Fuente | Colección | Qué se indexa | Por qué |
|---|---|---|---|
| 1. Ítems de órdenes | `ordenes` (items[]) | descripción + proveedor + parte | El cruce más valioso: "¿dónde compré esto?" |
| 2. Proveedores | `proveedores` | nombre + categorías + materiales | Resuelve "quién vende X" |
| 3. Endmills | `endmills-medidas` | medida + tipo + material | Catálogo técnico real con stock |
| 4. Cotizaciones | `cotizaciones` | pieza + proveedor | Histórico de precios de piezas |

**Decidido (2026-08-17): arrancar con 1 y 2.** Son los que responden las preguntas que de verdad se
hacen en el taller, y permiten medir costo y calidad antes de ampliar. 3 y 4 se agregan después con
el mismo mecanismo, sin rediseño.

### Fuera de alcance

- Búsqueda multimodal (imágenes). El modelo la soporta; el caso de uso no está pedido.
- Reemplazar la búsqueda por texto existente del buscador global. El bloque semántico
  **se suma**, no sustituye.
- Indexar finanzas, caja chica o auditoría. Datos sensibles, sin caso de uso de búsqueda.

## Decisión técnica clave: dónde viven los vectores

Verificado: `firebase-admin@13.10.0` (instalado) expone `FieldValue.vector()` y
`collection.findNearest()`, así que Firestore Vector Search es viable sin dependencias nuevas.

Hay dos caminos y **la elección depende de cuántos documentos hay**, que es justo lo que todavía
no medimos:

**Opción A — vectores en Firestore + `findNearest` (KNN nativo).**
Escala a decenas de miles de documentos, no carga nada en memoria, la búsqueda ocurre del lado de
Firestore. Costo: hay que crear un índice vectorial —según la doc de Firebase se puede por Consola,
`gcloud firestore indexes composite create`, **Firebase CLI vía `firestore.indexes.json`** o
Terraform— y los vectores viven en la base de producción. Que el repo ya despliegue
`firestore.indexes.json` en CI juega a favor de esta opción.

**Opción B — vectores en Firestore, coseno en el servidor.**
Se leen los vectores de la colección índice y se comparan en memoria con `similitudCoseno`, que ya
está implementada y probada. Más simple, cero infraestructura nueva. Deja de ser razonable cuando
el índice pasa de ~1,000–2,000 vectores (cada uno son ~3 KB de floats: 2,000 vectores ≈ 6 MB por
consulta fría).

**Recomendación: medir primero (Fase 0), luego decidir.** Si el índice sale por debajo de ~1,500
entradas, la Opción B entrega el mismo resultado con una fracción de la complejidad, y migrar a A
después no cambia el modelo de datos — solo cómo se consulta. No hay que decidirlo hoy a ciegas.

## Modelo de datos propuesto

Una colección índice separada, `busqueda_indice`, en vez de meter vectores en las colecciones de
negocio (no ensucia `ordenes`/`proveedores` ni sus reglas, y se puede reconstruir de cero):

```
busqueda_indice/{id}
  fuente: "orden-item" | "proveedor" | "endmill" | "cotizacion"
  refId: string            // id del documento original
  refPath: string          // ruta para abrirlo (p.ej. "/ordenes?id=abc")
  texto: string            // el texto que se vectorizó (auditable)
  textoHash: string        // sha1 del texto → evita re-embeber lo que no cambió
  embedding: VectorValue   // FieldValue.vector([...])
  modelo: string           // con qué modelo se generó (para reindexar en migraciones)
  titulo: string           // lo que ve el usuario
  metadata: {...}          // proveedor, precio, moneda, fecha — para pintar el resultado
  actualizadoEn: timestamp
```

`textoHash` es lo que hace barata la reindexación: solo se re-embebe lo que cambió de texto.
`modelo` permite detectar entradas generadas con un modelo viejo y regenerarlas por lotes.

## Cómo se mantiene fresco

Un job de indexación incremental en Cloud Functions (`functions/`), programado, que recorre lo
modificado desde la última corrida y actualiza solo lo que cambió de hash. **No** triggers por
documento: encarece y complica el rate limiting de Gemini sin necesidad, porque nadie espera que
una compra capturada hace 30 segundos ya esté indexada.

## Cambios que arrastra (deuda que ya detectamos)

Esto arregla o vuelve relevantes cuatro puntos de la revisión del 2026-08-17:

- **B2** (falla silenciosa): con datos reales, un índice caído debe decir "la búsqueda falló", no
  "no hay resultados". La ruta debe distinguir ambos casos.
- **C1** (modelo preview sin fallback): con vectores persistidos, el modelo pasa a ser parte del
  modelo de datos — cambiar de modelo obliga a reindexar. `MODELO_EMBEDDING_FALLBACK` deja de ser
  código muerto y el campo `modelo` del índice se vuelve obligatorio.
- **C2** (batch sin usar): indexar cientos de documentos sí necesita `generarEmbeddingsLote` de
  verdad, con control de rate limit y sin el fallback que amplifica errores.
- **B3** (race condition del buscador): con búsquedas más lentas sobre datos reales, la respuesta
  fuera de orden pasa de rara a probable. Hay que resolverla como parte de esto.

## Riesgos

- **Costo de Gemini.** Es la razón de medir antes de construir. La indexación inicial es un pago
  único por documento; las consultas son 1 embedding cada una. El buscador vive en el NavBar, o
  sea en todas las páginas, y hoy cualquier usuario activo puede llamarlo sin límite.
- **Fuga de datos entre módulos.** El índice mezcla fuentes; si alguien sin el módulo `ordenes`
  busca, no debería ver ítems de órdenes. **Decidido: sí se filtra por permisos del usuario, y
  ocurre del lado del servidor** (no ocultando resultados en la UI). Ver criterio de éxito #2.
- **Calidad.** Las descripciones de factura vienen abreviadas y en inglés ("CARB EM 1/4 4FL"). Hay
  que validar con búsquedas reales antes de exponerlo, no asumir que el modelo lo resuelve.

## Criterio de éxito

1. Buscar las 10 búsquedas de prueba (§ abajo) devuelve el documento correcto en el top 3 en al
   menos 8 de las 10.
2. Un usuario sin el módulo `ordenes` nunca ve resultados de órdenes — verificado con test.
3. Si el índice o Gemini fallan, el usuario ve un error claro, no una lista vacía.
4. El costo mensual estimado de embeddings queda documentado y aprobado antes de desplegar.

## Las 10 búsquedas de prueba (aprobadas por Emiliano, 2026-08-17)

Construidas a partir de una muestra real de producción (60 órdenes recientes + 100 proveedores de
`smv-brain`, leída en la revisión de esta misma fecha) — no son términos inventados. Cada una ataca
uno de los cuatro problemas reales que un buscador de texto plano no resuelve: traducción
factura↔español, sinónimo sin coincidencia de texto, categoría con muchos SKUs distintos, o
histórico/precio en vez de solo nombre. Esta es la prueba de fuego de T0.3 del plan.

| # | Búsqueda | Debe encontrar | Qué prueba |
|---|---|---|---|
| 1 | "fresa de carburo 4 filos para acero inoxidable" | Ítem de Changzhou North Carbide: "4 Flute... Carbide End Mill Fresa for Stainless Steel" | Traducción factura↔español (el título ya viene medio en español) |
| 2 | "quién me vende rodamientos" | Proveedores RYASA (Rodamientos y Accesorios), BALEROS Y RET | Sinónimo — el nombre del proveedor no contiene "rodamiento" |
| 3 | "sensor de proximidad inductivo M12" | IFM Efector PN4221, E18027 | Marca + término genérico en español |
| 4 | "fuente de poder riel din 24V" | DigiKey "AC/DC DIN RAIL SUPPLY 24V" (MDR-20-24, NDR-120-24, etc.) | Traducción directa de la factura |
| 5 | "quién vende acero inoxidable en Monterrey" | ABINOX MONTERREY, ACEROS FORTUNA, IIRSACERO, SERVIACERO | Sinónimo duro — "Abinox" no contiene "inoxidable" |
| 6 | "pernos expulsores para moldes" | PCS Company "Ejector Pin, Straight, Hardened..." | Jerga de taller vs. término de factura en inglés |
| 7 | "resortes de compresión" | McMaster "Compression Spring... 9657K286" | Coincide con el ancla SAT ya documentada en `AGENTS.md` |
| 8 | "insertos para torno" | ISCAR, CARMEX, CCMT/CNMG de varias facturas | Categoría con muchos SKUs distintos |
| 9 | "conectores circulares Mouser" | Los "Standard Circular Connector... shell size 17/23" (7 líneas en la muestra) | Categoría con muchos SKUs distintos |
| 10 | "cuándo fue la última vez que compré un encoder Mitsubishi" | Aparece 2 veces en la muestra (eBay, fechas distintas) | Histórico/precio, no solo nombre |

Advertencia de la propia muestra: es de 60 órdenes recientes y 100 proveedores, no todo el
histórico — no salió nada de pailería, por ejemplo. Si en Fase 0/T0.3 alguna de las 10 no encuentra
lo esperado, revisar primero si el ítem realmente está en el rango indexado antes de asumir que el
modelo falló.

## Preguntas abiertas para Emiliano — todas resueltas (2026-08-17)

1. ~~¿Arrancamos con órdenes + proveedores, o prefieres otro orden?~~ **Resuelto:** sí, órdenes +
   proveedores primero.
2. ~~¿Los resultados deben respetar permisos por módulo?~~ **Resuelto:** sí, filtrado en servidor.
3. ~~¿Qué 10 búsquedas reales usamos como prueba de fuego?~~ **Resuelto** — ver tabla arriba.

Spec aprobado. Sigue el checkpoint de Fase 0 del plan (medir universo, costo y calidad) antes de
tocar código de producción — ver [plan](../plans/2026-08-17-busqueda-semantica-datos-reales.md).
