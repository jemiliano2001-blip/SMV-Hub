# Revisión del commit `617226e` — bloque no auditado (búsqueda semántica, embeddings, lector de PO)

Fecha: 2026-08-17 · Revisor: Claude Opus 5 · Base: `617226e` (working tree limpio)

> Complemento de [2026-08-17-revision-compras-odoo-investigacion-ia.md](./2026-08-17-revision-compras-odoo-investigacion-ia.md).
> Esa revisión cerró los bloqueantes de `/compras-odoo` e investigación IA, pero dejó explícitamente
> fuera de alcance el trabajo que se coló al final del commit: **búsqueda semántica, embeddings y el
> lector de órdenes de cliente**. Esto revisa justo eso.

## Gates automáticos

| Check | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ limpio |
| `npm run lint` | ✅ 0 errores, 17 warnings (todos preexistentes) |
| `npm test` | ✅ 911 pasan, 25 skip, 99 archivos |
| `npm run build` (webpack + verificador de bundle) | ✅ "Bundle SSR compatible con Firebase Hosting" |
| Modelos Gemini de embeddings vs `ai.google.dev` | ✅ `gemini-embedding-2-preview` existe (preview), `gemini-embedding-001` estable |

Los 4 gates pasan. Los hallazgos de abajo son cosas que **ningún gate detecta**.

---

## Estado (2026-08-17, misma sesión)

| Hallazgo | Estado |
|---|---|
| A1 · Falso emparejamiento de POs | ✅ **arreglado y verificado** — guard en `lib/documentos-venta-lector-ia.ts` + 2 tests de regresión |
| A2 · `/compras-odoo` invisible | ✅ **script arreglado y verificado** — falta que Emiliano lo corra contra Firestore |
| B1 · Catálogo de 15 ítems | 📋 Emiliano eligió **conectarlo a datos reales** → [spec](../superpowers/specs/2026-08-17-busqueda-semantica-datos-reales.md) + [plan](../superpowers/plans/2026-08-17-busqueda-semantica-datos-reales.md), pendientes de aprobación |
| B2, B3, C1, C2 | 📋 Incorporados a la Fase 1 del plan (son deuda real del código de hoy) |
| C3, C4 | Abiertos, sin plan asignado |

Gates tras los arreglos: `tsc` limpio · lint 0 errores · **913 tests** (2 nuevos) · build ✅.

## A — Hay que arreglarlo

### A1 · Falso emparejamiento de órdenes de cliente (confirmado empíricamente)

`lib/documentos-venta-lector-ia.ts:252`

```ts
descSo.includes(descCliente) || descCliente.includes(descSo)
```

Cuando `descSo` es cadena vacía, `descCliente.includes("")` es **siempre `true`**. Odoo genera
líneas con `productName` vacío para notas y secciones, así que no es hipotético.

**Verificado con un test temporal contra el módulo real:** una SO de un cliente sin ninguna relación
(sin coincidencia de orden de compra, sin coincidencia de nombre) con 3 líneas de nota alcanzó
`scoreCoincidencia: 25` — justo el umbral de entrada — y salió como sugerencia **con las 3 partidas
precargadas**. Si el vendedor le da "Aplicar", se prellenan cantidades de la SO equivocada.

El defecto concreto es que un `descSo` vacío vuelve el `includes` verdadero por vacuidad. El arreglo
mínimo correcto es **exigir que ambas cadenas tengan contenido y saltar las líneas sin nombre**; si
además se quiere un piso de longitud para evitar coincidencias por fragmentos, ese umbral es una
decisión aparte (afecta descripciones legítimamente cortas) y no la estoy recomendando a ciegas.

El caso que usé para confirmarlo debería quedarse como **test de regresión** en
`tests/documentos-venta-lector-ia.test.ts` cuando se aplique el arreglo — lo corrí en un archivo
temporal que ya borré para no ensuciar el árbol.

### A2 · `/compras-odoo` es invisible para todo el equipo salvo super-admins (confirmado)

`lib/roles.ts:259` — `tienePermiso` devuelve `true` de inmediato si `esSuperAdmin`. Por eso **tú sí
ves el módulo**. Pero los usuarios reales tienen `modulos[]` persistido en Firestore, y ahí no está
`compras-odoo`: agregarlo a `PLANTILLA_ADMIN` / `PLANTILLA_COMPRAS` en el código no toca los
documentos existentes.

