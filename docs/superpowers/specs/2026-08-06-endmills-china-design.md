# Diseño: Inventario y ciclos de compra de Endmills China

**Fecha:** 2026-08-06  
**Módulo:** nueva ruta `/endmills`  
**Estado:** implementado y desplegado en producción el 2026-08-06  
**Fuente:** `endmills-seed.json` + cotización ChangZhou North Alloy Tool Co. de agosto de 2026  
**Plan:** `docs/superpowers/plans/2026-08-06-endmills-china.md`

---

## Problema

La compra de endmills se repite con frecuencia, pero hoy la preparación de cada
cotización vuelve a hacerse fuera de SMV Hub. El trabajo manual consiste en:

1. revisar el stock de 47 medidas;
2. recuperar qué se pidió y a qué precio la vez anterior;
3. calcular cuánto conviene pedir ahora;
4. comparar el costo nuevo contra el pedido anterior;
5. preparar una lista revisable para el proveedor en China.

El resultado actual es una fotografía en Excel. No queda una base viva que use el
nuevo pedido como referencia del siguiente ciclo.

El 2026-07-24 se retiró de `/almacen` el tablero Reabastecimiento ROP porque usaba
`DEMO_ITEMS_RECOMPRA` y permitía generar requisiciones reales. Este diseño no
restaura ese módulo: parte exclusivamente de las 47 medidas reales del seed y no
crea requisiciones ni órdenes generales con un clic.

## Objetivo

Crear un flujo vivo y auditable para:

- consultar inventario, especificación y precio vigente de las 47 medidas;
- identificar medidas críticas, bajas, correctas o aún sin base de cálculo;
- preparar cantidades sugeridas con una fórmula reproducible;
- revisar y ajustar cada cantidad antes de registrar un pedido;
- comparar el pedido en preparación contra el pedido real anterior, siempre en
  USD y distinguiendo artículos de costos adicionales;
- conservar historial por medida y por ciclo de compra;
- reutilizar el pedido confirmado como base del siguiente ciclo.

## Hechos verificados del seed

El importador y sus pruebas deben conservar estos invariantes:

| Dato | Valor verificado |
|---|---:|
| Medidas | 47 |
| Categorías | 7 |
| Stock actual total | 722 pzas |
| Medidas con partida en marzo | 32 |
| Medidas sin partida en marzo | 15 |
| Partidas que requieren confirmación explícita | 2 (`id` 2 y 38) |
| Piezas rastreadas del pedido de marzo | 478 |
| Partida fuera del catálogo actual | 5 pzas · Largo Bola 1/8" |
| Piezas totales marzo | 483 |
| Artículos rastreados marzo | $5,885.19 USD |
| Artículo fuera de catálogo | $36.75 USD |
| Artículos totales marzo | $5,921.94 USD |
| Ali Cost + shipping | $40.00 + $198.00 USD |
| Total real marzo | $6,159.94 USD |

### Hueco de datos que no se debe ocultar

Ninguna de las 47 medidas incluye `stockAntesDelUltimoPedido`. Por eso el seed no
permite reconstruir de forma válida el PAR histórico:

```text
objetivoPar = stockAntesDelPedido + cantidadPedida
sugerido = max(0, objetivoPar - stockActual)
```

No se inferirá ni inventará ese valor. En el primer ciclo después de importar:

- la sugerencia aparece como **Sin base**;
- el usuario captura o ajusta manualmente la cantidad del primer pedido;
- al confirmar ese pedido, la app guarda el stock actual como
  `stockAntesPedido` y calcula `objetivoPar`;
- desde el siguiente ciclo, la sugerencia ya se calcula automáticamente.

Si antes de implementar se entrega una fuente confiable con
`stockAntesDelUltimoPedido`, el importador podrá aceptarla como dato opcional y
habilitar la sugerencia inicial sin cambiar el modelo.

## Decisiones de producto

### Ruta propia, no pestaña de `/almacen`

Se usará `/endmills`, visible en el grupo **Compras**.

| Alternativa | Evaluación |
|---|---|
| Pestaña en `/almacen` | Repite la forma del módulo retirado, mezcla movimientos físicos con precios/pedidos y vuelve a mostrar recompra a personal de almacén. Rechazada. |
| Panel dentro de `/proveedores` | El proveedor es solo una parte; inventario e historial de 47 medidas dominarían una pantalla cuyo propósito es el catálogo. Rechazada. |
| Ruta `/endmills` | Da espacio al ciclo completo, conserva `/almacen` como Entradas/Salidas y permite un permiso explícito. Elegida. |

