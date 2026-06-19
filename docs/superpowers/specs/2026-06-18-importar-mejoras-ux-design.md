# Spec: Mejoras UX — Importación Masiva

**Fecha:** 2026-06-18
**Estado:** aprobado por usuario
**Scope:** Enfoque A (pulido UX diario) + deduplicación básica

---

## Contexto

La pantalla `/importar` se usa 2-3 veces al día para registrar compras industriales. Tiene dos flujos: CSV (desde Google Sheets) y Capturas (fotos/screenshots de facturas procesadas por IA). El brainstorm identificó 6 mejoras de alto impacto y bajo esfuerzo para reducir la fricción diaria sin tocar la lógica de validación ni importación existente.

---

## Cambios por archivo

### `lib/importar.ts` — `ResultadoCSV` y `procesarCSV`

`ResultadoCSV` se amplía para exponer las columnas detectadas:

```ts
export interface ResultadoCSV {
  filas: FilaParseada[]
  error: string | null
  columnasDetectadas: string[]  // nombres de campo internos detectados (ej. ["proveedor","requisitor",...])
}
```

`procesarCSV` ya llama `detectarColumnas`; solo se agrega `columnasDetectadas: Object.keys(colIdx)` al objeto de retorno.

---

### `app/importar/ImportarCSV.tsx`

**A. Botón "Descargar plantilla"**

- Posición: encima del drop zone, alineado a la derecha del heading "Cargar archivo CSV".
- Comportamiento: genera un `Blob` con los headers canónicos del importer + 2 filas de ejemplo, lo descarga como `plantilla-compras.csv`. Sin fetch ni servidor.
- Headers a incluir: `Proveedor, Requisitor, Orden de trabajo, Empresa, Estado del pedido, Fecha del pedido, Cantidad, Descripción, Link, Fecha entrega / Guía, Moneda, Total`.
- Ejemplo fila 1: `McMaster-Carr, emiliano, OT-2024-001, SMV Maquinados, aprobado, 2026-06-18, 2, Tornillo M6x20 acero inoxidable, https://www.mcmaster.com/..., 2026-06-25, USD, 12.50`

**B. Panel de columnas detectadas**

- `ImportarCSV` guarda `columnasDetectadas: string[]` en estado local, obtenido del `resultado.columnasDetectadas` de `procesarCSV`.
- Al renderizar `<PreviewImportacion>`, pasa `columnasDetectadas` como prop opcional.
- `PreviewImportacion` muestra el panel en su encabezado cuando la prop está presente.
- El panel lista las columnas del `ALIAS`: ✓ si está en `columnasDetectadas`, — si es opcional y ausente.
- Desaparece automáticamente al llamar `onReiniciar` (porque `ImportarCSV` resetea su estado).

---

### `app/importar/ImportarCapturas.tsx`

**C. Thumbnails en lista de archivos**

- Reemplaza `<ImageIcon>` por `<img>` de 40×40 px con `object-cover rounded`.
- `src` = `URL.createObjectURL(f)`, creado al agregar cada archivo.
- Limpieza: `URL.revokeObjectURL` al quitar un archivo (`quitarArchivo`) y al `reiniciar`.
- Fallback: si el objeto URL no puede crearse, mostrar `<ImageIcon>` como antes.

---

### `app/importar/PreviewImportacion.tsx`

Props nuevas:

```ts
{
  filasIniciales: FilaParseada[]
  onReiniciar: () => void
  columnasDetectadas?: string[]   // solo desde flujo CSV; undefined desde capturas
}
```

El tipo de `status` se amplía:

```ts
'preview' | 'confirmando-dedup' | 'importing' | 'completed'
```

**D. Columnas Total + Moneda en la tabla**

- Dos columnas nuevas después de "Estado": `Total` y `Moneda`.
- `Total`: valor numérico de `fila.datos.total`, formateado con `toLocaleString('es-MX')` (no `Intl.NumberFormat` completo — la moneda ya tiene su propia columna).
- `Moneda`: chip pequeño. `USD` → fondo `blue-100` texto `blue-700`. `MXN` → fondo `green-100` texto `green-700`. Valor nulo → dash.

