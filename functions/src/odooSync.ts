import * as functions from 'firebase-functions';
import { assertAuthorizedCallable, errorMessage, esCorreoBreakGlass } from './auth';
import { getDb } from './firestore-db';
import { idsHuerfanos, mapearFacturaOdoo, type OdooFacturaRaw } from './odoo-mapeo';

// Base nombrada compartida — ver firestore-db.ts.
const db = getDb();

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

const TAMANO_LOTE = 400; // límite de writeBatch de Firestore

async function llamarOdoo<T>(url: string, service: string, method: string, args: unknown[]): Promise<T> {
  for (let intento = 1; intento <= 3; intento++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(`${url}/jsonrpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { service, method, args } }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.status >= 500 && intento < 3) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** (intento - 1)));
        continue;
      }
      if (!res.ok) throw new Error(`Odoo HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const json = await res.json();
      if (json.error) throw new Error(`Odoo RPC error: ${JSON.stringify(json.error).slice(0, 500)}`);
      return json.result as T;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (intento < 3) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** (intento - 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Odoo: agotados los reintentos (5xx o timeout)');
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

  // Reconciliación: Odoo no expone deletions. Facturas canceladas/borradas
  // dejan de aparecer en search_read (state=posted) y quedarían inflando
  // KPIs si no se eliminan del espejo.
  let huerfanosEliminados = 0;
  const idsActuales = registros.map((r) => `odoo_${r.id}`);
  const huerfanos = idsHuerfanos([...creadoEnExistente.keys()], idsActuales);

  if (registros.length === 0 && creadoEnExistente.size > 0) {
    // Guard de seguridad financiera: respuesta vacía con espejo no vacío
    // huele a glitch de Odoo — no vaciar el espejo.
    console.warn(
      `Sync Odoo→Finanzas: Odoo devolvió 0 facturas pero hay ${creadoEnExistente.size} en Firestore; se omite el prune de huérfanos.`
    );
  } else if (huerfanos.length > 0) {
    for (let i = 0; i < huerfanos.length; i += TAMANO_LOTE) {
      const batch = db.batch();
      for (const id of huerfanos.slice(i, i + TAMANO_LOTE)) {
        batch.delete(db.collection('finanzas_facturas').doc(id));
      }
      await batch.commit();
    }
    huerfanosEliminados = huerfanos.length;
    console.log(`Sync Odoo→Finanzas: eliminados ${huerfanosEliminados} huérfanos`);
  }

  await db.collection('finanzas_sync_state').doc('odoo').set({
    ultimaCorridaEn: ahora,
    ultimoError: null,
    facturasSincronizadas: registros.length,
    huerfanosEliminados,
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
    const esBreakGlass = esCorreoBreakGlass(email);
    if (!esBreakGlass && usuarioSnap.data()?.rol !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Requiere rol admin.');
    }
    try {
      return await ejecutarSyncConLogging();
    } catch (error) {
      throw new functions.https.HttpsError('internal', errorMessage(error));
    }
  });
