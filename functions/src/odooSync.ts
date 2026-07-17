import * as functions from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import { assertAuthorizedCallable, errorMessage } from './auth';
import { mapearFacturaOdoo, type OdooFacturaRaw } from './odoo-mapeo';

// `admin.firestore()` (namespaced, sin argumento) apunta a la base "(default)".
// Este proyecto usa una base nombrada — mismo patrón que lib/firebase-admin.ts
// en la app Next.js. Sin esto, el sync escribe donde nadie lee.
const db = getFirestore('compras-americanas');

// Credenciales de un sistema financiero externo → Secret Manager, no
// process.env plano como excelSync.ts/sheetsSync.ts (primera vez en este
// repo que se usa `runWith({ secrets })`).
//
// Nombres con prefijo FINANZAS_ a propósito: el proyecto de Firebase
// `smv-brain` es compartido con otra app ("SMV brain", funciones
// triggerOdooSync/syncOdooSuprajitOrders) que ya tiene sus propios secretos
// de Odoo con nombres planos (ODOO_URL/ODOO_DB/ODOO_USERNAME/ODOO_API_KEY) —
// cada integración usa su propio API key de Odoo (credenciales dedicadas por
// proyecto), así que compartir el nombre del secreto arriesgaba pisar la
// credencial de la otra app en el próximo deploy de cualquiera de las dos.
// Configurar con:
//   firebase functions:secrets:set FINANZAS_ODOO_URL / FINANZAS_ODOO_DB / FINANZAS_ODOO_USERNAME / FINANZAS_ODOO_API_KEY
const ODOO_SECRETS = ['FINANZAS_ODOO_URL', 'FINANZAS_ODOO_DB', 'FINANZAS_ODOO_USERNAME', 'FINANZAS_ODOO_API_KEY'];

const CAMPOS_FACTURA = [
  'id', 'name', 'move_type', 'partner_id', 'invoice_date', 'invoice_date_due',
  'amount_untaxed', 'amount_tax', 'amount_total', 'amount_residual',
  'currency_id', 'payment_state', 'state', 'ref', 'invoice_origin', 'company_id',
];

async function llamarOdoo<T>(url: string, service: string, method: string, args: unknown[]): Promise<T> {
  for (let intento = 1; intento <= 3; intento++) {
    const res = await fetch(`${url}/jsonrpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { service, method, args } }),
    });
    if (res.status >= 500 && intento < 3) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** (intento - 1)));
      continue;
    }
    if (!res.ok) throw new Error(`Odoo HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = await res.json();
    if (json.error) throw new Error(`Odoo RPC error: ${JSON.stringify(json.error).slice(0, 500)}`);
    return json.result as T;
  }
  throw new Error('Odoo: agotados los reintentos (5xx)');
}

// ponytail: sync completo (trae todas las facturas posteadas en cada corrida),
// no incremental. Suficiente para el volumen actual de SMV; si el histórico
// crece mucho, agregar un cursor por write_date antes de optimizar más.
async function sincronizarFacturasOdoo(): Promise<number> {
  const url = process.env.FINANZAS_ODOO_URL;
  const dbName = process.env.FINANZAS_ODOO_DB;
  const username = process.env.FINANZAS_ODOO_USERNAME;
  const apiKey = process.env.FINANZAS_ODOO_API_KEY;
  if (!url || !dbName || !username || !apiKey) {
    throw new Error('Faltan credenciales de Odoo (FINANZAS_ODOO_URL/FINANZAS_ODOO_DB/FINANZAS_ODOO_USERNAME/FINANZAS_ODOO_API_KEY)');
  }

  const uid = await llamarOdoo<number>(url, 'common', 'login', [dbName, username, apiKey]);
  if (!uid) throw new Error('Login a Odoo falló — revisa credenciales');

  const registros = await llamarOdoo<OdooFacturaRaw[]>(url, 'object', 'execute_kw', [
    dbName, uid, apiKey, 'account.move', 'search_read',
    [[['move_type', 'in', ['out_invoice', 'out_refund']], ['state', '=', 'posted']]],
    { fields: CAMPOS_FACTURA },
  ]);

  const ahora = new Date();

  // Preserva creadoEn de registros ya sincronizados antes; todo lo demás
  // siempre refleja el estado más reciente de Odoo (es un espejo, no un
  // historial de cambios).
  const existentesSnap = await db.collection('finanzas_facturas').select('creadoEn').get();
  const creadoEnExistente = new Map(
    existentesSnap.docs.map((d) => [d.id, d.data().creadoEn as FirebaseFirestore.Timestamp])
  );

  const TAMANO_LOTE = 400; // límite de writeBatch de Firestore
  for (let i = 0; i < registros.length; i += TAMANO_LOTE) {
    const batch = db.batch();
    for (const raw of registros.slice(i, i + TAMANO_LOTE)) {
      const factura = mapearFacturaOdoo(raw, ahora);
      batch.set(db.collection('finanzas_facturas').doc(factura.id), {
        ...factura,
        creadoEn: creadoEnExistente.get(factura.id) ?? ahora,
        actualizadoEn: ahora,
      });
    }
    await batch.commit();
  }

  await db.collection('finanzas_sync_state').doc('odoo').set({
    ultimaCorridaEn: ahora,
    ultimoError: null,
    facturasSincronizadas: registros.length,
  });

  return registros.length;
}

async function ejecutarSyncConLogging(): Promise<{ sincronizadas: number }> {
  try {
    const sincronizadas = await sincronizarFacturasOdoo();
    console.log(`Sync Odoo→Finanzas: ${sincronizadas} facturas`);
    return { sincronizadas };
  } catch (error) {
    console.error('Sync Odoo→Finanzas falló:', errorMessage(error));
    await db.collection('finanzas_sync_state').doc('odoo').set(
      { ultimoError: errorMessage(error), ultimoErrorEn: new Date() },
      { merge: true }
    );
    throw error;
  }
}

// Corre cada 2 horas. Un fallo de Odoo queda registrado en
// finanzas_sync_state y no propaga — la UI sigue sirviendo el último espejo
// válido (CLAUDE.md regla 14: un fallo de Odoo no debe romper la app).
export const syncOdooFacturasScheduled = functions
  .runWith({ secrets: ODOO_SECRETS })
  .pubsub.schedule('every 2 hours')
  .onRun(async () => {
    try {
      await ejecutarSyncConLogging();
    } catch {
      // Ya quedó registrado en finanzas_sync_state.
    }
  });

// Botón "Sincronizar ahora" — solo admin (facturación de clientes es más
// sensible que compras).
export const syncOdooFacturasManual = functions
  .runWith({ secrets: ODOO_SECRETS })
  .https.onCall(async (_data, context) => {
    const email = await assertAuthorizedCallable(context);
    const usuarioSnap = await db.collection('usuarios').doc(context.auth!.uid).get();
    const esBreakGlass = email === 'jemiliano2001@gmail.com';
    if (!esBreakGlass && usuarioSnap.data()?.rol !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Requiere rol admin.');
    }
    try {
      return await ejecutarSyncConLogging();
    } catch (error) {
      throw new functions.https.HttpsError('internal', errorMessage(error));
    }
  });