### Permiso independiente

Se agrega el módulo `endmills`, sin reutilizar ni resucitar
`reabastecimiento-rop`.

- Plantillas con acceso por defecto: `admin` y `compras`.
- `almacen`, `diseno` y `automatizacion`: sin acceso por defecto.
- Un usuario de otra plantilla puede recibir `endmills` de forma individual en
  `/usuarios`.
- Cliente, documentos `usuarios`, custom claims cuando apliquen y
  `firestore.rules` deben permanecer sincronizados.

### Sin compra automática

La sugerencia solo alimenta un borrador. Registrar un pedido requiere:

1. abrir la revisión;
2. revisar/editar cantidades y precios;
3. resolver o excluir partidas marcadas para confirmación;
4. confirmar que los datos fueron revisados;
5. pulsar **Registrar pedido**.

V1 no crea automáticamente una `requisicion`, una `orden` general ni escribe en
Odoo. Esas integraciones quedan fuera hasta que el flujo dedicado tenga uso real.

## Modelo de datos

### Colección `endmills-medidas`

`EndmillMedidaSchema`:

| Campo | Tipo | Propósito |
|---|---|---|
| `id` | `string` | ID estable `endmill-001` … `endmill-047` |
| `orden` | `int` | Orden estable del seed |
| `categoria` | enum | `FLAT`, `BALL`, `LARGO_FLAT`, `LARGO_BOLA`, `EXTRA_LARGO_FLAT`, `EXTRA_LARGO_BOLA`, `RUPA_CARBURO` |
| `medidaPulgadas` | `string` | Medida visible, sin convertir fracciones a flotante |
| `descripcion` | `string` | Descripción comercial |
| `stockActual` | `int >= 0` | Existencia viva |
| `stockActualizadoEn` | `Date` | Fecha del último conteo/ajuste |
| `precioActualUSD` | `number >= 0` | Precio vigente por pieza |
| `cotizacionFecha` | `YYYY-MM-DD` | Fecha de la cotización vigente |
| `specPropuesta` | `string` | Especificación enviada/propuesta por China |
| `requiereConfirmacion` | `boolean` | Bloquea su inclusión silenciosa en un pedido |
| `notas` | `string | null` | Observaciones reales del seed |
| `objetivoPar` | `int | null` | Base derivada del último pedido confirmado |
| `ultimoPedidoId` | `string | null` | Referencia al ciclo que fijó el objetivo |
| `creadoEn`, `actualizadoEn` | `Date` | Trazabilidad estándar |

`objetivoPar` es una denormalización deliberada para renderizar las 47 filas sin
consultar todo el historial. Su fuente de verdad es la partida del último pedido
confirmado.

### Colección `endmills-pedidos`

`PedidoEndmillsSchema` guarda la cabecera y los totales de un ciclo completo.

Campos de cabecera:

- `id`, `fecha`, `numeroProveedor`, `estado` (`confirmado`, `recibido`,
  `cancelado`);
- snapshot de proveedor: nombre, contacto, email y origen;
- `moneda: "USD"` literal;
- `costoItemsUSD`, `aliCostUSD`, `shippingUSD`, `totalUSD`;
- `costosAdicionalesConfirmados: boolean` para no presentar un total incompleto
  como landed total;
- `origen: "semilla" | "manual"`;
- `numeroPartidas` y `numeroPiezas` como resúmenes verificables;
- `creadoPorUid`, `creadoPorNombre`, `creadoEn`, `actualizadoEn`.

### Colección `endmills-pedido-partidas`

Cada `PartidaPedidoEndmills` es un documento propio. Esta normalización permite
validar cantidades/precios en Firestore Rules y consultar historial por
`pedidoId` o `medidaId`, sin descargar todos los ciclos.

Cada partida guarda snapshots históricos:

- `pedidoId`, `fechaPedido`, `tipo` (`catalogada` o `fuera_catalogo`);
- `medidaId` nullable, categoría, descripción, medida y spec;
- `stockAntesPedido` (`int | null` solo para el seed histórico incompleto);
- `cantidadPedida`, `precioUnitarioUSD`, `subtotalUSD`;
- `objetivoPar` (`int | null`);
- `requiereConfirmacionAlCrear` y `confirmacionResuelta`.

El pedido de marzo se importa como `confirmado` con sus 32 partidas rastreadas,
una partida `fuera_catalogo` y los totales reales. Sus campos
`stockAntesPedido`/`objetivoPar` quedan `null`.

## Lógica de cálculo

Las funciones puras viven en `lib/endmills-calculos.ts`; Firestore no participa
en sus pruebas.

