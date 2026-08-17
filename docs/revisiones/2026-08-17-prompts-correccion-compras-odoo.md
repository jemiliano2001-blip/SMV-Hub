# Prompts para Gemini 3.7 Flash — arreglos de la revisión

> Hallazgos y evidencia: [2026-08-17-revision-compras-odoo-investigacion-ia.md](./2026-08-17-revision-compras-odoo-investigacion-ia.md)

Van en 3 tandas, en orden. Corre `npx tsc --noEmit && npm test && npm run lint` después de cada una
antes de pasar a la siguiente. No las juntes: 3.7 Flash pierde profundidad con listas largas.

---

## PROMPT 1 — Odoo: fallar fuerte en vez de inventar (BLOQUEANTE)

```
Contexto: SMV Hub. El archivo lib/odoo-crear-cotizacion.ts escribe purchase.order en el Odoo de
PRODUCCIÓN, que además comparte otras apps de SMV. Hoy tiene fallbacks silenciosos que crean la
orden aunque no haya podido resolver moneda, producto, impuesto o proveedor. Eso ya corrompió el
diseño: hay que cambiar la política de "resolver como sea" a "fallar fuerte antes de escribir".

REGLA ÚNICA que quiero que apliques: ninguna resolución fallida puede terminar en un
purchase.order.create. Si algo no se resuelve, lanza un Error con mensaje claro en español ANTES
de crear nada en Odoo.

Cambios concretos en lib/odoo-crear-cotizacion.ts:

1. resolverMonedaId: si no encuentra la moneda, lanza Error
   (`No se encontró la moneda ${codigoMoneda} en Odoo...`). Quita el `| false` del tipo de retorno
   y el `if (currencyId)` condicional en crearCotizacionEnOdoo: currency_id SIEMPRE se manda.
   Hoy, si falla, una cotización en USD se crea con la moneda de la compañía y los mismos números.

2. resolverProductoGenericoId: ELIMINA el fallback 3 ("primer producto activo"). Deja solo la
   búsqueda del producto "." y la de "generico". Si ninguna existe, lanza Error explicando que hay
   que crear un producto genérico en Odoo. Nunca estampes un producto real arbitrario en las líneas.

3. resolverImpuestoCompraId: cámbiala a resolverImpuestoCompraPorTasa(cred, uid, tasaIva) que busque
   [["type_tax_use","=","purchase"],["amount","=",Math.round(tasaIva*100)]]. En crearCotizacionEnOdoo
   resuelve el impuesto POR PARTIDA usando item.tasaIva (cachea por tasa para no repetir RPCs).
   Si la tasa es 0, no mandes taxes_id. Si la tasa no es 0 y no existe ese impuesto en Odoo, lanza Error.

4. resolverPartnerId: NUNCA crees un res.partner nuevo. Elimina ese bloque completo.
   Además el match por nombre debe ser exacto, no substring: usa ["name","=ilike",nombreLimpio]
   (en Odoo "ilike" es substring y hace que "ACME" se pegue a "ACME DE MEXICO SA DE CV").
   Si no hay match exacto, lanza Error pidiendo que se seleccione el proveedor del buscador o se
   dé de alta primero en Odoo.

5. llamarOdooRpc: agrega timeout de 20 segundos con AbortController y mensaje claro si expira.

Cambios en app/api/odoo/crear-cotizacion/route.ts:

6. Saca la escritura a Firestore del camino fatal. Hoy, si Odoo crea la PO y luego falla el
   docRef.set(), la API devuelve 500, el usuario reintenta y se crea una PO DUPLICADA en Odoo.
   Envuelve el docRef.set() en su propio try/catch: si falla, haz console.error y responde 200 con
   ok:true, los datos de Odoo, registroId: null y un campo advertenciaEspejo con el mensaje.
   La orden en Odoo ya existe: eso manda.

7. En el mismo set(), agrega los campos que hoy se pierden: fecha, notas, requisitorGeneral,
   empresaGeneral y usoGeneral (tomados de payload). El historial los necesita.

8. No devuelvas `detalles: mensaje` crudo al cliente en el 500 (los errores de Odoo pueden traer
   trazas internas). Loguéalo en servidor y manda un mensaje genérico + un código corto.

No cambies nada más. Entrega los archivos completos, sin stubs. Corre npx tsc --noEmit y npm test.
```

