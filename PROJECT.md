# Project: SMV Hub

Plataforma interna de SMV Maquinados para compras, diseño, finanzas y operación
del taller. El repositorio, el paquete y la base Firestore conservan el
identificador técnico `compras-americanas`; el producto visible es **SMV Hub**.

## Estado actual

SMV Hub es una aplicación Next.js 16 desplegada en Firebase sobre el proyecto
compartido `smv-brain`. El desarrollo local apunta a `smv-brain-dev` y usa la
misma base Firestore nombrada `compras-americanas`.

Los módulos de producto vigentes son:

- **Compras:** `/nueva-compra`, `/ordenes`, `/claves-sat`, `/cotizaciones`,
  `/requisiciones`, `/proveedores` y `/reportes`.
- **Finanzas:** `/finanzas`, `/reportes/contable` y `/caja-chica`.
- **Operación:** `/almacen`, `/pedidos-almacen`, `/banos`,
  `/operadores` y `/horas-extra`.
- **Administración:** `/usuarios`, `/auditoria` y `/login`.

La autorización se administra por usuario con `modulos[]`, una `plantilla`
(`admin`, `compras`, `diseno` o `almacen`) como atajo y `esSuperAdmin` para las
operaciones privilegiadas. `/usuarios` exige super-administración;
`pedidos-almacen` es un permiso independiente del módulo base `almacen`.

## Arquitectura

- `app/`: rutas App Router, Route Handlers y UI por módulo.
- `components/`: componentes compartidos, primitivas de UI y providers.
- `lib/`: schemas Zod, lógica de negocio, hooks y acceso a Firebase.
- `functions/src/`: sincronizaciones de compras y finanzas con Odoo.
- `tests/`: Vitest para lógica pura, rutas y adaptadores.
- `e2e/`: Playwright para accesibilidad y el camino real del dinero en
  `smv-brain-dev`.
- `docs/superpowers/`: diseños y planes históricos de implementación.

## Hitos entregados

| # | Hito | Resultado |
|---|---|---|
| 1 | Base de calidad | TypeScript estricto, ESLint, Vitest y build Firebase SSR verificado |
| 2 | Compras y órdenes | Captura IA, validación financiera, duplicados, edición, búsqueda y trazabilidad |
| 3 | Reportes y SAT | KPIs por moneda, impresión/PDF, correo por `mailto:`, cierre contable y clasificación SAT |
| 4 | Operación del taller | Almacén, baños, horas extra, operadores, requisiciones y órdenes de servicio |
| 5 | Usuarios y permisos | Google Sign-In, usuarios activos, módulos configurables, claims y super-admin |
| 6 | Finanzas | Facturación/cobranza Odoo, alertas financieras y caja chica con comprobantes |
| 7 | Proveedores | Catálogo USA Tooling, inteligencia cruzada, landed price y compras Odoo |
| 8 | Pedidos de almacén | Captura móvil y seguimiento con permiso Firestore independiente |
| 9 | Feedback de producción | CI selectivo, Playwright/axe y E2E compra → orden → reporte en Firebase dev |

## Funcionalidad retirada

- `/importar` fue retirado por decisión del propietario. `lib/importar.ts`
  permanece como librería compartida de Nueva Compra y Cotizaciones.
- El tab Reabastecimiento ROP de `/almacen`, su módulo y su lógica demo fueron
  eliminados el 2026-07-24. No debe volver sin una fuente real de inventario.

## Restricciones operativas activas

- Nunca mezclar MXN y USD en una misma suma o KPI.
- Producción permanece en `smv-brain`; los deploys de Hub deben respetar el
  codebase de Functions `smv-hub`.
- `npm run build` debe conservar `next build --webpack` y la verificación del
  bundle Firebase SSR.
- App Check está instrumentado, pero el enforcement de Firestore y Storage está
  pausado hasta validar dominios, tokens y métricas.
- Los cambios de roles, reglas, Route Handlers o Functions requieren revisar en
  conjunto cliente, documentos `usuarios`, custom claims y reglas Firebase.

Las reglas detalladas para agentes están en [AGENTS.md](AGENTS.md) y
[CLAUDE.md](CLAUDE.md). Los procedimientos operativos viven en `docs/infra/` y
`docs/testing/`.
