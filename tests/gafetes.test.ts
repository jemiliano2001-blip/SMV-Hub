import { describe, expect, it } from "vitest"
import { GafetePerfilSchema } from "@/lib/schemas"
import {
  agruparGafetesParaEnmicar,
  agruparGafetesParaImpresion,
  DATOS_TALLER_GAFETES,
  estaCompletoGafete,
  formatearFechaIngresoGafete,
  GAFETES_POR_HOJA_ENMICADO,
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
      domicilioLinea1: "Calle: 7 de diciembre #128",
      domicilioLinea2: "Col. México Agrario, H. Matamoros",
      domicilioLinea3: "Tamaulipas, México CP: 87440",
    })
    expect(DATOS_TALLER_GAFETES.domicilio.toLowerCase()).toContain("calle: 7 de diciembre #128")
  })

  it("formatea la fecha de ingreso en formato estándar DD/MM/AAAA para impresión", () => {
    expect(formatearFechaIngresoGafete("2026-07-12")).toBe("12/07/2026")
    expect(formatearFechaIngresoGafete("12/07/2026")).toBe("12/07/2026")
    expect(formatearFechaIngresoGafete("")).toBe("")
    expect(formatearFechaIngresoGafete(null)).toBe("")
  })

  it("normaliza la rotación y limita el encuadre de fotografía", () => {
    expect(normalizarAjusteFoto({ rotacion: -90, zoom: 4, desplazamientoX: -90, desplazamientoY: 80 })).toEqual({
      rotacion: 270,
      zoom: 2.5,
      desplazamientoX: -50,
      desplazamientoY: 50,
    })
  })

  it("agrupa gafetes para enmicado (2 gafetes con frente y reverso por hoja)", () => {
    const hojas = agruparGafetesParaEnmicar(["a", "b", "c"])
    expect(hojas).toEqual([["a", "b"], ["c"]])
    expect(GAFETES_POR_HOJA_ENMICADO).toBe(2)
  })

  it("mantiene el orden entre frentes y reversos en lotes de cuatro para dúplex", () => {
    const hojas = agruparGafetesParaImpresion(["a", "b", "c", "d", "e"])
    expect(hojas).toEqual([["a", "b", "c", "d"], ["e"]])
    expect(MEDIDAS_GAFETE_PULGADAS).toMatchObject({ ancho: 2.462, alto: 3.802, porHoja: 4 })
  })

  it("acomoda un par de frente y reverso en una sola hoja Carta para enmicar", () => {
    const anchoPar = 2 * MEDIDAS_GAFETE_PULGADAS.ancho
    const altoPar = 2 * MEDIDAS_GAFETE_PULGADAS.alto + 0.45 // 2 pares con separación
    expect(anchoPar).toBeLessThanOrEqual(8.5)
    expect(altoPar).toBeLessThanOrEqual(11)
  })

  it("acomoda cuatro gafetes exactos dentro de una hoja Carta para dúplex", () => {
    const ancho = 2 * MEDIDAS_GAFETE_PULGADAS.ancho + 0.26 + 2 * 1.658
    const alto = 2 * MEDIDAS_GAFETE_PULGADAS.alto + 0.26 + 2 * 1.568
    expect(ancho).toBeLessThanOrEqual(8.5)
    expect(alto).toBeLessThanOrEqual(11)
  })
})