**E. Persistir `ordenTrabajo`**

- Al montar el componente, `localStorage.getItem('smv:ordenTrabajo')` pre-rellena el campo `ordenTrabajo` del estado `aplicar`.
- Al hacer clic en "Aplicar a todas", si `aplicar.ordenTrabajo.trim()` no está vacío, se persiste con `localStorage.setItem('smv:ordenTrabajo', ...)`.
- Comportamiento idéntico al de `requisitor` ya existente.

**F. Banner de deduplicación**

- Se activa al hacer clic en "Importar órdenes".
- Flujo:
  1. Filtrar filas seleccionadas con `numeroFactura !== null`.
  2. Si no hay ninguna con `numeroFactura`, saltar dedup y continuar con el import normal.
  3. Si las hay, llamar `buscarPorFacturaYProveedor(pares)` en `lib/ordenes.ts`.
  4. Llamar `verificarDuplicados(filas, existentes)` en `lib/importar.ts` para obtener `{ indice, motivo }[]`.
  5. Si `duplicados.length === 0`, continuar con import normal.
  6. Si `duplicados.length > 0`, mostrar banner amarillo con conteo y lista de duplicados. Dos botones: "Importar de todas formas" (continúa) y "Cancelar". El import no inicia hasta que el usuario elija.
- Si `buscarPorFacturaYProveedor` lanza error (fallo de red), loguear y continuar con import sin verificación.
- Estado nuevo en `PreviewImportacion`: `'confirmando-dedup'` entre `'preview'` e `'importing'`.

---

### `lib/importar.ts`

**`verificarDuplicados`** (función pura exportada):

```ts
export function verificarDuplicados(
  filas: FilaParseada[],
  existentes: Array<{ numeroFactura: string | null; proveedor: string }>
): Array<{ indice: number; motivo: string }> 
```

- Compara por `numeroFactura.toLowerCase() + '|' + proveedor.toLowerCase()`.
- Solo evalúa filas con `fila.datos.numeroFactura !== null`.
- Testeable sin Firebase.

---

### `lib/ordenes.ts`

**`buscarPorFacturaYProveedor`** (query Firestore):

```ts
export async function buscarPorFacturaYProveedor(
  pares: Array<{ numeroFactura: string; proveedor: string }>
): Promise<Array<{ numeroFactura: string | null; proveedor: string }>>
```

- Una sola query `where('numeroFactura', 'in', [...])` sobre la colección `ordenes`.
- Límite: `in` soporta hasta 30 valores en Firestore; si `pares.length > 30`, dividir en chunks de 30 y ejecutar en paralelo.
- Devuelve solo los campos necesarios (`numeroFactura`, `proveedor`).

---

## Manejo de errores

| Caso | Comportamiento |
|------|---------------|
| `buscarPorFacturaYProveedor` falla | `console.error` + continuar import sin dedup |
| `URL.createObjectURL` falla | fallback a `<ImageIcon>` |
| CSV sin ninguna columna opcional | panel muestra solo las opcionales como `—` (no error) |
| Plantilla: usuario ya importó datos de ejemplo | sin prevención — las filas de ejemplo fallarán validación (proveedor/requisitor de ejemplo no son datos reales de SMV) |

---

## Pruebas

- `tests/importar.test.ts`: agregar casos para `verificarDuplicados` con fixtures:
  - Sin duplicados → devuelve `[]`
  - Un duplicado exacto → devuelve 1 entrada
  - Match case-insensitive → devuelve duplicado
  - Filas sin `numeroFactura` → ignoradas

---

## Lo que NO cambia

- Lógica de validación (`erroresRequeridos`, `refrescarFila`)
- Lógica de importación (`importarOrdenes`, `crearOrdenesLote`)
- Flujo del preview (selección, edición de celdas, "aplicar a todas" para empresa)
- API routes (`/api/extraer-lote`, `/api/extraer`)
