# Endmills China — Implementation Plan

> **Estado:** implementado, validado y desplegado el 2026-08-06. La semilla quedó
> importada de forma idempotente en `smv-brain-dev` y `smv-brain`. Las reglas se
> verificaron con un usuario temporal autenticado en desarrollo; luego se
> publicaron Hosting + Firestore Rules en producción y se asignó el módulo a los
> tres perfiles admin/compras existentes, sin desplegar Functions compartidas.

**Goal:** Convertir el conteo y las cotizaciones recurrentes de 47 endmills en
un flujo vivo de inventario, revisión humana, pedido e historial, siempre en USD.

**Architecture:** Ruta propia `/endmills` protegida por módulo `endmills`;
catálogo vivo en `endmills-medidas`; cada ciclo atómico en
`endmills-pedidos` + `endmills-pedido-partidas`; lógica pura en
`lib/endmills-calculos.ts`; CRUD y transacciones de confirmación/recepción en
`lib/endmills.ts`; listeners de catálogo/ciclos en
`lib/hooks/useEndmills.ts`. El seed histórico no inventa el stock anterior
faltante: el primer pedido manual calibra el objetivo del siguiente ciclo.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript estricto, Zod 4,
Firebase 12 / Firestore, shadcn/Base UI existente, Tailwind v4, Vitest,
Firestore Emulator y Playwright.

**Spec:** `docs/superpowers/specs/2026-08-06-endmills-china-design.md`

## Restricciones globales

- No tocar producción ni `firestore.rules` antes de la aprobación del plan.
- No usar `any`, `@ts-ignore` ni datos demo.
- No restaurar el módulo `reabastecimiento-rop`.
- `/almacen` permanece Entradas/Salidas.
- UI sin imports directos de Firestore.
- `null` = sin base; nunca convertirlo a sugerencia 0.
- Todos los montos y KPIs del módulo son USD.
- Ningún botón crea una requisición, orden general o escritura Odoo.
- El seed real no se incluye en el bundle del cliente ni se agrega a Git sin
  aprobación explícita.
- Implementar y probar contra `smv-brain-dev`; producción/deploy requieren una
  instrucción posterior del propietario.

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `lib/schemas.ts` | Schemas/tipos Endmills + módulo `endmills` |
| `lib/endmills-calculos.ts` | PAR, sugerido, semáforo y totales USD |
| `lib/endmills.ts` | Repositorios, listeners y batches atómicos |
| `lib/hooks/useEndmills.ts` | Estado vivo, reintento y acciones de dominio |
| `app/endmills/page.tsx` | Ruta protegida |
| `app/endmills/EndmillsView.tsx` | Shell, KPIs, tabs y errores |
| `app/endmills/InventarioEndmills.tsx` | Filtros, tabla/cards y detalle |
| `app/endmills/RevisionPedidoEndmills.tsx` | Borrador editable + confirmación humana |
| `app/endmills/HistorialPedidosEndmills.tsx` | Ciclos y comparación |
| `app/NavBar.tsx`, `app/page.tsx` | Descubrimiento de la nueva ruta |
| `components/BuscadorGlobalCommand.tsx` | Resultado de búsqueda global |
| `lib/roles.ts` | Ruta, plantillas y permiso nuevo |
| `firestore.rules` | Seguridad de tres colecciones |
| `scripts/importar-endmills.mjs` | Dry-run/import idempotente del seed real |
| `tests/endmills-calculos.test.ts` | Lógica pura |
| `tests/endmills-seed.test.ts` | Invariantes del JSON |
| `tests/lib-endmills.test.ts` | Acceso a datos/batch |
| `tests/roles-modulos.test.ts` | Rutas y plantillas |
| `tests/firestore-rules-emulator.test.ts` | Autorización y forma |

---

### Task 1: Contratos Zod y lógica pura

**Files:**
- Modify: `lib/schemas.ts`
- Create: `lib/endmills-calculos.ts`
- Create: `tests/endmills-calculos.test.ts`
- Create: `tests/endmills-seed.test.ts`

**Produces:**

