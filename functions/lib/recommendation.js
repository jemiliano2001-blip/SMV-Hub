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
exports.recommendProvider = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const zod_1 = require("zod");
const vertexai_1 = require("@google-cloud/vertexai");
const auth_1 = require("./auth");
const db = admin.firestore();
// Initialize Vertex AI with the current project ID and location
// Using gemini-1.5-pro for reasoning tasks like supplier recommendations
const vertexAI = new vertexai_1.VertexAI({
    project: process.env.GCLOUD_PROJECT || 'smv-brain', // Defaults to current project
    location: 'us-central1'
});
const generativeModel = vertexAI.preview.getGenerativeModel({
    model: 'gemini-3.5-flash',
    generationConfig: {
        temperature: 0.2, // Low temperature for deterministic, analytical results
        maxOutputTokens: 1024,
    },
});
const requestSchema = zod_1.z.object({
    sku: zod_1.z.string(),
    name: zod_1.z.string(),
    quantity: zod_1.z.number(),
    // History of past purchases or known prices from suppliers
    supplierData: zod_1.z.array(zod_1.z.object({
        supplierName: zod_1.z.string(),
        price: zod_1.z.number(),
        leadTimeDays: zod_1.z.number(),
        rating: zod_1.z.number().optional(),
    })).min(1)
});
/**
 * Callable Cloud Function that uses Vertex AI to recommend the best supplier
 * based on price, lead time, and historical rating.
 */
exports.recommendProvider = functions.https.onCall(async (data, context) => {
    (0, auth_1.assertAuthorizedCallable)(context);
    const parseResult = requestSchema.safeParse(data);
    if (!parseResult.success) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid request payload', parseResult.error.format());
    }
    const { sku, name, quantity, supplierData } = parseResult.data;
    // Construct the prompt for the LLM
    const prompt = `
  You are an expert procurement analyst. 
  Please recommend the best supplier for the product: "${name}" (SKU: ${sku}), for a total quantity of ${quantity}.

  Here is the data for the available suppliers:
  ${JSON.stringify(supplierData, null, 2)}

  Consider the following factors:
  1. Total Cost (price * quantity)
  2. Lead Time (faster is generally better, but balance with cost)
  3. Supplier Rating (if available, higher is better)

  Provide your response as a JSON object with the following structure exactly (no markdown formatting, no backticks):
  {
    "recommendedSupplier": "Name of the best supplier",
    "totalCost": "calculated total cost",
    "reasoning": "A concise explanation of why this supplier was chosen over the others."
  }
  `;
    try {
        const response = await generativeModel.generateContent(prompt);
        // Attempt to parse the LLM output as JSON
        let resultText = response.response.candidates?.[0].content?.parts?.[0].text || "{}";
        // Clean up potential markdown code block formatting
        resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
        const resultJson = JSON.parse(resultText);
        // Optionally, save this recommendation to the database for historical tracking
        await db.collection('orderRecommendations').add({
            sku,
            productName: name,
            quantity,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            recommendation: resultJson,
            inputs: supplierData
        });
        return resultJson;
    }
    catch (error) {
        console.error("Error generating recommendation from Vertex AI:", (0, auth_1.errorMessage)(error));
        throw new functions.https.HttpsError('internal', 'Failed to generate recommendation');
    }
});
