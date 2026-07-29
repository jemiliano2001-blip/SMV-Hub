# SMV Hub

Plataforma interna de SMV Maquinados para compras, diseño, finanzas y operación
del taller. El nombre técnico del repositorio y de la base Firestore sigue siendo
`compras-americanas`; el producto visible es **SMV Hub**.

## Capacidades principales

- **Compras:** captura de facturas con extracción estructurada mediante Gemini,
  validación de montos, detección de duplicados, claves SAT y órdenes
  multi-moneda.
- **Proveedores y cotizaciones:** catálogo USA Tooling, importación CSV de
  cotizaciones, precios históricos, lead time, scorecards e inteligencia cruzada
  con compras de Odoo.
- **Reportes y finanzas:** KPIs por moneda, impresión/PDF desde el navegador,
  cierre contable asistido por IA, facturación/cobranza sincronizada con Odoo y
  caja chica con comprobantes.
- **Operación:** entradas/salidas de almacén, pedidos de almacén, requisiciones,
  órdenes de servicio, operadores, horas extra y registros de baños.
- **Administración:** Google Sign-In, usuarios activos, permisos por módulo,
  super-administración y auditoría.

La ruta legacy `/importar` y el tab de reabastecimiento ROP de `/almacen` están
retirados. Los helpers de `lib/importar.ts` siguen activos porque Nueva Compra y
Cotizaciones los reutilizan.

## Stack

- Next.js 16.2.9 con App Router y React 19.2.4
- TypeScript estricto, Tailwind CSS v4 y Zod
- Firebase Auth, Firestore nombrado, Storage, Hosting y Cloud Functions
- Gemini API vía REST para extracción y clasificación
- Vitest, Playwright y axe-core

## Desarrollo local

Requisitos: Node.js 22, npm y acceso al proyecto Firebase de desarrollo
`smv-brain-dev`.

```powershell
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run dev
```

Rellena `.env.local` con la configuración Web App de `smv-brain-dev`, la base
`compras-americanas` y `GEMINI_API_KEY`. El inicio de sesión real es el
comportamiento normal también en localhost. Usa
`NEXT_PUBLIC_DEV_AUTH_BYPASS=true` únicamente para maquetación sin acceso real a
Firestore.

La aplicación queda disponible en
[http://localhost:3000](http://localhost:3000).

## Verificación

```powershell
npm.cmd run lint
npm.cmd exec tsc -- --noEmit
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
```

`npm run build` usa `next build --webpack` y después valida el bundle de Firebase
SSR. No retires `--webpack` ni el verificador: el bundle generado con Turbopack
no es compatible con el despliegue actual de Firebase Hosting.

Las pruebas E2E públicas no requieren sesión. Los recorridos autenticados y el
camino real de compra → orden → reporte tienen requisitos adicionales descritos
en [docs/testing/e2e.md](docs/testing/e2e.md).

## Despliegue y seguridad

Producción vive en el proyecto compartido `smv-brain`. El workflow de
`.github/workflows/ci.yml` valida el código y despliega únicamente los targets
Firebase afectados. Las Functions de Hub usan el codebase `smv-hub`; no ejecutes
un deploy global de Functions con `--force`, porque el proyecto también aloja
funciones de otras aplicaciones.

El acceso combina Firebase Auth, documentos activos en `usuarios`, permisos por
módulo, Firestore/Storage Rules y custom claims para Storage. App Check está
instrumentado, pero el enforcement en reglas continúa pausado hasta completar la
validación indicada en
[docs/infra/app-check-setup.md](docs/infra/app-check-setup.md).

Consulta [PROJECT.md](PROJECT.md) para el estado funcional,
[CLAUDE.md](CLAUDE.md) para convenciones de desarrollo y
[AGENTS.md](AGENTS.md) para restricciones críticas.
