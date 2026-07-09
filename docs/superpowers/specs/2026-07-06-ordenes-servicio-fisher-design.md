# Diseño: Órdenes de servicio alineadas con hoja Fisher

**Fecha:** 2026-07-06  
**Módulo:** `/ordenes-servicio`  
**Estado:** aprobado (Fase 1 + entregas parciales numéricas; sin importación Excel)  
**Referencia:** pestaña **Fisher** de `Compras SMV (1).xlsx` (~30 filas activas)

---

## Problema

El módulo web replica la estructura básica de la hoja Fisher pero no cubre el flujo real
de seguimiento que el equipo usa en Excel:

1. **Campos faltantes** — no hay `fechaEntregaActualizada` ni `nota` (donde registran
   entregas parciales, visitas del proveedor, cambios de fecha, etc.).
2. **Estatus desalineados** — Excel usa **Entregada** y **Detenida** (rojo); la app cicla
   entre Pendiente → En proceso → Recibido → Cancelado con un solo clic, sin opción
   *Detenida* ni selector explícito.
3. **Listas desactualizadas** — requisitor e ingeniero son `<select>` con nombres viejos
   (`Lorena/Stock`, `Salvador`…); en Excel aparecen Cindy Chaires, Gabriel Martinez,
   Antonio Vazquez, Edgar Castro, etc., a veces combinados (`Cindy / Guadalupe`).
4. **Fechas flexibles** — Excel admite `??`, rangos (`8 al 15 abril`) y texto libre en
   fecha de entrega actualizada; la UI fuerza `<input type="date">`.
5. **Tabla incompleta** — faltan columnas visibles de nota y fecha actualizada; el estatus
   no va primero como en la hoja.
6. **Sin importación** — los ~30 registros actuales están solo en Excel; no hay camino
   para migrarlos (a diferencia de cotizaciones e importar compras).

---

## Columnas Excel vs app (mapeo)

| Excel (Fisher) | Campo actual | Acción propuesta |
|---|---|---|
| Estatus | `estatus` | Ampliar enum + selector |
| Fecha de OC | `fechaOC` | Mantener (date) |
| Orden de compra | `numOC` | Mantener |
| Requisitor | `requisitor` | Texto + datalist (operadores) |
| Ing. a cargo de proyecto | `ingAcargo` | Texto + datalist (diseño/taller) |
| Orden de trabajo | `ordenTrabajo` | Mantener |
| Descripción | `descripcion` | Mantener |
| Cantidad | `cantidad` | Mantener (texto libre) |
| Tiempo de entrega | `tiempoEntrega` | Mantener (texto: `6 dias h`, `??`) |
| Fecha de entrega | `fechaEntrega` | **Texto** (no solo date) |
| Fecha de entrega actualizada | — | **Nuevo** `fechaEntregaActualizada` |
| Nota | — | **Nuevo** `nota` |
| — | — | **Nuevo** `cantidadEntregada` / `cantidadPendiente` (numéricos; pendiente auto-calculada) |

---

## Entregas parciales (confirmado por usuario)

Además de la nota libre, campos numéricos:

| Campo | Tipo | Comportamiento |
|---|---|---|
| `cantidad` | texto | Total pedido (`"12"`, `"1 pza"`) |
| `cantidadEntregada` | number \| null | Piezas ya recibidas |
| `cantidadPendiente` | number \| null | Auto = total − entregada; editable manualmente |

En tabla se muestra `9/12 (↓3)` cuando hay entregas parciales.

---

## Estatus propuestos

Alinear etiquetas con Excel y conservar estados intermedios útiles:

| Valor interno | Etiqueta UI | Uso |
|---|---|---|
| `pendiente` | Pendiente | OC recién creada, sin arranque |
| `en_proceso` | En proceso | Proveedor trabajando |
| `detenida` | Detenida | En pausa (badge rojo, como Excel) |
| `entregada` | Entregada | Completada (reemplaza `recibido`) |
| `cancelado` | Cancelado | Cancelada |

**Migración de datos:** documentos con `estatus: "recibido"` se leen como `entregada`
en el converter o con fallback en UI (`recibido` → `entregada`).

