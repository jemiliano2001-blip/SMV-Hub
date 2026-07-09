# Sugerencias inteligentes en nueva compra

Fecha: 2026-06-26

## Problema

En `/nueva-compra`, los campos por ítem **Empresa / destino**, **Cuenta cargo** y
**Requisitor** se capturan a mano cuando la IA no los encuentra en la factura. El equipo
repite los mismos valores una y otra vez (las herramientas casi siempre son para SMV y van a
Stock), lo que genera trabajo manual y errores.

## Objetivo

Auto-rellenar esos tres campos cuando queden vacíos tras la extracción de IA, usando el
historial de compras y una regla de dominio para herramientas. Lo que la IA extrae de la
foto o PDF siempre tiene prioridad; la sugerencia solo aplica si el campo quedó vacío.

## Reglas de prioridad (por campo, por ítem)

1. Si Gemini devolvió un valor no vacío para el campo, se respeta tal cual.
2. Si el campo quedó vacío, se calcula una sugerencia desde el historial y se auto-rellena.
3. Si el ítem parece una herramienta de taller y sigue vacío tras el historial:
   - `empresa` = `"SMV"`
   - `cuentaCargo` = `"Stock"`
   - `requisitor` = valor más frecuente entre ítems históricos con SMV + Stock (si existe).
4. El usuario siempre puede corregir; nunca se sobrescribe un campo que ya tiene texto.

## Algoritmo de sugerencia desde historial

Para cada campo vacío, en orden de preferencia:

| Prioridad | Criterio                                              | Valor sugerido                          |
| --------- | ---------------------------------------------------- | --------------------------------------- |
| 1         | Misma descripción normalizada + mismo proveedor      | Valor del registro más reciente         |
| 2         | Overlap de tokens en descripción + mismo proveedor   | Moda ponderada por recencia             |
| 3         | Mismo proveedor                                       | Moda del campo                          |
| 4         | Es herramienta (heurística)                           | SMV / Stock + requisitor más frecuente  |
| 5         | Global                                                | Moda global del campo (ignora vacíos)   |

## Detección de herramientas (heurística)

Basada en palabras clave en la descripción (`reamer`, `drill`, `tap`, `end mill`, `insert`,
`broca`, `machuelo`, `fresa`, `herramienta`, etc.) y proveedores típicos de herramienta
(`McMaster`, `Grainger`, `MSC`). Se excluye cuando la descripción es claramente material
consumible (tornillo, cable, guante…). Es una heurística en memoria; no se persiste ninguna
categoría en Firestore.

## Disparadores en la UI

- Al terminar la extracción IA de una factura/PDF.
- Al cambiar `descripcion` o `proveedor` de un ítem (debounce ~400 ms), rellenando solo los
  campos que sigan vacíos.

Sin cambios visuales: se mantienen los mismos inputs (auto-relleno silencioso, editable).

## Alcance fuera de v1

- API/Server Action dedicada (el historial ya se consulta client-side, como en reportes).
- Datalist o dropdown de alternativas.
- Campo `categoria`/`esHerramienta` persistido en el schema de Firestore.
- Reutilización en `app/ordenes/OrdenFormModal.tsx`.

## Archivos

- `lib/sugerencias-compra.ts` — lógica pura (nuevo).
- `tests/sugerencias-compra.test.ts` — pruebas (nuevo).
- `lib/extraer-ia.ts` — regla herramienta → SMV/Stock en el prompt.
- `app/nueva-compra/NuevaCompraForm.tsx` — integración (cargar historial, post-extracción,
  debounce reactivo).
