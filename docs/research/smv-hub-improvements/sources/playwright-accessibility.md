---
title: Accesibilidad automatizada con Playwright
date: 2026-07-22
type: source-synthesis
---

# Accesibilidad automatizada con Playwright

## Fuente oficial

- [Accessibility testing | Playwright](https://playwright.dev/docs/accessibility-testing)

## Capacidad

Playwright documenta la integración de `@axe-core/playwright` para detectar problemas como contraste insuficiente, controles sin etiqueta e identificadores duplicados. También aclara que las herramientas automáticas solo detectan una parte de los problemas y deben complementarse con evaluación manual e inclusiva.

## Suite inicial propuesta

1. Inicio de sesión real y acceso por módulo.
2. Crear una compra y validar duplicado.
3. Aprobar/cambiar estado de orden o requisición.
4. Registrar y verificar un movimiento de Caja Chica.
5. Generar/exportar un reporte.
6. Repetir recorridos clave en viewport móvil.

Cada prueba debe cubrir:

- recorrido feliz;
- error de red o permiso;
- navegación por teclado;
- foco al abrir/cerrar diálogo;
- escaneo axe en estados estables;
- mensajes de éxito/error detectables.

## Estrategia de autenticación y datos

La suite debe respetar Google Sign-In real en desarrollo cuando sea posible. El bypass solo se usaría explícitamente para pruebas visuales aisladas. Los datos E2E deben vivir en un proyecto/entorno de desarrollo, con limpieza controlada y sin tocar producción.

## Limitación

Un escaneo axe exitoso no certifica que una tabla sea comprensible, que el lenguaje sea claro o que el flujo funcione bien para un operador. Es una red de seguridad, no el criterio final de diseño.

