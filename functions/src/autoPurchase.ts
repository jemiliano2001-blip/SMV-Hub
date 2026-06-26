import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { QueryDocumentSnapshot } from 'firebase-admin/firestore';

admin.initializeApp();
const db = admin.firestore();

// Schema for product documents (adjust fields as needed)
const productSchema = z.object({
  sku: z.string(),
  name: z.string(),
  stock: z.number(),
  reorderThreshold: z.number().optional().default(10),
  preferredSupplier: z.string().optional(),
  price: z.number().optional(),
});

/**
 * Cloud Scheduler function that runs every 15 minutes.
 * It scans the `products` collection for items whose stock is below the
 * `reorderThreshold` and creates an order document in the `orders`
 * collection. The order contains minimal required fields; further enrichment
 * (e.g., recommendation, email) can be added later.
 */
export const autoPurchase = functions.pubsub
  .schedule('every 15 minutes')
  .onRun(async (context: functions.EventContext) => {
    console.log('Auto‑purchase trigger fired');
    const productSnap = await db.collection('products').get();
    const batch = db.batch();
    let createdOrders = 0;

    productSnap.forEach((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      const parseResult = productSchema.safeParse(data);
      if (!parseResult.success) {
        console.warn(`Invalid product data in ${doc.id}`, parseResult.error.format());
        return;
      }
      const product = parseResult.data;
      const threshold = product.reorderThreshold ?? 10;
      if (product.stock <= threshold) {
        const orderRef = db.collection('orders').doc();
        const order = {
          productId: doc.id,
          sku: product.sku,
          name: product.name,
          quantity: threshold * 2, // simple heuristic: order double the threshold
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'pending',
          requestedBy: 'autoPurchase',
        };
        batch.set(orderRef, order);
        createdOrders++;
      }
    });

    if (createdOrders > 0) {
      await batch.commit();
      console.log(`Created ${createdOrders} auto‑purchase orders`);
    } else {
      console.log('No products needed re‑ordering at this time');
    }
    return null;
  });
