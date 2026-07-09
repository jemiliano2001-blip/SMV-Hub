# Diseño: Captura rápida en Control de Baños

**Fecha:** 2026-07-06  
**Módulo:** `/banos` (pestaña Registro)  
**Estado:** aprobado por el usuario (Enfoque A — formulario mínimo con timestamps automáticos)  
**Archivos afectados:** `app/banos/RegistroBanoList.tsx`, `lib/format.ts` (helpers opcionales), `tests/banos-captura.test.ts` (nuevo, si se extraen helpers)

---

## Problema

El supervisor registra entradas y salidas de baño desde una PC fija (~25 operadores,
15–30 registros/día). El formulario actual exige rellenar fecha, hora de entrada y operador
manualmente; marcar "Llegó" requiere dos clics (confirmación). Eso ralentiza la captura sin
aportar valor en el flujo normal, porque la fecha y la hora siempre corresponden al momento
del registro.

## Objetivo

1. **Fecha y hora automáticas** — sin inputs editables en captura; siempre "ahora".
2. **Baño obligatorio por registro** — selector visible (cambia en cada registro).
3. **Operador por búsqueda/escritura** — conservar input con datalist (sin rejilla de botones).
4. **Llegada en un clic** — eliminar confirmación de dos pasos.
5. **Sin cambios de schema** — mismos campos en Firestore y mismas pestañas Cuenta diaria / Resumen.

---

## Decisiones del usuario (brainstorming)

| Tema | Decisión |
|---|---|
| Quién captura | Supervisor/admin en PC fija |
| Escala | ~25 operadores, 15–30 registros/día |
| Fecha | Automática (hoy); sin input |
| Hora entrada | Automática (momento del registro); sin input |
| Hora llegada | Automática (momento del clic en "Llegó") |
| Baño / área | Obligatorio; se elige en cada registro |
| Selección de operador | Input con búsqueda/escritura + datalist (no rejilla) |
| Correcciones | Eliminar registro en "Completados hoy"; sin edición inline en esta iteración |
| Enfoque descartado | Rejilla de operadores (B), toggle Salió/Llegó (C parcial) |

---

## Arquitectura

### Sin cambios

| Archivo | Motivo |
|---|---|
| `lib/schemas.ts` | `RegistroBanoSchema` y `BanoSchema` sin cambios |
| `lib/banos.ts` | CRUD Firestore sin cambios |
| `lib/hooks/useBanos.ts` | `registrarEntrada`, `registrarLlegada`, `borrarRegistro` se reutilizan |
| `app/banos/CuentaDiaria.tsx` | Fuera de alcance |
| `app/banos/ResumenMensual.tsx` | Fuera de alcance |
| `app/banos/page.tsx` | Solo contenedor de tabs; sin cambios |

### Cambios

**`app/banos/RegistroBanoList.tsx`** — rediseño de la UI de captura:

| Antes | Después |
|---|---|
| Input `type="date"` | Eliminado; `fecha` = hoy al registrar |
| Input `type="time"` + botón reloj | Eliminado; `horaEntrada` = ahora al registrar |
| Select de baño en fila de formulario | Pills / segmented control (4 opciones) |
| Input operador + datalist | Se conserva; autofocus tras cada registro |
| Botón "Registrar Entrada" | Se conserva; también activable con Enter |
| "Llegó" → confirmar ✓ | Un solo clic; `horaLlegada` = ahora |

**Helpers de fecha/hora** (en `lib/format.ts` o locales al componente):

```ts
/** YYYY-MM-DD en zona local del cliente (es-MX / America/Monterrey). */
export function fechaHoyLocal(): string

/** HH:mm en zona local del cliente. */
export function horaAhoraLocal(): string
```

Si se extraen a `lib/format.ts`, añadir tests en `tests/banos-captura.test.ts`.

---

## UX detallada

### Barra de captura (una fila)

```
[Baño #1 | Baño #2 | CNC | Automatizacion]   [Buscar operador... ▼]   [+ Registrar Entrada]
                                              Hoy, 6 jul 2026 — 14:52
```

