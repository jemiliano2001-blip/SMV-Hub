# Diseño: Búsqueda y filtrado en Órdenes de compra

**Fecha:** 2026-06-26  
**Módulo:** `/ordenes`  
**Archivos afectados:** `app/ordenes/OrdenesList.tsx`, `lib/hooks/useOrdenes.ts` (sin cambios)

---

## Problema

La página `/ordenes` muestra todas las órdenes en una tabla sin ningún mecanismo de búsqueda
ni filtrado. El usuario tiene que hacer scroll manual para localizar una compra, lo cual es
ineficiente cuando la lista crece.

## Objetivo

Agregar búsqueda de texto libre y filtros de estado directamente sobre la tabla existente,
sin peticiones adicionales a Firestore, con respuesta instantánea.

---

## Decisión de arquitectura

**Filtrado 100% client-side con `useMemo`.**

Las órdenes ya están cargadas en memoria por `useOrdenes`. Aplicar un `useMemo` sobre ese
array es instantáneo para el volumen de SMV y no requiere índices nuevos en Firestore, ni
cambios en `lib/ordenes.ts`, ni dependencias nuevas.

Se descartó:
- **Filtros por URL** — añade complejidad (SSR/hydration con `useSearchParams`) sin beneficio
  real para el caso de uso actual.
- **Búsqueda server-side en Firestore** — Firestore no soporta full-text search nativo;
  requeriría Algolia/Typesense, lo cual es sobredimensionado para este volumen.

---

## Estado de búsqueda

Dos `useState` nuevos dentro de `OrdenesList`:

| Variable | Tipo | Valor inicial |
|---|---|---|
| `query` | `string` | `""` |
| `estadoFiltro` | `EstadoOrden \| "todos"` | `"todos"` |

---

## Lógica de filtrado (`useMemo`)

```
ordenesFiltradas = useMemo(() => {
  let resultado = ordenes

  // 1. Filtro de estado
  if (estadoFiltro !== "todos") {
    resultado = resultado.filter(o => o.estado === estadoFiltro)
  }

  // 2. Filtro de texto (normalizado: minúsculas, sin acentos)
  if (query.trim()) {
    const q = normalizar(query)
    resultado = resultado.filter(o =>
      [o.proveedor, o.requisitor, o.empresa, o.ordenTrabajo,
       o.numeroFactura, o.fechaFactura]
        .some(campo => normalizar(campo ?? "").includes(q))
    )
  }

  return resultado
}, [ordenes, query, estadoFiltro])
```

La función `normalizar(s)` convierte a minúsculas y elimina diacríticos con
`String.prototype.normalize("NFD")` + regex para remover combining marks — permite buscar
"mcmaster" y encontrar "McMaster-Carr", o "jose" y encontrar "José".

---

## UI

### Barra de controles (sobre la tabla)

```
┌─────────────────────────────────────────────────────┬─────────────────────────────────────┐
│ 🔍 Buscar por proveedor, requisitor, fecha...    [×] │ [Todos] [⏰Pendiente] [✓Aprobada] [✗Rechazada] │
└─────────────────────────────────────────────────────┴─────────────────────────────────────┘
```

- **Input de texto** (izquierda): ícono `Search` de lucide, placeholder descriptivo, botón
  `×` visible solo cuando `query !== ""` para limpiar con un clic.
- **Pills de estado** (derecha): cuatro botones — "Todos", "Pendiente", "Aprobada",
  "Rechazada" — con el mismo estilo de badge que la columna Estado. Solo uno activo a la vez.
  Al hacer clic en el pill ya activo no ocurre nada (permanece activo).

### Contador de resultados

Cuando hay algún filtro activo (`query !== ""` o `estadoFiltro !== "todos"`), el área entre
la barra de controles y la tabla muestra:

```
Mostrando 3 de 24 órdenes
```

Si no hay filtros activos, el contador no se muestra (no añade ruido innecesario).

### Estado vacío por filtro

Si `ordenesFiltradas.length === 0` pero `ordenes.length > 0` (hay órdenes pero ninguna
coincide), se muestra un estado vacío diferente al de "no hay órdenes":

```
Sin resultados para "pablo msc"
[ Limpiar filtros ]
```

El botón "Limpiar filtros" resetea `query = ""` y `estadoFiltro = "todos"`.

---

## Comportamiento al cambiar de datos

- Cuando se agrega una nueva orden (desde `OrdenFormModal`), el array `ordenes` cambia y el
  `useMemo` recalcula automáticamente respetando los filtros activos.
- Cuando se elimina una orden, idem.
- Los filtros **no se resetean** al agregar/eliminar órdenes; el usuario conserva su contexto
  de búsqueda.

---

## Pruebas

No se requieren pruebas de Vitest para esta feature (lógica de UI pura sin lógica de negocio
financiero). La función `normalizar` sí se puede probar unitariamente si en el futuro se
extrae a `lib/`.

---

## Cambios en archivos

| Archivo | Tipo de cambio |
|---|---|
| `app/ordenes/OrdenesList.tsx` | Modificación: agregar estados, `useMemo`, barra de búsqueda, contador, estado vacío filtrado |
| `lib/hooks/useOrdenes.ts` | Sin cambios |
| `lib/ordenes.ts` | Sin cambios |
| `lib/schemas.ts` | Sin cambios |

---

## Criterios de aceptación

1. Escribir en el input filtra la tabla en tiempo real (sin delay perceptible).
2. La búsqueda es case-insensitive y accent-insensitive.
3. Los pills de estado filtran correctamente y solo uno puede estar activo a la vez.
4. El contador aparece solo cuando hay filtros activos.
5. El estado vacío muestra el término buscado y el botón "Limpiar filtros" funciona.
6. Agregar o eliminar una orden mientras hay un filtro activo no rompe la tabla.
7. El botón `×` del input limpia solo el texto (el pill de estado permanece).
