---
title: Investigación de mejoras de SMV Hub
date: 2026-07-22
status: completa
scope: experiencia de usuario, arquitectura y calidad
---

# Investigación de mejoras de SMV Hub

Este directorio contiene el resultado de un `autoresearch` completo de tres rondas, cruzando el código actual con documentación oficial de Next.js, React, Firebase, W3C y Playwright.

## Lectura recomendada

1. [Síntesis principal](Research-SMV-Hub-UX-and-Code-Improvements.md)
2. [Roadmap priorizado](roadmap-priorizado.md)
3. [Evidencia local](evidencia-local.md)
4. [Registro de investigación](log.md)
5. [Hallazgos calientes](hot.md)

## Fuentes consolidadas

- [Next.js App Router y experiencia](sources/next-app-router-ux.md)
- [Firebase, datos y experiencia](sources/firebase-data-ux.md)
- [WCAG 2.2](sources/wcag-22.md)
- [Acciones y estados en React](sources/react-actions.md)
- [Accesibilidad con Playwright](sources/playwright-accessibility.md)
- [Firebase Performance Monitoring](sources/firebase-performance.md)
- [Firestore Query Explain](sources/firestore-query-explain.md)

## Conceptos propuestos

- [Arquitectura híbrida por funciones](concepts/arquitectura-hibrida.md)
- [Sistema de feedback de operaciones](concepts/sistema-feedback-operaciones.md)

## Alcance y límites

- Se revisó todo el árbol funcional de `app`, `components`, `lib`, `functions/src`, reglas y pruebas.
- Se usaron fuentes oficiales o primarias y recientes.
- Este trabajo propone una dirección técnica y una secuencia; no modifica todavía el comportamiento de producción.
- Las cifras de bundles son tamaños brutos de archivos JavaScript generados, no tamaños gzip transferidos.
- La investigación no sustituye pruebas con usuarios ni telemetría real de producción.

