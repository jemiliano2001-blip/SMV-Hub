import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * Base Firestore nombrada del proyecto SMV Hub.
 * `admin.firestore()` (sin argumento) apunta a "(default)" — ahí nadie lee.
 * Misma convención que `lib/firebase-admin.ts` en la app Next.js.
 */
export const DATABASE_ID = 'compras-americanas';

export function getDb(): Firestore {
  return getFirestore(DATABASE_ID);
}
