# Proveedores: rango histórico Odoo + habituales MX

Fecha: 2026-08-14

## Problema

`/proveedores` ya tiene un comparador sobre el espejo Odoo (`compras_odoo_items`) y un
directorio USA/MX. El trabajo real de compras —“me cotizaron X, ¿está caro?”— no se
resuelve: la tabla marca “Mejor precio” solo entre filas filtradas, no muestra
min / promedio / máx del histórico, y el directorio México pagina por nombre en vez
de poner adelante a quienes más se compra en Odoo.

El sync cada 2 h ya escribe lo necesario (`precioUnitario`, `odooRefInterna`,
`ordenesOdoo`, `ultimaCompraOdoo`). No falta ETL; falta usarlo en la UI.

## Objetivo

1. Al buscar en el comparador de siempre, ver si un precio está caro contra el
   **rango histórico de todos los proveedores** (min / promedio / máx) para el
   mismo ítem — metales, plásticos, herramientas, oficina y el resto de Odoo.
2. En México, el directorio abre con **habituales primero** (más POs/facturas en
   Odoo) y un **Ver todos**. USA no cambia.

## Enfoque elegido

**Misma tabla + banda de rango + directorio MX habitual.** Sin pantalla nueva,
sin escritura a Odoo, sin reactivar Inteligencia 360.

## Fuera de alcance

- Inteligencia 360 / scorecards / matriz primario-backup (sigue apagada; no borrar)
- Checador de cotización pegada o carga por lote
- Lead time real (`fechaLimite`, recepciones)
- Costo estándar Odoo en UI
- Cuentas por pagar (viven en `/finanzas`)
- Cambios al ETL / Cloud Functions (los campos ya existen)

## Arquitectura

```text
compras_odoo_items (Firestore, sync 2 h)
  └─► claveHibridaItem(item)
        └─► rangoPreciosPorClave(historico, clave, moneda)
              └─► ComparadorPreciosInsumos
                    banda min/avg/máx  +  pista barato/medio/caro

proveedores.ordenesOdoo (upsert Odoo)
  └─► filtrarOrdenarDirectorio(..., orden: "habitual")
        └─► Directorio MX: top ~18 + Ver todos
```

Cálculo 100 % cliente sobre el espejo ya cargado. El rango **no** se achica con
los filtros de la tabla.

## Agrupado híbrido

Fuente de verdad en `lib/compras-odoo/` (no en el componente). Una clave por ítem,
en este orden:

1. **SKU** (`odooRefInterna` no vacío, normalizado).
2. Si no hay SKU: **familia + tipo + medida**
   (`categoriaId` + `tipoInsumo`/`tipoMetal` + `medida`). Los tres tienen que
   existir; si falta tipo o medida, no se usa este nivel.
3. Si no: **descripción normalizada**.

`llaveItem` actual incluye `odooPartnerId` y no sirve para comparar entre
proveedores. No se reutiliza para el rango.

### Rango

- Por **clave híbrida + moneda**. Nunca mezclar MXN y USD.
- Universo: todos los ítems del espejo con `precioUnitario > 0` (RFQ con precio
  sí; línea en $0 no). `esRfq` no filtra.
- Filtros de UI (proveedor, tipo de doc, “sólo comparables”) **no** entran al
  cálculo. Si filtras un proveedor, la banda sigue siendo de todos.
- `n = 0` → no hay banda, no se inventan números.

### Semáforo por fila

Comparar el unitario del ítem **en su moneda original** contra el rango de su
clave+moneda:

- **barato** — cerca del mínimo (tolerancia 0.05, igual que el trophy actual)
- **en medio** — por encima del mínimo y hasta el promedio (inclusive)
- **caro** — por encima del promedio

Trophy “Mejor precio” se queda, calculado entre alternativas **visibles** (como
hoy, en MXN). Es independiente del semáforo histórico.

Si el grupo no arma rango (`n = 0` o clave degenerada sin pares), la fila se
muestra suelta, sin pista.

## Comparador

Sigue `ComparadorPreciosInsumos` dentro de `PanelComprasOdoo`.

- **Banda fija** arriba de la tabla cuando hay búsqueda o filtro de familia y
  existe al menos un rango: min · promedio · máx, moneda, `n` compras, `n`
  proveedores. Si la búsqueda cae en varios grupos, la banda es del par
  clave+moneda con **más compras** históricas.
- Cada fila del grupo: pista barato / en medio / caro vs **ese** rango.
- Ficha de detalle: la misma banda de ese ítem + otras compras del grupo
  (proveedor, fecha, documento), tomadas del histórico completo de esa
  clave+moneda, no de las filas filtradas. Tope de 8 líneas, más recientes
  primero.
- Presupuesto / Excel, clasificación IA y toggle “sólo comparables” no cambian.
  El rango no depende del toggle.

## Directorio México

`ordenesOdoo` / `ultimaCompraOdoo` ya los escribe el upsert de partners. El
directorio no los usa.

- Vista default de **México**: orden `habitual` = `ordenesOdoo` descendente.
  Sin métrica o con 0 compras → al final, alfabético.
- Primera pantalla: ~18 habituales (mismo tamaño de página de hoy).
- Botón **Ver todos (N)**: el resto, mismo orden habitual. No es otro panel.
- Búsqueda, filtro de categoría u otro sort (nombre, calificación, lead time):
  se respeta; se muestra el resultado completo filtrado (sin recorte de 18).
- **USA**: sin cambios (nombre A→Z + Cargar más). El select no ofrece “Habituales”.
- Chip en `TarjetaProveedor` (y en la celda de nombre de la vista tabla) cuando
  `ordenesOdoo >= 1`: `N compras Odoo`.
- Sin KPIs nuevos en el header. Sin saldos AP en la ficha.

México se carga el mercado completo y se ordena en cliente (catálogo chico).
No hay índice Firestore nuevo ni cambio a Functions.

## Errores

- Sync Odoo caído: banner actual de `PanelComprasOdoo`; el comparador usa el
  último espejo. Sin rango → no hay banda.
- MX sin `ordenesOdoo` (sync viejo o alta manual): el directorio no se rompe;
  esos proveedores van al final.
- Fallo de red al cargar directorio: mensaje + reintento, la UI no se cae
  (patrón actual).

## Tests

Vitest, lógica pura (sin Firebase):

- Clave híbrida: SKU gana; sin SKU usa familia+tipo+medida; si falta tipo o
  medida, cae a descripción; SKU vacío se trata como ausente.
- Rango: no mezcla monedas; ignora `$0`; RFQ con precio cuenta; un subconjunto
  filtrado por proveedor no cambia min/avg/máx del histórico.
- Semáforo: cerca del min → barato; entre min y avg → en medio; arriba del avg
  → caro.
- Directorio: `habitual` pone más `ordenesOdoo` primero; `undefined` y `0` al
  final alfabético; `requiereCatalogoCompleto` es true para `habitual`.

## Archivos

- `lib/compras-odoo/clave-hibrida.ts` (nuevo) + export en `lib/compras-odoo/index.ts`
- `app/proveedores/components/ComparadorPreciosInsumos.tsx`
- `lib/proveedores/directorio.ts`, `lib/hooks/useDirectorioProveedores.ts`
- `app/proveedores/components/DirectorioProveedores.tsx`, `TarjetaProveedor.tsx`
- `app/proveedores/page.tsx` (pasar `mercado` al directorio si hace falta)
- `tests/compras-odoo-clave-hibrida.test.ts`, `tests/proveedores-directorio.test.ts`