- `CategoriaEndmillSchema`
- `EndmillMedidaSchema`
- `PartidaPedidoEndmillsSchema`
- `PartidaFueraCatalogoEndmillsSchema`
- `PedidoEndmillsSchema`
- `calcularObjetivoPar()`
- `calcularCantidadSugerida()`
- `clasificarStockEndmill()`
- `calcularTotalesPedidoEndmills()`

- [ ] Escribir primero tests fallidos para:
  - `objetivo = stockAntes + cantidad`;
  - `sugerido = max(0, objetivo - stock)`;
  - objetivo `null` devuelve sugerido `null`;
  - sobrestock devuelve 0;
  - estados sin_base/crítico/bajo/ok;
  - redondeo a centavos y suma de adicionales;
  - schema rechaza negativos, moneda distinta de USD y estados inválidos.
- [ ] Implementar schemas y helpers sin imports Firebase.
- [ ] Validar el seed con `EndmillsSeedSchema` y fijar los invariantes: 47
  medidas, IDs únicos, distribución 19/8/4/3/4/5/4, 32 partidas marzo, 2
  confirmaciones, 478 + 5 piezas y total $6,159.94.
- [ ] Ejecutar:

```powershell
npx.cmd vitest run tests/endmills-calculos.test.ts tests/endmills-seed.test.ts
```

**Criterio de salida:** lógica pura verde y ninguna sugerencia inicial fabricada.

---

### Task 2: Repositorios, operaciones atómicas y hook

**Files:**
- Create: `lib/endmills.ts`
- Create: `lib/hooks/useEndmills.ts`
- Create: `tests/lib-endmills.test.ts`

**Interfaces:**

- `listarMedidasEndmills()` / `suscribirMedidasEndmills()`
- `listarPedidosEndmills()` / `suscribirPedidosEndmills()`
- `listarPartidasPedidoEndmills(pedidoId)`
- `listarHistorialMedidaEndmills(medidaId)`
- `actualizarStockEndmill(id, stockActual)`
- `registrarPedidoEndmills(borrador, actor)`
- `marcarPedidoEndmillsRecibido(id, cantidadesRecibidas)`
- `cancelarPedidoEndmills(id, motivo)`

- [ ] Crear los tres repositorios con `crearRepositorio<T>()`.
- [ ] Ordenar medidas por `orden` y pedidos por `fecha desc`.
- [ ] Escribir tests mockeados antes de implementar las acciones.
- [ ] Implementar `registrarPedidoEndmills` con una transacción:
  - releer las medidas incluidas y abortar si cambió el stock revisado;
  - crear cabecera confirmada;
  - crear documentos de partida con snapshot de stock/precio/spec;
  - actualizar `objetivoPar` y `ultimoPedidoId` solo en partidas incluidas;
  - registrar auditoría después del commit como best-effort; un fallo de
    auditoría se reporta por separado y nunca provoca un segundo pedido al
    reintentar.
- [ ] Implementar recepción separada: sumar solo cantidades recibidas y avanzar
  estado; comprobar que registrar el pedido no aumenta stock.
- [ ] Implementar cancelación solo antes de recepción y restaurar en la misma
  transacción el objetivo anterior no cancelado de cada medida (o `null`).
- [ ] El hook conserva última data válida ante error y expone `fetchMedidas`,
  `fetchPedidos`, loading/error por fuente y acciones.
- [ ] Ejecutar:

```powershell
npx.cmd vitest run tests/lib-endmills.test.ts
```

**Criterio de salida:** no existen escrituras parciales entre pedido y objetivos.

---

### Task 3: Permisos y reglas Firestore

**Files:**
- Modify: `lib/schemas.ts`
- Modify: `lib/roles.ts`
- Modify: `scripts/backfill-modulos-usuarios.mjs`
- Modify: `tests/roles-modulos.test.ts`
- Modify: `tests/usuarios.test.ts`
- Modify: `tests/usuarios-admin.test.ts`
- Modify: `firestore.rules`
- Modify: `tests/firestore-rules-emulator.test.ts`

