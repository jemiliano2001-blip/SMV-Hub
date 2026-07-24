# Diseño: Lazo de retroalimentación con producción (y qué NO construir)

**Fecha:** 2026-07-24
**Módulo:** transversal — E2E, reglas, telemetría, backups, `/almacen` (ROP)
**Estado:** propuesto — pendiente de aprobación del dueño
**Relacionado:** [roadmap-priorizado.md](../../research/smv-hub-improvements/roadmap-priorizado.md) (recorta y reordena sus Fases 0–4) · [auditoría de completitud funcional](2026-07-23-auditoria-completitud-funcional.md)

---

## Qué es SMV Hub (según el código, no según el README)

El mapa de propiedad de las colecciones de Firestore define la arquitectura real:

| Bucket | Colecciones | Qué significa |
|---|---|---|
| **Hub es system of record** | `ordenes`, `requisiciones`, `cotizaciones`, `ordenes-servicio`, `pedidos-almacen`, `almacen-entradas`, `almacen-salidas`, `registros-bano`, `horas-extra`, `operadores`, `caja_chica_movimientos`, `reportes_contables`, `sat_asignaciones`, `proveedores`, `auditoria` | El Hub **es** la verdad. Si el dato está mal, no hay upstream a quién culpar. |
| **Espejo de Odoo (una vía, solo lectura)** | `compras_odoo_po`, `compras_odoo_items`, `compras_odoo_facturas`, `finanzas_facturas` | Odoo manda; el sync copia y elimina huérfanos (con guarda anti-borrado si Odoo devuelve 0). |

Hasta el 2026-07-24 había un tercer bucket — pantallas sobre datos inventados. Tenía un solo
miembro, el tablero ROP de `/almacen`, y se eliminó (ver Fase A, ítem 6). Que ese bucket exista
otra vez es en sí mismo una señal de alarma.

**Conclusión:** SMV Hub **no es un ERP y no debe intentar serlo**. Es la *capa de operación
diaria alrededor de Odoo*: todo el trabajo del taller que Odoo no captura, o que nadie iba a
capturar en Odoo porque es incómodo. Odoo tiene la contabilidad formal; el Hub tiene la
operación real.

Ese eje decide qué construir: **si Odoo ya lo hace aceptablemente bien, el trabajo es conectar,
no construir.** Cada módulo que el Hub duplica de Odoo es mantenimiento permanente de una sola
persona.

## Estado real al 2026-07-24

- 101 commits desde el 2026-06-16 (5.5 semanas), ~48.8k líneas en `app/` + `lib/` + `components/` + `functions/src/`.
- 23 páginas, 11 Route Handlers, ~20 colecciones, 64 archivos de test (~9k líneas).
- CI con lint + `tsc --noEmit` + tests + Lighthouse y **deploy selectivo por target** a Firebase.
- Roles por módulo sincronizados en 3 capas (cliente, custom claims, Firestore Rules).
- Auditoría instrumentada en todos los módulos.

### La auditoría del 2026-07-23 quedó sustancialmente cerrada

Verificación directa contra el código al 2026-07-24 — los 11 ítems muestreados están cerrados,
tanto P1 como P2:

| Hallazgo | Estado | Evidencia |
|---|---|---|
| Envío perdido en órdenes con ítems (P1) | ✅ | `lib/reportes.ts` — `propEnvio` prorrateado por línea |
| `monedaFiltro` inerte + mezcla USD/MXN (P1) | ✅ | `DashboardInteligenciaCompras.tsx:41-45` → `comprasEnMonedaActiva` |
| `esSuperAdmin` ignorado por fallback legacy (P1) | ✅ | `lib/roles.ts:270-283` — el booleano explícito manda |
| Cierre contable archiva todas las monedas (P1) | ✅ | `ReporteContableView.tsx:225-240` — solo la moneda activa, con aviso |
| KPIs de Cuentas por Pagar sin pantalla (P2) | ✅ | `app/finanzas/page.tsx:202` — `calcularKpisAP` en uso |
| Arqueo de caja chica no persiste (P2) | ✅ | `ArqueoCaja.tsx:40` — `guardarArqueo()` + historial |
| Moneda como texto libre en Nueva Compra (P2) | ✅ | `NuevaCompraForm.tsx:523` — `<select>` cerrado |
| Borrado duro en caja chica (P2) | ✅ | `lib/caja-chica.ts:70` — soft-delete `anulado: true` |
| `/banos` sin auditoría (P2) | ✅ | `lib/banos.ts` — 4 llamadas a `registrarAuditoria` |
| Falta botón copiar clave SAT (P2) | ✅ | `BuscadorClavesSat.tsx:36` |
| `/ordenes-servicio` sin paginación (P2) | ✅ | `useOrdenesServicio.ts:30` usa `obtenerPaginaOrdenesServicio` |

