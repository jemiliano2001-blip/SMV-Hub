---
title: Mejoras de UX y código para SMV Hub
date: 2026-07-22
status: propuesta priorizada
---

# Mejoras de UX y código para SMV Hub

## Conclusión ejecutiva

SMV Hub tiene una base funcional amplia, permisos detallados y buena cobertura de lógica crítica, pero la experiencia se degrada por tres patrones sistémicos: estados de carga/error no uniformes, consultas que crecerán sin paginación y módulos cliente demasiado grandes. El refactor profundo sí está justificado, pero debe ejecutarse como migración incremental por funciones, no como reescritura total.

La mejor inversión inicial no es un rediseño visual completo. Es crear una capa de confiabilidad percibida: feedback coherente, recuperación de errores, cargas predecibles, confirmaciones accesibles y pruebas de los recorridos diarios. Después se puede dividir arquitectura y datos sin que el usuario pague el costo de la transición.

## Prioridades principales

### 1. Confiabilidad visible en cada operación

No existen `loading.tsx`, `error.tsx` ni `not-found.tsx` en `app`, y hay 36 usos de `alert()` o `confirm()`. Se recomienda una base común con skeletons, errores recuperables, estados vacíos, `AlertDialog`, Sonner y mensajes accesibles con `role="status"`/`role="alert"`.

Resultado esperado: el usuario siempre sabe si una acción está pendiente, terminó, falló o puede reintentarse.

### 2. Datos escalables con paginación real

Muchas pantallas descargan colecciones completas con `getDocs()` y `orderBy()` sin `limit()` ni `startAfter()`. Ordenes, Requisiciones, Cotizaciones y Proveedores deben migrar primero a contratos de consulta paginados, con filtros aplicados antes de descargar datos.

Resultado esperado: tiempos de carga estables y menor costo de lecturas conforme crezca la operación.

### 3. Pruebas de recorridos críticos y accesibilidad

El repositorio tiene pruebas unitarias sólidas, pero no una capa E2E propia ni auditoría automatizada de accesibilidad. Incorporar Playwright + axe para autenticación, nueva compra, aprobación, Caja Chica, reportes y móvil. La automatización debe complementarse con navegación por teclado y pruebas manuales.

Resultado esperado: cambios profundos con una red de seguridad centrada en lo que realmente hace el usuario.

### 4. Menos JavaScript inicial

Aproximadamente 68% de los TSX son componentes cliente. No se encontraron `next/dynamic` ni `React.lazy`; además, `xlsx` se importa estáticamente en tres vistas de reportes. Conviene dejar shells de servidor y hojas cliente pequeñas, y cargar exportadores, modales y paneles pesados únicamente cuando se usen.

Resultado esperado: navegación más rápida, mejor respuesta en equipos modestos y menos costo de hidratación.

### 5. Refactor profundo por funciones

Proveedores supera 1,500 líneas y varios módulos rebasan 600–1,100 líneas. La división recomendada es `app/<modulo>/_components`, `_hooks`, `_actions` y una capa de repositorio/dominio en `lib`. Proveedores y Requisiciones son los mejores pilotos; Nueva Compra, Ordenes y Finanzas siguen después.

Resultado esperado: cambios más pequeños, pruebas focalizadas y menor riesgo de regresión.

## Principios del refactor

- Migrar una función completa de usuario a la vez.
- Mantener la interfaz actual mientras se cambia el interior.
- Evitar una capa genérica universal: compartir contratos de consulta, feedback y tablas, no reglas de negocio distintas.
- Medir antes y después con Web Vitals, trazas y duración de consultas.
- Conservar Firestore y Firebase Auth como límites explícitos; no filtrar datos sensibles en el cliente por conveniencia.
- Diseñar móvil, teclado y estados lentos desde el inicio.

## Oportunidades secundarias

- Acciones optimistas para cambios de estado, con rollback y error inline.
- Modo offline solo en dispositivos confiables para Almacén, Baños y Horas Extra; nunca por defecto en Finanzas o Administración.
- Query Explain e índices para consultas de servidor y cruces de proveedores.
- Normalizar patrones de tablas responsivas, objetivos táctiles y densidad visual.
- Corregir documentación obsoleta sobre Functions eliminadas, autenticación y `/importar`.

## Decisiones confirmadas por el propietario

- La aplicación todavía no tiene usuarios operativos; la primera medición será una línea base técnica.
- Proveedores será el piloto principal de experiencia y refactor.
- El personal usa computadoras; el propietario usa computadora y celular.
- Hay dispositivos personales y compartidos, por lo que offline persistente queda pospuesto.
- La ruta `/importar` debe eliminarse; los helpers compartidos pueden mantenerse si otros módulos los necesitan.
- Se autoriza telemetría anónima sin PII.
- Se aprueba comenzar con Fase 0 + Fase 1.

## Decisiones que faltan

1. ¿Cuántos documentos tiene hoy cada colección y cuánto crecerá en 12 meses?
2. ¿Qué calidad de red existe en taller y almacén?
3. ¿Qué objetivos se desean para LCP, INP y tiempo de confirmación de una acción?

La secuencia y estimaciones están en el [roadmap priorizado](roadmap-priorizado.md); la trazabilidad del diagnóstico está en [evidencia local](evidencia-local.md).
