"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ejecutarComandoCasoIntegridad = exports.obtenerCasoIntegridad = exports.listarCasosIntegridad = exports.syncOdooVentasManual = exports.syncOdooVentasScheduled = exports.syncOdooComprasManual = exports.syncOdooComprasScheduled = exports.syncOdooFacturasManual = exports.syncOdooFacturasScheduled = void 0;
const app_1 = require("firebase-admin/app");
// Debe ejecutarse antes de cualquier import que llame a getFirestore() a
// nivel de módulo (odooSync.ts y odoo-compras-sync.ts lo hacen para su
// constante `db`) — sin esto, tanto el runtime real como la fase de
// "discovery" local de `firebase deploy` (que hace require() de este mismo
// bundle para introspeccionar los triggers) truenan con
// "The default Firebase app does not exist."
(0, app_1.initializeApp)();
var odooSync_1 = require("./odooSync");
Object.defineProperty(exports, "syncOdooFacturasScheduled", { enumerable: true, get: function () { return odooSync_1.syncOdooFacturasScheduled; } });
Object.defineProperty(exports, "syncOdooFacturasManual", { enumerable: true, get: function () { return odooSync_1.syncOdooFacturasManual; } });
var odoo_compras_sync_1 = require("./odoo-compras-sync");
Object.defineProperty(exports, "syncOdooComprasScheduled", { enumerable: true, get: function () { return odoo_compras_sync_1.syncOdooComprasScheduled; } });
Object.defineProperty(exports, "syncOdooComprasManual", { enumerable: true, get: function () { return odoo_compras_sync_1.syncOdooComprasManual; } });
var odoo_ventas_sync_1 = require("./odoo-ventas-sync");
Object.defineProperty(exports, "syncOdooVentasScheduled", { enumerable: true, get: function () { return odoo_ventas_sync_1.syncOdooVentasScheduled; } });
Object.defineProperty(exports, "syncOdooVentasManual", { enumerable: true, get: function () { return odoo_ventas_sync_1.syncOdooVentasManual; } });
var api_1 = require("./reportes-integridad/api");
Object.defineProperty(exports, "listarCasosIntegridad", { enumerable: true, get: function () { return api_1.listarCasosIntegridad; } });
Object.defineProperty(exports, "obtenerCasoIntegridad", { enumerable: true, get: function () { return api_1.obtenerCasoIntegridad; } });
Object.defineProperty(exports, "ejecutarComandoCasoIntegridad", { enumerable: true, get: function () { return api_1.ejecutarComandoCasoIntegridad; } });
