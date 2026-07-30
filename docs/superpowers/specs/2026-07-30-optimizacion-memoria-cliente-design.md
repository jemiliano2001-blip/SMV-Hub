# Diseño: Optimización de memoria del cliente (SMV Hub)

**Fecha:** 2026-07-30  
**Módulo:** transversal (compras, proveedores, reportes, cotizaciones, nueva-compra; layout/NavBar)  
**Estado:** aprobado por el usuario (Enfoque 2 — datos bajo demanda en dos fases)  
**Enfoque:** 2 — “Datos bajo demanda” en dos fases  
**Fuera de alcance:** agregados diarios en Cloud Functions, virtualización de tablas, rewrite grande de capa de datos (Enfoque 3)

---

## Problema

En producción (`smv-hub.web.app`), Chrome marca **High memory usage (~1.4 GB)** en la pestaña
después de usar varios módulos y volver al home. El home en sí no carga catálogos pesados; el
crecimiento viene de **retener datasets completos en el cliente** al navegar entre rutas
(compras + proveedores + reportes).

Patrones confirmados en el código:

| Hotspot | Comportamiento actual |
|---------|----------------------|
| `/reportes` | UI de período, pero `listarOrdenes()` carga **todas** las órdenes y filtra en cliente |
| `/reportes/contable` | `listarOrdenes()` completo al armar lote |
| `/proveedores` | `cargarTodasOrdenes()` al montar para scorecards; `listarCotizaciones()` en flujos de histórico |
| `/cotizaciones` | `useCotizaciones` carga la colección entera; paginación solo en UI |
| `/nueva-compra` | `listarOrdenes()` completo para sugerencias inteligentes |
| `/ordenes` / `/requisiciones` | `cargarTodas` disparado por filtros de estado / preparación de filtros |
| Catálogo SAT | `data/sat/catalogo.json` (~10 MB) importado + parse Zod donde se use ese path |

Las órdenes ya tienen paginación Firestore (`obtenerPaginaOrdenes`, 50/página). El problema es
el **full-scan** (`listarOrdenes` / `cargarTodas` / `listarCotizaciones`) como default.

---

## Decisiones del usuario (brainstorming)

| Tema | Decisión |
|------|----------|
| Cuándo se nota | Tras usar varios módulos y volver al home (no solo al abrir) |
| Prioridad | Ambos, en fases: (1) frenar crecimiento al navegar, (2) aligerar pantallas pesadas |
| Ruta diaria | Mezcla compras + proveedores + reportes |
| Trade-off UX | Medio: OK pedir rango de fechas / “cargar más” / no traer historial completo hasta que el usuario lo pida |
| Enfoque | 2 — Datos bajo demanda |

---

## Objetivo y métricas

Medir en **producción o build de producción** (no solo `next dev`/Turbopack), con Chrome Task Manager.

**Flujo baseline fijo:** home → órdenes → proveedores → reportes → home.

| Fase | Criterio de éxito |
|------|-------------------|
| Baseline | Anotar MB al final del flujo (referencia ~1.4 GB observada) |
| Fase 1 | Tras el mismo flujo, memoria **estable** al repetir el ciclo; idealmente ≤ ~50% del baseline o claramente &lt; 700 MB si el baseline es ~1.4 GB |
| Fase 2 | Reportes / proveedores / cotizaciones **no** bajan el historial completo por defecto; picos por pantalla menores que hoy |

**No-regresión de negocio:**

- Multi-moneda: nunca sumar `total` entre MXN y USD.
- Reportes: si `fechaFactura` es null, seguir usando `creadoEn` (`filtrarPorRango` / columna `dia`).
- Sugerencias en nueva-compra: la IA sigue teniendo prioridad; el historial acotado puede reducir hits — documentarlo en UI o comentarios de módulo.
- E2E `camino-dinero` sigue pasando contra `smv-brain-dev`.

---

## Arquitectura

### Principios

1. Ninguna pantalla deja un catálogo completo vivo al desmontar la ruta.
2. Hooks de lista permanecen **locales a la página** — no subir catálogos a Context global.
3. `listarOrdenes()` / `listarCotizaciones()` / `cargarTodas` son **excepciones explícitas** (botón “Cargar historial completo”, export, etc.), no el default al montar.
4. La UI no importa Firestore directo; nuevas consultas viven en `lib/` (contrato actual).
5. Si falta un índice Firestore, **no** hay fallback silencioso a full-scan (eso recrearía el bug de memoria).

### Flujo de datos

```
Usuario entra a módulo
  → hook/página pide página o rango (no colección entera)
  → lib/* consulta Firestore acotada
  → estado React local a la ruta
Usuario sale del módulo
  → unmount → se libera el array grande
Usuario pide historial completo / export / scorecards full
  → acción explícita → listar* completo (excepción)
```

---

## Fase 1 — Contención al navegar

**Meta:** cortar auto-loads de colección completa y dejar de acumular RAM entre rutas.

### Trabajo

