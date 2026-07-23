"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncOdooComprasManual = exports.syncOdooComprasScheduled = exports.syncOdooFacturasManual = exports.syncOdooFacturasScheduled = void 0;
var odooSync_1 = require("./odooSync");
Object.defineProperty(exports, "syncOdooFacturasScheduled", { enumerable: true, get: function () { return odooSync_1.syncOdooFacturasScheduled; } });
Object.defineProperty(exports, "syncOdooFacturasManual", { enumerable: true, get: function () { return odooSync_1.syncOdooFacturasManual; } });
var odoo_compras_sync_1 = require("./odoo-compras-sync");
Object.defineProperty(exports, "syncOdooComprasScheduled", { enumerable: true, get: function () { return odoo_compras_sync_1.syncOdooComprasScheduled; } });
Object.defineProperty(exports, "syncOdooComprasManual", { enumerable: true, get: function () { return odoo_compras_sync_1.syncOdooComprasManual; } });
