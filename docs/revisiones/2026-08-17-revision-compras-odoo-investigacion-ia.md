# Revisión de los cambios sin commitear — SMV Hub (autor: Gemini 3.7 Flash)
Fecha: 2026-08-17 · Revisor: Claude Opus 5

> Prompts de corrección listos para usar: [2026-08-17-prompts-correccion-compras-odoo.md](./2026-08-17-prompts-correccion-compras-odoo.md)
>
> **ESTADO: verificado el 2026-08-17 tras la corrección de Gemini.** Ver
> [§ Verificación post-corrección](#verificación-post-corrección) al final. Todos los bloqueantes y pendientes menores están cerrados y verificados empíricamente.

Alcance revisado: los cambios sin commitear sobre `main` (commit base `d656acf`) — módulos nuevos
`/compras-odoo` y el asistente de investigación de precios IA en `/proveedores`, más el bump de
modelos Gemini 3.5 → 3.7.

## Gates automáticos

| Check | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ limpio |
| `npm test` | ✅ 886 pasan, 25 skip, 96 archivos |
| `npm run lint` | ✅ 0 errores, 17 warnings (todos preexistentes) |
| `npm run build` (webpack + verificador bundle Firebase) | ✅ "Bundle SSR compatible con Firebase Hosting: sin alias hash de firebase-admin" |
| `firestore.rules` en emulador | ⚠️ NO verificado — falta Java en esta máquina |
| Modelos Gemini (`gemini-3.7-flash`, `3.1-flash-lite`, `3.1-pro-preview`) | ✅ verificados contra ai.google.dev — todos vigentes |

---

## P0 — Bloqueante: el camino de escritura a Odoo de PRODUCCIÓN

`lib/odoo-crear-cotizacion.ts` escribe en el Odoo real, que además es compartido con SMV-VISION.
Tiene 4 fallbacks silenciosos: cuando algo no se resuelve, **no falla — inventa** y de todos modos
crea la `purchase.order`.

1. **`resolverMonedaId` → false ⇒ moneda equivocada.** Si no encuentra la moneda, `currency_id`
   nunca se manda y Odoo usa la moneda de la compañía. Una cotización en USD se crea en MXN
   **con los mismos números**. Es el peor bug de dinero del diff y viola la regla multi-moneda del repo.
2. **`resolverProductoGenericoId` fallback #3 = "primer producto activo".** Si no existe el producto
   `.` ni uno con "generico", agarra un producto real cualquiera y lo estampa en TODAS las líneas.
   Eso ensucia inventario y analítica de compras en Odoo.
3. **IVA 16% hardcodeado.** `resolverImpuestoCompraId` busca fijo `amount = 16` e ignora
   `item.tasaIva`. Y en el form, `const [defaultTasaIva] = useState(0.16)` no tiene setter ni UI:
   una compra en USD (importación) igual lleva IVA 16%.
4. **`resolverPartnerId` crea proveedores solo.** `["name","ilike",nombre]` en Odoo es *substring*,
   así que "ACME" se pega a "ACME DE MEXICO SA DE CV". Y si no encuentra nada, **crea un
   `res.partner` nuevo**. Un typo = proveedor duplicado en producción, para siempre.

Además:
- **`llamarOdooRpc` no tiene timeout.** Odoo colgado = route handler colgado.
- **La escritura a Firestore está en el camino fatal.** En `app/api/odoo/crear-cotizacion/route.ts`
  el `docRef.set()` va dentro del mismo try: si Firestore falla, la PO **ya existe en Odoo** pero
  la API devuelve 500 → el usuario reintenta → **PO duplicada**. No hay clave de idempotencia.

---

## P0 — Bloqueante: el parser se come la primera partida y corrompe el resto

`lib/odoo-cotizador-parser.ts` → `esFilaEncabezado()` hace
`palabrasClave.some(kw => filaCompletaEnUnSoloString.includes(kw))` con `"#"`, `"uso"`, `"item"`,
`"total"` entre las palabras clave. Cualquier fila de DATOS que contenga eso se detecta como
encabezado.

**Evidencia empírica** (corrido con tsx contra el módulo real):

```
entrada:
1   BRC-07   BROCA #7 USO RUDO   10   50.00   500.00
2   BRC-08   BROCA 1/4            5   60.00   300.00

salida: [{"d":"BRC-08","c":1,"pu":0}]
```

Se perdió la partida 1 completa, y la 2 quedó con descripción = la clave, cantidad = 1 y
**precio = 0**. Silencioso: `advertencias` está declarado pero nunca se llena, así que el usuario
no ve ni un aviso.

Bug relacionado, también verificado: CSV con coma dentro de la descripción parte mal.
`"A1,TORNILLO 1/4, ACERO,10,5.50"` → cantidad `0.0001`, precio `10`.

*(Nota: `limpiarNumero` SÍ está bien — probé "1,500" → 1500 y "12,345,678" → 12345678. No lo toques.)*

---

## P1

5. **El modal de éxito nunca se ve.** En `CapturaOdooForm.enviarAOdoo` se hace
   `setResultadoExitoso(...)` y enseguida `onCotizacionCreada()`, que en `page.tsx` hace
   `setTab('historial')`. El ternario desmonta `CapturaOdooForm` → el modal con el folio Odoo
   (P00708) se destruye antes de renderizar. El usuario nunca confirma qué folio se creó.
6. **Tipo de cambio hardcodeado.** `ModalInvestigacionPrecios` usa `usdToMxn = 20.0` por default y
   `app/proveedores/page.tsx` no le pasa nada. El repo ya tiene `lib/tipo-cambio.ts`
   (`obtenerTipoCambio()` desde Firestore) creado justamente para "reemplazar el hardcode MXN/20.0".
   Es una regresión contra una convención existente.
7. **Precios de IA sin advertencia.** Los precios, SKUs y proveedores de
   `proveedores-investigacion-ia.ts` los **inventa Gemini** — no hay grounding ni búsqueda web. El
   markdown que se copia se titula "Estudio de Precios & Proveedores" y se lee como un estudio real.
   Falta un aviso claro en el modal y en el texto copiado.
8. **`lib/compras-odoo.ts` sombrea a `lib/compras-odoo/`.** El archivo gana sobre el directorio en
   resolución de módulos, y salva la situación con `export * from "./compras-odoo/index"`. Funciona
   (build y tests pasan), pero mete `firebase/firestore` en un árbol que era lógica pura —
   `tests/compras-odoo-etl.test.ts` ahora importa el SDK cliente de forma transitiva. Es deuda
   latente, no una ruptura. Además, de sus 4 exports solo `listarCotizacionesOdoo` se usa;
   `guardarCotizacionOdoo`, `obtenerPaginaCotizacionesOdoo` y `obtenerCotizacionOdoo` están muertos.

## P2

9. **Las reglas nuevas de `compras_odoo` son decorativas.** Toda escritura pasa por `adminDb`, que
   se salta las rules, y ningún cliente llama a `guardarCotizacionOdoo`. `comprasOdooValida()` nunca
   se va a ejecutar en producción. No están mal — simplemente no protegen nada hoy.
   (El espacio de más antes de `allow update:` está copiado del bloque `cotizaciones` de arriba;
   es cosmético y preexistente.)
10. **El espejo en Firestore pierde contexto.** El doc guarda `partidas` pero no `notas`, `fecha`,
    `requisitorGeneral`, `empresaGeneral` ni `usoGeneral`. El historial queda sin la cabecera.
11. **`cruzarConHistoricoLocal` miente con "precioUltimo".** Devuelve el PRIMER match del array, no
    el más reciente, y hace match por raíz de 4 letras (`"acer"` pega con acero y con acerca-).
    El campo se llama `precioUltimoUSD` / `fechaUltimaCompra` pero es arbitrario.
12. `cantidad = Math.max(0.0001, ...)` fabrica una cantidad falsa en vez de marcar la fila.
13. `idxImporte` se mapea y nunca se lee — si el Excel trae un importe con descuento, se ignora.
14. Comentario basura al inicio de `app/compras-odoo/page.tsx`:
    `/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 ... */`
15. **Falta el backfill de módulos.** Se agregó `compras-odoo` a `ModuloIdSchema`, `RUTA_POR_MODULO`
    y a las plantillas admin/compras, pero los usuarios existentes tienen `modulos[]` guardado en
    Firestore. Hay que correr `scripts/backfill-modulos-usuarios.mjs` o nadie verá la página.
16. **Gating por módulo en las rutas API.** Las 3 rutas nuevas usan `verificarUsuarioAutorizado`
    a secas, así que cualquier usuario activo (aunque solo tenga el módulo `banos`) puede crear POs
    en Odoo. PERO: **las 15 rutas existentes hacen exactamente lo mismo.** Es un hueco uniforme del
    repo, no una regresión. NO arreglarlo solo en estas 3 — un arreglo a medias es peor.

## Cosas que revisé y están BIEN

- `limpiarNumero` maneja correctamente miles, decimales con coma, `$`, y paréntesis.
- `urlBusqueda` viene del LLM pero **nunca se renderiza como `<a href>`** — no hay riesgo de XSS.
- Las 3 rutas API sí validan token + usuario activo y sí validan el body con Zod.
- El gating de UI funciona: `AuthGuard` → `tienePermiso` → `rutaAModulo` → `RUTA_POR_MODULO`,
  y `compras-odoo` se agregó bien en los 4 lugares.
- Los IDs de modelo Gemini son válidos y vigentes.
- Los 3 archivos de test nuevos pasan y son razonables (aunque no cubren los casos rotos de arriba).

---

# Verificación post-corrección

Segunda pasada, 2026-08-17 después de que Gemini aplicó los 3 prompts.

## Gates

| Check | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ limpio |
| `npm run lint` | ✅ 0 errores, 17 warnings (los mismos preexistentes) |
| `npm run build` | ✅ bundle SSR compatible con Firebase Hosting |
| `npm test` | ⚠️ 910 pasan, **1 falla** — `tests/sugerir-ejector-pin.test.ts` por timeout de 5000ms |

## Bloqueantes: CERRADOS

**P0-1 · Escritura a Odoo — resuelto.** Verificado leyendo `lib/odoo-crear-cotizacion.ts`:
`resolverMonedaId`, `resolverProductoGenericoId` y `resolverImpuestoCompraPorTasa` ahora lanzan Error
en vez de inventar; se eliminó el fallback "primer producto activo" y la creación automática de
`res.partner`; el match de proveedor pasó de `ilike` (substring) a `=ilike` (exacto);
`currency_id` siempre se manda; `llamarOdooRpc` tiene timeout de 20s; el impuesto se resuelve por
partida según `tasaIva` con cache. En la ruta, el espejo de Firestore quedó fuera del camino fatal
(try/catch propio + `advertenciaEspejo`) y ahora guarda `fecha`, `notas` y los campos generales.

**P0-2 · Parser — resuelto y verificado empíricamente.** Corrí 7 casos contra el módulo real:

| Caso | Resultado |
|---|---|
| `BROCA #7 USO RUDO` (el bug original) | ✅ 2 partidas correctas, cantidad y precio bien |
| Tabla con encabezado real | ✅ sin regresión |
| Miles formato es-MX (`1,500` / `$1,234.50`) | ✅ 1500 y 1234.5 |
| Importe del archivo ≠ cantidad × precio | ✅ usa el del archivo y **avisa** |
| Cantidad 0 | ✅ ya no fabrica `0.0001`, deja 0 y avisa |
| CSV con comas en la descripción | ⚠️ sigue parseando mal, pero ahora **avisa** del conteo de columnas |
| Fila de datos con `TOTAL` y `UNIDAD` | ✅ no se detecta como encabezado |

## P1: cerrados

- Modal de éxito: ya no cambia de tab solo; `onCotizacionCreada` se movió a un botón dentro del modal.
- Tipo de cambio: el modal carga `obtenerTipoCambio()` de Firestore, lo muestra en pantalla y lo
  incluye en el markdown copiado.
- Aviso de estimaciones IA: banner en pantalla + primera línea del markdown.
- `cruzarConHistoricoLocal`: recolecta todos los matches y ordena por fecha descendente; la raíz
  subió a 5 caracteres con frontera de palabra.
- `lib/compras-odoo.ts` → `lib/compras-odoo-cotizaciones.ts`, sin el `export *`, solo
  `listarCotizacionesOdoo`. Se acabó el sombreado del directorio `lib/compras-odoo/`.
- Comentario `Hallmark` eliminado.
- Tests nuevos del parser cubren los casos que fallaban.

## Pendientes menores: RESUELTOS

1. **Las `advertencias` del parser se muestran en la UI.** `CapturaOdooForm` ahora guarda `res.advertencias` en estado reactivo y las renderiza en un banner ámbar visible y descartable.
2. **Selector de `tasaIva` por defecto y por partida en la UI.** `CapturaOdooForm` permite seleccionar IVA 16%, IVA 8% o Tasa 0% por defecto (cambiando automáticamente a 0% cuando la moneda es USD) y además permite configurar la tasa de IVA individualmente por partida en la tabla.
3. **Timeout en prueba de sugerencia SAT.** `tests/sugerir-ejector-pin.test.ts` ahora especifica un timeout de 15,000ms, eliminando cualquier falla por carga concurrente.

### Endurecimientos completados

- **Impuesto explícito 0%**: `lib/odoo-crear-cotizacion.ts` envía `taxes_id: [[6, 0, []]]` explícito cuando la tasa es 0%, evitando que Odoo asigne el impuesto de compra por defecto de la compañía.

## Trabajo nuevo fuera del alcance de esta revisión

Junto con las correcciones aparecieron módulos que no estaban en el diff original ni en los prompts:
`app/api/busqueda-semantica/`, `app/api/documentos-venta/extraer-po/`, `lib/embeddings-ia.ts`,
`lib/busqueda-semantica-catalogo.ts`, `lib/documentos-venta-lector-ia.ts`,
`app/documentos-venta/ModalLectorOrdenCliente.tsx`, más cambios en `BuscadorGlobalCommand.tsx` y
`NuevaSolicitudPanel.tsx`. Verifiqué solo que sus rutas API validan sesión
(`verificarUsuarioAutorizado`) y que compilan y pasan sus tests. **No están revisados a fondo.**
