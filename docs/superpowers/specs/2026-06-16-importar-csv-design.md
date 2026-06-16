# Spec: Importación masiva desde CSV (Google Sheets)

**Fecha:** 2026-06-16  
**Estado:** Aprobado  
**Scope:** Phase 1 — importación histórica de ~50 órdenes exportadas de Google Sheets como CSV

---

## Contexto

Las órdenes históricas de compras americanas viven en Google Sheets. Existe una imagen de factura para cada una pero recuperarlas es trabajo extra; la importación sin imagen es aceptable. El objetivo es cargar esas ~50 órdenes a Firestore en un solo flujo sin entrar una por una en el formulario de nueva compra.

---

## 1. Cambios al schema (`lib/schemas.ts`)

### Campos nuevos en `OrdenCompraSchema`

```ts
linkProveedor: z.string().nullable()   // link al proveedor/producto
fechaEntrega:  z.string().nullable()   // fecha de entrega o número de guía
```

### `imagenUrl` e `imagenPath` se vuelven opcionales

Actualmente son requeridos (`z.string().url()` y `z.string()`). Pasan a:

```ts
imagenUrl:  z.string().url().optional()
imagenPath: z.string().optional()
```

Las órdenes importadas desde CSV no tienen imagen. Las órdenes creadas con el formulario de nueva compra siguen requiriendo imagen (validación en el componente, no en el schema).

### Mapeo columnas CSV → campos Firestore

| Columna en Google Sheets | Campo en Firestore |
|---|---|
| Estado del pedido | `estado` |
| Fecha del pedido | `fechaFactura` |
| Proveedor | `proveedor` |
| Cantidad | `items[0].cantidad` |
| Descripción | `items[0].descripcion` |
| Link | `linkProveedor` |
| Fecha entrega / Guía | `fechaEntrega` |
| Requisitor | `requisitor` |
| Orden de trabajo | `ordenTrabajo` |
| Empresa | `empresa` |

Campos no presentes en el Sheets (`subtotal`, `impuestos`, `total`, `numeroFactura`) quedan en `null`. `moneda` queda en `"USD"` por default.

---

## 2. Flujo de la página `/importar`

La página tiene tres estados en secuencia dentro de un solo Client Component:

### Estado 1 — Upload

Drop zone con `<input type="file" accept=".csv">` y soporte drag & drop. Al seleccionar el archivo se parsea inmediatamente en el browser (sin subida a servidor).

### Estado 2 — Preview

Tabla con todas las filas parseadas y sus campos mapeados. Comportamiento visual:
- **Rojo** — fila con error bloqueante (ver sección 3). No se puede importar.
- **Amarillo** — fila con advertencia no bloqueante. Se importa con defaults.
- **Sin color** — fila válida.

El usuario puede desmarcar filas individuales que no quiere importar. Contador visible: `"48 de 50 filas listas para importar"`.

### Estado 3 — Importando / Resultado

Progreso visible mientras se escriben los docs a Firestore en lotes de 10. Al terminar: `"✓ 48 órdenes importadas"` con botón para ir a `/ordenes`.

---

## 3. Parseo y validación (`lib/importar.ts`)

### Detección de columnas

La primera fila del CSV se usa como header. El mapeo es **case-insensitive** y hace trim de espacios. Si una columna esperada no se encuentra, se muestra un error claro indicando cuál falta antes de mostrar el preview.

Aliases reconocidos:
- `"estado"`, `"estado del pedido"` → `estado`
- `"fecha"`, `"fecha del pedido"` → `fechaFactura`
- `"proveedor"` → `proveedor`
- `"cantidad"` → `items[0].cantidad`
- `"descripción"`, `"descripcion"` → `items[0].descripcion`
- `"link"` → `linkProveedor`
- `"fecha entrega"`, `"guía"`, `"guia"`, `"fecha de entrega"` → `fechaEntrega`
- `"requisitor"` → `requisitor`
- `"orden de trabajo"` → `ordenTrabajo`
- `"empresa"` → `empresa`

### Normalización del campo `estado`

| Valor en Sheets | Valor guardado |
|---|---|
| pendiente, pending | `"pendiente"` |
| aprobada, aprobado, approved | `"aprobada"` |
| rechazada, rechazado, rejected | `"rechazada"` |
| cualquier otro valor | `"pendiente"` + advertencia amarilla |

### Errores bloqueantes (fila en rojo)

- `proveedor` vacío o ausente
- `requisitor` vacío o ausente
- `ordenTrabajo` vacío o ausente
- `empresa` vacío o ausente

### Advertencias no bloqueantes (fila en amarillo)

- Estado no reconocido → se importa como `"pendiente"`
- `cantidad` no numérica → se importa como `null`
- Fecha con formato no estándar → se importa como string tal cual

---

## 4. Batch write a Firestore

- Las filas válidas (no bloqueantes, no desmarcadas) se escriben con `crearOrden()` de `lib/ordenes.ts`.
- Se procesan en lotes de 10 con `Promise.all` por lote para evitar saturar Firestore.
- `imagenUrl` e `imagenPath` se omiten (quedan `undefined`).
- `creadoEn` y `actualizadoEn` se asignan al momento de la importación.

---

## 5. Estructura de archivos

```
app/
  importar/
    page.tsx          ← Server Component (layout + título)
    ImportarCSV.tsx   ← Client Component (lógica de estados, UI)
lib/
  importar.ts         ← parseo CSV, mapeo, validación, batch-write
tests/
  importar.test.ts    ← tests de parseo, validación y batch-write
```

---

## 6. Tests (`tests/importar.test.ts`)

### Parseo de CSV
- CSV con headers en orden diferente mapea correctamente
- Headers con espacios extra y mayúsculas distintas son reconocidos
- Fila con todos los campos llenos produce objeto válido
- Fila con `cantidad` no numérica produce `null` sin error bloqueante

### Validación de filas
- Fila sin `proveedor` se marca como error bloqueante
- Fila sin `requisitor` se marca como error bloqueante
- Estado `"Entregado"` → `"pendiente"` + advertencia
- Estado `"Aprobado"` → `"aprobada"` sin advertencia

### Batch write (Firestore mockeado)
- 50 filas válidas se dividen en 5 llamadas de 10
- Filas con error bloqueante se omiten del batch
- Filas desmarcadas por el usuario se omiten del batch

---

## Fuera de scope (Phase 1)

- Conexión directa a Google Sheets API (OAuth)
- Importación con imagen adjunta
- Edición de campos en la tabla de preview
- Detección de duplicados