1. **Pills de baño** — una opción activa a la vez; obligatoria antes de registrar.
2. **Indicador de fecha/hora** — solo lectura, debajo del campo operador; se actualiza visualmente
   al registrar (el valor persistido es el del momento exacto del submit).
3. **Operador** — `datalist` con operadores activos de `useOperadores`; placeholder
   *"Buscar o escribir..."*.
4. **Enter** en el campo operador dispara el mismo submit que el botón.

### Feedback

| Evento | Mensaje / comportamiento |
|---|---|
| Entrada registrada | Banner breve: *"{operador} registrado — {baño}, {hora}"* |
| Sin baño seleccionado | *"Selecciona un baño primero"* |
| Operador ya en el baño | Banner ámbar; botón deshabilitado (lógica existente) |
| Operador no en catálogo | *"Operador no encontrado en el catálogo"* |
| Error de red | Banner rojo con mensaje claro; UI intacta |

### Tablas (pestaña Registro)

**En el baño** — sin cambio de columnas; orden por `horaEntrada` descendente.

**Completados hoy** — solo registros con `fecha === hoy`; columnas y eliminar sin cambios.

**Buscador** — filtra ambas tablas por nombre de operador; no afecta stats del día.

**Quick stats** — promedio y persona con más tiempo (solo completados de hoy); sin cambios.

### Llegada

- Un clic en **Llegó** → `registrarLlegada(id, horaAhoraLocal(), horaEntrada)`.
- Flash visual breve en la fila antes de mover a "Completados hoy".
- Se elimina estado `confirmarLlegada` y los botones de confirmación/cancelación.

---

## Reglas de negocio

1. `fecha` en captura = día local actual (`YYYY-MM-DD`).
2. `horaEntrada` = hora local al momento del submit de entrada.
3. `horaLlegada` = hora local al momento del clic en "Llegó".
4. Máximo un registro abierto por operador por día (validación existente).
5. `bano` obligatorio en cada registro.
6. La vista de captura solo muestra y opera sobre registros de **hoy** (sin selector de fecha).
7. Cruce de medianoche: `calcularMinutos` en `useBanos.ts` ya suma 24 h si `llegada < entrada`.

---

## Casos límite

| Caso | Comportamiento |
|---|---|
| Página abierta al cambiar de día | Al registrar o recargar, `fecha` = día actual |
| Operador escrito con typo | Rechazar si no coincide con operador activo del catálogo |
| Doble clic rápido en Registrar | Deshabilitar botón mientras `agregando === true` (ya existe) |
| Firestore lento / offline | Banner de error; no romper layout |
| Eliminar registro completado | `confirm()` nativo se mantiene |

---

## Fuera de alcance

- Rejilla de botones por operador.
- Edición inline de fecha/hora en tablas.
- Modo toggle Salió/Llegó desde la misma rejilla.
- Cambios en Cuenta diaria, Resumen mensual o schema Firestore.
- Captura desde móvil o kiosco.

---

## Pruebas

| Tipo | Qué verificar |
|---|---|
| Unitario | `fechaHoyLocal()` y `horaAhoraLocal()` si van a `lib/format.ts` |
| Manual | Elegir baño → operador → Enter → aparece en "En el baño" |
| Manual | Un clic "Llegó" → pasa a "Completados" con minutos correctos |
| Manual | Operador duplicado abierto → banner y botón deshabilitado |
| CI | `npm run lint`, `npm test`, `npm run build` sin regresiones |

---

## Criterios de aceptación

- [ ] No hay inputs de fecha ni hora en el formulario de captura.
- [ ] Indicador de fecha/hora visible (solo lectura).
- [ ] Pills de baño con selección obligatoria.
- [ ] Input operador con datalist conservado.
- [ ] Enter registra entrada con timestamps automáticos.
- [ ] "Llegó" funciona con un solo clic.
- [ ] Cuenta diaria y Resumen siguen funcionando sin cambios.
- [ ] Lint, tests y build pasan.
