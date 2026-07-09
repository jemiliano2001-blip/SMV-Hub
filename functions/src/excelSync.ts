import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Client } from '@microsoft/microsoft-graph-client';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { z } from 'zod';
import { assertAuthorizedCallable, errorMessage } from './auth';

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
  const cca = new ConfidentialClientApplication(msalConfig);
  const authResponse = await cca.acquireTokenByClientCredential(tokenRequest);
  
  if (!authResponse || !authResponse.accessToken) {
    throw new Error('Failed to acquire token from MSAL');
  }

  return Client.init({
    authProvider: (done) => {
      done(null, authResponse.accessToken);
    }
  });
}

const exportSchema = z.object({
  workbookId: z.string(), // The item ID of the Excel file in OneDrive/SharePoint
  worksheetName: z.string().default('Sheet1'),
});

/**
 * Callable function to export products to Microsoft Excel Online via MS Graph API.
 */
export const exportToExcel = functions.https.onCall(async (data, context) => {
  await assertAuthorizedCallable(context);

  const parseResult = exportSchema.safeParse(data);
  if (!parseResult.success) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid Excel config', parseResult.error.format());
  }

  const { workbookId, worksheetName } = parseResult.data;

  try {
    const graphClient = await getGraphClient();
    const productsSnap = await db.collection('products').get();
    
    // Headers + Data
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
  } catch (error: unknown) {
    console.error('Error exporting to MS Excel:', errorMessage(error));
    throw new functions.https.HttpsError('internal', 'Excel Export failed');
  }
});
