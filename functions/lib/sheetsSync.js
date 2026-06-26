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
exports.importFromGoogleSheets = exports.exportToGoogleSheets = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const googleapis_1 = require("googleapis");
const zod_1 = require("zod");
const auth_1 = require("./auth");
const db = admin.firestore();
// We expect the Service Account credentials to be provided via Firebase config or environment variables
// Example using Application Default Credentials
const auth = new googleapis_1.google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
const exportSchema = zod_1.z.object({
    spreadsheetId: zod_1.z.string(),
    range: zod_1.z.string().default('Sheet1!A1'),
});
/**
 * Callable function to export the current products list to a Google Sheet.
 */
exports.exportToGoogleSheets = functions.https.onCall(async (data, context) => {
    (0, auth_1.assertAuthorizedCallable)(context);
    const parseResult = exportSchema.safeParse(data);
    if (!parseResult.success) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid spreadsheet config', parseResult.error.format());
    }
    const { spreadsheetId, range } = parseResult.data;
    try {
        const productsSnap = await db.collection('products').get();
        // Define headers
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
        // Clear existing data before appending
        await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range,
        });
        // Write data to sheet
        const result = await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: rows,
            },
        });
        return { success: true, updatedCells: result.data.updatedCells };
    }
    catch (error) {
        console.error('Error exporting to Google Sheets:', (0, auth_1.errorMessage)(error));
        throw new functions.https.HttpsError('internal', 'Export failed');
    }
});
const importSchema = zod_1.z.object({
    spreadsheetId: zod_1.z.string(),
    range: zod_1.z.string().default('Sheet1!A2:F'), // skip header
});
/**
 * Callable function to import products from a Google Sheet to Firestore.
 * Expects columns: ID | SKU | Name | Stock | Price | Preferred Supplier
 */
exports.importFromGoogleSheets = functions.https.onCall(async (data, context) => {
    (0, auth_1.assertAuthorizedCallable)(context);
    const parseResult = importSchema.safeParse(data);
    if (!parseResult.success) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid spreadsheet config', parseResult.error.format());
    }
    const { spreadsheetId, range } = parseResult.data;
    try {
        const result = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });
        const rows = result.data.values;
        if (!rows || rows.length === 0) {
            return { success: true, message: 'No data found.' };
        }
        const batch = db.batch();
        let importedCount = 0;
        for (const row of rows) {
            // Row format: [id, sku, name, stock, price, preferredSupplier]
            const docId = row[0];
            const sku = row[1];
            const name = row[2];
            if (!sku || !name)
                continue;
            const stock = parseInt(row[3], 10) || 0;
            const price = parseFloat(row[4]) || 0;
            const preferredSupplier = row[5] || '';
            const docRef = docId ? db.collection('products').doc(docId) : db.collection('products').doc();
            batch.set(docRef, {
                sku,
                name,
                stock,
                price,
                preferredSupplier,
                lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            importedCount++;
        }
        await batch.commit();
        return { success: true, importedCount };
    }
    catch (error) {
        console.error('Error importing from Google Sheets:', (0, auth_1.errorMessage)(error));
        throw new functions.https.HttpsError('internal', 'Import failed');
    }
});
