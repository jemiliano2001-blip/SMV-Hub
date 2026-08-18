import { describe, expect, it } from "vitest"
import {
  GEMINI_MODELO_EMBEDDING,
  GEMINI_MODELO_EXTRACCION_ALTA,
  GEMINI_MODELO_FLASH_ECONOMICO,
  GEMINI_MODELO_LITE,
  GEMINI_MODELO_WORKHORSE,
  GEMINI_MODELOS_OBSOLETOS,
  resolverModeloGemini,
} from "@/lib/gemini-modelos"
import { MODELO_EXTRACCION, MODELO_EXTRACCION_ALTA } from "@/lib/extraer-ia"
import { MODELO_EMBEDDING_DEFAULT } from "@/lib/embeddings-ia"
import { MODELO_SAT_LITE, MODELO_SAT_ESCALADO } from "@/lib/sat/gemini-sat"
import { MODELO_BANOS_DEFAULT } from "@/lib/banos-ia"
import { MODELO_ORDENES_CLIENTE_DEFAULT } from "@/lib/documentos-venta-lector-ia"
import { MODELO_CLASIFICACION_DEFAULT } from "@/lib/compras-odoo/clasificar-items-ia"
import { MODELO_INVESTIGACION_DEFAULT } from "@/lib/proveedores-investigacion-ia"
import { MODELO_EMBEDDING_INDICE } from "../functions/src/busqueda-indice-gemini"

describe("verificar-modelos-gemini (defaults GA)", () => {
  it("usa gemini-3.7-flash como workhorse en módulos de visión/JSON", () => {
    expect(MODELO_EXTRACCION).toBe(GEMINI_MODELO_WORKHORSE)
    expect(MODELO_BANOS_DEFAULT).toBe(GEMINI_MODELO_WORKHORSE)
    expect(MODELO_ORDENES_CLIENTE_DEFAULT).toBe(GEMINI_MODELO_WORKHORSE)
    expect(MODELO_INVESTIGACION_DEFAULT).toBe(GEMINI_MODELO_WORKHORSE)
    expect(MODELO_SAT_ESCALADO).toBe(GEMINI_MODELO_WORKHORSE)
  })

  it("usa gemini-3.5-flash-lite en flujos lite de alto volumen", () => {
    expect(MODELO_SAT_LITE).toBe(GEMINI_MODELO_LITE)
    expect(MODELO_CLASIFICACION_DEFAULT).toBe(GEMINI_MODELO_LITE)
  })

  it("usa gemini-embedding-2 GA en app e índice Functions", () => {
    expect(MODELO_EMBEDDING_DEFAULT).toBe(GEMINI_MODELO_EMBEDDING)
    expect(MODELO_EMBEDDING_INDICE).toBe(GEMINI_MODELO_EMBEDDING)
  })

  it("reserva gemini-3.1-pro-preview solo para extracción calidad=alta", () => {
    expect(MODELO_EXTRACCION_ALTA).toBe(GEMINI_MODELO_EXTRACCION_ALTA)
  })

  it("no usa IDs preview retirados como defaults (excepto pro escalado)", () => {
    const defaults = [
      MODELO_EXTRACCION,
      MODELO_SAT_LITE,
      MODELO_SAT_ESCALADO,
      MODELO_EMBEDDING_DEFAULT,
      MODELO_EMBEDDING_INDICE,
    ]
    for (const id of defaults) {
      expect(id).not.toMatch(/preview$/)
    }
    // Escalón calidad=alta: preview vigente, no mezclar con índice de embeddings
    expect(MODELO_EXTRACCION_ALTA).toBe("gemini-3.1-pro-preview")
  })

  it("migra modelos obsoletos al GA correspondiente", () => {
    expect(
      resolverModeloGemini("gemini-3.1-flash-lite-preview", GEMINI_MODELO_LITE),
    ).toBe(GEMINI_MODELO_LITE)
    expect(
      resolverModeloGemini("gemini-embedding-2-preview", GEMINI_MODELO_EMBEDDING),
    ).toBe(GEMINI_MODELO_EMBEDDING)
    expect(GEMINI_MODELOS_OBSOLETOS["gemini-embedding-2-preview"]).toBe(
      GEMINI_MODELO_EMBEDDING,
    )
  })

  it("expone gemini-3.6-flash como candidato A/B documentado", () => {
    expect(GEMINI_MODELO_FLASH_ECONOMICO).toBe("gemini-3.6-flash")
  })
})