```ts
objetivoPar = stockAntesPedido + cantidadPedida
sugerido = objetivoPar === null ? null : Math.max(0, objetivoPar - stockActual)
subtotalUSD = redondearUSD(cantidad * precioUnitarioUSD)
```

Reglas:

- `null` significa **Sin base**; nunca se convierte silenciosamente en `0`.
- una existencia superior al objetivo produce sugerido `0`, nunca negativo;
- los montos se redondean a centavos en cada subtotal y al sumar el pedido;
- todos los KPIs de este módulo son USD; no existe agregación MXN;
- la cotización de agosto actualiza precio/spec, pero no se registra como pedido
  real.

### Semáforo

El semáforo es una ayuda visual; no modifica la cantidad sugerida:

- **Sin base**: `objetivoPar === null`;
- **Crítico**: stock en 0 o stock <= 25% del objetivo;
- **Bajo**: stock por debajo del objetivo;
- **OK**: stock igual o superior al objetivo.

El umbral de 25% será una constante probada y documentada, no un supuesto de
lead time ni un falso ROP. V1 no afirma conocer consumo semanal, stock de
seguridad o MOQ porque el seed no los contiene.

## Flujos

### 1. Consulta y actualización de inventario

- filtros por categoría mediante pills con conteo;
- búsqueda por descripción, medida o spec;
- edición de stock desde el detalle de una medida;
- confirmación antes de guardar y auditoría automática;
- actualización optimista solo después de validación Zod; si falla la red, se
  conserva el valor capturado y se muestra banner con reintento.

V1 registra el último conteo y la auditoría estándar. Un ledger completo de
consumos/entradas por pieza queda fuera hasta comprobar que el equipo lo usará.

### 2. Preparar pedido

1. La app crea en memoria un borrador con las 47 medidas.
2. Usa `sugerido` cuando existe; usa 0 + etiqueta **Definir manualmente** cuando
   falta base.
3. El usuario elige partidas, ajusta cantidad/precio y captura Ali Cost/shipping
   si ya se conocen.
4. Se muestran en paralelo:
   - artículos del pedido anterior;
   - artículos del borrador actual;
   - total landed solo si los adicionales actuales están confirmados.
5. Las medidas 2 y 38 empiezan excluidas y con alerta. Para incluirlas, el
   usuario debe marcar que spec y precio fueron confirmados.
6. La acción final presenta un resumen y checkbox de revisión humana.
7. Al confirmar, se guarda el pedido y cada partida actualiza `objetivoPar` y
   `ultimoPedidoId` de su medida.

No se aumenta `stockActual` al registrar el pedido. Solo cambia al marcarlo
**Recibido**, usando cantidades recibidas confirmadas; así no se presenta stock
en tránsito como disponible.

### 3. Historial

- Tab **Pedidos**: ciclos ordenados por fecha descendente, total de artículos,
  costos adicionales y total USD.
- Detalle de medida: precios, cantidades y objetivo de cada pedido donde estuvo
  incluida.
- Pedido de marzo: conserva 483 piezas y $6,159.94 USD aunque una partida no
  pertenezca a las 47 medidas actuales.

### 4. Salida para cotizar

Desde el borrador revisado:

- **Copiar tabla**: spec, cantidad y precio de referencia;
- **Descargar CSV**: salida local, sin subir otro archivo;
- **Preparar correo**: `mailto:` a Rita con asunto y resumen, sin envío
  automático ni credenciales de correo.

Estas salidas no registran un pedido. La persistencia ocurre únicamente al usar
**Registrar pedido**.

## Interfaz

La vista usa las primitivas existentes de `components/ui/` y el estilo claro
actual de SMV Hub; no introduce un tema paralelo.

### Cabecera compacta

- título **Endmills China** y proveedor actual;
- KPIs: 47 medidas, críticas/bajas, sin base y pendientes de confirmar;
- acciones: **Actualizar stock** y **Preparar pedido**.

### Tab Inventario

Tabla desktop y tarjetas compactas en móvil:

| Medida | Descripción / spec | Stock | Estado | Precio USD | Sugerido | Variación vs. marzo |
|---|---|---:|---|---:|---:|---:|

- categorías como pills, no siete paneles permanentes;
- fila amber para `requiereConfirmacion`;
- historial y notas dentro de un drawer/modal, no como columnas pesadas;
- estados expresados también con texto/icono, no solo color.

### Tab Pedidos

Lista simple por ciclo. El detalle abre el snapshot completo y separa:

- subtotal de artículos;
- Ali Cost;
- shipping;
- total USD.

