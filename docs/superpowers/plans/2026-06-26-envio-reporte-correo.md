# Envío del reporte por correo — Plan de implementación

> **Para agentes:** usa `superpowers:executing-plans` para seguir este plan task-by-task.

**Goal:** Agregar botón "✉ Enviar" en `/reportes` que manda el reporte activo (KPIs + tabla agrupada)
como correo HTML a uno o varios destinatarios, usando Resend como servicio de envío.

**Spec:** `docs/superpowers/specs/2026-06-26-envio-reporte-correo.md`

**Tech stack:** Next.js 16 App Router, React 19, Tailwind v4, TypeScript strict, Zod, react-hook-form,
Firebase auth, Resend SDK.

---

## Constraints

- Tipado estricto: sin `any` ni `@ts-ignore`.
- Validación Zod en cliente **y** servidor.
- Auth: `verificarUsuarioAutorizado` en el API route (mismo patrón que `/api/extraer`).
- Errores nunca rompen la UI; banners claros de éxito/error.
- No se modifica `lib/reportes.ts` ni schemas de Firestore.
- `npm run lint && npm run build && npm test` deben pasar al final.

---

## File Map

| Acción | Archivo | Rol |
|--------|---------|-----|
| Nuevo | `lib/email-reporte.ts` | Renderizador HTML puro; función `renderizarEmailReporte()` |
| Nuevo | `app/api/enviar-reporte/route.ts` | POST handler: auth + validación + Resend |
| Nuevo | `app/reportes/components/ModalEnviarReporte.tsx` | Modal UI con react-hook-form + zod |
| Modificar | `app/reportes/components/CabeceraReporte.tsx` | Botón "Enviar" + integrar modal |
| Nuevo | `tests/email-reporte.test.ts` | Pruebas unitarias para el renderizador |
| Modificar | `CLAUDE.md` | Documentar `RESEND_API_KEY` y `RESEND_FROM` |

---

## Task 0: Instalar Resend y actualizar documentación

**Files:**
- Modify: `package.json` (via npm)
- Modify: `CLAUDE.md`

- [ ] **Step 1: Instalar dependencia**

```bash
npm install resend
```

Expected: `resend` aparece en `dependencies` de `package.json`.

- [ ] **Step 2: Documentar env vars**

En `CLAUDE.md`, dentro de la sección "Variables de entorno", agregar al ejemplo `.env.local`:

```bash
# Resend (para envío de reportes por correo)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
RESEND_FROM=noreply@smv.mx   # o "Compras SMV <noreply@smv.mx>"
```

---

## Task 1: Renderizador de email HTML (`lib/email-reporte.ts`)

**Files:**
- New: `lib/email-reporte.ts`

**Interfaces:**
- Exports: `renderizarEmailReporte(payload: EmailReportePayload): string`
- Types: `EmailReportePayload` (reexportado para uso en API route y tests)

Este módulo es **pura lógica** — sin imports de React, Firebase, ni DOM.  
Usa `Intl.NumberFormat` para formatear montos (misma lógica que el resto del proyecto).

- [ ] **Step 1: Implementar `lib/email-reporte.ts`**