**Implicación para este diseño:** el trabajo pendiente **no** es re-implementar la lista de la
auditoría. Ese documento es historia, no backlog. Si algo de ahí se va a tocar, se re-verifica
contra el código primero — la tasa de falsos pendientes es alta.

---

## Problema

**No existe un lazo de retroalimentación entre la realidad de producción y el código.**

La evidencia está en el propio documento de auditoría: los ~40 huecos funcionales existían
mientras *"build/lint/tests ya pasan"*. Todo verde, y aun así el filtro de moneda no filtraba,
el envío se perdía en los reportes, y un botón escribía requisiciones reales con datos demo.
La suite verde no midió nada de lo que importaba.

Los cuatro agujeros concretos:

| # | Hueco | Evidencia |
|---|---|---|
| 1 | **Cero E2E ejecutándose, punto.** Los 2 únicos specs son de accesibilidad (52 líneas para 23 páginas) **y ni siquiera corren**: `ci.yml` no tiene ningún paso de Playwright — sus pasos son ESLint, `tsc`, vitest, build y Lighthouse. | `e2e/*.spec.ts`; `.github/workflows/ci.yml` — 0 menciones a `playwright` o `test:e2e`. |
| 2 | **Reglas de seguridad sin verificar.** `firestore.rules` son 29 KB; el "test" son 15 líneas de regex sobre el texto del archivo, cubriendo una sola colección (`configuraciones`). Ningún test de emulador. | `tests/firestore-security.test.ts` |
| 3 | **Los errores de producción no dicen qué pasó.** Se registra un evento GA4 `exception` con solo un string de scope (`ui_app` / `ui_proveedores`) — sin `digest`, sin ruta. Sabes *que* truena; nunca *qué*. | `lib/ux-telemetry.ts` → `registrarErrorInterfaz()` |
| 4 | **Backup nunca restaurado.** Existe el script de exports programados; jamás se ha probado un restore. Un backup no verificado no es un backup. | `infra/firestore-backup/setup.sh` |

Y **una sola pieza funcional falta de verdad**: el stock real en `/almacen`. El tablero ROP
corre sobre datos inventados con un tooltip de aviso — mejor que antes, pero sigue siendo una
pestaña de producción que miente.

## Objetivo

1. Que un error de negocio en los caminos donde se mueve dinero **falle en CI**, no en la
   contadora.
2. Que un error en producción llegue con suficiente detalle para arreglarlo sin reproducirlo.
3. Que se sepa que el backup sirve **antes** del día que importe.
4. Que ninguna pantalla de producción muestre datos inventados.
5. Que las siguientes decisiones de producto se tomen con datos de uso real, no por intuición.

## Decisiones

