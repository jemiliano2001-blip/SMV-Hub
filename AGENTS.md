<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Gemini Models Reference
When configuring or updating Gemini models, ALWAYS refer to [https://ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models) to check for the latest model versions and deprecations. Do not use outdated or hallucinated model names without verifying their current status in the docs first.

## Learned User Preferences

- Prefer real Google Sign-In on localhost over auth bypass; only enable bypass with `NEXT_PUBLIC_DEV_AUTH_BYPASS=true` when explicitly needed for UI-only testing.
- Expect fixes to be verified end-to-end (lint, tests, build, and browser flow) before considering them done.
- Keep Antigravity, Claude, and gstack skills available in Cursor via junction sync into `~/.cursor/skills/` (script: `~/.cursor/sync-skills.ps1`).
- In `/ordenes`, hide ID and Orden de trabajo from the main table; keep them in the detail/edit modal.
- In `/banos`, prefer operator search with datalist over a button grid; auto-fill date and entry time on capture (no manual date/time inputs).

## Learned Workspace Facts

- Invoice extraction uses Gemini (`GEMINI_API_KEY` in `.env.local`), not Anthropic; override with `GEMINI_MODEL`. Defaults in `lib/extraer-ia.ts`: `gemini-3.5-flash` (normal), `gemini-3.1-pro-preview` (batch `calidad=alta`).
- Visible product name is **SMV Hub** (compras, diseño, operación del taller); repo and Firestore DB stay `compras-americanas` on Firebase project `smv-brain`.
- API routes `/api/extraer` and `/api/extraer-lote` require a valid Firebase ID token plus an authorized email from `lib/authorized-emails.ts`; keep `lib/authorized-emails.ts`, `firestore.rules`, and `storage.rules` in sync (extras via `AUTHORIZED_EMAILS_EXTRA` / `NEXT_PUBLIC_AUTHORIZED_EMAILS_EXTRA` in `.env.local` still need rules deploy).
- Per line item: `empresa` and `destino` are the same concept (UI "Empresa / destino"), plus `cuentaCargo`, `requisitor`, and `ordenTrabajo` (optional for compras americanas); McMaster "Your Reference" maps to empresa + SO/cuenta cargo. Workshop tools (herramientas) default to empresa="SMV" and cuentaCargo="Stock" unless the invoice reference says otherwise; smart suggestions in `/nueva-compra` fill empty fields from history with IA-extracted values always taking priority.
- Duplicate orders are detected by `numeroFactura` + `proveedor` (case-insensitive); blocks save in `/nueva-compra` and auto-deselects in CSV import preview.
- Invoice `total` should include shipping/freight when present (subtotal + impuestos + envío); US sales tax is state/local (8.25% is Texas max, not universal) — store `impuestos` as the dollar amount from the invoice.
- Reports: when `fechaFactura` is null, `lib/reportes.ts` uses `creadoEn` for period filtering and the `dia` column so orders without invoice dates still appear.
- SAT per item: `claveProdServ` + `satPendiente`; catalog (`data/sat/catalogo.json`) is Spanish — translate English descriptions first. Suggestions: glosario → `GEMINI_MODEL_SAT` (default `gemini-3.1-flash-lite`) in `lib/sat/gemini-sat.ts`; SMV areas map to UNSPSC divisions via `lib/sat/perfil-compras-smv.ts` (**taller** 23/27/30/31, **automatización** 26/32/39, **oficina** 14/41/45/55). Validated mappings persist to `sat_asignaciones` and load via `/api/sugerir-clave-sat` with `data/sat/mapeos-smv.json`.
- **PDF Export & Emailing:** PDF export uses browser printing and Tailwind `print:` modifiers (no jspdf). Hide the Referencia column when printing supervisor reports. Emailing uses `<ModalEnviarReporte>` with a `mailto:` link (preferred over SMTP/Resend when email credentials are unavailable).
- **Hosting/security:** production stays on Firebase project `smv-brain` (Hosting/App Hosting; CI on `main` deploys `hosting,functions,firestore:rules,storage`); local dev targets `smv-brain-dev` (`.firebaserc` aliases). Data protection = Google Auth whitelist + Firestore/Storage rules + App Check (reCAPTCHA v3; setup in `docs/infra/app-check-setup.md`). Scheduled Firestore exports: `infra/firestore-backup/setup.sh`.
- **`/ordenes-servicio`:** mirrors Excel Fisher tab — estatus `pendiente|en_proceso|detenida|entregada|cancelado` (legacy `recibido`→`entregada`); fields `nota`, `fechaEntregaActualizada`, `cantidadEntregada`/`cantidadPendiente`; delivery dates as free text (`??`, ranges); requisitor/ing. a cargo via datalist from operadores.
- **`/requisiciones` + `/banos`:** Automatización tab mirrors Excel (link, nota, recibio, revisionFinanzas, estado `parcial`, semáforo in `lib/requisicion-atraso.ts`, status dropdown); deploy rules when adding estatus. `/banos` Registro uses `fechaHoyLocal`/`horaAhoraLocal` in `lib/format.ts` (local time, not UTC `toISOString()`), required baño pills, one-click llegada.
- **Roles/permisos:** every user has a `Rol` (`admin`|`compras`|`diseno`|`almacen`, `lib/schemas.ts`); `lib/roles.ts` (`PERMISOS_POR_ROL`, `tienePermiso()`) gates routes in `AuthGuard.tsx` and hides nav links in `NavBar.tsx`. `/finanzas`, `/auditoria`, `/usuarios` are `admin`-only — keep in sync with `firestore.rules` when adding a route or changing a role's access.
- **`/finanzas` + `/caja-chica`:** client invoicing/collections synced from Odoo (`functions/src/odooSync.ts` + `odoo-mapeo.ts`, first use of Secret Manager via `runWith({ secrets })` in this repo, prefixed `FINANZAS_*`; pure mapping logic has no firebase-admin/functions deps so it's testable from repo root with Vitest); app logic in `lib/finanzas.ts` / `lib/finanzas-facturas.ts`. Petty cash movements/arqueo in `lib/caja-chica.ts`.
- **Build:** `npm run build` runs `next build --webpack` (not Turbopack) then `scripts/verificar-bundle-firebase.mjs` — Turbopack + `firebase-admin`/`firebase-functions` produces hashed aliases the Firebase Hosting SSR function can't resolve in prod; don't drop the `--webpack` flag or the verify step.