Y el arreglo esperado tampoco sirve tal cual: `scripts/backfill-modulos-usuarios.mjs:16-56` tiene su
**propia copia** de las plantillas, congelada en la era pre-endmills, sin `compras-odoo`. Su única
lógica de ampliación (`MODULOS_PREVIOS_ENDMILLS`, líneas 61-64) está hardcodeada para endmills.
Correrlo hoy no le da acceso a nadie.

Es el módulo más grande del commit y nadie de compras lo puede abrir.

Arreglo aplicado: se agregó `compras-odoo` a la copia del script y se generalizó la lógica de
ampliación (`AMPLIACIONES` + `matrizPreviaA`, acumulativa) para que no haya que escribir un caso
especial cada vez que se agrega un módulo. También se añadió `--dry-run` y `--proyecto=`, que antes
no existían: el script tenía `smv-brain` hardcodeado y escribía sin ensayo posible.

**Secuencia segura para correrlo:**

```bash
node scripts/backfill-modulos-usuarios.mjs --dry-run --proyecto=smv-brain-dev
```

Luego sin `--dry-run` en dev, y solo al final contra producción (sin `--proyecto`).

**Qué se verificó y qué no** — importante antes de escribir en documentos de usuarios reales:
verifiqué la lógica de decisión y que las 5 plantillas del script coincidan exactamente con
`lib/roles.ts` (los 5 escenarios pasan: se amplía una matriz pre-endmills, se amplía una
pre-compras-odoo, una vigente no se toca, una personalizada se reporta sin tocarse). Lo hice
importando el prefijo puro del archivo real y replicando la rama de decisión, así que **no está
verificado el archivo ejecutándose de punta a punta**, ni el camino de usuarios sin `plantilla`
(el que escribe `plantilla`/`rol`/`esSuperAdmin`). El `--dry-run` contra dev cubre justo eso.

---

## B — Decisión tuya / calidad de experiencia

### B1 · El "catálogo semántico" son 15 ítems escritos a mano, no los datos de SMV

`lib/busqueda-semantica-catalogo.ts:40-200` — `CATALOGO_BASE_SMV` es una lista fija de 15 categorías
genéricas (fresas, aluminio 6061, Delrin, sensores…) cuyo `urlDestino` apunta a un módulo. La
búsqueda **no toca** órdenes, proveedores, endmills ni requisiciones reales.

La UI lo presenta como "Resultados Inteligentes IA (Catálogo & Refacciones)" con un badge de
"% afinidad", que se lee como si buscara en tu información.

Precedente directo tuyo: el tab **Reabastecimiento ROP se retiró el 2026-07-24 exactamente por
correr sobre datos demo en producción** (está documentado en `CLAUDE.md`). Es el mismo patrón.
Las opciones son conectarlo a datos reales, o etiquetarlo claramente como sugerencias de categoría.

### B2 · La búsqueda semántica falla en silencio

`lib/busqueda-semantica-catalogo.ts:237-239` — si falla la generación de embeddings del catálogo, se
hace `console.warn` y se devuelve `[]`. La ruta responde `ok: true` con 0 resultados, así que el
usuario ve "No se encontraron resultados" cuando lo que pasó fue que **el servicio se cayó**.
Va contra la regla del repo de errores visibles con mensaje claro.

### B3 · Race condition en el buscador global

`components/BuscadorGlobalCommand.tsx` — el debounce (350 ms, mínimo 3 caracteres) está bien puesto,
pero una vez que sale el `fetch` no hay `AbortController` ni verificación de que la respuesta
corresponda a la consulta actual: una respuesta lenta de una búsqueda vieja pisa los resultados de la
nueva. Además `timeoutRef` nunca se limpia al desmontar. El componente vive en `NavBar`, o sea en
todas las páginas.

---

## C — Menores / deuda

### C1 · Modelo de embeddings en preview, sin la red de seguridad que ya existe