| Tema | Decisión | Por qué |
|---|---|---|
| Reparto test unitario vs E2E | **2 tests unitarios + 1 E2E**, no un E2E para todo | De los 4 P1, dos eran funciones puras (`aplanarLineas` con envío, `esSuperAdminDesdeUsuarioLegacy`) — se cubren con vitest en `tests/reportes.test.ts`, que ya existe, a un costo mínimo. Solo `monedaFiltro` y el cierre contable son bugs de cableado que exigen navegador. Escalar al peldaño caro cuando el barato alcanza sería justo el error que este documento combate. |
| Alcance del E2E | **Un** recorrido: nueva compra → orden → reporte → cierre contable | Playwright ya está instalado y configurado; falta lo caro (ver abajo). |
| E2E en CI | El paso de Playwright en `ci.yml` es **parte del entregable**, no un extra | Sin él, el spec es un archivo que nadie corre — exactamente el estado actual de los 2 specs de accesibilidad. |
| Monitoreo de errores | Extender el evento GA4 existente con `digest` + ruta | Sin dependencia nueva. **Esto revierte una decisión deliberada**: `lib/ux-telemetry.ts` dice explícitamente *"No enviamos mensajes, rutas, digests ni datos del usuario"*. Se revierte a conciencia: el `digest` de React es un hash sin PII y las rutas del Hub son estáticas (`/ordenes`, `/finanzas`) — no llevan datos de nadie. Los mensajes de error siguen fuera. |
| Tests de reglas | Emulador de Firestore, solo en colecciones sensibles: `finanzas_facturas`, `caja_chica_movimientos`, escritura de `usuarios`, `auditoria` | Cuatro casos negativos ("usuario sin módulo NO puede leer"). Cubrir las 20 colecciones es trabajo sin retorno. |
| Restore de backup | Manual, **una vez**, a una base Firestore desechable que se borra al terminar | **No a `smv-brain-dev`**: ahí se hacen pruebas locales casuales, y el backup trae nómina, facturas y usuarios reales. Automatizar un drill anual sí sería over-engineering; meter datos reales al ambiente de juego sería peor. |
| ROP de `/almacen` | **Borrado** (decisión del dueño, 2026-07-24) | Datos demo en producción. Borrar el módulo del enum resultó seguro porque `modulosDesdeUsuarioLegacy` (`lib/roles.ts:236-241`) hace `safeParse` por ítem y descarta strings desconocidos — los docs de usuario en Firestore que aún traen `reabastecimiento-rop` simplemente lo pierden, sin excepción ni bloqueo de acceso. |
| Telemetría de uso | `page_view` con nombre de módulo sobre el GA4 ya montado | ~3 líneas. Sin dashboard propio: la consola de GA4 ya existe. |
| Unidad de estimación | **Noches**, no semanas | El equipo es una persona que rinde de noche y a rachas. Estimar en semanas produce planes que no se cierran. |

---

## Plan por fases

### Fase A — Que la realidad avise (5–7 noches) 🔴

Todo lo que falta de verdad. Va primero porque sin esto las demás fases se construyen a ciegas.

1. **Tests unitarios de las 2 reglas de dinero puras** — `aplanarLineas` con envío y
   `esSuperAdminDesdeUsuarioLegacy`. Media noche; el archivo de tests ya existe.
2. **Paso de Playwright en `ci.yml`** — instalación de navegadores, `webServer` y `storageState`
   desde un secret. **Esto va antes que escribir el E2E**: sin este paso, cualquier spec nuevo
   nace muerto igual que los dos de accesibilidad.
3. **E2E del camino del dinero** (1 spec): nueva compra → orden → reporte → cierre contable.
   Es la tarea más grande del plan, no una de cuatro chicas. Bloqueada por lo que tu propio
   roadmap ya identificó: conseguir un `storageState` autenticado con Google Sign-In real. La
   llamada a Gemini se stubea; no se prueba la IA, se prueba el cableado.
4. `registrarErrorInterfaz` con `digest` + ruta. Media noche.
5. Restore de backup a una base desechable, una vez, verificando que las órdenes están.
6. ~~ROP: conectar o borrar.~~ ✅ **Hecho el 2026-07-24** — borrado. `tsc` limpio, 625 tests en
   verde, `GET /almacen 200` sin errores de consola.

**Criterio de salida:** un bug de moneda o de monto introducido a propósito **rompe CI** — lo
cual hoy es imposible por construcción, porque CI no ejecuta ningún E2E.

