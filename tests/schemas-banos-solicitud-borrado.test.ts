import { describe, it, expect } from "vitest"
import {
  RegistroBanoSchema,
  CrearSolicitudBorradoBanoInputSchema,
  SolicitudBorradoBanoSchema,
  TipoNotificacionSchema,
  OrigenModuloNotificacionSchema,
} from "@/lib/schemas"

describe("RegistroBanoSchema retrocompatibilidad", () => {
  it("acepta un registro viejo sin los campos nuevos", () => {
    const registroViejo = {
      id: "r1",
      operador: "Juan Pérez",
      bano: "Baño #1" as const,
      horaEntrada: "10:00",
      horaLlegada: "10:07",
      fecha: "2026-07-30",
      tiempoMinutos: 7,
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    }
    expect(() => RegistroBanoSchema.parse(registroViejo)).not.toThrow()
  })

  it("acepta los campos nuevos cuando están presentes", () => {
    const registroNuevo = {
      id: "r2",
      operador: "Ana López",
      bano: "CNC" as const,
      horaEntrada: "11:00",
      horaLlegada: null,
      fecha: "2026-07-30",
      tiempoMinutos: null,
      creadoEn: new Date(),
      actualizadoEn: new Date(),
      creadoPorUid: "uid-1",
      creadoPorNombre: "Ana López",
      solicitudBorradoEstado: "pendiente" as const,
    }
    const parsed = RegistroBanoSchema.parse(registroNuevo)
    expect(parsed.solicitudBorradoEstado).toBe("pendiente")
  })
})

describe("CrearSolicitudBorradoBanoInputSchema", () => {
  it("acepta un motivo distinto de 'otro' sin nota", () => {
    expect(() =>
      CrearSolicitudBorradoBanoInputSchema.parse({ registroId: "r1", motivo: "duplicado" })
    ).not.toThrow()
  })

  it("rechaza motivo 'otro' sin nota", () => {
    expect(() =>
      CrearSolicitudBorradoBanoInputSchema.parse({ registroId: "r1", motivo: "otro" })
    ).toThrow()
  })

  it("acepta motivo 'otro' con nota", () => {
    expect(() =>
      CrearSolicitudBorradoBanoInputSchema.parse({
        registroId: "r1",
        motivo: "otro",
        nota: "Se registró en el baño equivocado por error de dedo",
      })
    ).not.toThrow()
  })
})

describe("SolicitudBorradoBanoSchema", () => {
  it("valida un documento completo", () => {
    const doc = {
      id: "s1",
      registroId: "r1",
      registroResumen: {
        operador: "Juan Pérez",
        bano: "Baño #1" as const,
        fecha: "2026-07-30",
        horaEntrada: "10:00",
        horaLlegada: "10:07",
        tiempoMinutos: 7,
      },
      motivo: "duplicado" as const,
      solicitadoPorUid: "uid-1",
      solicitadoPorNombre: "Ana López",
      estado: "pendiente" as const,
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    }
    expect(SolicitudBorradoBanoSchema.parse(doc).estado).toBe("pendiente")
  })
})

describe("Notificaciones extendidas", () => {
  it("acepta los tipos y origen de baños", () => {
    expect(TipoNotificacionSchema.parse("banos_solicitud_creada")).toBe("banos_solicitud_creada")
    expect(TipoNotificacionSchema.parse("banos_solicitud_resuelta")).toBe("banos_solicitud_resuelta")
    expect(OrigenModuloNotificacionSchema.parse("banos")).toBe("banos")
  })
})
