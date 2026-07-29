# Instrucciones para Gemini

@AGENTS.md

Las reglas de `AGENTS.md` son la fuente de verdad para producto, seguridad,
modelos Gemini, build y despliegue.

## Graphify

El repositorio puede incluir un grafo de conocimiento en `graphify-out/`.
Úsalo como mapa auxiliar cuando esté presente y actualizado:

- Lee `graphify-out/GRAPH_REPORT.md` o `graphify-out/wiki/index.md` si existen.
- Para relaciones entre módulos, puedes usar `graphify query`, `graphify path` o
  `graphify explain`.
- Después de modificar código, ejecuta `graphify update .` si la herramienta
  está disponible.

Graphify no sustituye la lectura de `AGENTS.md`, `CLAUDE.md` ni la verificación
directa del código. Si el grafo falta, está desactualizado o la herramienta
falla, continúa con inspección nativa del repositorio.