**Nota de estimación:** los ítems 2 y 3 valen ~4 de las 5–7 noches. Si el `storageState`
autenticado se atora, se entregan 1, 4 y 5 (1.5 noches, valor real) y el E2E se aísla como
su propio bloque en vez de bloquear la fase entera.

### Fase B — Confianza en el candado (1–2 noches) 🟠

5. Tests de emulador para las 4 reglas sensibles: `finanzas_facturas`,
   `caja_chica_movimientos`, escritura de `usuarios`, `auditoria`. Un caso negativo cada una.

Nota: la Fase B originalmente incluía "cerrar los P2 de la auditoría que tocan dinero". **Se
elimina** — al verificar contra el código, esos P2 ya están cerrados (ver tabla arriba). Es el
ejemplo perfecto de por qué la Fase A va primero: sin verificación, se re-trabaja lo ya hecho.

### Fase C — Adopción, no features (2 noches — la de mayor retorno) 🟢

6. `page_view` por módulo. **Revisar primero la consola de GA4**: Firebase Analytics ya
   auto-registra `page_view` en web; lo dudoso es si captura los cambios de ruta del App Router.
   Si ya está, esta tarea cuesta cero.
7. 30 minutos observando a compras, almacén y finanzas usarlo. **Verlos, no preguntarles.**
8. Con esos datos: sacar del nav los módulos que nadie abre (archivar, no borrar del repo).

### Fase D — Solo si la Fase C lo pide 🔵

9. Partir `app/proveedores/page.tsx` (1,703 líneas) y `RequisicionesList.tsx` (1,257)
   **cuando estorben al editarlos**, no antes. Órdenes, Proveedores, Requisiciones y Órdenes de
   Servicio ya usan `startAfter` + `limit`; no queda un problema de volumen abierto que
   justifique tocarlos hoy. Es tamaño de archivo, no lentitud.

---

## Fuera de alcance (recortes explícitos al roadmap del 2026-07-22)

| Iniciativa cortada | Razón |
|---|---|
| **Fase 4 — offline persistente** | Ningún usuario lo ha pedido. Caché offline de datos financieros en un celular es riesgo de seguridad y bug farm. Si el problema es el wifi del taller, se arregla el wifi. |
| **Fase 3 — refactor XL por funciones de usuario** | 4–8 semanas para que el código se vea mejor. El código feo que funciona no le cuesta nada al taller; los bugs sí. Se parte un archivo cuando estorbe. |
| **"Sistema visual y tablas responsivas" (L)** | Ya hay migración a shadcn y vistas móviles. Es pulido, no falta. |
| **Presupuestos de carga por ruta + Query Explain** | Optimización sin un problema medido. Se mide cuando alguien diga "esto tarda". |
| **Eliminar duplicación / consolidar contratos** | Solo después de observar dos o más implementaciones equivalentes que estorben. |

## Higiene del repo (5 minutos, aparte)

4 logos duplicados en la raíz (~2.5 MB), `.graphify_ast.json` trackeado pese a estar en
`.gitignore:59`, `Estilo Reporte de Compras (standalone).html` (1 MB) y `Compras SMV (1).xlsx`
en la raíz. Un `git rm --cached`. Va al final a propósito: es lo más fácil de borrar y por eso
mismo es la trampa — no es el problema.

---

## Siguiente paso

Este documento es diseño, no plan ejecutable. Si se aprueba la Fase A, el siguiente artefacto es
`docs/superpowers/plans/2026-07-24-lazo-retroalimentacion-produccion.md` task-by-task.

Plan ejecutable: [`docs/superpowers/plans/2026-07-24-lazo-retroalimentacion-produccion.md`](../plans/2026-07-24-lazo-retroalimentacion-produccion.md).

Decisión pendiente del dueño, y la única del plan sin una salida obviamente floja:
**¿cómo se autentica el E2E en CI?** `storageState` guardado como secret de GitHub es lo más
simple y no mete dependencias, pero hay que regenerarlo a mano cada vez que caduque. Ver Task 3
del plan para las opciones.
