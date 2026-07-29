# Integridad del gasto en Reportes

Este documento es el contrato implementable de la v1. Sustituye cualquier
wireframe anterior de Reportes que incluya búsqueda libre, severidad baja,
recálculo dominante o un dashboard de tarjetas.

## Objetivo

`/reportes` detecta, investiga y resuelve diferencias entre órdenes de SMV Hub
y facturas de proveedor `posted` de Odoo, sin convertir el cálculo shadow en
una cifra productiva ni migrar `/finanzas` antes del Go formal.

## Experiencia

- Pestañas: `Integridad`, `Reporte gerencial` y `Cierre contable`.
- Integridad usa ledger horizontal de confianza, cuatro filtros cerrados y
  workspace `58/42` de cola + inspector.
- Escritorio mantiene el inspector; tablet usa `Sheet`; móvil muestra detalle
  a pantalla completa.
- Gerencial y Contable solo reutilizan una franja compacta de confianza.
- `/proveedores/mis-casos` consume una tarea redactada: no recibe importes,
  precios, porcentajes, variaciones, totales ni KPIs.
- La vinculación manual compara candidatos vigentes. No existen campos libres
  de IDs.
- Con evidencia desactualizada se conserva el último cálculo; solo se bloquea
  resolver, descartar y vincular.

La UI conserva el shell claro actual: superficies planas, divisores de 1 px,
radio de 8 px en grupos interactivos, rose/amber/emerald con texto o icono,
objetivos táctiles de 44 px y movimiento funcional compatible con
`prefers-reduced-motion`.

## Pipeline e invariantes

```text
sync manual/programado
  -> lease renovable
  -> snapshot Odoo en memoria
  -> escritura/poda del espejo
  -> validación aislada de fuentes para Integridad
  -> ventana local de 12 meses + workflows abiertos
  -> motor determinista puro
  -> run staging + run_cases + checksum
  -> transacción ready + activeRunId
  -> callables unen evidencia y workflow
```

- Una corrida fallida o staging nunca reemplaza `activeRunId`.
- Un error de dominio de Integridad nunca revierte ni marca como fallida la
  sincronización del espejo de compras; solo falla la salud de Integridad.
- Un error inesperado sí se propaga para no ocultar fallas operativas.
- El motor no relee el espejo recién escrito.
- `in_refund` se excluye y contabiliza.
- La clave automática es factura normalizada + proveedor normalizado; no hay
  fallback por número de factura.
- Monedas distintas nunca se restan.
- Diferencia mayor a 2% crea caso; 10% o más es alta.
- Solo hay severidad alta y media.
- Los exactos alimentan cobertura, no la cola.

## Datos

Todo vive en la base nombrada `compras-americanas`:

- `reportes_integridad_state/{config|active|lease}`
- `reportes_integridad_runs/{runId}`
- `reportes_integridad_run_cases/{runId_caseId}`
- `reportes_integridad_workflows/{caseId}`
- `reportes_integridad_workflows/{caseId}/events/{eventId}`

Runs y evidencia expiran a 90 días mediante `expireAt`; workflows y eventos no
caducan en v1. El cliente no tiene lectura ni escritura directa a ninguna de
estas rutas.

## API y autorización

Callables:

1. `listarCasosIntegridad`
2. `obtenerCasoIntegridad`
3. `ejecutarComandoCasoIntegridad`

`syncOdooComprasManual` permanece como única sincronización manual.

- Vista completa: superadmin/break-glass o usuario activo con `reportes` +
  `finanzas`.
- Mis casos: usuario activo con `proveedores`, únicamente si sigue asignado.
- Resolver, descartar, asignar y vincular: Finanzas.
- Comentar, investigar y solicitar corrección: Finanzas o asignado operativo.
- En piloto se aplica además `pilotAllowlistUids`.

## Rollout

1. Producción se despliega en `mode=off`.
2. Shadow valida contratos, permisos, lease, cálculo y UI sin publicar sus
   resultados como cifras productivas.
3. El piloto requiere al menos dos semanas, 30 excepciones y 30 controles
   negativos.
4. `/finanzas` solo migra después de un Go firmado.

Inicialización:

```powershell
node scripts/init-reportes-integridad-config.mjs --project=smv-brain-dev --mode=shadow
node scripts/init-reportes-integridad-config.mjs --project=smv-brain --mode=off --confirm-production
node scripts/init-reportes-integridad-config.mjs --project=smv-brain --mode=shadow --confirm-production-shadow
```

El script bloquea `pilot` y `on` en producción. Esos modos requieren el gate
formal y no se habilitan desde esta utilidad.

### Estado del shadow del 29 de julio de 2026

- Producción permanece en `mode=shadow`.
- El espejo terminó correctamente con 594 órdenes, 1,788 partidas y sin error
  de sincronización.
- La consulta de Odoo devolvió 0 facturas de proveedor `posted`; Integridad
  registró `SOURCE_SNAPSHOT_INVALID`, no creó `activeRunId` y no sustituyó un
  cálculo válido.
- Antes de iniciar el piloto se debe corregir la visibilidad de `account.move`
  para el usuario/contexto de compañía de Odoo y repetir los controles
  positivos y negativos.
- Dev no tiene los secretos de Odoo: allí quedaron desplegados callables,
  reglas y Hosting, pero la corrida integrada se verificó en producción shadow.

La publicación de Hosting se hace con `scripts/firebase-deploy.mjs`: el wrapper
fuerza Webpack, resuelve `esbuild` en Windows y restaura los archivos temporales
al terminar. Dev usa `firebase.dev.json`; producción usa `firebase.json`.

La política TTL se habilita por colección y base:

```powershell
gcloud firestore fields ttls update expireAt --collection-group=reportes_integridad_runs --enable-ttl --database=compras-americanas --project=smv-brain
gcloud firestore fields ttls update expireAt --collection-group=reportes_integridad_run_cases --enable-ttl --database=compras-americanas --project=smv-brain
```

Ambas políticas quedaron `ACTIVE` el 29 de julio de 2026.

No ejecutar un deploy global de Functions. Los targets siempre incluyen el
codebase `smv-hub`.

## Evidencia de validación

- Functions y Next.js compilan; el build de Next usa Webpack y pasa la
  verificación del bundle SSR.
- Vitest: 67 archivos pasan y 3 se omiten; 660 pruebas pasan y 15 se omiten.
- Emulador Firestore: 14 pruebas pasan entre reglas, workflow, revisiones,
  candidatos, lease y carreras.
- Playwright cubre escritorio, tablet y móvil, además de axe, teclado, foco,
  zoom 200%, contraste y `prefers-reduced-motion`.
- Smoke HTTP público: `/`, `/login`, las tres vistas de Reportes y
  `/proveedores/mis-casos` responden 200 en producción.
- El smoke autenticado remoto queda pendiente porque esta ejecución no contó
  con una sesión Google ni contraseña E2E de dev. No se sustituyó por bypass.
