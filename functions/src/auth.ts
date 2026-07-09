import * as functions from 'firebase-functions';

const ALLOWED_EMAILS = new Set([
  'ordenes@smv.com',
  'lorena@smv.com',
  'jemiliano2001@gmail.com',
]);

function parseExtraEmails(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((correo) => correo.trim().toLowerCase())
    .filter(Boolean);
}

function conjuntoCorreosAutorizados(): Set<string> {
  const extras = parseExtraEmails(process.env.AUTHORIZED_EMAILS_EXTRA);
  return new Set([...ALLOWED_EMAILS, ...extras]);
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

export function assertAuthorizedCallable(context: functions.https.CallableContext): string {
  assertAppCheckCallable(context);

  const email = context.auth?.token.email?.toLowerCase();
  const emailVerified = context.auth?.token.email_verified === true;

  if (!email || !emailVerified) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated with a verified email.');
  }

  if (!conjuntoCorreosAutorizados().has(email)) {
    throw new functions.https.HttpsError('permission-denied', 'User is not authorized for this operation.');
  }

  return email;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
