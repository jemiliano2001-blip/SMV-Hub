---
title: Acciones y estados en React
date: 2026-07-22
type: source-synthesis
---

# Acciones y estados en React

## Fuentes oficiales

- [useOptimistic](https://react.dev/reference/react/useOptimistic)
- [useActionState](https://react.dev/reference/react/useActionState)
- [useTransition](https://react.dev/reference/react/useTransition)

## Patrones útiles

`useOptimistic` permite mostrar inmediatamente el resultado esperado mientras una acción está pendiente. Si la operación falla, el estado confirmado vuelve a prevalecer. Es adecuado para cambios rápidos de estatus, verificación, marcado y creación simple.

`useActionState` combina el último resultado de la acción con `isPending`, lo que favorece errores inline y botones que expresan su estado. Los fallos esperados deben convertirse en resultados comprensibles; los inesperados deben alcanzar el Error Boundary más cercano.

`useTransition` mantiene interacciones responsivas cuando una actualización puede renderizar trabajo significativo en segundo plano.

## Aplicación a SMV Hub

Buenos candidatos:

- verificar un movimiento de Caja Chica;
- cambiar estado de una requisición u orden;
- asignar o desvincular un proveedor;
- guardar una edición pequeña;
- aplicar filtros costosos sin bloquear escritura.

No usar optimismo sin diseño de rollback en:

- operaciones financieras irreversibles;
- cargas de comprobantes;
- sincronización con Odoo;
- acciones que dependan de reglas o permisos complejos no conocidos por el cliente.

## Contrato recomendado

Cada mutación debe declarar estado pendiente, resultado confirmado, error recuperable y mecanismo de reintento. La interfaz no debe confundir “enviado” con “persistido”. En listas paginadas, el rollback debe conservar el orden y cursor actuales.