```typescript
import type { Grupo, Kpis } from "@/lib/reportes"

export type EmailReportePayload = {
  titulo: string
  subtitulo: string
  moneda: string
  kpis: Kpis
  grupos: Grupo[]
  totalGeneral: number
}

function fmt(monto: number, moneda: string): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: 2,
  }).format(monto)
}

export function renderizarEmailReporte(p: EmailReportePayload): string {
  const { titulo, subtitulo, moneda, kpis, grupos, totalGeneral } = p

  // ---- KPI row ----
  const kpiCeldas = [
    { label: "Órdenes", valor: String(kpis.numOrdenes) },
    { label: "Gasto total", valor: fmt(kpis.totalComprado, moneda) },
    { label: "Artículos", valor: String(kpis.numArticulos) },
    { label: "Proveedores", valor: String(kpis.numProveedores) },
  ]
    .map(
      ({ label, valor }) => `
      <td style="padding:8px 16px;text-align:center;border:1px solid #e2e8f0;background:#f8fafc">
        <div style="font-size:11px;color:#64748b;margin-bottom:2px">${label}</div>
        <div style="font-size:16px;font-weight:700;color:#1e293b">${valor}</div>
      </td>`
    )
    .join("")

  // ---- Tabla de grupos ----
  const filas = grupos
    .flatMap((g) => {
      const headerFila = `
      <tr>
        <td colspan="7" style="background:#eff6ff;padding:6px 8px;font-weight:700;font-size:12px;color:#1d4ed8;border-top:2px solid #bfdbfe">
          ${esc(g.clave)}
        </td>
      </tr>`

      const lineasFila = g.lineas.map((l) => {
        const fecha = l.dia
          ? new Date(l.dia).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "2-digit" })
          : ""
        return `
      <tr>
        <td style="${tdStyle}">${esc(fecha)}</td>
        <td style="${tdStyle}">${esc(l.referencia)}</td>
        <td style="${tdStyle}">${esc(l.proveedor)}</td>
        <td style="${tdStyle};max-width:200px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(l.descripcion)}</td>
        <td style="${tdStyle};text-align:right">${l.cantidad != null ? l.cantidad : ""}</td>
        <td style="${tdStyle};text-align:right">${l.precioUnitario != null ? fmt(l.precioUnitario, moneda) : ""}</td>
        <td style="${tdStyle};text-align:right;font-weight:600">${fmt(l.total, moneda)}</td>
      </tr>`
      })

      const subtotalFila = `
      <tr>
        <td colspan="6" style="${tdStyle};text-align:right;font-weight:600;background:#f1f5f9">Subtotal ${esc(g.clave)}</td>
        <td style="${tdStyle};text-align:right;font-weight:700;background:#f1f5f9">${fmt(g.total, moneda)}</td>
      </tr>`

      return [headerFila, ...lineasFila, subtotalFila]
    })
    .join("")

  const totalFila = `
    <tr>
      <td colspan="6" style="${tdStyle};text-align:right;font-weight:700;font-size:13px;border-top:2px solid #1e293b">TOTAL GENERAL</td>
      <td style="${tdStyle};text-align:right;font-weight:700;font-size:14px;border-top:2px solid #1e293b">${fmt(totalGeneral, moneda)}</td>
    </tr>`

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc">
    <tr><td align="center" style="padding:24px 16px">
      <table width="700" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden">

        <!-- Cabecera -->
        <tr>
          <td style="background:#1e3a5f;padding:20px 24px">
            <div style="font-size:20px;font-weight:900;color:#ffffff;letter-spacing:1px">SMV</div>
            <div style="font-size:16px;font-weight:700;color:#93c5fd;margin-top:4px">${esc(titulo)}</div>
            <div style="font-size:13px;color:#bfdbfe;margin-top:2px">${esc(subtitulo)}</div>
          </td>
        </tr>

        <!-- KPIs -->
        <tr>
          <td style="padding:16px 24px">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>${kpiCeldas}</tr>
            </table>
          </td>
        </tr>

        <!-- Tabla de órdenes -->
        <tr>
          <td style="padding:0 24px 24px">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:12px">
              <thead>
                <tr style="background:#f1f5f9">
                  <th style="${thStyle}">Fecha</th>
                  <th style="${thStyle}">Referencia</th>
                  <th style="${thStyle}">Proveedor</th>
                  <th style="${thStyle}">Descripción</th>
                  <th style="${thStyle};text-align:right">Cant.</th>
                  <th style="${thStyle};text-align:right">P. Unit.</th>
                  <th style="${thStyle};text-align:right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${filas}
                ${totalFila}
              </tbody>
            </table>
          </td>
        </tr>

        <!-- Pie -->
        <tr>
          <td style="padding:12px 24px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center">
            Generado automáticamente por SMV Hub
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ---- Helpers privados ----

const thStyle = "padding:8px;text-align:left;font-weight:700;color:#475569;font-size:11px;border-bottom:2px solid #cbd5e1"
const tdStyle = "padding:5px 8px;border-bottom:1px solid #f1f5f9;color:#334155;font-size:12px;vertical-align:top"

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
```

---

## Task 2: API route `app/api/enviar-reporte/route.ts`

**Files:**
- New: `app/api/enviar-reporte/route.ts`

**Interfaces:**
- POST `{ destinatarios, asunto?, reporte }` → `{ ok: true, enviados: number }` o error JSON.
- Reutiliza `verificarUsuarioAutorizado` de `lib/api-auth.ts`.

- [ ] **Step 1: Crear el route handler**