**UX de estatus:** dropdown o menú al hacer clic en el badge (en lugar de ciclar
Pendiente→En proceso→… con un solo clic accidental).

---

## Cambios de schema (`lib/schemas.ts`)

```ts
export const EstatusOrdenServicioSchema = z.enum([
  "pendiente",
  "en_proceso",
  "detenida",
  "entregada",
  "cancelado",
])

// En OrdenServicioSchema, agregar:
fechaEntregaActualizada: z.string().nullable(), // texto o YYYY-MM-DD
nota: z.string().nullable(),
// fechaEntrega ya es string — documentar que admite texto libre
```

Sin cambio de reglas Firestore (misma colección `ordenes-servicio`; campos nuevos opcionales).

---

## Cambios de UI

### Formulario alta / edición

- Fila 1: Descripción *, Requisitor (texto+datalist), Ing. a cargo (texto+datalist)
- Fila 2: No. OC, Fecha OC, O.T., Cantidad
- Fila 3: Tiempo entrega, Fecha entrega (texto), **Fecha entrega actualizada** (texto)
- Fila 4: **Nota** (textarea, 2–3 líneas)
- Estatus editable en modal de edición (select); en alta default `pendiente`

### Tabla

Orden de columnas (como Excel):

`Estatus | Fecha OC | No. OC | Requisitor | Ing. | O.T. | Descripción | Cant. | T. entrega | F. entrega | F. act. | Nota | acciones`

- Nota: truncar a ~60 caracteres con `title` completo o fila expandible al clic.
- Resaltar filas `detenida` con borde/fondo sutil rojo.
- Filtros: agregar chip **Detenida** y renombrar **Recibido** → **Entregada**.

### Personas (requisitor / ingeniero)

- `useOperadores()` para sugerencias en datalist (nombres activos).
- Permitir texto libre y valores compuestos (`Cindy / Guadalupe`) como en Excel.
- Eliminar constantes `SOLICITANTES` / `INGENIEROS` hardcodeadas.

---

## Importación desde Excel/CSV (fase 2 — opcional)

Nuevo `lib/ordenes-servicio-importar.ts` + UI compacta en la página (patrón
`ImportarCotizaciones`):

- Aceptar `.xlsx` (pestaña Fisher) o CSV exportado con las 12 columnas.
- Mapear estatus: `Entregada` → `entregada`, `Detenida` → `detenida`.
- Convertir fechas serial Excel → `YYYY-MM-DD` cuando sea número; conservar texto si no.
- Preview con validación Zod antes de `writeBatch`.

---

## Archivos a tocar (fase 1 — core)

| Archivo | Cambio |
|---|---|
| `lib/schemas.ts` | Enum estatus + 2 campos nuevos |
| `lib/ordenes-servicio.ts` | Sin cambio de API (Partial ya cubre campos) |
| `app/ordenes-servicio/OrdenesServicioList.tsx` | Form, tabla, filtros, estatus |
| `app/ordenes-servicio/OrdenServicioFormModal.tsx` | Campos nuevos + estatus select |
| `tests/ordenes-servicio.test.ts` | Nuevo — schema + mapeo estatus legacy |

Fase 2 añade: `lib/ordenes-servicio-importar.ts`, componente import, tests de parseo.

---

## Fuera de alcance (por ahora)

- Entregas parciales estructuradas (`cantidadEntregada` / `cantidadPendiente`) — las notas
  en Excel bastan; se puede modelar después si el equipo lo pide.
- Sync bidireccional con Google Sheets.
- Proveedor como campo separado (Fisher es el proveedor implícito de toda la hoja).

---

## Criterios de aceptación (fase 1)

1. Crear una OT con nota y fecha de entrega actualizada; persisten en Firestore.
2. Marcar una OT como **Detenida** con badge rojo y filtro dedicado.
3. Requisitor e ingeniero aceptan nombres del catálogo de operadores o texto libre.
4. Fecha de entrega acepta `??` o `8 al 15 abril` sin romper validación.
5. Tabla muestra las 12 columnas equivalentes al Excel en orden lógico.
6. Registros legacy con `recibido` se muestran como **Entregada**.
7. `npm test`, `npm run lint`, `npm run build` pasan.
