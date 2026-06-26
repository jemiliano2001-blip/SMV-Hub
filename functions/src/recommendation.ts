import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { VertexAI } from '@google-cloud/vertexai';
import { assertAuthorizedCallable, errorMessage } from './auth';

const db = admin.firestore();

// Initialize Vertex AI with the current project ID and location
// Using gemini-1.5-pro for reasoning tasks like supplier recommendations
const vertexAI = new VertexAI({
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

const requestSchema = z.object({
  sku: z.string(),
  name: z.string(),
  quantity: z.number(),
  // History of past purchases or known prices from suppliers
  supplierData: z.array(z.object({
    supplierName: z.string(),
    price: z.number(),
    leadTimeDays: z.number(),
    rating: z.number().optional(),
  })).min(1)
});

/**
 * Callable Cloud Function that uses Vertex AI to recommend the best supplier
 * based on price, lead time, and historical rating.
 */
export const recommendProvider = functions.https.onCall(async (data, context) => {
  assertAuthorizedCallable(context);

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

  } catch (error: unknown) {
    console.error("Error generating recommendation from Vertex AI:", errorMessage(error));
    throw new functions.https.HttpsError('internal', 'Failed to generate recommendation');
  }
});
