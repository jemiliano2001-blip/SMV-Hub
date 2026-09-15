import { describe, expect, it } from "vitest"
import { compararNumerosParte, extraerNumerosParte, numerosParteDePieza } from "@/lib/memoria-operativa/numero-parte"

/** Descripciones reales de órdenes de smv-brain (muestra de calibración C0, 2026-09-15). */
describe("extraerNumerosParte — números de parte embebidos en descripciones reales", () => {
  it.each([
    ['Compression Spring 0.5" Long, 0.125" OD, 0.093" ID 9657K266', ["9657K266"]],
    ["1866-1030-ND\nMDR-10-5\nAC/DC DIN RAIL SUPPLY 5V 10W\nFrancisco", ["18661030ND", "MDR105"]],
    ["NEW IN BOX GENUINE OMRON V680S-D2KF68M V680SD2KF68M RFID TAG (335821173102)", ["V680SD2KF68M"]],
    ["140M-C2E-C20 - Guardamotor 14.5–20 A", ["140MC2EC20"]],
    ["Nitride-Coated H13 Tool Steel Ejector Pin, 1/4\" Diameter, 6\" Long, 93772A118", ["93772A118"]],
    ["Sensor IFM PN2271", ["PN2271"]],
    ["1PC New SMC CDUJB10-6DM CDUJB106DM Cylinder Free Shipping #SM (3890290123)", ["CDUJB106DM"]],
    ["F1-023273 TRS 0075", ["F1023273"]],
    ["1412762-ND / 1412762 - CONN HOOD TOP ENTRY SZB24 PG21", ["1412762ND"]],
  ])("%s → %j", (descripcion, esperado) => {
    expect(extraerNumerosParte(descripcion)).toEqual(esperado)
  })

  it("no confunde unidades, dimensiones, listados ni referencias con números de parte", () => {
    expect(
      extraerNumerosParte(
        "Murrelektronik Cat5e Ethernet connection cable, M12 axial male D-coded to RJ45 axial male, 4-pole, shielded 49.2ft/ 15m cable length IP67 M12 IP20 RJ45 data. 7700-44711-S7V1500"
      )
    ).toEqual(["770044711S7V1500"])
    expect(extraerNumerosParte("30X47X6 HMSA10 RG (MRO# 2576130)")).toEqual(["HMSA10"])
    expect(extraerNumerosParte("45X68X10MM Nitrile Rotary Shaft Seal 120VAC 1000PCS 22AWG")).toEqual([])
    expect(extraerNumerosParte("Tracking 1Z8748W60230354240 SO S01251")).toEqual([])
    expect(extraerNumerosParte("Husky 16 oz. 100% Full Synthetic Compressor Oil")).toEqual([])
    expect(extraerNumerosParte("XHF 1000 PCS AWG 22/0.5mm² Wire Ferrules Insulated Copper Crimp")).toEqual([])
    expect(extraerNumerosParte("Alpha Wire 3053 BL001 602-3053-1000-06 Hook-up Wire 20AWG")).toEqual([])
    expect(extraerNumerosParte("")).toEqual([])
    expect(extraerNumerosParte(null)).toEqual([])
  })

  it("corta la cola 'Your Reference …' de McMaster (trae referencias internas, no números de parte)", () => {
    expect(
      extraerNumerosParte("Norton Toolroom Grinding Wheel for Metals 38A, 7\" Diameter, 4397A68 Your Reference Almacen / Suprajit S01527")
    ).toEqual(["4397A68"])
  })
})

describe("numerosParteDePieza — explícito primero, embebidos después, sin duplicar", () => {
  it("combina el numeroParte del formulario con los de la descripción", () => {
    expect(numerosParteDePieza("pn-2271", "Sensor IFM PN2271 inductivo")).toEqual(["PN2271"])
    expect(numerosParteDePieza("9657K266", "Compression Spring 0.5\" Long")).toEqual(["9657K266"])
    expect(numerosParteDePieza(null, "Compression Spring 9657K266")).toEqual(["9657K266"])
    expect(numerosParteDePieza("ABC-123", "Pieza 9657K266")).toEqual(["ABC123", "9657K266"])
  })
})

describe("compararNumerosParte — la regla que separa misma pieza de misma familia (C0)", () => {
  it("igual si comparten alguno; distinto si ambos tienen y ninguno coincide; indeterminado si falta alguno", () => {
    expect(compararNumerosParte(["9657K266"], ["9657K266"])).toBe("igual")
    expect(compararNumerosParte(["9657K266"], ["9657K493"])).toBe("distinto")
    expect(compararNumerosParte(["140MC2EC20"], ["140MC2EC16"])).toBe("distinto")
    expect(compararNumerosParte(["V680SD2KF68M"], ["V680SD2KF68M", "OTRO1"])).toBe("igual")
    expect(compararNumerosParte([], ["9657K266"])).toBe("indeterminado")
    expect(compararNumerosParte([], [])).toBe("indeterminado")
  })
})
