---
name: smv-ui-consistencia
description: >-
  Mantenimiento de consistencia visual en SMV Hub: unificar módulos a PageShell,
  PageHeader, ModuleSurface, ModuleTabs, ModuleFilterChips, ModuleEmptyState y
  tokens semánticos; barrer slate/white/gray; guardar print:; correr guardrail
  Vitest. Usar cuando la UI se ve inconsistente entre secciones, al rediseñar
  módulos, migrar chrome legacy, o el usuario pida "mismo diseño en toda la app".
triggers:
  - consistencia ui smv
  - unificar diseño smv
  - mantenimiento diseño smv
  - module surface
  - module tabs
  - tokens smv hub
  - slate white chrome
  - ui tokens guardrail
  - mismo diseño en cada seccion
---

# SMV Hub — Consistencia UI (mantenimiento)

Workflow para que **toda la app** use el mismo sistema de layout y tokens.
Complementa `smv-frontend-design` (principios) y `ui-ux-pro-max-fix` (recomendaciones);
este skill es el **cómo migrar / auditar / no regresar**.

## Fuente de verdad (no inventar)

| Pieza | Ubicación |
|-------|-----------|
| Tokens CSS | `app/globals.css` — tema **claro** (Fira + primary `#0369A1`) |
| Layout | `components/layout/PageShell`, `PageHeader`, `ModuleSurface`, `ModuleTabs`, `ModuleFilterChips`, `ModuleEmptyState` |
| Primitivas | `components/ui/*` (shadcn) |
| Referencia gold | `app/cotizaciones/CotizacionesTabs.tsx` + `CotizacionesList.tsx` |
| Guardrail | `tests/ui-tokens-guardrail.test.ts` (`npx vitest run tests/ui-tokens-guardrail.test.ts`) |

**No** voltear la app a dark OLED solo porque un skill genérico lo sugiera. El producto real es light + tokens.

## Cuándo usar

- “Que toda la app tenga el mismo diseño”
- Un módulo se ve distinto (slate/white suelto, tabs caseros, emoji)
- Nuevo módulo / modal denso
- Pre-PR de UI

## Cuándo NO usar

- Solo lógica de negocio / Firestore / APIs
- Landing marketing genérica fuera de Hub → `frontend-design`
- Solo tokens/principios sin migración → `smv-frontend-design`

## Primitivas canónicas

```tsx
<PageShell>
  <PageHeader title="…" icon={Icon} description="…" actions={…} />
  <ModuleTabs
    value={tab}
    onValueChange={setTab}
    headerClassName="print:hidden"  // opcional
    actions={…}                     // CTA junto a tabs
    items={[
      { value: "a", label: <span className="inline-flex items-center gap-2">…</span>, content: <VistaA /> },
    ]}
  />
</PageShell>
```

- Paneles densos → `ModuleSurface`
- Filtros exclusivos → `ModuleFilterChips`
- Vacío → `ModuleEmptyState`
- Nav entre **rutas** (finanzas) → mismo look que `TabsList` con `Link` (ver `FinanzasNav`), no forzar `ModuleTabs` si el estado vive en la URL

## Mapa de tokens (pantalla)

| Evitar | Usar |
|--------|------|
| `bg-white` | `bg-card` / `bg-background` |
| `bg-slate-50` / `bg-gray-100` | `bg-muted` / `bg-muted/40` |
| `border-slate-*` / `border-gray-*` | `border-border` / `border-input` |
| `text-slate-900` / `text-gray-900` | `text-foreground` |
| `text-slate-500` / `text-gray-500` | `text-muted-foreground` |
| Emoji (⭐ 💰 ✅ ✨) | Lucide (`Star`, `DollarSign`, `CheckCircle2`, `Sparkles`) |
| Gradientes purple marketing | `bg-primary` / tokens |

**Permitido:** colores de estatus (emerald / amber / rose / sky) para badges semánticos.

## Allowlist (NO romper)

1. Cualquier clase `print:*` (PDF de reportes / caja / finanzas)
2. Hex solo dentro de `print:` (ej. `print:bg-[#111111]`)
3. `app/gafetes/GafetesView.tsx` — CSS/placeholders del **badge físico** (`bg-slate-200` en foto)

## Plan por fases (auditoría → migración)

Usar este orden; pedir confirmación antes de tocar código si el alcance es app-wide.

| Fase | Alcance | Impacto |
|------|---------|---------|
| **1** | `NavBar` + tabs → `ModuleTabs` / look TabsList; quitar emoji/marketing muerto | Global |
| **2** | Surfaces densas: proveedores, finanzas, caja-chica → `ModuleSurface` + tokens | Dialectos peores |
| **3** | Ops: documentos-venta, pedidos-almacén, notificaciones, baños, endmills, gafetes (solo pantalla) | Día a día |
| **4** | Admin + reportes: usuarios, auditoría, reportes/contable, integridad | Outliers |
| **5** | Modales densos + guardrail Vitest | Cierre / anti-regresión |

### Checklist por archivo

- [ ] Shell: `PageShell` + `PageHeader` (salvo login)
- [ ] Tabs: `ModuleTabs` o nav tipado como TabsList
- [ ] Paneles: `ModuleSurface` / empty / chips
- [ ] Cero `bg-white` / `slate-*` / `gray-*` en pantalla (salvo allowlist)
- [ ] Sin emoji estructurales
- [ ] Lógica de negocio intacta
- [ ] `npx tsc --noEmit` + `npx vitest run tests/ui-tokens-guardrail.test.ts`

## Anti-patrones

- Tabs underline caseros (`border-b-2 border-sky-600`)
- Pills grises custom en vez de `TabsList` / `ModuleTabs`
- Bloques `{false && …}` de UI muerta con marketing
- Modales en dialecto viejo mientras la página ya está tokenizada
- Inventar paleta paralela o dark mode “porque se ve premium”

## Skills relacionados

| Skill | Rol |
|-------|-----|
| `smv-frontend-design` | Principios / tokens / reglas por módulo |
| `ui-ux-pro-max-fix` | Recomendaciones de estilo/UX (no sobreescribir tokens reales de Hub) |
| `smv-ui-consistencia` (este) | Migración app-wide + guardrail |

## Deploy (si el usuario pide producción)

```bash
npm run deploy:hosting   # smv-brain, hosting:smv-hub — NUNCA firebase deploy a secas
```
