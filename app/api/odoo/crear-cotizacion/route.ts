import { NextResponse } from "next/server"
import { verificarUsuarioAutorizado } from "@/lib/api-auth"
import { CotizacionOdooPayloadSchema } from "@/lib/schemas"
import { crearCotizacionEnOdoo } from "@/lib/odoo-crear-cotizacion"
import { adminDb } from "@/lib/firebase-admin"
import { Timestamp } from "firebase-admin/firestore"

export async function POST(request: Request) {
  const auth = await verificarUsuarioAutorizado(request)
  if (!auth.ok) return auth.response

  try {
    const rawBody = await request.json()
    const parseResult = CotizacionOdooPayloadSchema.safeParse(rawBody)

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Datos de cotización inválidos",
          detalles: parseResult.error.flatten(),
        },
        { status: 400 }
      )
    }

    const payload = parseResult.data

    // 1. Enviar creación a Odoo ERP
    const resultadoOdoo = await crearCotizacionEnOdoo(payload)

    // 2. Guardar registro en Firestore para historial y búsqueda rápida
    // Se ejecuta fuera del camino fatal: si Firestore falla, la PO ya existe en Odoo y no se reintenta
    let registroId: string | null = null
    let advertenciaEspejo: string | undefined = undefined

    try {
      const ahora = Timestamp.now()
      const docRef = adminDb.collection("compras_odoo").doc()

      await docRef.set({
        id: docRef.id,
        odooId: resultadoOdoo.odooId,
        odooName: resultadoOdoo.odooName,
        odooState: resultadoOdoo.odooState,
        proveedor: resultadoOdoo.proveedorNombre,
        proveedorId: resultadoOdoo.proveedorId,
        referenciaProveedor: resultadoOdoo.referenciaProveedor,
        moneda: resultadoOdoo.moneda,
        fecha: payload.fecha || null,
        fechaRecepcion: payload.fechaRecepcion || null,
        notas: payload.notas || "",
        requisitorGeneral: payload.requisitorGeneral || "",
        empresaGeneral: payload.empresaGeneral || "",
        usoGeneral: payload.usoGeneral || "",
        totalUntaxed: resultadoOdoo.totalUntaxed,
        totalTax: resultadoOdoo.totalTax,
        total: resultadoOdoo.total,
        itemsCount: resultadoOdoo.itemsCount,
        partidas: payload.partidas,
        creadoPorUid: auth.uid,
        creadoPorEmail: auth.email,
        creadoEn: ahora,
        actualizadoEn: ahora,
      })

      registroId = docRef.id
    } catch (dbError) {
      console.error(
        `[api/odoo/crear-cotizacion] Error guardando espejo en Firestore para orden ${resultadoOdoo.odooName}:`,
        dbError
      )
      advertenciaEspejo = `La orden se creó exitosamente en Odoo (${resultadoOdoo.odooName}), pero no se pudo sincronizar en el historial local.`
    }

    return NextResponse.json({
      ok: true,
      data: {
        ...resultadoOdoo,
        registroId,
        ...(advertenciaEspejo ? { advertenciaEspejo } : {}),
      },
    })
  } catch (error) {
    console.error("[api/odoo/crear-cotizacion] Error al procesar cotización:", error)
    const mensaje = error instanceof Error ? error.message : "Error interno del servidor"

    return NextResponse.json(
      {
        error: "No se pudo crear la cotización en Odoo",
        codigo: "ODOO_CREACION_ERROR",
        detalles: mensaje,
      },
      { status: 500 }
    )
  }
}
