"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportToExcel = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const microsoft_graph_client_1 = require("@microsoft/microsoft-graph-client");
const msal_node_1 = require("@azure/msal-node");
const zod_1 = require("zod");
const auth_1 = require("./auth");
const db = admin.firestore();
// MS Graph configuration (should be stored in environment variables/secrets)
const msalConfig = {
    auth: {
        clientId: process.env.MS_GRAPH_CLIENT_ID || 'YOUR_CLIENT_ID',
        authority: `https://login.microsoftonline.com/${process.env.MS_GRAPH_TENANT_ID || 'YOUR_TENANT_ID'}`,
        clientSecret: process.env.MS_GRAPH_CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
    }
};
const tokenRequest = {
    scopes: ['https://graph.microsoft.com/.default'],
};
async function getGraphClient() {
    const cca = new msal_node_1.ConfidentialClientApplication(msalConfig);
    const authResponse = await cca.acquireTokenByClientCredential(tokenRequest);
    if (!authResponse || !authResponse.accessToken) {
        throw new Error('Failed to acquire token from MSAL');
    }
    return microsoft_graph_client_1.Client.init({
        authProvider: (done) => {
            done(null, authResponse.accessToken);
        }
    });
}
const exportSchema = zod_1.z.object({
    workbookId: zod_1.z.string(), // The item ID of the Excel file in OneDrive/SharePoint
    worksheetName: zod_1.z.string().default('Sheet1'),
});
/**
 * Callable function to export products to Microsoft Excel Online via MS Graph API.
 */
exports.exportToExcel = functions.https.onCall(async (data, context) => {
    (0, auth_1.assertAuthorizedCallable)(context);
    const parseResult = exportSchema.safeParse(data);
    if (!parseResult.success) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid Excel config', parseResult.error.format());
    }
    const { workbookId, worksheetName } = parseResult.data;
    try {
        const graphClient = await getGraphClient();
        const productsSnap = await db.collection('products').get();
        // Headers + Data
        const rows = [['ID', 'SKU', 'Name', 'Stock', 'Price', 'Preferred Supplier']];
        productsSnap.forEach(doc => {
            const p = doc.data();
            rows.push([
                doc.id,
                p.sku || '',
                p.name || '',
                p.stock || 0,
                p.price || 0,
                p.preferredSupplier || ''
            ]);
        });
        // Write to Excel table or range
        // A more robust implementation would check if a table exists, clear it, and append.
        // For simplicity, we write to a specific range.
        const rangeAddress = `A1:F${rows.length}`;
        await graphClient
            .api(`/me/drive/items/${workbookId}/workbook/worksheets('${worksheetName}')/range(address='${rangeAddress}')`)
            .patch({
            values: rows
        });
        return { success: true, rowsExported: rows.length - 1 };
    }
    catch (error) {
        console.error('Error exporting to MS Excel:', (0, auth_1.errorMessage)(error));
        throw new functions.https.HttpsError('internal', 'Excel Export failed');
    }
});
