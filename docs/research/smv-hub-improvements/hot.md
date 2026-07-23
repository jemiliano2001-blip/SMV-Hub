---
title: Hallazgos calientes
date: 2026-07-22
status: activo
---

# Hallazgos calientes

## Acciones inmediatas

1. Ejecutar el E2E autenticado de Proveedores con Google Sign-In real.
2. Ampliar E2E a los recorridos críticos que todavía no tienen cobertura de navegador.
3. Unificar los hooks de Requisiciones y definir el orden Firestore de Cotizaciones antes de extenderles el contrato con cursor ya usado en Proveedores y Órdenes.
4. Medir la línea base de Web Vitals cuando exista tráfico real.
5. Continuar la división incremental de Proveedores después de validar el piloto paginado con autenticación real.

## Riesgos que pueden crecer rápido

- Colecciones completas descargadas en cada visita.
- Proveedores/Requisiciones demasiado grandes para cambios seguros.
- Importación estática de librerías de exportación.
- Documentación contradictoria sobre autenticación y Functions.
- Caché offline aplicada sin distinguir dispositivos confiables.

## Ganancias rápidas

- Import dinámico de `xlsx` al hacer click en exportar.
- Estados de error con reintento en rutas financieras y operativas.
- Unificar toasts y confirmaciones con primitives existentes.
- Añadir etiquetas accesibles y tamaño táctil a iconos de acción.
- Establecer límites explícitos incluso antes de la paginación visual.

## Regla de ejecución

No iniciar una reescritura transversal. Migrar un recorrido completo, comparar métricas, estabilizar y repetir. Proveedores es el piloto estructural; Caja Chica u Ordenes son buenos pilotos de experiencia y fronteras de renderizado.

## Decisión tomada

El propietario aprobó Fase 0 + Fase 1 como un bloque: línea base, E2E, feedback y estados de ruta. Proveedores es el piloto; `/importar` se retira y el modo offline queda pospuesto por el uso de dispositivos compartidos.
