---
title: Arquitectura híbrida por funciones
date: 2026-07-22
type: concept
---

# Arquitectura híbrida por funciones

## Definición

Una arquitectura híbrida conserva componentes cliente donde hay interacción inmediata, pero mueve el shell estable, composición y trabajo seguro al servidor. La unidad de refactor es una función de usuario completa, no una capa técnica global.

## Estructura objetivo orientativa

```text
app/proveedores/
  page.tsx                 # shell y composición
  loading.tsx
  error.tsx
  _components/
    ProveedoresTable.tsx
    ProveedorFilters.tsx
    ProveedorDetailDialog.tsx
  _hooks/
    useProveedorFilters.ts
    useProveedorMutations.ts
lib/proveedores/
  repository.ts            # consultas paginadas
  mutations.ts
  domain.ts
  schemas.ts
  intelligence.ts
```

Los nombres finales deben adaptarse al dominio; el valor está en separar responsabilidades y ofrecer puntos de prueba.

## Flujo de migración

1. Cubrir el recorrido actual con E2E.
2. Extraer una función sin cambiar su interfaz.
3. Introducir el contrato paginado o de mutación.
4. Reducir la frontera `use client`.
5. Medir bundle, tiempo y errores.
6. Retirar el código antiguo cuando exista paridad.

## Qué compartir

- contratos de página/cursor;
- estados de operación y errores tipados;
- feedback accesible;
- primitives de tabla, diálogo y formulario;
- políticas de telemetría sin PII.

## Qué no forzar a compartir

- reglas de permisos distintas;
- validaciones financieras y operativas;
- semántica de estados de cada módulo;
- transformaciones Odoo/SAT;
- modelos de edición que no tienen el mismo ciclo de vida.

## Pilotos

Proveedores es el mejor piloto estructural por tamaño y diversidad de funciones. Requisiciones es el segundo por complejidad de estado. Caja Chica u Ordenes pueden servir como piloto temprano de shell híbrido porque sus recorridos son más acotados.

