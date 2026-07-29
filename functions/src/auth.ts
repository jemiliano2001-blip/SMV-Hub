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

export type CallablePrincipal = {
  uid: string;
  email: string;
  modules: string[];
  isSuperAdmin: boolean;
  isBreakGlass: boolean;
  active: true;
  template: string | null;
};

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

function modulesFromLegacy(data: FirebaseFirestore.DocumentData): string[] {
  if (Array.isArray(data.modulos)) {
    return data.modulos.filter((value): value is string => typeof value === 'string');
  }
  const template = typeof data.plantilla === 'string' ? data.plantilla : data.rol;
  if (template === 'admin') {
    return ['reportes', 'finanzas', 'proveedores', 'usuarios', 'auditoria'];
  }
  if (template === 'compras') {
    return ['proveedores', 'nueva-compra', 'ordenes', 'cotizaciones', 'requisiciones'];
  }
  if (template === 'almacen') return ['almacen', 'pedidos-almacen'];
  if (template === 'diseno') return ['diseno'];
  return [];
}

export async function getCallablePrincipal(
  context: functions.https.CallableContext
): Promise<CallablePrincipal> {
  assertAppCheckCallable(context);

  const email = context.auth?.token.email?.toLowerCase();
  const emailVerified = context.auth?.token.email_verified === true;
  const uid = context.auth?.uid;

  if (!email || !emailVerified || !uid) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated with a verified email.');
  }

  const isBreakGlass = esCorreoBreakGlass(email);
  if (isBreakGlass) {
    return {
      uid,
      email,
      modules: ['reportes', 'finanzas', 'proveedores', 'usuarios', 'auditoria'],
      isSuperAdmin: true,
      isBreakGlass: true,
      active: true,
      template: 'admin',
    };
  }

  // Usuarios viven en la base nombrada `compras-americanas`, no en "(default)".
  const snap = await getDb().collection('usuarios').doc(uid).get();
  const data = snap.data();
  if (!snap.exists || data?.activo !== true) {
    throw new functions.https.HttpsError('permission-denied', 'User is not authorized for this operation.');
  }

  const template =
    typeof data.plantilla === 'string'
      ? data.plantilla
      : typeof data.rol === 'string'
        ? data.rol
        : null;
  const explicitSuperAdmin = typeof data.esSuperAdmin === 'boolean';

  return {
    uid,
    email,
    modules: modulesFromLegacy(data),
    isSuperAdmin:
      data.esSuperAdmin === true ||
      (!explicitSuperAdmin && (data.rol === 'admin' || data.plantilla === 'admin')),
    isBreakGlass: false,
    active: true,
    template,
  };
}

export function principalCanViewFullIntegrity(principal: CallablePrincipal): boolean {
  return (
    principal.isBreakGlass ||
    principal.isSuperAdmin ||
    (principal.modules.includes('reportes') && principal.modules.includes('finanzas'))
  );
}

export function principalCanViewOwnIntegrity(principal: CallablePrincipal): boolean {
  return (
    principal.isBreakGlass ||
    principal.isSuperAdmin ||
    principal.modules.includes('proveedores')
  );
}

export function principalCanTriggerPurchasingSync(principal: CallablePrincipal): boolean {
  return principalCanViewFullIntegrity(principal);
}

export function principalHasLegacyPurchasingSyncAccess(principal: CallablePrincipal): boolean {
  return (
    principalCanTriggerPurchasingSync(principal) ||
    principal.template === 'admin' ||
    principal.template === 'compras' ||
    principal.modules.includes('proveedores')
  );
}

export async function assertAuthorizedCallable(
  context: functions.https.CallableContext
): Promise<string> {
  return (await getCallablePrincipal(context)).email;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
