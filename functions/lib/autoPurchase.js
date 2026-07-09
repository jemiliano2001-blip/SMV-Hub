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
exports.autoPurchase = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const zod_1 = require("zod");
admin.initializeApp();
const db = admin.firestore();
// Schema for product documents (adjust fields as needed)
const productSchema = zod_1.z.object({
    sku: zod_1.z.string(),
    name: zod_1.z.string(),
    stock: zod_1.z.number(),
    reorderThreshold: zod_1.z.number().optional().default(10),
    preferredSupplier: zod_1.z.string().optional(),
    price: zod_1.z.number().optional(),
});
/**
 * Cloud Scheduler function that runs every 15 minutes.
 * It scans the `products` collection for items whose stock is below the
 * `reorderThreshold` and creates an order document in the `orders`
 * collection. The order contains minimal required fields; further enrichment
 * (e.g., recommendation, email) can be added later.
 */
exports.autoPurchase = functions.pubsub
    .schedule('every 15 minutes')
    .onRun(async () => {
    console.log('Auto‑purchase trigger fired');
    const productSnap = await db.collection('products').get();
    const batch = db.batch();
    let createdOrders = 0;
    productSnap.forEach((doc) => {
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
    }
    else {
        console.log('No products needed re‑ordering at this time');
    }
    return null;
});
