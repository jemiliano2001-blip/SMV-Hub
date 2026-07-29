import type { TrustEnvelopeDTO } from "@/lib/reportes-integridad"

type IntegrityUnavailableCopy = {
  title: string
  description: string
}

export function integrityUnavailableCopy(
  trust: Pick<TrustEnvelopeDTO, "mode" | "safeErrorCode">
): IntegrityUnavailableCopy {
  if (trust.mode === "off") {
    return {
      title: "Integridad apagada",
      description:
        "El backend está desplegado de forma segura, pero el cálculo permanece apagado.",
    }
  }

  switch (trust.safeErrorCode) {
    case "SOURCE_SNAPSHOT_INVALID":
      return {
        title: "Fuente sin evidencia suficiente",
        description:
          "Odoo no devolvió la evidencia mínima para conciliar: órdenes y facturas de proveedor publicadas, o el corte local quedó vacío. Las facturas en borrador no se consideran; publícalas en Odoo y vuelve a sincronizar.",
      }
    case "ODOO_UNAVAILABLE":
      return {
        title: "Odoo no está disponible",
        description:
          "No fue posible leer Odoo. Revisa la conexión o vuelve a sincronizar más tarde.",
      }
    case "MIRROR_WRITE_FAILED":
      return {
        title: "El espejo no se completó",
        description:
          "La evidencia de Odoo no terminó de guardarse y no se publicó un cálculo parcial.",
      }
    case "RUN_WRITE_FAILED":
    case "RUN_INTEGRITY_FAILED":
      return {
        title: "El cálculo no se pudo publicar",
        description:
          "La evidencia se leyó, pero la corrida no superó la verificación de integridad. Vuelve a sincronizar.",
      }
    default:
      return {
        title: "Sin cálculo válido",
        description:
          "La cola aparecerá después de una sincronización completa de espejo, cálculo y verificación.",
      }
  }
}

export function integritySyncResultMessage(
  errorCode: string | null
): string {
  switch (errorCode) {
    case null:
      return "Sincronización terminada; la cola usa la corrida activa más reciente."
    case "SOURCE_SNAPSHOT_INVALID":
      return "El espejo se actualizó, pero Odoo no devolvió la evidencia mínima para calcular. Las facturas de proveedor deben estar publicadas; los borradores no se consideran."
    case "ODOO_UNAVAILABLE":
      return "No fue posible leer Odoo. Se conserva el último corte válido."
    case "MIRROR_WRITE_FAILED":
      return "El espejo de Odoo no se completó; no se publicó un cálculo parcial."
    default:
      return "Integridad conservó el último corte válido porque la corrida no superó la verificación."
  }
}
