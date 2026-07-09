# Diseño: Búsqueda mejorada, ordenamiento y paginación en Cotizaciones

**Fecha:** 2026-07-06  
**Módulo:** `/cotizaciones`  
**Estado:** aprobado por el usuario (Enfoque 1 — cliente puro con lógica en `lib/`)  
**Archivos afectados:** `lib/cotizaciones-tabla.ts` (nuevo), `app/cotizaciones/CotizacionesList.tsx`, `tests/cotizaciones-tabla.test.ts` (nuevo)

---

## Problema

La pestaña **Consultar** de `/cotizaciones` carga ~443 cotizaciones en una sola tabla sin
paginación ni ordenamiento por columna. La búsqueda actual concatena descripción, no. de parte
y proveedor en un solo `includes`, lo que dificulta localizar piezas cuando el usuario escribe
varias palabras o cuando el no. de parte y la descripción aportan información distinta.

El equipo necesita comparar precios entre proveedores ordenando la tabla (sin vistas especiales
de comparación) y navegar listas largas sin scroll infinito.

## Objetivo

1. **Búsqueda mejorada** — no. de parte y descripción con igual peso; soporte multi-palabra.
2. **Ordenamiento por columna** — clic en encabezados para comparar precios y fechas.
3. **Paginación** — 50 filas por página; orden por defecto fecha descendente.

Sin columnas nuevas visibles, sin cambios al schema Firestore, sin vistas agrupadas ni modales
de comparación.

---

## Decisiones del usuario (brainstorming)

| Tema | Decisión |
|---|---|
| Prioridad | Búsqueda/comparación + UX de tabla |
| Búsqueda | No. de parte **y** descripción por igual |
| Comparación | Tabla mejorada (ordenar por precio); sin vistas especiales |
| Columnas | Las actuales; sin `diasHabiles` ni `notas` en tabla |
| Paginación | 50 filas/página; orden inicial por fecha ↓ |

---

## Arquitectura

Nuevo módulo de lógica pura `lib/cotizaciones-tabla.ts`:

| Función | Responsabilidad |
|---|---|
| `filtrarCotizaciones(cotizaciones, filtros)` | Ubicación, estatus y búsqueda por tokens |
| `ordenarCotizaciones(cotizaciones, columna, direccion, opts?)` | Orden por columna; `opts.busqueda` activa ranking si orden es el default |
| `puntuacionRelevancia(cotizacion, busqueda)` | Score de relevancia para búsqueda activa |
| `paginarCotizaciones(cotizaciones, pagina, tamanoPagina)` | Slice + metadatos de paginación |

`CotizacionesList.tsx` conserva el estado de UI y delega el procesamiento a esas funciones
(mismo patrón que `lib/reportes.ts` + `app/reportes/`).

**Sin cambios:** `lib/schemas.ts`, `lib/cotizaciones.ts`, `lib/hooks/useCotizaciones.ts`,
`CotizacionFormModal`, `ImportarCotizaciones`, `CotizacionesTabs`.

Se descartó:
- **Paginación en Firestore** — no resuelve búsqueda multi-campo; complejidad innecesaria
  para ~500 registros.
- **Scroll virtual** — UX distinta a la paginación pedida; nueva dependencia.

---

## Tipos

```ts
export type FiltroUbicacion = "todas" | "MX" | "USA"
export type FiltroEstatus = "todos" | "cotizado" | "revisar" | "cancelado"

export type FiltrosCotizacion = {
  busqueda: string
  ubicacion: FiltroUbicacion
  estatus: FiltroEstatus
}

export type ColumnaOrdenCotizacion =
  | "fecha"
  | "solicitante"
  | "proveedor"
  | "descripcion"
  | "numeroParte"
  | "cantidad"
  | "precioUnitario"
  | "total"
  | "estatus"

export type DireccionOrden = "asc" | "desc"

export type ResultadoPaginacion<T> = {
  filas: T[]
  paginaActual: number
  totalPaginas: number
  totalFilas: number
  indiceInicio: number // 1-based para UI
  indiceFin: number
}
```

---

## Búsqueda mejorada

### Campos buscables

`descripcion`, `numeroParte`, `proveedor`, `solicitante` — todos normalizados con
`normalizar()` de `lib/format.ts` (case- y accent-insensitive, igual que `/ordenes`).

### Lógica por tokens

1. `busqueda.trim()` se divide en tokens por espacios (tokens vacíos se descartan).
2. Si no hay tokens, no se aplica filtro de texto.
3. Cada token debe aparecer en **al menos un** campo buscable (`AND` entre tokens,
   `OR` entre campos).
4. Filtros de ubicación y estatus se aplican **antes** del filtro de texto.

### Ranking (solo cuando hay búsqueda activa)

Función auxiliar `puntuacionRelevancia(cotizacion, busqueda)` → número menor = más
relevante:

1. Coincidencia exacta de `numeroParte` normalizado con la búsqueda completa → 0.
2. `numeroParte` normalizado empieza con la búsqueda completa → 1.
3. `descripcion` normalizada empieza con el primer token → 2.
4. Resto → 3.

**Cuándo aplica:** si `busqueda` tiene tokens **y** el usuario no ha cambiado el orden
(`columnaOrden === "fecha"` y `direccionOrden === "desc"`, estado inicial), ordenar primero
por `puntuacionRelevancia` y luego por `fecha` desc como desempate.

