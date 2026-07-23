---
title: Sistema de feedback de operaciones
date: 2026-07-22
type: concept
---

# Sistema de feedback de operaciones

## Objetivo

Toda acción debe responder cuatro preguntas sin ambigüedad:

1. ¿La aplicación recibió mi intención?
2. ¿La operación sigue pendiente?
3. ¿Quedó confirmada y persistida?
4. Si falló, ¿qué puedo hacer ahora?

## Modelo sugerido

```ts
type OperationState<T> =
  | { status: "idle" }
  | { status: "pending"; optimistic?: T }
  | { status: "success"; data: T; message?: string }
  | { status: "error"; error: AppError; retryable: boolean };
```

`AppError` debe distinguir al menos validación, permiso, red, conflicto, dependencia externa y error desconocido. El texto mostrado al usuario no debe exponer detalles internos.

## Canales de comunicación

| Situación | Componente |
|---|---|
| Confirmar acción destructiva | AlertDialog con foco controlado |
| Éxito no crítico | Toast Sonner + estado actualizado |
| Error asociado a campo | Mensaje inline |
| Error recuperable de sección | Panel con reintento |
| Fallo inesperado de ruta | `error.tsx` |
| Proceso prolongado | Estado persistente con progreso/pending |
| Datos de caché | Badge de conexión y antigüedad |

## Reglas

- Nunca usar solo color para comunicar resultado.
- No deshabilitar sin explicar qué está ocurriendo.
- Evitar toasts como único registro de una operación crítica.
- Devolver el foco al origen al cerrar diálogos.
- Exponer cambios inline con `role="status"` y errores urgentes con `role="alert"` cuando corresponda.
- Mantener mensajes consistentes entre módulos.

## Implantación

Crear primero una API mínima sobre los componentes ya existentes. Migrar Caja Chica, Ordenes y Requisiciones; observar necesidades reales; después generalizar. El objetivo no es una abstracción sofisticada, sino eliminar 36 diálogos nativos y duplicación de estados sin perder contexto de negocio.

