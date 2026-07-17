# Módulo Finanzas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la captura manual de `EDOS FINANCIEROS 2026.xlsx` con un
espejo de solo lectura de las facturas de cliente en Odoo, sin mezclarse con
los reportes de compras existentes.

**Architecture:** Sync programado (Cloud Function) desde Odoo hacia
Firestore (`finanzas_facturas`), leído por la UI vía hook — nunca consulta
Odoo en vivo. Ver justificación completa en el spec.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript estricto, Zod,
Firebase (Firestore + Cloud Functions v2 + Secret Manager), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-15-finanzas-modulo-design.md`

## Global Constraints

- Prohibido `any` y `@ts-ignore` (CLAUDE.md).
- `lib/reportes.ts` no se toca — Finanzas vive en `lib/finanzas.ts`, archivo
  separado.
- Nunca sumar `total` entre `moneda` distintas; nunca hardcodear tasa de IVA.
- Credenciales de Odoo: `.env.local` en dev (nunca en el chat, nunca
  commiteadas), Firebase Secret Manager en prod.
- Ninguna colección `finanzas_*` se escribe desde el cliente.
- No se avanza a Task 2+ hasta que Task 1 (Fase 0) esté corrida contra Odoo
  real y su output haya sido revisado — cualquier nombre de campo de Odoo
  usado después de este punto debe coincidir con lo observado, no con lo
  supuesto en el spec.

---

### Task 1: Fase 0 — Script de descubrimiento en Odoo

**Status: COMPLETADA (2026-07-15).** Correguí el script tras la primera
corrida (traía puros borradores/cancelados de prueba por ordenar por
`invoice_date desc` con ese campo `false` en no-posteadas) — ahora filtra
`state = 'posted'` y ordena por `id desc`. Hallazgos completos en el spec
(§ Fase 0). Resumen: una sola compañía (`id=1`), moneda `MXN`, `payment_state`
real tiene 6 valores (no 4), `name` solo se puebla al postear.

**Files:**
- Create: `scripts/odoo-discovery.mjs`
- Create: `.gitignore` entry para `data/odoo-discovery/` (si no existe ya un patrón `data/*` ignorado)

**Interfaces:**
- Lee de `.env.local`: `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME`, `ODOO_API_KEY`.
- Produce archivos JSON en `data/odoo-discovery/`: `companies.json`,
  `account-move-fields.json`, `sample-invoices.json`.

- [ ] **Step 1: Confirmar variables de entorno**

Pedir a Emiliano que agregue a `.env.local` (raíz del repo, ya gitignored):

```bash
ODOO_URL=
ODOO_DB=
ODOO_USERNAME=
ODOO_API_KEY=
```

No continuar sin esto — el script debe fallar rápido y claro si faltan.

- [ ] **Step 2: Escribir el script de autenticación + JSON-RPC**

`scripts/odoo-discovery.mjs` — Node puro (`fetch` nativo, sin dependencias
nuevas), mismo estilo que `scripts/extraer-compras.mjs` (carga `.env.local` a
mano con un parser simple, sin `dotenv`):

```js
#!/usr/bin/env node
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs"
import path from "node:path"

function cargarEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local")
  if (!existsSync(envPath)) return
  for (const linea of readFileSync(envPath, "utf-8").split("\n")) {
    const m = linea.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}

cargarEnvLocal()

const { ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY } = process.env
for (const [k, v] of Object.entries({ ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY })) {
  if (!v) {
    console.error(`Falta ${k} en .env.local`)
    process.exit(1)
  }
}

let uid
async function llamarOdoo(service, method, args) {
  const res = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: { service, method, args },
    }),
  })
  if (!res.ok) throw new Error(`Odoo HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const json = await res.json()
  if (json.error) throw new Error(`Odoo RPC error: ${JSON.stringify(json.error).slice(0, 500)}`)
  return json.result
}

async function main() {
  uid = await llamarOdoo("common", "login", [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY])
  if (!uid) throw new Error("Login falló — revisa ODOO_DB/ODOO_USERNAME/ODOO_API_KEY")

  const outDir = path.resolve(process.cwd(), "data/odoo-discovery")
  mkdirSync(outDir, { recursive: true })

  const companies = await llamarOdoo("object", "execute_kw", [
    ODOO_DB, uid, ODOO_API_KEY, "res.company", "search_read", [[], ["id", "name"]],
  ])
  writeFileSync(path.join(outDir, "companies.json"), JSON.stringify(companies, null, 2))
  console.log(`Compañías encontradas: ${companies.map((c) => `${c.id}:${c.name}`).join(", ")}`)

  const fields = await llamarOdoo("object", "execute_kw", [
    ODOO_DB, uid, ODOO_API_KEY, "account.move", "fields_get", [], { attributes: ["string", "type"] },
  ])
  writeFileSync(path.join(outDir, "account-move-fields.json"), JSON.stringify(fields, null, 2))

  // Ajustar company_id tras revisar companies.json
  const sample = await llamarOdoo("object", "execute_kw", [
    ODOO_DB, uid, ODOO_API_KEY, "account.move", "search_read",
    [[["move_type", "in", ["out_invoice", "out_refund"]]]],
    { fields: [
        "id", "name", "partner_id", "invoice_date", "invoice_date_due",
        "amount_untaxed", "amount_tax", "amount_total", "amount_residual",
        "currency_id", "payment_state", "state", "ref", "invoice_origin", "company_id",
      ], limit: 5, order: "invoice_date desc" },
  ])
  writeFileSync(path.join(outDir, "sample-invoices.json"), JSON.stringify(sample, null, 2))

  console.log(`Listo. Revisa data/odoo-discovery/ (gitignored, no lo compartas fuera del repo).`)
}

main().catch((err) => {
  console.error("Descubrimiento falló:", err.message)
  process.exit(1)
})
```

- [ ] **Step 2b: Confirmar `data/` está gitignored**

Revisar `.gitignore` — si `data/` ya cubre `data/extraccion/` (usado por
`extraer-compras.mjs`), no hace falta entrada nueva. Si no, agregar
`data/odoo-discovery/`.

- [ ] **Step 3: Correr y revisar manualmente**

```bash
node scripts/odoo-discovery.mjs
```

Emiliano revisa a mano (no se pega el contenido en el chat, puede tener datos
de clientes reales):
1. `companies.json` — confirma cuál `id` es la empresa correcta.
2. `account-move-fields.json` — confirma que los campos usados en el sample
   existen y sus tipos coinciden con lo esperado.
3. `sample-invoices.json` — confirma la forma real de `partner_id`
   (`[id, "Nombre"]` típico de Odoo), `currency_id`, `payment_state` (valores
   reales: `not_paid`/`in_payment`/`paid`/`partial`/`reversed`?), y si
   `amount_residual` refleja pagos parciales.

- [ ] **Step 4: Reportar hallazgos de vuelta**

Con el contenido revisado, actualizar el schema propuesto en el spec (§
"Fase 1") con los nombres/tipos reales antes de tocar `lib/schemas.ts` en
serio. Cualquier diferencia entre lo asumido y lo real se documenta aquí como
adenda antes de continuar a Task 2.

---

### Task 2+: Fase 1 — Schema, sync, UI

**Status: COMPLETADA (2026-07-15).** Todo el código está escrito y verificado
(lint + 441 tests + `npm run build`), pero **nada se ha desplegado** — eso
requiere confirmación explícita del usuario porque toca producción.

1. ✅ `lib/schemas.ts` — `FacturaClienteSchema` con campos confirmados en Fase 0.
2. ✅ `lib/finanzas.ts` + `tests/finanzas.test.ts` (19 tests) — lógica pura.
   Se encontró y corrigió un bug real de zona horaria al comparar fechas
   `YYYY-MM-DD` con `Date` en horario local; se resolvió comparando strings
   ISO directamente (reutilizando `fechaHoyLocal` de `lib/format.ts`).
3. ✅ `lib/finanzas-facturas.ts` + `lib/hooks/useFinanzasFacturas.ts` — el hook
   sigue el patrón de `useOrdenes.ts` (función plana, no `useCallback`) tras
   detectar que `useCallback` + `useEffect` dispara
   `react-hooks/set-state-in-effect`.
4. ✅ `firestore.rules` — `esAdminRol()` + `esFinanzasAutorizado()` +
   colecciones `finanzas_facturas`/`finanzas_sync_state` (solo lectura admin,
   escritura bloqueada).
5. ✅ `functions/src/odoo-mapeo.ts` (mapeo puro, testeable) +
   `functions/src/odooSync.ts` (sync real vía `functions.runWith({ secrets })`,
   sin `firebase-functions/v2` — Secret Manager funciona con v1 también) +
   `tests/odoo-sync-mapeo.test.ts` (12 tests, fixtures sintéticos que
   reproducen la forma real sin usar datos de clientes reales — un
   intento inicial de usar nombres/montos reales fue bloqueado correctamente
   por el clasificador de auto mode). Corrección importante: el tipo
   factura/nota_crédito se detecta por `move_type` real, no por el prefijo
   `RINV` del nombre (que solo existe una vez posteada).
6. ✅ `app/finanzas/**` (4 páginas + `FinanzasNav`/`BannerSync` compartidos) +
   `app/NavBar.tsx` (nuevo grupo Finanzas) + `lib/roles.ts` (`/finanzas`
   solo en `admin`).
7. ✅ Verificación: `npm run lint` (sin errores nuevos), `npx vitest run`
   (441/441), `npm run build` (las 4 rutas `/finanzas/*` generan bien).

**Hallazgo importante durante el despliegue (2026-07-15):** `smv-brain` es un
proyecto de Firebase **compartido con otra app** ("SMV brain": sitio
`ssrsmvbrain`, reportes programados, y su propio sync de Odoo —
`triggerOdooSync` + `syncOdooSuprajitOrders`, ya en producción). El CI de
este repo ya desplegaba funciones **por nombre explícito**
(`.github/workflows/ci.yml`) precisamente para no pisar las de esa otra app.
Emiliano confirmó que cada integración de Odoo usa su **propio API key
dedicado** (generó 3 keys distintos para 3 proyectos distintos) — por eso los
secretos de este módulo usan el prefijo `FINANZAS_ODOO_*`
(`FINANZAS_ODOO_URL`/`FINANZAS_ODOO_DB`/`FINANZAS_ODOO_USERNAME`/`FINANZAS_ODOO_API_KEY`)
en vez de compartir nombre con los secretos planos `ODOO_*` que ya usa "SMV
brain". El CI (`ci.yml`) ya se actualizó para incluir
`functions:syncOdooFacturasScheduled,functions:syncOdooFacturasManual` en el
`--only` explícito.

**Nota de limpieza pendiente (no urgente):** al intentar configurar los
secretos, Emiliano corrió por error `firebase functions:secrets:set
ODOO_API_KEY` (nombre plano, ya usado por "SMV brain") y `ODOO_USERNAME`
(nombre plano, nuevo). Como cada integración debe tener su propio key, esto
dejó una versión nueva (v3) de `ODOO_API_KEY` que no necesariamente coincide
con el key que usan `triggerOdooSync`/`syncOdooSuprajitOrders` — no rompió
nada de inmediato (esas funciones siguen ancladas a su versión anterior hasta
que alguien las redeploye), pero si quien mantiene "SMV brain" las vuelve a
desplegar sin fijar versión, tomarían la v3 nueva. Recomendado: que esa
persona agregue una versión nueva con el valor correcto de "SMV brain" para
restaurar `latest`, o simplemente lo tengan presente.

**Pendiente, requiere al usuario:**
- Configurar los 4 secretos **con el prefijo correcto**:
  `firebase functions:secrets:set FINANZAS_ODOO_URL/FINANZAS_ODOO_DB/FINANZAS_ODOO_USERNAME/FINANZAS_ODOO_API_KEY`
  (uno a la vez, no pegados en bloque — así fue como fallaron los primeros
  dos intentos de `ODOO_URL`/`ODOO_DB`).
- Desplegar `firestore:rules` y `functions` (vía CI en `main` o manual,
  siempre con el `--only` explícito) — no se hizo en esta sesión.
- Confirmar que la cuenta admin real tiene `usuarios/{uid}.rol == 'admin'` en
  Firestore (la regla nueva depende de esto).
- Probar el sync manual (`syncOdooFacturasManual`) contra `smv-brain-dev`
  antes de activar el `onSchedule` en producción — **pendiente investigar**:
  `smv-brain-dev` no aparece en `firebase projects:list` ni se puede
  seleccionar con `firebase use development` desde esta cuenta; hay que
  confirmar si existe o si falta acceso antes de poder probar ahí.

---

## Spec coverage (self-review)

| Spec requirement | Task |
|---|---|
| Confirmar empresa real y campos de Odoo | Task 1 ✅ |
| Nunca inventar campos de Odoo | Constraint global + Task 1 gate ✅ |
| Credenciales fuera del chat/commits | Task 1 Step 1 ✅ |
| Schema/sync/UI de Fase 1 | Task 2+ ✅ (código completo, despliegue pendiente) |
