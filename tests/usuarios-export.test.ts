import { describe, expect, it } from "vitest"
import {
  armarFilasUsuarios,
  generarCSVUsuarios,
  COLUMNAS_EXCEL_USUARIOS,
} from "@/lib/usuarios-export"
import type { UsuarioAdmin } from "@/lib/hooks/useUsuarios"
import type { Operador } from "@/lib/schemas"

describe("usuarios-export", () => {
  const mockUsuarios: UsuarioAdmin[] = [
    {
      id: "uid-1",
      email: "admin@smv.mx",
      rol: "admin",
      plantilla: "admin",
      modulos: ["ordenes", "reportes", "usuarios", "auditoria"],
      esSuperAdmin: true,
      atiendeDocumentosVenta: true,
      editaHorasExtra: true,
      operadorId: "op-1",
      operadorNombre: "Juan Pérez",
      activo: true,
      proveedor: "google",
      creadoPor: "sistema",
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    },
    {
      id: "uid-2",
      email: "diseno@smv.mx",
      rol: "diseno",
      plantilla: "diseno",
      modulos: ["cotizaciones", "requisiciones", "horas-extra"],
      esSuperAdmin: false,
      atiendeDocumentosVenta: false,
      editaHorasExtra: false,
      operadorId: null,
      operadorNombre: null,
      activo: false,
      proveedor: "password",
      creadoPor: "sistema",
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    },
  ]

  const mockOperadoresMap = new Map<string, Operador>([
    [
      "op-1",
      {
        id: "op-1",
        nombre: "Juan Pérez",
        area: "taller",
        activo: true,
        creadoEn: new Date(),
        actualizadoEn: new Date(),
      },
    ],
  ])

  it("define columnas para exportación", () => {
    expect(COLUMNAS_EXCEL_USUARIOS.length).toBeGreaterThan(5)
    expect(COLUMNAS_EXCEL_USUARIOS.map((c) => c.header)).toContain("Correo")
    expect(COLUMNAS_EXCEL_USUARIOS.map((c) => c.header)).toContain("Plantilla")
  })

  it("arma filas con datos mapeados correctamente", () => {
    const filas = armarFilasUsuarios(mockUsuarios, mockOperadoresMap)
    expect(filas).toHaveLength(2)

    // Fila 1
    expect(filas[0][0]).toBe("admin@smv.mx")
    expect(filas[0][1]).toBe("Juan Pérez")
    expect(filas[0][2]).toBe("taller")
    expect(filas[0][3]).toBe("admin")
    expect(filas[0][5]).toBe(4) // total modulos
    expect(filas[0][6]).toBe("SÍ") // super admin
    expect(filas[0][11]).toBe("ACTIVO")

    // Fila 2
    expect(filas[1][0]).toBe("diseno@smv.mx")
    expect(filas[1][1]).toBe("—")
    expect(filas[1][6]).toBe("NO")
    expect(filas[1][11]).toBe("INACTIVO")
  })

  it("genera string CSV válido con comillas de escape", () => {
    const csv = generarCSVUsuarios(mockUsuarios, mockOperadoresMap)
    expect(csv).toContain('"Correo","Operador Vinculado"')
    expect(csv).toContain('"admin@smv.mx"')
    expect(csv).toContain('"diseno@smv.mx"')
  })
})
