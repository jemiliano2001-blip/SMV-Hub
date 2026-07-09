# Project: SMV Hub

Plataforma interna de SMV Maquinados — compras, diseño y operación del taller.
Este archivo contiene el panorama del estado y las metas a alto nivel del proyecto.
(Nota: Para reglas de IA, referirse a `CLAUDE.md`. El repo y la BD Firestore conservan
el identificador técnico `compras-americanas`.)

## 🏗️ Arquitectura y Base

- **Framework:** Next.js 16 (App Router)
- **State & BD:** Firebase Firestore (Reglas de seguridad estrictas)
- **Styling:** Tailwind CSS v4 + Lucide Icons
- **Calidad de Código:** Verificación automatizada con Vitest (pruebas) y ESLint estricto.

## 🗺️ Code Layout

- `app/` - Componentes de interfaz de usuario de Next.js, rutas y Server Actions.
  - Subdirectorios por módulo: `/almacen`, `/banos`, `/cotizaciones`, `/horas-extra`, `/importar`, `/nueva-compra`, `/operadores`, `/ordenes`, `/ordenes-servicio`, `/reportes`, `/requisiciones`.
- `lib/` - Funciones utilitarias puras, esquemas de Zod (`schemas.ts`), helpers de Firestore y lógica de negocio.
- `lib/hooks/` - Custom React hooks para fetching y mutación interactiva con la base de datos (e.g. `useBanos.ts`, `useOrdenes.ts`).
- `tests/` - Archivos de prueba para Vitest (mayormente lógica pura).
- `functions/` - Cloud Functions de Firebase.

## 🏁 Milestones & Seguimiento

| # | Hito | Alcance | Estado |
|---|---|---|---|
| 1 | Baseline & ESLint Fixes | Arreglo de la base de código inicial y chequeos estrictos | ✅ DONE |
| 2 | `/ordenes` | Listado, edición inline, detalles y tracking en vivo de OCs | ✅ DONE |
| 3 | `/importar` | Subida de CSV (McMaster/Grainger), validación por filas y carga batch | ✅ DONE |
| 4 | Vitest Suite | Expansión de test suite para lógica pura de `lib/` | ✅ DONE |
| 5 | Migración de Excel Operativo | Creación de módulos de `/almacen`, `/banos`, `/horas-extra` y `/operadores` con reportes automáticos | ✅ DONE |
| 6 | Auditoría Continua | Verificación de que todos los tests, lints y builds pasen sin advertencias | ✅ DONE |
| 7 | Exportación y Utilidades | Envío de reportes por correo, exportación a PDF optimizada, órdenes recurrentes y sugerencias inteligentes de compras | ✅ DONE |

## 📝 Notas Activas

- Los módulos operativos (Hito 5) aislaron la información general de SMV en colecciones propias en Firestore, reemplazando fórmulas frágiles del antiguo archivo Excel.
- Las métricas de tiempos (Baños) y cálculos de Horas Extra se calculan dinámicamente con memoización en el cliente sin guardarse redundantemente.