**Cuándo no aplica:** en cuanto el usuario hace clic en cualquier encabezado de columna,
solo se usa `ordenarCotizaciones` con la columna elegida (sin relevancia). Volver al
estado inicial (fecha ↓ sin haber tocado encabezados) restaura el ranking con búsqueda
activa.

---

## Ordenamiento por columna

Clic en encabezado de columna ordenable:

| Columna | Criterio | Default primer clic |
|---|---|---|
| Fecha | `fecha` ISO; `null` al final | `desc` |
| Solicitante | alfabético `localeCompare("es")` | `asc` |
| Proveedor | alfabético | `asc` |
| Descripción | alfabético | `asc` |
| No. parte | alfabético | `asc` |
| Cantidad | numérico; `null` al final | `desc` |
| P. Unit. | numérico por moneda; ver abajo | `desc` |
| Total | numérico por moneda; ver abajo | `desc` |
| Estatus | orden fijo: cotizado → revisar → cancelado | `asc` |

- Primer clic en columna nueva: dirección default de la tabla anterior.
- Segundo clic en la misma columna: invierte dirección.
- Icono ▲/▼ visible solo en la columna activa.
- **Estado inicial al cargar:** columna `fecha`, dirección `desc`.

### Precios multi-moneda

Al ordenar por `precioUnitario` o `total`, **no se mezclan USD y MXN**:

1. Agrupar por `moneda` (USD antes que MXN).
2. Dentro de cada moneda, ordenar por valor numérico (`null` al final).
3. La dirección `asc`/`desc` aplica dentro de cada grupo de moneda.

---

## Paginación

- Tamaño fijo: **50** filas por página.
- Controles debajo de la tabla: `« Anterior` | `Página X de Y` | `Siguiente »`.
- Botones deshabilitados en primera/última página.
- Texto: `Mostrando 1–50 de 127 resultados` (basado en filas filtradas, no el total de la
  colección).
- Al cambiar búsqueda, ubicación o estatus → reset a página 1.
- Al cambiar orden de columna → **mantener** página actual (si la página queda fuera de rango,
  ajustar a la última página válida).

---

## UI (`CotizacionesList.tsx`)

### Estado nuevo

| Variable | Tipo | Inicial |
|---|---|---|
| `columnaOrden` | `ColumnaOrdenCotizacion` | `"fecha"` |
| `direccionOrden` | `DireccionOrden` | `"desc"` |
| `pagina` | `number` | `1` |
| `ordenPersonalizado` | `boolean` | `false` — `true` tras el primer clic en encabezado |

### Pipeline `useMemo`

```
cotizaciones
  → filtrarCotizaciones(filtros)
  → ordenarCotizaciones(columna, direccion, {
      busqueda: filtros.busqueda,
      usarRelevancia: !ordenPersonalizado && hayTokens(filtros.busqueda),
    })
  → paginarCotizaciones(pagina, 50)
```

### Encabezados

Columnas `Ubic.`, `Link` y el checkbox de selección **no** son ordenables.

### Selección múltiple

- «Seleccionar todo» aplica solo a las filas de la **página actual**.
- Al cambiar de página, se limpia `selectedIds` (evita borrado accidental de filas no visibles).
- El botón de eliminar en lote conserva el comportamiento actual.

### Sin cambios visuales

Mismas columnas, badges de estatus/ubicación, modal de edición al hacer clic en fila, bulk
delete, empty states de carga/error/sin datos.

---

## Manejo de errores

- Carga, error y retry: sin cambios (ya implementados).
- Tabla vacía por filtros: mensaje existente «Ninguna cotización coincide con la búsqueda».
- Paginación con 0 resultados: ocultar controles de página; mostrar solo el mensaje vacío.

---

## Pruebas (`tests/cotizaciones-tabla.test.ts`)

| Caso | Qué verifica |
|---|---|
| Token único | Encuentra por descripción, no. de parte o proveedor |
| Multi-token | `seal e110` exige ambas palabras en campos combinados |
| Sin resultados | Array vacío con búsqueda imposible |
| Ranking | No. de parte exacto sube sobre coincidencia parcial en descripción |
| Orden fecha | Desc y asc; null al final |
| Orden precio | USD y MXN no se mezclan; null al final |
| Orden estatus | Orden fijo cotizado → revisar → cancelado |
| Paginación | Página 1, última, página fuera de rango → última válida |
| Filtros combinados | Ubicación + estatus + búsqueda en cadena |

---

## Criterios de aceptación

1. Búsqueda multi-palabra filtra en tiempo real sin lag perceptible con ~500 registros.
2. Buscar por no. de parte o por descripción encuentra resultados relevantes por igual.
3. Clic en encabezado ordena la columna; segundo clic invierte; icono ▲/▼ en columna activa.
4. Orden por precio no mezcla USD con MXN.
5. Tabla muestra 50 filas por página con controles Anterior/Siguiente.
6. Al cargar, orden por fecha descendente (más reciente primero).
7. Cambiar filtros resetea a página 1; cambiar página limpia selección múltiple.
8. `npm test` pasa con los nuevos tests de `cotizaciones-tabla`.
9. `npm run lint` y `npm run build` sin errores.

---

## Verificación manual

1. Buscar `motor` → resultados con esa palabra en cualquier campo.
2. Buscar `e110576 seal` → solo filas que contengan ambas palabras.
3. Ordenar por Total desc → comparar precios USD agrupados, luego MXN.
4. Navegar páginas con 443 registros → ~9 páginas.
5. Seleccionar filas, cambiar página → selección limpia.
6. Editar una cotización desde la tabla → modal funciona igual que antes.