```typescript
import { NextRequest } from "next/server"
import { Resend } from "resend"
import { z } from "zod"
import { verificarUsuarioAutorizado } from "@/lib/api-auth"
import { renderizarEmailReporte, type EmailReportePayload } from "@/lib/email-reporte"
import type { Grupo, Kpis } from "@/lib/reportes"

const KpisSchema = z.object({
  totalComprado: z.number(),
  numOrdenes: z.number(),
  numArticulos: z.number(),
  numProveedores: z.number(),
  destinoTop: z.string(),
  destinoTopPct: z.number(),
})

const GrupoSchema = z.object({
  clave: z.string(),
  subtotal: z.number(),
  total: z.number(),
  lineas: z.array(
    z.object({
      ordenId: z.string(),
      referencia: z.string(),
      dia: z.union([z.string(), z.date(), z.null()]),
      proveedor: z.string(),
      descripcion: z.string(),
      cantidad: z.number().nullable(),
      precioUnitario: z.number().nullable(),
      subtotal: z.number(),
      total: z.number(),
      requisitor: z.string(),
      cuentaCargo: z.string(),
      destino: z.string(),
      moneda: z.string(),
    })
  ),
})

const BodySchema = z.object({
  destinatarios: z
    .array(z.string().email("Correo inválido"))
    .min(1, "Agrega al menos un destinatario"),
  asunto: z.string().optional(),
  reporte: z.object({
    titulo: z.string(),
    subtitulo: z.string(),
    moneda: z.string(),
    kpis: KpisSchema,
    grupos: z.array(GrupoSchema),
    totalGeneral: z.number(),
  }),
})

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await verificarUsuarioAutorizado(request)
  if (!auth.ok) return auth.response

  const raw = await request.json().catch(() => null)
  if (!raw) {
    return Response.json({ error: "Cuerpo JSON inválido" }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    const mensaje = parsed.error.errors.map((e) => e.message).join("; ")
    return Response.json({ error: mensaje }, { status: 422 })
  }

  const { destinatarios, asunto, reporte } = parsed.data
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM ?? "Compras SMV <noreply@resend.dev>"

  if (!apiKey) {
    console.error("[enviar-reporte] RESEND_API_KEY no configurada")
    return Response.json({ error: "Servicio de correo no configurado" }, { status: 500 })
  }

  const resend = new Resend(apiKey)
  const asuntoFinal = asunto ?? `Reporte de compras — ${reporte.subtitulo}`

  // Normalizar lineas.dia: el cliente envía fechas como strings ISO
  const gruposNorm: Grupo[] = reporte.grupos.map((g) => ({
    ...g,
    lineas: g.lineas.map((l) => ({
      ...l,
      dia: l.dia ? new Date(l.dia as string) : null,
    })),
  }))

  const payload: EmailReportePayload = {
    ...reporte,
    grupos: gruposNorm,
    kpis: reporte.kpis as Kpis,
  }

  const html = renderizarEmailReporte(payload)

  const { error } = await resend.emails.send({
    from,
    to: destinatarios,
    subject: asuntoFinal,
    html,
  })

  if (error) {
    console.error("[enviar-reporte] Resend error:", error)
    return Response.json(
      { error: "No se pudo enviar el correo. Intenta de nuevo." },
      { status: 502 }
    )
  }

  return Response.json({ ok: true, enviados: destinatarios.length })
}
```

---

## Task 3: Modal UI `app/reportes/components/ModalEnviarReporte.tsx`

**Files:**
- New: `app/reportes/components/ModalEnviarReporte.tsx`

**Interfaces:**
- Props: `{ abierto: boolean; onCerrar: () => void; asunto: string; datosReporte: EmailReportePayload }`
- Obtiene el ID token con `getIdToken()` del usuario de `useUsuario`.

- [ ] **Step 1: Crear el componente**

