import { describe, expect, it } from "vitest"
import {
  armarFilasAuditoria,
  generarCSVAuditoria,
  COLUMNAS_EXCEL_AUDITORIA,
  formatearFechaAuditoria,
  type EventoAuditoriaExportable,
} from "@/lib/auditoria-export"

describe("auditoria-export", () => {
  const fecha = new Date(2026, 7, 28, 10, 30, 0)
  const mockEventos: EventoAuditoriaExportable[] = [
    {
      id: "ev-1",
      emailUsuario: "compras@smv.mx",
      accion: "CREAR",
      coleccion: "ordenes",
      idDoc: "ord-123",
      resumen: "Nueva orden creada para McMaster-Carr por $150.00 USD",
      fechaHora: fecha,
    },
    {
      id: "ev-2",
      emailUsuario: "admin@smv.mx",
      accion: "BORRAR",
      coleccion: "usuarios",
      idDoc: "uid-legacy",
      resumen: "Usuario eliminado",
      fechaHora: "2026-08-28T12:00:00.000Z",
    },
  ]

  it("formatea fechas adecuadamente", () => {
    expect(formatearFechaAuditoria(fecha)).toBeTruthy()
    expect(formatearFechaAuditoria(undefined)).toBe("—")
    expect(formatearFechaAuditoria("2026-08-28T12:00:00.000Z")).toBeTruthy()
  })

  it("define columnas de auditoría para exportación", () => {
    expect(COLUMNAS_EXCEL_AUDITORIA.length).toBe(6)
    expect(COLUMNAS_EXCEL_AUDITORIA.map((c) => c.header)).toContain("Usuario")
    expect(COLUMNAS_EXCEL_AUDITORIA.map((c) => c.header)).toContain("Acción")
    expect(COLUMNAS_EXCEL_AUDITORIA.map((c) => c.header)).toContain("Colección / Sección")
  })

  it("arma filas con valores esperados", () => {
    const filas = armarFilasAuditoria(mockEventos)
    expect(filas).toHaveLength(2)
    expect(filas[0][1]).toBe("compras@smv.mx")
    expect(filas[0][2]).toBe("CREAR")
    expect(filas[0][3]).toBe("ordenes")
    expect(filas[0][4]).toBe("ord-123")
    expect(filas[0][5]).toContain("McMaster-Carr")

    expect(filas[1][1]).toBe("admin@smv.mx")
    expect(filas[1][2]).toBe("BORRAR")
  })

  it("genera CSV de auditoría correctamente", () => {
    const csv = generarCSVAuditoria(mockEventos)
    expect(csv).toContain('"Fecha y Hora","Usuario","Accion","Coleccion","ID Documento","Resumen de Operacion"')
    expect(csv).toContain('"compras@smv.mx"')
    expect(csv).toContain('"CREAR"')
    expect(csv).toContain('"ordenes"')
  })
})
