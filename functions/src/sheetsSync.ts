import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { google } from 'googleapis';
import { z } from 'zod';
import { assertAuthorizedCallable, errorMessage } from './auth';

const db = admin.firestore();

// We expect the Service Account credentials to be provided via Firebase config or environment variables
// Example using Application Default Credentials
const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const exportSchema = z.object({
  spreadsheetId: z.string(),
  range: z.string().default('Sheet1!A1'),
});

/**
 * Callable function to export the current products list to a Google Sheet.
 */
export const exportToGoogleSheets = functions.https.onCall(async (data, context) => {
  await assertAuthorizedCallable(context);

  const parseResult = exportSchema.safeParse(data);
  if (!parseResult.success) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid spreadsheet config', parseResult.error.format());
  }

  const { spreadsheetId, range } = parseResult.data;

  try {
    const productsSnap = await db.collection('products').get();
    
    // Define headers
    const rows: (string | number)[][] = [['ID', 'SKU', 'Name', 'Stock', 'Price', 'Preferred Supplier']];

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
  } catch (error: unknown) {
    console.error('Error exporting to Google Sheets:', errorMessage(error));
    throw new functions.https.HttpsError('internal', 'Export failed');
  }
});

const importSchema = z.object({
  spreadsheetId: z.string(),
  range: z.string().default('Sheet1!A2:F'), // skip header
});

/**
 * Callable function to import products from a Google Sheet to Firestore.
 * Expects columns: ID | SKU | Name | Stock | Price | Preferred Supplier
 */
export const importFromGoogleSheets = functions.https.onCall(async (data, context) => {
  await assertAuthorizedCallable(context);

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
      
      if (!sku || !name) continue;

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
  } catch (error: unknown) {
    console.error('Error importing from Google Sheets:', errorMessage(error));
    throw new functions.https.HttpsError('internal', 'Import failed');
  }
});