```typescript
'use client'

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { X, Send, Loader2 } from "lucide-react"
import { getIdToken } from "firebase/auth"
import { useUsuario } from "@/lib/auth"
import type { EmailReportePayload } from "@/lib/email-reporte"

const FormSchema = z.object({
  destinatarios: z
    .string()
    .min(1, "Escribe al menos un correo")
    .refine(
      (v) => {
        const correos = v
          .split(/[\n,;]+/)
          .map((s) => s.trim())
          .filter(Boolean)
        return correos.every((c) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c))
      },
      { message: "Uno o más correos tienen formato inválido" }
    ),
  asunto: z.string().min(1, "El asunto no puede estar vacío"),
})

type FormValues = z.infer<typeof FormSchema>

type Props = {
  abierto: boolean
  onCerrar: () => void
  asunto: string
  datosReporte: EmailReportePayload
}

export default function ModalEnviarReporte({ abierto, onCerrar, asunto, datosReporte }: Props) {
  const { usuario } = useUsuario()
  const [estado, setEstado] = useState<"idle" | "enviando" | "ok" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { destinatarios: "", asunto },
  })

  if (!abierto) return null

  function cerrar() {
    reset()
    setEstado("idle")
    setErrorMsg(null)
    onCerrar()
  }

  async function onSubmit(values: FormValues) {
    if (!usuario) return
    setEstado("enviando")
    setErrorMsg(null)

    const destinatarios = values.destinatarios
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)

    try {
      const token = await getIdToken(usuario)
      const res = await fetch("/api/enviar-reporte", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          destinatarios,
          asunto: values.asunto,
          reporte: datosReporte,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? "Error desconocido")
      }

      setEstado("ok")
      setTimeout(cerrar, 2000)
    } catch (err) {
      setEstado("error")
      setErrorMsg(err instanceof Error ? err.message : "No se pudo enviar el correo.")
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) cerrar() }}
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl p-6 mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900">Enviar reporte por correo</h2>
          <button onClick={cerrar} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {estado === "ok" && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800 mb-4">
            ✓ Correo enviado correctamente.
          </div>
        )}

        {estado === "error" && errorMsg && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800 mb-4">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Destinatarios
              <span className="text-gray-400 font-normal ml-1">(separados por coma o línea nueva)</span>
            </label>
            <textarea
              {...register("destinatarios")}
              rows={3}
              placeholder="gerencia@smv.mx, contabilidad@smv.mx"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              disabled={estado === "enviando" || estado === "ok"}
            />
            {errors.destinatarios && (
              <p className="mt-1 text-xs text-red-600">{errors.destinatarios.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Asunto</label>
            <input
              {...register("asunto")}
              type="text"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={estado === "enviando" || estado === "ok"}
            />
            {errors.asunto && (
              <p className="mt-1 text-xs text-red-600">{errors.asunto.message}</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={cerrar}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={estado === "enviando"}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={estado === "enviando" || estado === "ok"}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {estado === "enviando" ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</>
              ) : (
                <><Send className="h-4 w-4" /> Enviar</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

---

## Task 4: Actualizar `CabeceraReporte.tsx`

**Files:**
- Modify: `app/reportes/components/CabeceraReporte.tsx`

**Interfaces:**
- Nuevos props: `asunto: string`, `datosReporte: EmailReportePayload`

- [ ] **Step 1: Agregar botón "Enviar" y modal**

Agregar estado `modalAbierto`, importar `ModalEnviarReporte`, y agregar el botón junto a "Guardar PDF":

```typescript
'use client'

import Image from "next/image"
import { useState } from "react"
import { Mail } from "lucide-react"
import ModalEnviarReporte from "@/app/reportes/components/ModalEnviarReporte"
import type { EmailReportePayload } from "@/lib/email-reporte"

type Props = {
  titulo: string
  subtitulo: string
  asunto: string
  datosReporte: EmailReportePayload
}

export default function CabeceraReporte({ titulo, subtitulo, asunto, datosReporte }: Props) {
  const [modalAbierto, setModalAbierto] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 print:mb-4 print:pb-2">
        <div className="flex items-center gap-4">
          <Image
            src="/smv-logo.png"
            alt="SMV"
            width={120}
            height={40}
            className="object-contain print:h-8"
            style={{ width: "auto", height: "auto" }}
            priority
          />
          <div>
            <h1 className="text-xl font-bold text-gray-900 print:text-lg">{titulo}</h1>
            <p className="text-sm text-gray-500 print:text-xs">{subtitulo}</p>
          </div>
        </div>

        <div className="no-print flex items-center gap-2">
          <button
            onClick={() => setModalAbierto(true)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Mail className="h-4 w-4" />
            Enviar
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            ⬇ Guardar PDF
          </button>
        </div>
      </div>

      <ModalEnviarReporte
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        asunto={asunto}
        datosReporte={datosReporte}
      />
    </>
  )
}
```

---

## Task 5: Pasar datos al CabeceraReporte desde ReporteView

**Files:**
- Modify: `app/reportes/ReporteView.tsx`

Los datos ya están calculados en `ReporteView` (`kpis`, `grupos`, `totalGeneral`, `monedaActiva`, etc.).
Solo hay que construir el `datosReporte` y el `asunto` y pasarlos a `CabeceraReporte`.

- [ ] **Step 1: Agregar import e inyectar props**

En `ReporteView.tsx`, importar `EmailReportePayload` y agregar:

```typescript
import type { EmailReportePayload } from "@/lib/email-reporte"

