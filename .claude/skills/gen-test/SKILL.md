---
name: gen-test
description: Genera y verifica una prueba Vitest para lógica pura de lib/ en SMV Hub, sin Firebase ni red reales.
---

Dado un archivo o función de `lib/`, crea
`tests/<nombre>.test.ts` siguiendo los patrones existentes:

- Importa desde `@/lib/<módulo>` usando el alias de `vitest.config.ts`.
- Usa datos inline tipados; evita fixtures externos para lógica pequeña.
- Cubre happy path y al menos dos bordes relevantes (vacío, límite, moneda,
  fecha nula o input inválido según el dominio).
- Usa `describe`/`it` con nombres descriptivos en español.
- No uses `any`, `@ts-ignore`, Firebase real ni red real.
- Conserva la separación por moneda en cualquier cálculo financiero.
- Sigue el archivo de pruebas más cercano al módulo; usa
  `tests/reportes.test.ts` como referencia general.

Esta skill no cubre Route Handlers ni E2E. Esos tests pueden requerir mocks de
Auth/Gemini o Playwright y deben seguir sus suites existentes.

Después de crear el test, ejecútalo de forma aislada:

```powershell
npm.cmd exec vitest run -- tests/<nombre>.test.ts
```

Ejemplos: `/gen-test lib/reportes.ts` o `/gen-test filtrarPorRango`.