1. **Inventario y corte de auto-full-load**
   - `/proveedores`: quitar `cargarTodasOrdenes()` al montar; scorecards con ventana acotada o bajo botón “Actualizar scorecards”.
   - `/nueva-compra`: dejar de llamar `listarOrdenes()` entero; usar muestra reciente por defecto = **últimas 200 órdenes** (`creadoEn` desc) o, si es más barato de indexar, **últimos 6 meses**.
   - `/ordenes` / `/requisiciones`: filtros que hoy fuerzan `cargarTodas` → bajo demanda, con tope, o query acotada; “cargar historial completo” queda como acción explícita.
2. **Listeners globales** (NavBar: notificaciones, badges de pedidos/casos): mantener; no ampliar a snapshots de colecciones grandes; respetar límites existentes.
3. **Medición:** checklist manual del flujo baseline; registrar MB antes/después en el plan de implementación o en una nota de verificación.

### Fuera de Fase 1

- Reescribir reportes con query por rango (Fase 2).
- Paginación Firestore de cotizaciones (Fase 2).
- Refactor del catálogo SAT en cliente (Fase 2).

---

## Fase 2 — Pantallas pesadas

**Meta:** cada módulo pesado trae solo lo que el período/página pide.

| Módulo | Hoy | Después |
|--------|-----|---------|
| `/reportes` | Período en UI + `listarOrdenes()` full + `filtrarPorRango` cliente | Query acotada por rango (preferir `creadoEn` + `filtrarPorRango` en cliente para el fallback `fechaFactura`); default = preset semana/mes actual |
| `/reportes/contable` | `listarOrdenes()` completo | Solo candidatas del período / pendientes de cierre |
| `/proveedores` | Historial completo al montar | Ventana default **últimos 12 meses** o botón “Actualizar scorecards”; comparador histórico no baja todas las cotizaciones hasta buscar |
| `/cotizaciones` | Colección entera en hook | `obtenerPaginaCotizaciones` (mismo patrón que órdenes, ~50/página) |
| `/nueva-compra` | Historial completo | Muestra reciente acotada |
| SAT | JSON ~10 MB + Zod en paths de catálogo | Búsqueda vía `/api/claves-sat` / servidor; no meter `catalogo.json` en el bundle del cliente |

### API de datos (lib)

Nuevas (o extendidas) funciones puras de acceso, por ejemplo:

- `listarOrdenesEnRango(desde, hasta, …)` — consulta acotada; el filtro fino de negocio sigue en `filtrarPorRango` cuando haga falta el fallback `fechaFactura`.
- `obtenerPaginaCotizaciones(tamano, cursor?)` — espejo de `obtenerPaginaOrdenes`.
- Helpers de “muestra reciente” para sugerencias / scorecards (default: 200 órdenes o 6 meses; scorecards: 12 meses).

Índices Firestore nuevos (si `where` + `orderBy` lo requieren) se documentan y despliegan en el mismo plan; sin fallback a full-scan.

---

## Errores

- Fallo de red / query: banner + reintento (patrón actual); no romper la UI.
- Rango sin resultados: empty state (“No hay compras en este periodo…”), sin reintentar full-scan.
- Índice faltante: error visible en logs/dev; no degradar a `listarOrdenes()` completo.

---

## Pruebas

| Tipo | Qué |
|------|-----|
| Unit | Nuevas funciones de rango/paginación; `filtrarPorRango` con subsets |
| Regresión | Tests existentes de reportes, órdenes, cotizaciones, sugerencias |
| Manual | Flujo baseline + MB en Task Manager (prod o build `--webpack`) |
| E2E | `e2e/camino-dinero.spec.ts` sigue verde; ajustar solo si cambian contratos de carga |

---

## Archivos afectados (estimado)

**Fase 1:** `app/proveedores/page.tsx`, `app/nueva-compra/NuevaCompraForm.tsx`, `app/ordenes/OrdenesList.tsx`, `app/requisiciones/RequisicionesList.tsx`, hooks relacionados, tests de regresión.

**Fase 2:** `lib/ordenes.ts`, `lib/cotizaciones.ts`, `lib/hooks/useCotizaciones.ts`, `app/reportes/ReporteView.tsx`, `app/reportes/contable/ReporteContableView.tsx`, paths SAT cliente vs API, índices Firestore, tests nuevos/actualizados.

Lista exacta en el plan de implementación.

---

## Orden de entrega

1. Baseline medido + Fase 1 (cortes de auto-full-load).
2. Verificar métrica de estabilidad al navegar.
3. Fase 2 por módulo: reportes → cotizaciones → proveedores/nueva-compra refinamiento → SAT cliente.
4. Re-medir flujo baseline y documentar resultado.

---

## Alternativas descartadas

| Enfoque | Por qué no ahora |
|---------|------------------|
| 1 — Solo contención | No baja el pico al abrir reportes/proveedores |
| 3 — Arquitectura de datos (agregados, Functions, virtualización) | Overkill antes de cortar full-scans; candidato si Fase 2 no alcanza |
