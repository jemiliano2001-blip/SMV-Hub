'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import NuevaCompraForm from './NuevaCompraForm'
import { subirImagenOrden } from '@/lib/storage'
import { crearOrden } from '@/lib/ordenes'
import type { NuevaCompraForm as FormData } from '@/lib/schemas'
import { sincronizarCamposLegacyOrden } from '@/lib/schemas'

export default function NuevaCompraFormWrapper() {
  const router = useRouter()
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null)

  async function handleSubmit(data: FormData, imagen?: File) {
    setErrorGuardado(null)
    try {
      const imagenGuardada = imagen ? await subirImagenOrden(imagen) : null
      await crearOrden(
        sincronizarCamposLegacyOrden({
          ...data,
          ...(imagenGuardada
            ? { imagenUrl: imagenGuardada.url, imagenPath: imagenGuardada.path }
            : {}),
        })
      )
      router.push('/ordenes')
    } catch (err) {
      console.error('[nueva-compra] error al guardar:', err)
      setErrorGuardado('No se pudo guardar la compra. Revisa tu conexión e intenta de nuevo.')
    }
  }

  return (
    <>
      {errorGuardado && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorGuardado}
        </div>
      )}
      <NuevaCompraForm onSubmit={handleSubmit} />
    </>
  )
}