### Revisión de pedido

Drawer o modal ancho con tabla editable, resumen pegajoso y confirmación final.
No hay controles de ROP/EOQ, gráficas decorativas ni paneles de otras categorías.

## Acceso a datos y errores

- `lib/endmills.ts` usa `crearRepositorio<T>()` para las tres colecciones y añade
  únicamente las operaciones atómicas específicas del dominio.
- `lib/hooks/useEndmills.ts` suscribe medidas y pedidos en vivo, ofrece fetch
  manual y estados `loading`/`error`.
- La UI nunca importa Firestore directamente.
- Un error de listener muestra banner + **Reintentar** y conserva la última data
  válida en pantalla.
- Un fallo al registrar pedido no cambia objetivos ni stock parcialmente: una
  transacción relee el stock, crea cabecera/partidas y actualiza objetivos como
  una sola operación. Si el stock cambió desde que se abrió la revisión, obliga
  a revisar de nuevo en lugar de confirmar datos obsoletos.

## Seed e importación

`scripts/importar-endmills.mjs`:

- recibe la ruta al JSON y `--project` explícito;
- hace dry-run por defecto;
- exige `--apply` para escribir;
- valida las 47 medidas, IDs únicos, enums, números no negativos, dos flags de
  confirmación y el cuadre 478 + 5 = 483 / $5,885.19 + $36.75 + $40 + $198 =
  $6,159.94;
- usa IDs deterministas y aborta ante documentos divergentes ya existentes;
- importa 47 medidas, la cabecera histórica y sus 33 partidas en un solo batch;
- nunca genera insertos, tooling, consumibles ni proveedores ficticios.

El seed contiene precios y contacto comercial reales. No se importa al bundle
del cliente. Permanecerá fuera de Git por defecto; versionarlo requeriría una
decisión explícita del propietario.

## Seguridad

`firestore.rules` incorpora validadores separados para:

- `endmills-medidas`;
- `endmills-pedidos`;
- `endmills-pedido-partidas`.

Lectura y escritura requieren usuario activo y módulo `endmills`. Además:

- `moneda` debe ser `USD`;
- stock, cantidades y montos no pueden ser negativos;
- `creadoEn` es inmutable y `actualizadoEn` debe avanzar;
- delete queda deshabilitado; una corrección usa actualización auditada o
  `estado: cancelado`;
- un pedido confirmado no puede alterarse silenciosamente; correcciones
  financieras se registran como cancelación + nuevo pedido.

Los tests de emulador cubren usuario con/sin módulo, forma básica, inmutabilidad y
rechazo de borrado.

## Pruebas

- Vitest de fórmula, estados, redondeo y totales.
- Vitest de seed e invariantes de marzo.
- Vitest de permisos/plantillas y mapeo de ruta.
- Tests de repositorio con Firebase mockeado.
- Firestore Emulator: positivos y negativos de las tres colecciones.
- Browser smoke autenticado contra `smv-brain-dev`:
  - listar 47 medidas;
  - filtrar/buscar;
  - actualizar un stock y comprobar persistencia tras reload;
  - preparar cantidades, resolver alerta, registrar pedido;
  - comprobar historial, nuevo objetivo y recepción sin stock prematuro.

## Fuera de alcance

- Restaurar `reabastecimiento-rop` o `DEMO_ITEMS_RECOMPRA`.
- Inventar datos de insertos, tooling u otras familias.
- Predicción por IA, consumo semanal, EOQ, MOQ o lead time no respaldado por
  datos reales.
- Escribir en Odoo.
- Crear automáticamente requisiciones u órdenes generales.
- Mezclar o convertir MXN dentro de los KPIs de Endmills.
- Un ledger completo de cada consumo de taller.
- Despliegue a producción sin una solicitud explícita posterior.

## Criterios de éxito

1. La ruta muestra exactamente las 47 medidas reales y el pedido de marzo cuadra
   con 483 pzas / $6,159.94 USD.
2. Ninguna fila sin `objetivoPar` muestra una sugerencia numérica inventada.
3. Un pedido confirmado guarda el stock anterior y habilita la sugerencia del
   ciclo siguiente.
4. Las medidas 2 y 38 no entran silenciosamente en un pedido.
5. El usuario puede pasar de inventario a una tabla lista para cotizar sin
   rehacer cálculos en Excel.
6. No existe ninguna acción directa desde una sugerencia hacia una requisición,
   orden general u Odoo.
7. Lint, TypeScript, Vitest, reglas, build y browser smoke pasan antes de dar la
   implementación por terminada.