- [ ] Añadir `endmills` a `ModuloIdSchema`, `RUTA_POR_MODULO` y grupo Compras.
- [ ] Añadirlo por defecto solo a plantillas `admin` y `compras`.
- [ ] Actualizar fixtures/backfill sin otorgarlo automáticamente a matrices
  personalizadas existentes; reportarlas para revisión manual.
- [ ] Añadir validadores de reglas con:
  - usuario activo + `tieneModulo('endmills')`;
  - claves/top-level requeridas;
  - moneda USD;
  - montos/cantidades no negativos;
  - timestamps e inmutabilidad;
  - delete denegado.
- [ ] Escribir casos de emulador:
  - sin módulo no lee/escribe;
  - con módulo lee y crea payload válido;
  - rechaza MXN, negativos y timestamp regresivo;
  - no permite borrar;
  - pedido confirmado no se reescribe como si fuera el mismo ciclo.
- [ ] Ejecutar unitarios de roles.
- [ ] Ejecutar reglas con emulador/Java. Si el emulador local no está disponible,
  dejar el gate como no verificado y no afirmar seguridad completa.

```powershell
npx.cmd vitest run tests/roles-modulos.test.ts tests/usuarios.test.ts tests/usuarios-admin.test.ts
npm.cmd run test:rules
```

**Criterio de salida:** cliente y reglas conceden exactamente el mismo módulo.

---

### Task 4: Importador seguro del seed real

**Files:**
- Create: `scripts/importar-endmills.mjs`
- Modify: `package.json`
- Modify: `.gitignore`
- Read only input: `endmills-seed.json`

- [ ] Añadir `endmills-seed.json` al ignore sin eliminar el archivo del usuario.
- [ ] Implementar CLI con `--file`, `--project` y dry-run por defecto.
- [ ] Exigir `--apply` para escribir y base nombrada `compras-americanas`.
- [ ] Validar todos los invariantes antes de inicializar cualquier batch.
- [ ] Crear IDs deterministas `endmill-001`…`047` y
  `pedido-2026-03-06-bfl20260306mlv`.
- [ ] Importar 47 medidas + cabecera marzo + 33 partidas en un batch Admin SDK.
- [ ] Ante documentos existentes:
  - mismos datos/version de importación → no-op informado;
  - datos divergentes → abortar, sin overwrite automático.
- [ ] Dry-run local:

```powershell
node scripts/importar-endmills.mjs --file endmills-seed.json --project smv-brain-dev
```

- [ ] Tras reglas y app listas, importar solo a `smv-brain-dev` con autorización
  explícita para escribir:

```powershell
node scripts/importar-endmills.mjs --file endmills-seed.json --project smv-brain-dev --apply
```

**Criterio de salida:** dry-run cuadra todo y una segunda ejecución no duplica.

---

### Task 5: Ruta, navegación e inventario compacto

**Files:**
- Create: `app/endmills/page.tsx`
- Create: `app/endmills/EndmillsView.tsx`
- Create: `app/endmills/InventarioEndmills.tsx`
- Create: `app/endmills/DetalleEndmill.tsx`
- Modify: `app/NavBar.tsx`
- Modify: `app/page.tsx`
- Modify: `components/BuscadorGlobalCommand.tsx`

- [ ] Antes de escribir componentes, leer la guía local relevante de Next.js 16
  en `node_modules/next/dist/docs/01-app/`.
- [ ] Proteger `/endmills` con `AuthGuard` y el nuevo mapa de módulos.
- [ ] Añadir enlace **Endmills China** al grupo Compras, home y buscador global.
- [ ] Implementar cabecera compacta con KPIs y tabs Inventario/Pedidos.
- [ ] Implementar búsqueda y pills de categorías con conteos.
- [ ] Tabla desktop + cards móvil con texto además de color.
- [ ] Detalle en drawer/modal con spec, notas, historial y actualización de stock.
- [ ] Para error del listener: banner, última data válida y botón Reintentar.
- [ ] Verificar accesibilidad de labels, foco, modal y contraste.

**Criterio de salida:** usuario con permiso encuentra y consulta las 47 medidas sin
entrar a `/almacen` ni `/proveedores`.

---

