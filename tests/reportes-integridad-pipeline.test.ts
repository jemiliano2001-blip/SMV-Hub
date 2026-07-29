import { describe, expect, it, vi } from "vitest"
import { IntegrityDomainError } from "../functions/src/reportes-integridad/errores"
import { runIntegrityWithoutBlockingMirror } from "../functions/src/reportes-integridad/pipeline"

describe("aislamiento del pipeline de Integridad", () => {
  it("conserva el resultado del espejo cuando Integridad rechaza la fuente", async () => {
    const onDomainError = vi.fn()
    const fallback = { runId: null, cases: 0 }

    const outcome = await runIntegrityWithoutBlockingMirror({
      fallback,
      run: async () => {
        throw new IntegrityDomainError(
          "SOURCE_SNAPSHOT_INVALID",
          "Fuente incompleta."
        )
      },
      onDomainError,
    })

    expect(outcome).toEqual({
      result: fallback,
      errorCode: "SOURCE_SNAPSHOT_INVALID",
    })
    expect(onDomainError).toHaveBeenCalledOnce()
  })

  it("publica el resultado válido y no registra error", async () => {
    const result: { runId: string | null; cases: number } = {
      runId: "run-ok",
      cases: 4,
    }
    await expect(
      runIntegrityWithoutBlockingMirror({
        fallback: { runId: null, cases: 0 },
        run: async () => result,
      })
    ).resolves.toEqual({ result, errorCode: null })
  })

  it("no oculta errores inesperados de programación", async () => {
    await expect(
      runIntegrityWithoutBlockingMirror({
        fallback: { runId: null, cases: 0 },
        run: async () => {
          throw new TypeError("bug")
        },
      })
    ).rejects.toThrow(TypeError)
  })
})
