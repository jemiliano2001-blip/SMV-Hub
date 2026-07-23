---
title: WCAG 2.2 para la experiencia operativa
date: 2026-07-22
type: source-synthesis
---

# WCAG 2.2 para la experiencia operativa

## Fuentes oficiales

- [Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/)
- [Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)

## Criterios relevantes

- El foco debe ser visible y no quedar oculto por elementos persistentes.
- Los objetivos táctiles deben alcanzar al menos 24 × 24 CSS px para el nivel AA, salvo excepciones documentadas.
- Cambios de estado importantes deben comunicarse a tecnologías de asistencia sin mover el foco innecesariamente.
- La navegación y los patrones repetidos deben ser predecibles.
- Los errores deben identificarse y ofrecer instrucciones comprensibles.

## Feedback accesible

Un mensaje inline como “Movimiento guardado” puede usar `role="status"`; un error urgente puede usar `role="alert"`. Las regiones vivas no deben anunciar cada pequeño cambio porque generan ruido. Un diálogo modal es distinto: toma el foco, debe atraparlo correctamente y devolverlo al control que lo abrió.

## Aplicación a SMV Hub

- Sustituir `alert()` y `confirm()` por componentes accesibles con foco controlado.
- Conservar el error junto al campo o acción que lo produjo.
- Añadir nombres accesibles a iconos de editar, eliminar y verificar.
- Verificar que tablas responsivas sigan un orden de lectura lógico.
- Revisar botones compactos e iconos para el mínimo táctil.
- Probar zoom, teclado, contraste y lector de pantalla en módulos críticos.

## No basta con cumplir visualmente

El mismo mensaje debe existir en la estructura accesible. Un color verde o rojo por sí solo no comunica resultado, y un toast que desaparece demasiado pronto puede perderse. Para operaciones críticas conviene combinar toast con estado persistente cercano a la acción.

