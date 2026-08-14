import { describe, expect, it } from "vitest"
import { GafetePerfilSchema } from "@/lib/schemas"
import {
  agruparGafetesParaImpresion,
  DATOS_TALLER_GAFETES,
  estaCompletoGafete,
  MEDIDAS_GAFETE_PULGADAS,
  normalizarAjusteFoto,
} from "@/lib/gafetes"

const perfilCompleto = {
  id: "operador-1",
  operadorId: "operador-1",
  cargo: "Asistencia en Diseño y Fabricación",
  fechaIngreso: "2026-02-06",
  nss: "0905-88-7715-1",
  rfc: "CACE8809015K6",
  fotoPath: "gafetes/operador-1/foto.jpg",
  fotoAjuste: { rotacion: 0, zoom: 1, desplazamientoX: 0, desplazamientoY: 0 },
  creadoEn: new Date("2026-01-01"),
  actualizadoEn: new Date("2026-01-01"),
}

describe("gafetes", () => {
  it("valida el perfil privado completo", () => {
    expect(GafetePerfilSchema.parse(perfilCompleto).operadorId).toBe("operador-1")
    expect(estaCompletoGafete(GafetePerfilSchema.parse(perfilCompleto))).toBe(true)
  })

  it("mantiene borradores fuera de impresión", () => {
    expect(estaCompletoGafete(GafetePerfilSchema.parse({ ...perfilCompleto, fotoPath: "" }))).toBe(false)
  })

  it("centraliza los datos institucionales del taller", () => {
    expect(DATOS_TALLER_GAFETES).toMatchObject({
      responsableNombre: "Ing. Antonio Vázquez Vicencio",
      responsablePuesto: "Gerente de Ingeniería / Ventas",
      responsableTelefono: "8681001683",
    })
    expect(DATOS_TALLER_GAFETES.domicilio).toContain("Calle: 7 de Diciembre #128")
  })

  it("normaliza la rotación y limita el encuadre de fotografía", () => {
    expect(normalizarAjusteFoto({ rotacion: -90, zoom: 4, desplazamientoX: -90, desplazamientoY: 80 })).toEqual({
      rotacion: 270,
      zoom: 2.5,
      desplazamientoX: -50,
      desplazamientoY: 50,
    })
  })

  it("mantiene el orden entre frentes y reversos en lotes de cuatro", () => {
    const hojas = agruparGafetesParaImpresion(["a", "b", "c", "d", "e"])
    expect(hojas).toEqual([["a", "b", "c", "d"], ["e"]])
    expect(MEDIDAS_GAFETE_PULGADAS).toMatchObject({ ancho: 2.462, alto: 3.802, porHoja: 4 })
  })

  it("acomoda cuatro gafetes exactos dentro de una hoja Carta sin escalar", () => {
    const ancho = 2 * MEDIDAS_GAFETE_PULGADAS.ancho + 0.26 + 2 * 1.658
    const alto = 2 * MEDIDAS_GAFETE_PULGADAS.alto + 0.26 + 2 * 1.568
    expect(ancho).toBeLessThanOrEqual(8.5)
    expect(alto).toBeLessThanOrEqual(11)
  })
})
