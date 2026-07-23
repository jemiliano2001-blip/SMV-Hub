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
  - Subdirectorios por módulo: `/almacen`, `/auditoria`, `/banos`, `/caja-chica`, `/claves-sat`, `/cotizaciones`, `/finanzas`, `/horas-extra`, `/login`, `/nueva-compra`, `/operadores`, `/ordenes`, `/ordenes-servicio`, `/proveedores`, `/reportes` (incl. `/reportes/contable`), `/requisiciones`, `/usuarios`.
- `lib/` - Funciones utilitarias puras, esquemas de Zod (`schemas.ts`), helpers de Firestore y lógica de negocio.
- `lib/hooks/` - Custom React hooks para fetching y mutación interactiva con la base de datos (e.g. `useBanos.ts`, `useOrdenes.ts`).
- `tests/` - Archivos de prueba para Vitest (mayormente lógica pura).
- `functions/` - Cloud Functions de Firebase.

## 🏁 Milestones & Seguimiento

| # | Hito | Alcance | Estado |
|---|---|---|---|
| 1 | Baseline & ESLint Fixes | Arreglo de la base de código inicial y chequeos estrictos | ✅ DONE |
| 2 | `/ordenes` | Listado, edición inline, detalles y tracking en vivo de OCs | ✅ DONE |
| 3 | Importación masiva legacy | La ruta `/importar` fue retirada; los parsers compartidos siguen soportando Nueva Compra y Cotizaciones | 🗑️ RETIRED |
| 4 | Vitest Suite | Expansión de test suite para lógica pura de `lib/` | ✅ DONE |
| 5 | Migración de Excel Operativo | Creación de módulos de `/almacen`, `/banos`, `/horas-extra` y `/operadores` con reportes automáticos | ✅ DONE |
| 6 | Auditoría Continua | Verificación de que todos los tests, lints y builds pasen sin advertencias | ✅ DONE |
| 7 | Exportación y Utilidades | Envío de reportes por correo, exportación a PDF optimizada, órdenes recurrentes y sugerencias inteligentes de compras | ✅ DONE |
| 8 | Roles y Accesos | `/usuarios` (altas/bajas, roles, custom claims de Firebase Auth), Google Sign-In persistente y gating por rol en `AuthGuard`/`NavBar` | ✅ DONE |
| 9 | Seguimiento Extendido | `/cotizaciones`, `/requisiciones` (semáforo de atrasos), `/ordenes-servicio` (hoja Fisher) y `/claves-sat` (buscador + sugerencia IA integrada a órdenes) | ✅ DONE |
| 10 | Finanzas y Caja Chica | `/finanzas` (facturación y cobranza sincronizada con Odoo) y `/caja-chica` (movimientos y arqueo), exclusivos de rol `admin` | ✅ DONE |
| 11 | Cierre Contable IA | `/reportes/contable`: agrupación de órdenes por lote, traducción y sugerencia/reasignación de claves SAT en batch vía IA | ✅ DONE |

## 📝 Notas Activas

- Los módulos operativos (Hito 5) aislaron la información general de SMV en colecciones propias en Firestore, reemplazando fórmulas frágiles del antiguo archivo Excel.
- Las métricas de tiempos (Baños) y cálculos de Horas Extra se calculan dinámicamente con memoización en el cliente sin guardarse redundantemente.
