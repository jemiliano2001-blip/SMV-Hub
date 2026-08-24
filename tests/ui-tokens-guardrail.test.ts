import { describe, expect, it } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

/**
 * Guardrail de consistencia UI (Fase 5).
 * Prohíbe chrome legacy (white/slate/gray) en pantalla salvo allowlist:
 * - clases `print:*`
 * - placeholders de foto en gafetes (badge físico)
 */

const ROOT = join(process.cwd(), "app")

const BANNED =
  /\b(bg-white|bg-slate-\S+|text-slate-\S+|border-slate-\S+|bg-gray-\S+|text-gray-\S+|border-gray-\S+)\b/g

/** Archivos donde el chrome slate/gray es intencional (impresion física / badge). */
const ALLOWLIST_FILES = new Set([
  join("gafetes", "GafetesView.tsx").replace(/\\/g, "/"),
])

function walkTsx(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      walkTsx(full, out)
      continue
    }
    if (name.endsWith(".tsx") || name.endsWith(".ts")) out.push(full)
  }
  return out
}

describe("UI tokens guardrail", () => {
  it("no introduce chrome white/slate/gray fuera de print: y allowlist", () => {
    const files = walkTsx(ROOT)
    const violations: string[] = []

    for (const file of files) {
      const rel = relative(ROOT, file).replace(/\\/g, "/")
      if (ALLOWLIST_FILES.has(rel)) continue

      const lines = readFileSync(file, "utf8").split(/\r?\n/)
      lines.forEach((line, idx) => {
        if (line.includes("print:")) return
        const matches = line.match(BANNED)
        if (!matches) return
        for (const m of matches) {
          violations.push(`${rel}:${idx + 1} → ${m}`)
        }
      })
    }

    expect(
      violations,
      [
        "Chrome legacy detectado. Usa tokens (bg-card, border-border, text-foreground, text-muted-foreground, bg-muted).",
        "Permitido: clases print:* y app/gafetes/GafetesView.tsx (placeholders de badge).",
        "",
        ...violations.slice(0, 40),
        violations.length > 40 ? `… y ${violations.length - 40} más` : "",
      ]
        .filter(Boolean)
        .join("\n")
    ).toEqual([])
  })
})
