# Checklist memoria cliente SMV Hub

Medir en Chrome → More tools → Task manager (o Performance monitor), sobre
build de producción o `smv-hub.web.app` (no solo `next dev`).

## Flujo baseline
1. Abrir sesión limpia (pestaña nueva).
2. home → `/ordenes` → `/proveedores` → `/reportes` (tab gerencial) → home.
3. Anotar MB de la pestaña al final.
4. Repetir el ciclo 2 veces más; anotar si sigue subiendo.

| Momento | MB | Notas |
|---------|-----|-------|
| Baseline pre-fix | | Medir en prod/build antes de desplegar este branch |
| Post Fase 1 | | Auto full-scans cortados; scorecards 12 meses |
| Post Fase 2 | | Reportes por rango; cotizaciones paginadas; SAT helper sin catálogo en cliente |
