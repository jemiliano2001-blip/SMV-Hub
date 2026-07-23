---
title: Roadmap priorizado de mejoras
date: 2026-07-22
status: propuesto
---

# Roadmap priorizado

## Avance de implementación — 2026-07-22

- Fase 0 iniciada: Web Vitals anónimos, documentación técnica corregida y baseline de build/pruebas.
- Fase 1 avanzada: estados globales y de Proveedores para carga/error, Playwright + axe en escritorio/móvil y cero `alert()`/`confirm()` nativos.
- Pendiente para cerrar la validación de Proveedores: ejecutar el recorrido E2E autenticado con un `storageState` obtenido mediante Google Sign-In real.
- Fase 2 iniciada: el Directorio de Proveedores usa páginas Firestore por mercado con cursor, carga incremental y catálogo completo bajo demanda para filtros e inteligencia.
- Primera división incremental de Proveedores: filtro/orden de dominio, repositorio paginado y hook de directorio quedaron separados de la página principal.
- Órdenes migrado a páginas Firestore de 50 registros, conteo agregado y carga completa únicamente para filtros e historial SAT.
- Requisiciones requiere unificar sus dos hooks antes de paginar; Cotizaciones requiere alinear el orden persistido con su orden global por fecha/relevancia.
- Siguiente bloque: estabilizar los pilotos autenticados y unificar la fuente de Requisiciones antes de extender el contrato.

## Matriz de decisión

| Orden | Iniciativa | UX | Técnica | Esfuerzo | Riesgo | Fase |
|---:|---|---:|---:|---|---|---|
| 1 | Feedback, carga y recuperación de errores | 5 | 4 | M | Bajo | 1 |
| 2 | Paginación y capa de consultas Firestore | 5 | 5 | L | Medio | 2 |
| 3 | E2E y accesibilidad de recorridos críticos | 4 | 5 | M | Bajo | 1 |
| 4 | Lazy loading y fronteras cliente pequeñas | 4 | 4 | M | Medio | 2 |
| 5 | Refactor por funciones de módulos gigantes | 4 | 5 | XL | Medio-alto | 3 |
| 6 | Web Vitals y observabilidad de UX | 4 | 4 | M | Bajo | 0 |
| 7 | Mutaciones optimistas con rollback | 5 | 3 | M | Medio | 2 |
| 8 | Offline en dispositivo confiable | 4 | 3 | L | Medio-alto | 4 |
| 9 | Documentación como fuente de verdad | 2 | 4 | S | Bajo | 0 |
| 10 | Query Explain e índices | 3 | 4 | M | Bajo-medio | 2 |
| 11 | Sistema visual y tablas responsivas | 4 | 3 | L | Bajo-medio | 3 |

Escala de impacto: 1 bajo, 5 muy alto. Las estimaciones deben recalibrarse con volumen real de datos y frecuencia de uso.

## Fase 0 — línea base y verdad técnica (1 semana)

- Medir Web Vitals y tiempos de los cinco recorridos principales.
- Definir presupuestos de carga, interacción y tamaño por ruta.
- Registrar trazas sin PII para cargas Firestore, extracción, exportación y sincronización.
- Corregir contradicciones de `CLAUDE.md`/`PROJECT.md` y documentar `/importar` como oculto o retirado.
- Capturar datos iniciales: volumen por colección, lecturas y consultas más lentas.

Salida: tablero de línea base y decisiones documentadas.

## Fase 1 — UX confiable y red de seguridad (1–2 semanas)

- Añadir `loading.tsx` y `error.tsx` por grupos de rutas críticas.
- Crear estados estándar: loading, vacío, error recuperable y acceso denegado.
- Crear un servicio/hook de feedback usando AlertDialog + Sonner.
- Sustituir primero alertas nativas en Caja Chica, Ordenes, Requisiciones y Nueva Compra.
- Añadir Playwright + axe en autenticación, compra, aprobación, Caja Chica, reportes y viewport móvil.

Salida: recorridos críticos observables, accesibles y protegidos por E2E.

## Fase 2 — rendimiento y datos (3–5 semanas)

- Introducir repositorios paginados con `limit` + `startAfter`.
- Aplicar filtros y permisos antes de transferir datos cuando sea posible.
- Añadir estados optimistas con rollback en mutaciones frecuentes.
- Cargar `xlsx`, modales y paneles de inteligencia bajo demanda.
- Pilotar shells de servidor con hojas cliente en Ordenes y Caja Chica.
- Usar Query Explain para consultas de servidor e índices críticos.

Salida: tiempo de carga estable y menos JavaScript/lecturas innecesarias.

## Fase 3 — refactor profundo incremental (4–8 semanas)

- Dividir Proveedores y Requisiciones por funciones de usuario.
- Continuar con Nueva Compra, Ordenes y Finanzas.
- Consolidar contratos de tabla, consulta, formulario y feedback.
- Normalizar densidad, responsive, foco y objetivos táctiles de 24 × 24 px como mínimo.
- Eliminar duplicación solo después de observar dos o más implementaciones equivalentes.

Salida: módulos pequeños, testeables y consistentes sin interrupción tipo “big bang”.

## Fase 4 — capacidades avanzadas (2–4 semanas)

- Evaluar offline persistente solo en dispositivos confiables.
- Mostrar estado online/offline y datos provenientes de caché.
- Ajustar índices y consultas con datos reales de producción.
- Ejecutar pruebas con usuarios de taller, compras, almacén y finanzas.

Salida: resiliencia de operación y mejoras guiadas por uso real.

## Criterios de éxito sugeridos

- Cero `alert()`/`confirm()` en recorridos críticos.
- Cero consulta de lista sin límite explícito o justificación documentada.
- E2E estable para los seis recorridos prioritarios.
- 100% de rutas críticas con carga, vacío y error recuperable.
- Reducción medible de JavaScript inicial en Proveedores, Requisiciones y reportes.
- Ninguna caché persistente de Finanzas/Administración sin consentimiento explícito.
