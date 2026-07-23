---
title: Registro de autoresearch
date: 2026-07-22
status: cerrado
---

# Registro de autoresearch

## Alcance

- Objetivo: balance general con énfasis en experiencia de usuario y autorización para refactor profundo.
- Profundidad: tres rondas completas.
- Consultas de búsqueda: 16.
- Fuentes oficiales revisadas o consolidadas: 15.
- Páginas producidas en esta wiki: 15.
- Transporte: fallback al filesystem en `docs/research/smv-hub-improvements/` aprobado por el usuario.

## Ronda 1 — navegación, errores, datos y accesibilidad

Se investigaron estados de carga/error de Next.js, persistencia offline de Firestore, paginación con cursores y WCAG 2.2. La evidencia local mostró ausencia total de route boundaries y consultas de listas sin cursores.

Resultado: la primera capa debe ser confiabilidad visible; la paginación es un requisito de escalabilidad, no una optimización opcional.

## Ronda 2 — fronteras cliente, acciones y pruebas

Se investigaron Server/Client Components, lazy loading, acciones optimistas, accesibilidad E2E y Firebase Performance Monitoring. La evidencia local mostró una proporción alta de componentes cliente, imports estáticos de `xlsx` y ausencia de E2E propio.

Resultado: reducir JavaScript y dividir módulos solo después de establecer medición y pruebas de recorridos.

## Ronda 3 — métricas, estados y consultas

Se investigaron Web Vitals, `useActionState`, mensajes de estado accesibles, Query Explain y la guía estable de Playwright.

Resultado: el refactor debe medirse por experiencia real, no solo por líneas o componentes.

## Fallos de recuperación de fuentes

El extractor web devolvió un error interno/HTTP 400 al abrir directamente varias páginas oficiales de Next.js: Linking and Navigating, Error Handling, Server and Client Components, Lazy Loading y Analytics. Los resultados oficiales de búsqueda estuvieron disponibles, pero no se copiaron afirmaciones detalladas que dependieran de contenido no recuperado.

Antes de implementar cambios Next.js se debe leer la versión local correspondiente en `node_modules/next/dist/docs/`, tal como exige `AGENTS.md`.

## Limitaciones

- No hubo analítica de uso ni trazas de producción.
- No se entrevistó a operadores.
- No se ejecutó Query Explain contra producción.
- No se habilitó caché offline ni se inspeccionaron dispositivos compartidos.
- La revisión propone cambios; no altera código funcional.

## Preguntas abiertas

- Volumen y crecimiento por colección.
- Frecuencia y tasa de error por recorrido.
- Condiciones reales de red/dispositivo.
- Política de caché en equipos compartidos.
- SLOs de UX y permiso de telemetría.
- Objetivos cuantitativos para LCP, INP y confirmación de operaciones cuando exista uso real.
