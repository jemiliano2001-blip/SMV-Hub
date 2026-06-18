'use client'

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Upload, X } from 'lucide-react'
import { z } from 'zod'
import { NuevaCompraFormSchema, type NuevaCompraForm, type ExtraccionInvoice } from '@/lib/schemas'

// Tipo de entrada del form: incluye opcionales de z.default() (moneda?, items?)
type FormInput = z.input<typeof NuevaCompraFormSchema>

const cls = {
  input: 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50',
  label: 'block text-sm font-medium text-gray-700 mb-1',
  error: 'text-xs text-red-500 mt-1',
  section: 'rounded-xl border border-gray-200 bg-white p-6 shadow-sm',
  heading: 'text-base font-semibold text-gray-900 mb-4',
}

export default function NuevaCompraForm({
  onSubmit: onExternalSubmit,
}: {
  onSubmit?: (data: NuevaCompraForm, imagen: File) => Promise<void>
}) {
  const [imagen, setImagen] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [extrayendo, setExtrayendo] = useState(false)
  const [errorExtraccion, setErrorExtraccion] = useState<string | null>(null)
  const [extraido, setExtraido] = useState(false)

  // Tres parámetros: <InputType, Context, OutputType>
  // → handleSubmit callback recibe NuevaCompraForm (output, con defaults aplicados)
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, NuevaCompraForm>({
    resolver: zodResolver(NuevaCompraFormSchema),
    defaultValues: { moneda: 'USD', items: [], cuentaCargo: '', destino: '' },
  })

  const { fields } = useFieldArray({ control, name: 'items' })

  // Convierte string vacío → null, cualquier otro valor → number
  function numReg(name: Parameters<typeof register>[0]) {
    return register(name, {
      setValueAs: (v: string) => (v === '' || v === null || v === undefined ? null : Number(v)),
    })
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setImagen(file)
    setPreviewUrl(URL.createObjectURL(file))
    setErrorExtraccion(null)
    setExtraido(false)
    setExtrayendo(true)

    try {
      const fd = new FormData()
      fd.append('imagen', file)
      const res = await fetch('/api/extraer', { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok) {
        setErrorExtraccion(data.error ?? 'Error al extraer datos de la factura')
        return
      }

      const ext = data as ExtraccionInvoice
      reset({
        proveedor: ext.proveedor,
        numeroFactura: ext.numeroFactura ?? '',
        fechaFactura: ext.fechaFactura ?? '',
        moneda: ext.moneda,
        subtotal: ext.subtotal,
        impuestos: ext.impuestos,
        total: ext.total,
        items: ext.items,
        requisitor: '',
        ordenTrabajo: '',
        empresa: '',
        cuentaCargo: '',
        destino: '',
      })
      setExtraido(true)
    } catch {
      setErrorExtraccion('Error de red al contactar la API')
    } finally {
      setExtrayendo(false)
    }
  }

  function clearImage() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setImagen(null)
    setPreviewUrl(null)
    setExtraido(false)
    setErrorExtraccion(null)
    reset({ moneda: 'USD', items: [], cuentaCargo: '', destino: '' })
  }

  async function onSubmit(data: NuevaCompraForm) {
    if (!imagen) return
    await onExternalSubmit?.(data, imagen)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      {/* ── Imagen ──────────────────────────────────────────────────── */}
      <section className={cls.section}>
        <h2 className={cls.heading}>Imagen de la factura</h2>

        {!imagen ? (
          <label className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-gray-300 p-10 cursor-pointer hover:border-blue-400 transition-colors">
            <Upload className="h-8 w-8 text-gray-400" />
            <span className="text-sm text-gray-500">Haz clic o arrastra una imagen</span>
            <span className="text-xs text-gray-400">JPG · PNG · WEBP</span>
            <input type="file" accept="image/*" onChange={handleImageChange} className="sr-only" />
          </label>
        ) : (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl!} alt="Factura" className="max-h-72 w-full rounded-lg object-contain bg-gray-50" />
            <button
              type="button"
              onClick={clearImage}
              className="absolute top-2 right-2 rounded-full bg-white p-1 shadow-md hover:bg-gray-100"
              aria-label="Quitar imagen"
            >
              <X className="h-4 w-4 text-gray-600" />
            </button>
            {extrayendo && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-white/80">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <span className="text-sm font-medium text-gray-700">Extrayendo datos con IA…</span>
              </div>
            )}
          </div>
        )}

        {errorExtraccion && (
          <p className="mt-3 text-sm text-red-600">⚠ {errorExtraccion}</p>
        )}
      </section>

      {/* ── Datos de la factura ──────────────────────────────────────── */}
      <section className={cls.section}>
        <h2 className={cls.heading}>
          Datos de la factura
          {extraido && <span className="ml-2 text-xs font-normal text-green-600">✓ Extraído por IA — revisa y corrige si es necesario</span>}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={cls.label}>Proveedor *</label>
            <input {...register('proveedor')} className={cls.input} placeholder="Nombre del proveedor" disabled={extrayendo} />
            {errors.proveedor && <p className={cls.error}>{errors.proveedor.message}</p>}
          </div>

          <div>
            <label className={cls.label}>N° Factura</label>
            <input {...register('numeroFactura')} className={cls.input} placeholder="INV-001" disabled={extrayendo} />
          </div>

          <div>
            <label className={cls.label}>Fecha de factura</label>
            <input {...register('fechaFactura')} type="date" className={cls.input} disabled={extrayendo} />
          </div>

          <div>
            <label className={cls.label}>Moneda</label>
            <input {...register('moneda')} className={cls.input} placeholder="USD" disabled={extrayendo} />
          </div>

          <div>
            <label className={cls.label}>Subtotal</label>
            <input {...numReg('subtotal')} type="number" step="0.01" min="0" className={cls.input} placeholder="0.00" disabled={extrayendo} />
          </div>

          <div>
            <label className={cls.label}>Impuestos / Tax</label>
            <input {...numReg('impuestos')} type="number" step="0.01" min="0" className={cls.input} placeholder="0.00" disabled={extrayendo} />
          </div>

          <div>
            <label className={cls.label}>Total</label>
            <input {...numReg('total')} type="number" step="0.01" min="0" className={cls.input} placeholder="0.00" disabled={extrayendo} />
          </div>
        </div>
      </section>

      {/* ── Ítems ────────────────────────────────────────────────────── */}
      {fields.length > 0 && (
        <section className={cls.section}>
          <h2 className={cls.heading}>Ítems de la factura</h2>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="pb-2 pr-3 text-xs font-medium text-gray-500">Descripción</th>
                  <th className="pb-2 pr-3 text-xs font-medium text-gray-500 w-20">Cant.</th>
                  <th className="pb-2 pr-3 text-xs font-medium text-gray-500 w-28">P. Unitario</th>
                  <th className="pb-2 text-xs font-medium text-gray-500 w-28">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {fields.map((field, i) => (
                  <tr key={field.id}>
                    <td className="py-1.5 pr-3">
                      <input {...register(`items.${i}.descripcion`)} className={cls.input} disabled={extrayendo} />
                    </td>
                    <td className="py-1.5 pr-3">
                      <input {...numReg(`items.${i}.cantidad`)} type="number" step="1" min="0" className={cls.input} disabled={extrayendo} />
                    </td>
                    <td className="py-1.5 pr-3">
                      <input {...numReg(`items.${i}.precioUnitario`)} type="number" step="0.01" min="0" className={cls.input} disabled={extrayendo} />
                    </td>
                    <td className="py-1.5">
                      <input {...numReg(`items.${i}.total`)} type="number" step="0.01" min="0" className={cls.input} disabled={extrayendo} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Datos de la compra (manual) ───────────────────────────────── */}
      <section className={cls.section}>
        <h2 className={cls.heading}>Datos de la compra</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={cls.label}>Requisitor *</label>
            <input {...register('requisitor')} className={cls.input} placeholder="Nombre completo" />
            {errors.requisitor && <p className={cls.error}>{errors.requisitor.message}</p>}
          </div>

          <div>
            <label className={cls.label}>Orden de trabajo *</label>
            <input {...register('ordenTrabajo')} className={cls.input} placeholder="OT-100" />
            {errors.ordenTrabajo && <p className={cls.error}>{errors.ordenTrabajo.message}</p>}
          </div>

          <div className="sm:col-span-2">
            <label className={cls.label}>Empresa *</label>
            <input {...register('empresa')} className={cls.input} placeholder="SMV Norte" />
            {errors.empresa && <p className={cls.error}>{errors.empresa.message}</p>}
          </div>

          <div>
            <label className={cls.label}>Cuenta Cargo</label>
            <input {...register('cuentaCargo')} className={cls.input} placeholder="SO19316 / Fresadora Daniel" />
          </div>

          <div>
            <label className={cls.label}>Destino</label>
            <input {...register('destino')} className={cls.input} placeholder="SMV / Fisher / Siltech" />
          </div>
        </div>
      </section>

      {/* ── Submit ───────────────────────────────────────────────────── */}
      <div className="flex justify-end pb-8">
        <button
          type="submit"
          disabled={extrayendo || isSubmitting || !imagen}
          className="rounded-lg bg-blue-600 px-8 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Guardando…
            </span>
          ) : (
            'Guardar compra'
          )}
        </button>
      </div>
    </form>
  )
}