`lib/embeddings-ia.ts:11-12`. Verifiqué contra `ai.google.dev`: los dos IDs son correctos y vigentes.
Pero `MODELO_EMBEDDING_FALLBACK = "gemini-embedding-001"` está exportado y **nunca se usa** —
`resolverModeloEmbedding()` ni lo consulta. El default es un modelo *preview*; si Google lo retira,
la búsqueda muere sin caída elegante. `lib/sat/gemini-sat.ts` ya resuelve esto (migra el modelo
obsoleto y avisa por consola); aquí falta el mismo patrón.

### C2 · `generarEmbeddingsLote` es código muerto, y su fallback amplifica errores

- El catálogo se vectoriza con **15 llamadas individuales** en `Promise.all`
  (`busqueda-semantica-catalogo.ts:224`) en vez de la función batch que existe justo para eso.
- `embeddings-ia.ts:203-228`: **cualquier** `!response.ok` — incluyendo 429 (rate limit) y API key
  inválida — dispara N peticiones individuales que van a fallar igual. Amplifica el error y el costo.
  Un timeout de 25 s también cae en ese camino.
- El caché es un `Map` a nivel de módulo: no sobrevive a un proceso de servidor nuevo, así que el
  costo y la latencia de revectorizar el catálogo escalan con qué tan seguido pase eso. No verifiqué
  el perfil de instancias/concurrencia con el que se sirve hoy en producción, así que no puedo
  cuantificarlo.

### C3 · La ruta `extraer-po` no acota el tamaño del cuerpo

`app/api/documentos-venta/extraer-po/route.ts:10` — `base64: z.string().min(1)` sin `.max()`.
El modal sí valida tipo y 15 MB (`ModalLectorOrdenCliente.tsx:75-83`), pero la ruta acepta cualquier
tamaño desde un cliente que no sea el modal. Defensa en profundidad, no urgencia.

### C4 · Los tests nuevos solo cubren el camino feliz

`tests/busqueda-semantica-catalogo.test.ts` mockea **el mismo vector para todos los ítems**, así que
"retorna resultados rankeados" no prueba ranking alguno — todos empatan en 1.0. No hay cobertura de
error de API, catálogo vacío, ni del fallo silencioso de B2. Por eso "911 tests pasan" no dice
gran cosa sobre este bloque.

---

## Lo que revisé y está bien

- Las **5 rutas API nuevas** validan token + usuario activo (`verificarUsuarioAutorizado`) y validan
  el body con Zod antes de tocar nada.
- **El lector de PO no auto-envía.** `handleSeleccionarSoConIA` (`NuevaSolicitudPanel.tsx`) solo
  preselecciona la SO y prellena cantidades; el humano sigue confirmando. Correcto para salida de IA.
- El modal valida tipo MIME y tamaño antes de subir.
- El buscador **no** dispara una llamada por tecla: debounce de 350 ms y mínimo 3 caracteres.
- Los IDs de modelos Gemini son válidos y vigentes (verificados contra la doc oficial, no de memoria).
- Los bloqueantes P0 de la revisión anterior (moneda de Odoo, parser TSV) siguen cerrados.
- `similitudCoseno` está bien implementada: valida dimensiones, protege contra norma cero y acota el
  resultado a [-1, 1].

## Fuera de alcance de esta revisión

Para que quede claro dónde están los bordes — el commit **no** queda revisado al 100%:

- `app/compras-odoo/CapturaOdooForm.tsx` (1078 líneas, el archivo más grande del commit). Ninguna de
  las dos revisiones lo leyó de punta a punta; la anterior verificó comportamientos puntuales
  (modal de éxito, selector de IVA, banner de advertencias).
- `lib/proveedores-investigacion-ia.ts` (460 líneas) y
  `app/proveedores/components/ModalInvestigacionPrecios.tsx` (537 líneas). Los cubrió la revisión
  anterior, pero contra el código **previo a las correcciones**; su pasada de verificación solo
  confirmó los puntos P1 específicos. No los releí aquí.

## Nota sobre gating por módulo en las rutas API

Las rutas nuevas usan `verificarUsuarioAutorizado` a secas, sin exigir módulo. La revisión anterior
ya caracterizó esto: **las 15 rutas existentes hacen exactamente lo mismo**. Es un hueco uniforme del
repo, no una regresión de este commit, y arreglarlo solo en las nuevas sería peor que dejarlo. Queda
anotado como tarea de repo, no como hallazgo de este bloque.
