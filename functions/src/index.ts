import { initializeApp } from "firebase-admin/app";

// Debe ejecutarse antes de cualquier import que llame a getFirestore() a
// nivel de módulo (odooSync.ts y odoo-compras-sync.ts lo hacen para su
// constante `db`) — sin esto, tanto el runtime real como la fase de
// "discovery" local de `firebase deploy` (que hace require() de este mismo
// bundle para introspeccionar los triggers) truenan con
// "The default Firebase app does not exist."
initializeApp();

export { syncOdooFacturasScheduled, syncOdooFacturasManual } from "./odooSync";
export { syncOdooComprasScheduled, syncOdooComprasManual } from "./odoo-compras-sync";
export { syncOdooVentasScheduled, syncOdooVentasManual } from "./odoo-ventas-sync";
export {
  listarCasosIntegridad,
  obtenerCasoIntegridad,
  ejecutarComandoCasoIntegridad,
} from "./reportes-integridad/api";
