---
name: gen-test
description: Genera un archivo de prueba Vitest para una función o módulo de lib/. Solo lógica pura — sin Firebase real, sin mocks de red.
---

Dado el archivo o función que se indica, genera un test en `tests/<nombre>.test.ts` siguiendo estos patrones del proyecto:

- Importa solo desde `@/lib/<módulo>` (alias configurado en vitest.config.ts)
- Usa datos dummy inline, nunca fixtures de archivo externo
- Cubre el happy path + al menos 2 edge cases (entrada vacía, tipo incorrecto, valor límite)
- Estilo `describe` / `it` con nombres descriptivos en español
- Sin comentarios obvios — los nombres de los tests son la documentación
- Sigue el patrón de tests existentes en `tests/` (ver `tests/reportes.test.ts` como referencia de calidad)

Ejemplo de invocación: `/gen-test lib/reportes.ts` o `/gen-test filtrarPorRango`
