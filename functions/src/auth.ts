import * as functions from 'firebase-functions';
import { getDb } from './firestore-db';

/**
 * Correo con acceso garantizado, fijo como red de seguridad — debe coincidir
 * con CORREO_ADMIN_BREAK_GLASS en lib/authorized-emails.ts (app Next.js).
 */
const CORREO_ADMIN_BREAK_GLASS = 'jemiliano2001@gmail.com';

export function esCorreoBreakGlass(email: string): boolean {
  return email === CORREO_ADMIN_BREAK_GLASS;
}

/** Verifica App Check en callables. Activar enforcement en Firebase Console → App Check. */
export function assertAppCheckCallable(context: functions.https.CallableContext): void {
  const enforce = process.env.APP_CHECK_ENFORCE !== 'false';
  if (enforce && context.app == undefined) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'App Check verification failed.'
    );
  }
}

async function usuarioActivo(uid: string, email: string): Promise<boolean> {
  if (esCorreoBreakGlass(email)) return true;
  // Usuarios viven en la base nombrada `compras-americanas`, no en "(default)".
  const snap = await getDb().collection('usuarios').doc(uid).get();
  return snap.exists && snap.data()?.activo === true;
}

export async function assertAuthorizedCallable(
  context: functions.https.CallableContext
): Promise<string> {
  assertAppCheckCallable(context);

  const email = context.auth?.token.email?.toLowerCase();
  const emailVerified = context.auth?.token.email_verified === true;
  const uid = context.auth?.uid;

  if (!email || !emailVerified || !uid) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated with a verified email.');
  }

  if (!(await usuarioActivo(uid, email))) {
    throw new functions.https.HttpsError('permission-denied', 'User is not authorized for this operation.');
  }

  return email;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
