import * as functions from 'firebase-functions';
import { assertAuthorizedCallable, errorMessage, esCorreoBreakGlass } from './auth';
import { getDb } from './firestore-db';
import { idsHuerfanos } from './odoo-mapeo';
import {
  mapearVentaOdooSo,
  soDebeIncluirse,
  type OdooPickingRaw,
  type OdooSaleLineRaw,
  type OdooSaleOrderRaw,
  type VentaOdooSoNormalizada,
} from './odoo-ventas-mapeo';

const db = getDb();

const ODOO_SECRETS = [
  'FINANZAS_ODOO_URL',
  'FINANZAS_ODOO_DB',
  'FINANZAS_ODOO_USERNAME',
  'FINANZAS_ODOO_API_KEY',
];

const CAMPOS_SO = [
  'id',
  'name',
  'client_order_ref',
  'partner_id',
  'date_order',
  'state',
  'invoice_status',
  'order_line',
];

const CAMPOS_LINEA = ['id', 'product_id', 'name', 'product_uom_qty', 'qty_delivered'];

const CAMPOS_PICKING = ['id', 'name', 'state', 'date_done', 'origin', 'picking_type_code'];

const TAMANO_LOTE = 400;
const TAMANO_READ = 500;

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

async function leerEnLotes<T>(
  url: string,
  dbName: string,
  uid: number,
  apiKey: string,
  model: string,
  ids: number[],
  fields: string[]
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += TAMANO_READ) {
    const slice = ids.slice(i, i + TAMANO_READ);
    if (slice.length === 0) continue;
    const batch = await llamarOdoo<T[]>(url, 'object', 'execute_kw', [
      dbName,
      uid,
      apiKey,
      model,
      'read',
      [slice],
      { fields },
    ]);
    out.push(...batch);
  }
  return out;
}

