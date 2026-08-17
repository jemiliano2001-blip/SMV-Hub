# Spec — Búsqueda semántica sobre datos reales de SMV

Fecha: 2026-08-17 · Estado: **propuesta, pendiente de aprobación** · Autor: Claude Opus 5

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

**Propuesta: arrancar con 1 y 2.** Son los que responden las preguntas que de verdad se hacen en
el taller, y permiten medir costo y calidad antes de ampliar. 3 y 4 se agregan después con el
mismo mecanismo, sin rediseño.

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
  busca, no debería ver ítems de órdenes. **El filtrado por permisos del usuario tiene que ocurrir
  del lado del servidor**, no ocultando resultados en la UI.
- **Calidad.** Las descripciones de factura vienen abreviadas y en inglés ("CARB EM 1/4 4FL"). Hay
  que validar con búsquedas reales antes de exponerlo, no asumir que el modelo lo resuelve.

## Criterio de éxito

1. Buscar 10 términos reales del taller (los define Emiliano) devuelve el documento correcto en
   el top 3 en al menos 8 de los 10.
2. Un usuario sin el módulo `ordenes` nunca ve resultados de órdenes — verificado con test.
3. Si el índice o Gemini fallan, el usuario ve un error claro, no una lista vacía.
4. El costo mensual estimado de embeddings queda documentado y aprobado antes de desplegar.

## Preguntas abiertas para Emiliano

1. **¿Arrancamos con órdenes + proveedores, o prefieres otro orden?**
2. **¿Los resultados deben respetar permisos por módulo?** (Recomiendo que sí.)
3. **¿Qué 10 búsquedas reales usamos como prueba de fuego?** Esto define si sirve o no.
