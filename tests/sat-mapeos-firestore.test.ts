import { describe, expect, it } from "vitest"
import { combinarMapeosSmv, getMapeosSmv } from "@/lib/sat/historial-sat"
import { clearSatSugerenciaCache } from "@/lib/sat/cache-sugerencias"
import { sugerirClaveSatItem } from "@/lib/sat/sugerir-clave"
import type { MapeoSmvEntry } from "@/lib/sat/types"

describe("combinarMapeosSmv", () => {
  it("Firestore sobrescribe JSON con el mismo SKU", () => {
    const estaticos: MapeoSmvEntry[] = [
      {
        tokensNormalizados: ["test"],
        sku: "ABC-123",
        claveProdServ: "11111111",
        descripcionEjemplo: "old",
        origen: "json",
      },
    ]
    const firestore: MapeoSmvEntry[] = [
      {
        tokensNormalizados: ["test"],
        sku: "ABC-123",
        claveProdServ: "22222222",
        descripcionEjemplo: "validated",
        origen: "firestore",
      },
    ]
    const merged = combinarMapeosSmv(estaticos, firestore)
    expect(merged).toHaveLength(1)
    expect(merged[0].claveProdServ).toBe("22222222")
    expect(merged[0].origen).toBe("firestore")
  })
})

describe("sugerirClaveSatItem con mapeos Firestore", () => {
  it("usa mapeo_validado cuando el SKU está en sat_asignaciones", async () => {
    clearSatSugerenciaCache()

    const mapeosFirestore: MapeoSmvEntry[] = [
      {
        tokensNormalizados: ["widget", "custom"],
        sku: "TST1234",
        claveProdServ: "31161500",
        descripcionEjemplo: "Custom widget TST1234",
        origen: "firestore",
      },
    ]

    const result = await sugerirClaveSatItem(
      { descripcion: "Custom industrial widget TST1234" },
      new Map(),
      {
        traducirYElegir: async () => ({
          terminosBusqueda: "skip",
          clave: null,
          motivo: "skip",
          confianzaIa: "baja" as const,
        }),
        mapeos: combinarMapeosSmv(getMapeosSmv(), mapeosFirestore),
      }
    )

    expect(result.claveProdServ).toBe("31161500")
    expect(result.fuente).toBe("mapeo_validado")
    expect(result.confianza).toBe("alta")
  })
})