// Dentro del return, donde ya existe <CabeceraReporte ...>:
const asunto = `Reporte de compras — ${tituloReporte(periodo.desde, periodo.hasta)}`
const datosReporte: EmailReportePayload = {
  titulo: "Reporte de compras",
  subtitulo: tituloReporte(periodo.desde, periodo.hasta),
  moneda: monedaActiva,
  kpis,
  grupos,
  totalGeneral,
}
```

Y actualizar la invocación del componente:

```tsx
<CabeceraReporte
  titulo="Reporte de compras"
  subtitulo={tituloReporte(periodo.desde, periodo.hasta)}
  asunto={asunto}
  datosReporte={datosReporte}
/>
```

---

## Task 6: Tests para `lib/email-reporte.ts`

**Files:**
- New: `tests/email-reporte.test.ts`

- [ ] **Step 1: Crear pruebas unitarias**

```typescript
import { describe, it, expect } from "vitest"
import { renderizarEmailReporte, type EmailReportePayload } from "@/lib/email-reporte"

const payloadBase: EmailReportePayload = {
  titulo: "Reporte de compras",
  subtitulo: "junio 2026",
  moneda: "USD",
  kpis: {
    totalComprado: 1500,
    numOrdenes: 3,
    numArticulos: 12,
    numProveedores: 2,
    destinoTop: "SMV",
    destinoTopPct: 80,
  },
  grupos: [
    {
      clave: "McMaster",
      subtotal: 900,
      total: 1000,
      lineas: [
        {
          ordenId: "ord1",
          referencia: "INV-001",
          dia: new Date("2026-06-10"),
          proveedor: "McMaster",
          descripcion: "Tornillo M8",
          cantidad: 10,
          precioUnitario: 90,
          subtotal: 900,
          total: 1000,
          requisitor: "Juan",
          cuentaCargo: "Stock",
          destino: "SMV",
          moneda: "USD",
        },
      ],
    },
  ],
  totalGeneral: 1000,
}

describe("renderizarEmailReporte", () => {
  it("produce HTML válido con el título", () => {
    const html = renderizarEmailReporte(payloadBase)
    expect(html).toContain("Reporte de compras")
    expect(html).toContain("junio 2026")
  })

  it("incluye los KPIs", () => {
    const html = renderizarEmailReporte(payloadBase)
    expect(html).toContain("Órdenes")
    expect(html).toContain("3")
    expect(html).toContain("Proveedores")
    expect(html).toContain("2")
  })

  it("incluye la clave del grupo y la referencia de la línea", () => {
    const html = renderizarEmailReporte(payloadBase)
    expect(html).toContain("McMaster")
    expect(html).toContain("INV-001")
    expect(html).toContain("Tornillo M8")
  })

  it("escapa caracteres HTML en los datos", () => {
    const html = renderizarEmailReporte({
      ...payloadBase,
      grupos: [
        {
          ...payloadBase.grupos[0],
          clave: "<script>alert(1)</script>",
          lineas: [
            {
              ...payloadBase.grupos[0].lineas[0],
              descripcion: 'Pieza "especial" & fuerte',
            },
          ],
        },
      ],
    })
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;")
    expect(html).toContain("&amp;")
    expect(html).toContain("&quot;")
  })

  it("formatea montos con Intl.NumberFormat es-MX", () => {
    const html = renderizarEmailReporte(payloadBase)
    // USD 1,000.00 en es-MX
    expect(html).toContain("1,000")
  })

  it("maneja grupos vacíos sin romper", () => {
    const html = renderizarEmailReporte({ ...payloadBase, grupos: [], totalGeneral: 0 })
    expect(html).toContain("TOTAL GENERAL")
  })
})
```

---

## Task 7: Lint, build y tests

- [ ] **Step 1: Lint**

```bash
npm run lint
```

Expected: 0 errores.

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: compila sin errores.

- [ ] **Step 3: Tests**

```bash
npm test
```

Expected: todos los tests pasan (incluyendo los nuevos de `email-reporte.test.ts`).

---

## Plan Self-Review

| Requirement | Task |
|-------------|------|
| Instalar Resend | Task 0 |
| Template HTML testeado | Task 1 + Task 6 |
| API route auth + validación | Task 2 |
| Modal UI con react-hook-form+zod | Task 3 |
| Botón en CabeceraReporte | Task 4 |
| Props datosReporte desde ReporteView | Task 5 |
| `npm run lint && build && test` | Task 7 |

Variables de entorno necesarias en `.env.local`:
```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
RESEND_FROM=noreply@smv.mx
```

Sin cambios en `lib/reportes.ts`, schemas de Firestore, ni `app/globals.css`.