---

## PROMPT 2 — Parser de Excel: deja de comerte la primera fila (BLOQUEANTE)

```
Contexto: SMV Hub, archivo lib/odoo-cotizador-parser.ts. La función esFilaEncabezado() hace
palabrasClave.some(kw => todaLaFilaComoUnString.includes(kw)) con palabras como "#", "uso", "item"
y "total". Eso hace que una fila de DATOS se detecte como encabezado.

Reproducción real (ya la corrí, es un bug confirmado, NO es teórico):

  entrada TSV:
  1\tBRC-07\tBROCA #7 USO RUDO\t10\t50.00\t500.00
  2\tBRC-08\tBROCA 1/4\t5\t60.00\t300.00

  salida actual: [{descripcion:"BRC-08", cantidad:1, precioUnitario:0}]

Se pierde la partida 1 entera y la 2 queda con precio 0. Y silencioso, porque el arreglo
`advertencias` está declarado pero nunca se llena.

Arregla lib/odoo-cotizador-parser.ts:

1. esFilaEncabezado(celdas): cambia la lógica. En vez de buscar substrings sobre la fila unida,
   evalúa CELDA POR CELDA: una celda "es encabezado" si su texto normalizado (trim + lowercase)
   coincide con un término de encabezado. Quita "#" e "item" de la lista de términos sueltos
   (son demasiado comunes en descripciones de taller). Requiere al menos 2 celdas-encabezado
   para declarar la fila como encabezado. Segunda condición de refuerzo: si 2 o más celdas de la
   fila parsean como número con limpiarNumero() > 0, NO es encabezado, es fila de datos.

2. Llena `advertencias` de verdad. Como mínimo:
   - cuántas filas se omitieron y por qué
   - si el mapeo posicional se usó porque no se detectó encabezado
   - si alguna fila quedó con precioUnitario 0
   - si el número de columnas varía entre filas (señal de delimitador equivocado)

3. Quita el `Math.max(0.0001, ...)` de cantidad. Si la cantidad parsea a 0 o menos, deja la
   cantidad en 0 y agrega una advertencia nombrando la fila; que la validación del form la marque.
   No fabriques cantidades falsas.

4. idxImporte hoy se mapea y nunca se lee. Úsalo: si la columna de importe existe y su valor
   difiere de cantidad*precioUnitario en más de 1 centavo, usa el importe del Excel como subtotal
   y agrega una advertencia diciendo que no cuadra (puede ser descuento del proveedor).

5. Si el delimitador detectado es "," y alguna fila produce más celdas que el encabezado, agrega
   una advertencia de que el CSV puede tener comas dentro de las descripciones y que conviene
   pegar desde Excel (TSV). Caso real que falla hoy:
   "A1,TORNILLO 1/4, ACERO,10,5.50" → cantidad 0.0001, precio 10.

6. Agrega tests en tests/odoo-cotizador-parser.test.ts para: el caso BROCA #7 USO RUDO de arriba
   (debe devolver 2 partidas correctas), una tabla CON encabezado real (no debe romperse), y que
   `advertencias` se llene cuando hay filas omitidas.

NO toques limpiarNumero(): ya la verifiqué y está correcta ("1,500"→1500, "12,345,678"→12345678,
"12,50"→12.5). Déjala igual.

Entrega los archivos completos. Corre npm test.
```

---

## PROMPT 3 — UI y honestidad de los datos