### Task 6: Revisión humana, registro, recepción e historial

**Files:**
- Create: `app/endmills/RevisionPedidoEndmills.tsx`
- Create: `app/endmills/HistorialPedidosEndmills.tsx`
- Create: `app/endmills/DetallePedidoEndmills.tsx`
- Modify: `app/endmills/EndmillsView.tsx`
- Modify: `lib/endmills-calculos.ts`
- Modify: `tests/endmills-calculos.test.ts`

- [ ] Generar borrador en memoria, sin escritura al abrirlo.
- [ ] Precargar `sugerido` o 0 + **Definir manualmente** cuando sea `null`.
- [ ] Mantener medidas 2 y 38 excluidas hasta confirmación explícita.
- [ ] Permitir editar cantidad, precio, Ali Cost y shipping; recalcular en vivo.
- [ ] Comparar artículos vs artículos y mostrar landed total únicamente cuando
  adicionales estén confirmados.
- [ ] Añadir confirmación final con resumen y checkbox humano.
- [ ] Registrar pedido mediante la operación atómica de Task 2.
- [ ] Implementar **Marcar recibido** con cantidades reales, sin asumir entrega
  completa.
- [ ] Mostrar historial por ciclo y por medida.
- [ ] Implementar **Copiar tabla**, CSV local y `mailto:`; ninguna salida registra
  el pedido por sí misma.

**Criterio de salida:** no existe camino de una sola pulsación entre sugerencia y
pedido persistido.

---

### Task 7: Verificación completa en desarrollo

**Files:**
- Modify/Create only if needed: `e2e/endmills.spec.ts`
- Modify only if needed: `docs/testing/e2e.md`

- [ ] Ejecutar gates unitarios y estáticos:

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd test
npm.cmd run build
```

- [ ] Ejecutar rules/emulator y distinguir cualquier bloqueo de Java/entorno de
  un fallo de reglas.
- [ ] Con autenticación real en `smv-brain-dev`, verificar en navegador:
  1. permiso con/sin módulo;
  2. exactamente 47 medidas;
  3. búsqueda/categorías;
  4. cambio de stock persiste tras reload;
  5. Sin base no muestra número inventado;
  6. alertas de medidas 2/38;
  7. pedido revisado crea historial y objetivos;
  8. registrar no sube stock;
  9. recepción parcial/completa sí lo actualiza;
  10. pedido marzo conserva 483 pzas / $6,159.94 USD.
- [ ] Revisar `git diff` y confirmar que los archivos del usuario y cambios
  ajenos permanecen intactos.

**Criterio de salida:** funcional, seguridad, persistencia/reload y build están
verificados por separado y se reportan con precisión.

---

### Task 8: Handoff y despliegue opcional

Esta tarea no se ejecuta con un simple “apruebo el plan” si el propietario no ha
pedido también desplegar.

- [ ] Presentar diff, pruebas y cualquier dato aún sin calibrar.
- [ ] Pedir instrucción explícita antes de importar a `smv-brain`.
- [ ] Si se autoriza producción:
  - revisar targets cambiados;
  - desplegar Hosting + `firestore:rules` únicamente;
  - nunca desplegar Functions globales;
  - ejecutar importador con `--project smv-brain --apply` una sola vez;
  - verificar ruta pública y flujo autenticado;
  - documentar conteos/totales importados.

## Cobertura del spec

| Requisito | Task |
|---|---:|
| 47 medidas reales y categorías | 1, 4, 5 |
| Stock/precio USD | 1, 2, 5 |
| PAR/sugerido reproducible | 1, 2, 6 |
| Hueco `stockAntesPedido` sin inventar | 1, 4, 6 |
| Historial por medida/pedido | 2, 6 |
| Comparación de totales | 1, 6 |
| Revisión humana obligatoria | 2, 6 |
| IDs 2 y 38 protegidos | 1, 4, 6 |
| Ruta propia + permiso | 3, 5 |
| Seed seguro e idempotente | 4 |
| Errores con reintento | 2, 5 |
| Lint/tests/build/browser | 7 |
| Deploy solo bajo autorización | 8 |
