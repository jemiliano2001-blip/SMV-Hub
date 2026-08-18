import { afterEach, describe, expect, it } from "vitest"
import {
  configGeneracionJson,
  debeOmitirTemperatureGemini,
} from "@/lib/gemini-generation-config"

describe("gemini-generation-config", () => {
  const original = process.env.GEMINI_OMIT_TEMPERATURE

  afterEach(() => {
    if (original === undefined) delete process.env.GEMINI_OMIT_TEMPERATURE
    else process.env.GEMINI_OMIT_TEMPERATURE = original
  })

  it("incluye temperature por default", () => {
    delete process.env.GEMINI_OMIT_TEMPERATURE
    const config = configGeneracionJson({
      responseSchema: { type: "object" },
      temperature: 0,
    })
    expect(config.temperature).toBe(0)
    expect(config.responseMimeType).toBe("application/json")
  })

  it("omite temperature cuando GEMINI_OMIT_TEMPERATURE=true", () => {
    process.env.GEMINI_OMIT_TEMPERATURE = "true"
    expect(debeOmitirTemperatureGemini()).toBe(true)
    const config = configGeneracionJson({
      responseSchema: { type: "object" },
    })
    expect(config).not.toHaveProperty("temperature")
  })
})
