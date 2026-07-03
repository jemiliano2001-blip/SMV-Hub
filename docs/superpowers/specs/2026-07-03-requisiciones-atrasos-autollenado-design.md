# Requisiciones: semáforo de atrasos + autollenado desde link

**Fecha:** 2026-07-03
**Módulo:** `/requisiciones`
**Estado:** aprobado por el usuario (Enfoque 1 — todo en cliente, campo `link` nuevo)

## Contexto

El módulo de requisiciones reemplaza la hoja de Excel más grande del taller (~1,800 filas
entre Compras y Compras Auto). Los dos dolores a resolver, confirmados con el usuario:

1. **Seguimiento y atrasos** — ver de un vistazo qué sigue sin comprar y qué ya se atrasó
   según su prioridad.
2. **Captura más rápida** — pegar un link de producto y que descripción y tienda se llenen
   solas, reutilizando el `POST /api/scrape` existente.

## Sección 1 — Semáforo de atrasos

### Regla de negocio (elegida por el usuario)

Una requisición está **atrasada** si sigue en `no_comprado` o `en_proceso` y ya pasaron los
días de su prioridad desde `fechaPedido`. El reloj se detiene al llegar a `comprado`.

Límites por prioridad:

| Prioridad | Fecha límite |
|---|---|
| `1-2 dias` | `fechaPedido` + 2 días |
| `3-5 dias` | `fechaPedido` + 5 días |
| `7-14 dias` | `fechaPedido` + 14 días |
| `cuando se pueda` | nunca vence |
| sin prioridad | nunca vence |

### Lógica pura

Módulo nuevo `lib/requisicion-atraso.ts`:

```ts
type EstadoAtraso = { tipo: 'a_tiempo' | 'por_vencer' | 'atrasada'; dias: number } | null

estadoAtraso(
  r: Pick<Requisicion, 'estado' | 'prioridad' | 'fechaPedido'>,
  hoy: string, // YYYY-MM-DD
): EstadoAtraso
```

- Devuelve `null` si `estado ∈ {comprado, recibido}`, si `prioridad` es `null` o
  `'cuando se pueda'`, o si `fechaPedido` no parsea.
- `a_tiempo` con `dias` restantes si `hoy < fechaLimite`.
- `por_vencer` (`dias = 0`) si `hoy === fechaLimite`.
- `atrasada` con `dias` de atraso si `hoy > fechaLimite`.
- Aritmética de fechas sobre strings `YYYY-MM-DD` parseados como UTC (consistente con la
  regla del repo: `fechaFactura`/fechas de negocio como string, formateo local solo en cliente).

### UI

- Columna nueva **"Límite"** en la tabla de `RequisicionesList`, solo en el tab
  **Compras generales** (Automatización no tiene prioridad; queda igual).
- Punto de color + texto corto: 🟢 "3 días", 🟡 "vence hoy", 🔴 "+4 días".
- Nada se persiste: se calcula al renderizar con la fecha local del cliente.

## Sección 2 — Autollenado desde link

### Datos

- Campo nuevo en `RequisicionSchema`: `link: z.string().nullable().default(null)`.
- Registros existentes no se migran; `link` ausente se lee como `null`.
- El payload de creación (`NuevaRequisicionPayload`) y la edición lo incluyen.

### Formulario (captura)

- Si el valor de descripción empieza con `http`, aparece un botón **"Autollenar"** junto al
  input (con spinner mientras corre).
- Al hacer clic: `POST /api/scrape` con el ID token de Firebase — mismo patrón que
  `OrdenFormModal.handleScrape`.
- Con respuesta exitosa: `title` → descripción, `provider` → tienda (solo si estaba vacía),
  la URL original → `link`.
- Si falla (host fuera del whitelist, red, parseo): la URL se queda en descripción tal cual,
  se muestra un mensaje de error inline y no se pierde ningún dato capturado.

### Tabla y edición

- Si la fila tiene `link`, la descripción se renderiza como `<a>` hacia él.
- Si no tiene `link` pero la descripción es una URL, se mantiene el render actual
  (compatibilidad con registros viejos).
- `RequisicionFormModal` agrega un input opcional **"Link"** editable.

## Manejo de errores

- El scrape nunca bloquea la captura: cualquier fallo deja el formulario como estaba.
- `estadoAtraso` devuelve `null` ante datos inválidos en lugar de lanzar — una fila con
  fecha corrupta simplemente no muestra semáforo.

## Pruebas

- `tests/requisicion-atraso.test.ts` (Vitest, espejo 1:1 de `lib/`): verde, ámbar (vence
  hoy), rojo con días de atraso, `cuando se pueda` → null, sin prioridad → null,
  `comprado`/`recibido` → null, fecha inválida → null.
- El autollenado es cableado de UI sobre un API ya probado (`tests/scrape.test.ts` cubre el
  parseo); no se agregan tests de fetch.

## Fuera de alcance (deliberado)

- El `price` del scrape se ignora — la requisición no tiene campo de precio.
- Semáforo en el tab Automatización (derivable de `fechaEntregaEst` en una iteración futura).
- Persistir `fechaLimite` en Firestore, notificaciones, ordenamiento en servidor.
