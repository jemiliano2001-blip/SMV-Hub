---
title: Next.js App Router y experiencia
date: 2026-07-22
type: source-synthesis
---

# Next.js App Router y experiencia

## Fuentes oficiales

- [Linking and Navigating](https://nextjs.org/docs/app/getting-started/linking-and-navigating)
- [Error Handling](https://nextjs.org/docs/app/getting-started/error-handling)
- [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Lazy Loading](https://nextjs.org/docs/app/guides/lazy-loading)
- [Analytics](https://nextjs.org/docs/app/guides/analytics)
- [Project Structure](https://nextjs.org/docs/app/getting-started/project-structure)

## Hallazgos relevantes

Next App Router permite que cada segmento tenga una experiencia de carga inmediata mediante `loading.tsx`, y que fallos inesperados se contengan mediante límites `error.tsx` con reintento. Esto evita que una ruta completa parezca congelada o quede inutilizable por un error local.

Los componentes son de servidor por defecto. Next recomienda colocar `use client` en las hojas interactivas más pequeñas posibles para reducir JavaScript enviado al navegador. Los componentes y librerías pesadas se pueden aplazar mediante imports dinámicos hasta que sean visibles o necesarios.

`useReportWebVitals` permite enviar métricas reales, pero el componente cliente que lo contiene debe mantenerse aislado para no ampliar la frontera de hidratación.

## Aplicación a SMV Hub

- Crear límites por grupos de módulos, no un único spinner global.
- Mantener búsqueda, tablas interactivas y diálogos en cliente; mover shells, encabezados y contenido estable al servidor cuando sea viable.
- Importar `xlsx` dentro de la acción de exportación.
- Diferir modales de detalle e inteligencia de Proveedores/Requisiciones.
- Añadir un componente cliente diminuto para Web Vitals.

## Precaución

Durante la investigación, varias aperturas directas de páginas de Next.js devolvieron un error técnico del extractor aunque los resultados oficiales estaban disponibles. Las recomendaciones se limitan a las capacidades descritas por la documentación oficial y deben validarse contra `node_modules/next/dist/docs/` antes de implementar, conforme a las reglas del repositorio.