async function sincronizarVentasOdoo(): Promise<number> {
  const url = process.env.FINANZAS_ODOO_URL;
  const dbName = process.env.FINANZAS_ODOO_DB;
  const username = process.env.FINANZAS_ODOO_USERNAME;
  const apiKey = process.env.FINANZAS_ODOO_API_KEY;
  if (!url || !dbName || !username || !apiKey) {
    throw new Error(
      'Faltan credenciales de Odoo (FINANZAS_ODOO_URL/FINANZAS_ODOO_DB/FINANZAS_ODOO_USERNAME/FINANZAS_ODOO_API_KEY)'
    );
  }

  const uid = await llamarOdoo<number>(url, 'common', 'login', [dbName, username, apiKey]);
  if (!uid) throw new Error('Login a Odoo falló — revisa credenciales');

  // Misma ventana que VISION / pestaña Odoo "A facturar".
  const ordenes = await llamarOdoo<OdooSaleOrderRaw[]>(url, 'object', 'execute_kw', [
    dbName,
    uid,
    apiKey,
    'sale.order',
    'search_read',
    [[
      ['state', 'in', ['sale', 'done']],
      ['invoice_status', 'in', ['to invoice', 'upselling']],
    ]],
    { fields: CAMPOS_SO },
  ]);

  const lineIds = Array.from(
    new Set(ordenes.flatMap((o) => (Array.isArray(o.order_line) ? o.order_line : [])))
  );
  const lineas = await leerEnLotes<OdooSaleLineRaw>(
    url,
    dbName,
    uid,
    apiKey,
    'sale.order.line',
    lineIds,
    CAMPOS_LINEA
  );
  const lineasPorId = new Map(lineas.map((l) => [l.id, l]));

  const soNames = ordenes.map((o) => o.name).filter(Boolean);
  let pickings: OdooPickingRaw[] = [];
  if (soNames.length > 0) {
    try {
      pickings = await llamarOdoo<OdooPickingRaw[]>(url, 'object', 'execute_kw', [
        dbName,
        uid,
        apiKey,
        'stock.picking',
        'search_read',
        [[['origin', 'in', soNames], ['picking_type_code', '=', 'outgoing']]],
        { fields: CAMPOS_PICKING },
      ]);
    } catch (err) {
      console.warn('Sync Odoo→Ventas: pickings falló, se continúa sin remisiones:', errorMessage(err));
      pickings = [];
    }
  }

  const pickingsPorOrigin = new Map<string, OdooPickingRaw[]>();
  for (const p of pickings) {
    const origin = typeof p.origin === 'string' ? p.origin : '';
    if (!origin) continue;
    const list = pickingsPorOrigin.get(origin) ?? [];
    list.push(p);
    pickingsPorOrigin.set(origin, list);
  }

  const ahora = new Date();
  const incluidos: VentaOdooSoNormalizada[] = [];
  for (const raw of ordenes) {
    const lineasSo = (raw.order_line ?? [])
      .map((id) => lineasPorId.get(id))
      .filter((l): l is OdooSaleLineRaw => l !== undefined);
    const mapped = mapearVentaOdooSo(raw, lineasSo, pickingsPorOrigin.get(raw.name) ?? [], ahora);
    if (soDebeIncluirse({ state: mapped.state, invoiceStatus: mapped.invoiceStatus })) {
      incluidos.push(mapped);
    }
  }

  const existentesSnap = await db.collection('ventas_odoo_so').select().get();
  const idsExistentes = existentesSnap.docs.map((d) => d.id);

  for (let i = 0; i < incluidos.length; i += TAMANO_LOTE) {
    const batch = db.batch();
    for (const so of incluidos.slice(i, i + TAMANO_LOTE)) {
      const { id, ...rest } = so;
      batch.set(db.collection('ventas_odoo_so').doc(id), rest);
    }
    await batch.commit();
  }

  let huerfanosEliminados = 0;
  const idsActuales = incluidos.map((s) => s.id);
  const huerfanos = idsHuerfanos(idsExistentes, idsActuales);

  if (incluidos.length === 0 && idsExistentes.length > 0) {
    console.warn(
      `Sync Odoo→Ventas: 0 SO incluidas pero hay ${idsExistentes.length} en Firestore; se omite prune.`
    );
  } else if (huerfanos.length > 0) {
    for (let i = 0; i < huerfanos.length; i += TAMANO_LOTE) {
      const batch = db.batch();
      for (const id of huerfanos.slice(i, i + TAMANO_LOTE)) {
        batch.delete(db.collection('ventas_odoo_so').doc(id));
      }
      await batch.commit();
    }
    huerfanosEliminados = huerfanos.length;
    console.log(`Sync Odoo→Ventas: eliminados ${huerfanosEliminados} huérfanos`);
  }

  await db.collection('ventas_odoo_sync_state').doc('latest').set({
    ultimaSyncEn: ahora,
    filas: incluidos.length,
    error: null,
  });

  return incluidos.length;
}

async function ejecutarSyncConLogging(): Promise<{ sincronizadas: number }> {
  try {
    const sincronizadas = await sincronizarVentasOdoo();
    console.log(`Sync Odoo→Ventas: ${sincronizadas} SO`);
    return { sincronizadas };
  } catch (error) {
    console.error('Sync Odoo→Ventas falló:', errorMessage(error));
    await db.collection('ventas_odoo_sync_state').doc('latest').set(
      { error: errorMessage(error) },
      { merge: true }
    );
    throw error;
  }
}

export const syncOdooVentasScheduled = functions
  .runWith({ secrets: ODOO_SECRETS })
  .pubsub.schedule('every 2 hours')
  .onRun(async () => {
    try {
      await ejecutarSyncConLogging();
    } catch {
      // Ya quedó registrado en ventas_odoo_sync_state.
    }
  });

export const syncOdooVentasManual = functions
  .runWith({ secrets: ODOO_SECRETS })
  .https.onCall(async (_data, context) => {
    const email = await assertAuthorizedCallable(context);
    const usuarioSnap = await db.collection('usuarios').doc(context.auth!.uid).get();
    const data = usuarioSnap.data();
    const esBreakGlass = esCorreoBreakGlass(email);
    const esAdmin = data?.rol === 'admin' || data?.esSuperAdmin === true;
    if (!esBreakGlass && !esAdmin) {
      throw new functions.https.HttpsError('permission-denied', 'Requiere rol admin.');
    }
    try {
      return await ejecutarSyncConLogging();
    } catch (error) {
      throw new functions.https.HttpsError('internal', errorMessage(error));
    }
  });