```
Contexto: SMV Hub. Tres arreglos de interfaz y uno de arquitectura sobre los módulos nuevos de
compras-odoo e investigación de precios IA.

1. BUG: el modal de éxito nunca se ve.
   En app/compras-odoo/CapturaOdooForm.tsx, enviarAOdoo() hace setResultadoExitoso(...) y luego
   llama onCotizacionCreada(), que en app/compras-odoo/page.tsx hace setTab('historial'). Como el
   page.tsx renderiza `tab === 'captura' ? <CapturaOdooForm/> : <HistorialOdooList/>`, el form se
   desmonta y el modal con el folio de Odoo se destruye antes de renderizar. El usuario nunca ve
   qué folio se creó.
   Arréglalo: NO cambies de tab automáticamente. Deja que el modal de éxito se muestre en el form,
   y que el botón "Ver historial" DENTRO del modal sea el que llame a onCotizacionCreada().

2. Tipo de cambio hardcodeado.
   app/proveedores/components/ModalInvestigacionPrecios.tsx usa `usdToMxn = 20.0` como default y
   app/proveedores/page.tsx no le pasa nada. El repo YA tiene lib/tipo-cambio.ts con
   obtenerTipoCambio() que lee la config de Firestore — se creó justamente para matar ese hardcode.
   Carga el tipo de cambio real en el modal (useEffect al abrirse, con TIPO_CAMBIO_DEFAULT_USD_MXN
   solo como fallback si falla) y muestra en pantalla qué tipo de cambio se está usando.

3. Los precios de IA son inventados y no se dice.
   lib/proveedores-investigacion-ia.ts pide precios, SKUs y proveedores a Gemini SIN grounding ni
   búsqueda web: son estimaciones confabuladas. El markdown que copia el modal se titula
   "Estudio de Precios & Proveedores" y se lee como un estudio real; alguien de compras podría
   decidir con eso.
   Agrega un banner visible y permanente arriba de los resultados en el modal:
   "Estimaciones generadas por IA a partir de conocimiento general de mercado. No son cotizaciones
   reales — verifica precio, SKU y disponibilidad con el proveedor antes de comprar."
   Agrega la MISMA advertencia como primera línea del markdown que genera copiarFichaMarkdown().

4. cruzarConHistoricoLocal miente con el nombre de los campos.
   En lib/proveedores-investigacion-ia.ts, la función devuelve el PRIMER match que encuentra
   recorriendo el arreglo, pero los campos se llaman precioUltimoUSD / fechaUltimaCompra, como si
   fuera la compra más reciente. Cámbiala para que recolecte TODOS los matches y se quede con el de
   fecha más reciente. Además, el match por raíz de 4 letras (`norm.includes(w.slice(0,4))`) es
   demasiado laxo ("acer" pega con "acero" y con "acercamiento"): súbelo a 5 caracteres mínimos y
   exige que la raíz caiga en frontera de palabra.

5. Deuda: lib/compras-odoo.ts sombrea al directorio lib/compras-odoo/.
   El archivo gana sobre el directorio en resolución de módulos y lo tapa con
   `export * from "./compras-odoo/index"`. Funciona, pero mete firebase/firestore en un árbol que
   era lógica pura (tests/compras-odoo-etl.test.ts ahora importa el SDK cliente transitivamente).
   Arréglalo así: renombra lib/compras-odoo.ts a lib/compras-odoo-cotizaciones.ts, quita de él la
   línea `export * from "./compras-odoo/index"`, borra los 3 exports que nadie usa
   (guardarCotizacionOdoo, obtenerPaginaCotizacionesOdoo, obtenerCotizacionOdoo) y deja solo
   listarCotizacionesOdoo. Actualiza el import en app/compras-odoo/HistorialOdooList.tsx.
   Verifica que app/proveedores/* siga importando de '@/lib/compras-odoo' (el directorio) sin cambios.

6. Limpieza: borra el comentario `/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 ... */` de la
   primera línea de app/compras-odoo/page.tsx.

Entrega archivos completos. Corre npx tsc --noEmit && npm test && npm run lint && npm run build.
```

---

## Pendientes que NO son para Gemini (los haces tú)

- **Correr `node scripts/backfill-modulos-usuarios.mjs`** — el módulo `compras-odoo` se agregó a las
  plantillas admin/compras, pero los usuarios existentes tienen `modulos[]` guardado en Firestore.
  Sin backfill, nadie ve la página.
- **Validar `firestore.rules` con el emulador** — no pude, falta Java en esta máquina. Instálalo y
  corre `npm run test:rules`, o al menos despliega las rules a `smv-brain-dev` primero.
- **Decidir si el flujo debe crear proveedores en Odoo.** El PROMPT 1 lo prohíbe, que es lo seguro.
  Si de verdad quieres poder dar de alta proveedores desde el Hub, que sea un botón aparte, explícito
  y confirmado — no un efecto colateral de crear una cotización.
