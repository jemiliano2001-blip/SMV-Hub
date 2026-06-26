import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

export interface SupplierData {
  supplierName: string;
  price: number;
  leadTimeDays: number;
  rating?: number;
}

export interface RecommendationRequest {
  sku: string;
  name: string;
  quantity: number;
  supplierData: SupplierData[];
}

export interface RecommendationResponse {
  recommendedSupplier: string;
  totalCost: string | number;
  reasoning: string;
}

/**
 * Calls the `recommendProvider` Cloud Function which uses Vertex AI
 * to recommend the best supplier based on the provided inputs.
 */
export async function getSupplierRecommendation(
  requestData: RecommendationRequest
): Promise<RecommendationResponse> {
  const functions = getFunctions(getApp());
  
  // Creates a reference to the callable Cloud Function
  const recommendProvider = httpsCallable<RecommendationRequest, RecommendationResponse>(
    functions, 
    'recommendProvider'
  );

  try {
    const result = await recommendProvider(requestData);
    return result.data;
  } catch (error) {
    console.error('Error fetching recommendation from Cloud Function:', error);
    throw error;
  }
}
