'use client'

import { useCallback, useEffect, useState } from 'react'
import type { CompraOdooItem } from '@/lib/schemas'
import { aMXN, aUSD, TIPO_CAMBIO_DEFAULT_USD_MXN } from '@/lib/tipo-cambio'

export type PartidaPresupuesto = {
  id: string
  itemId: string
  descripcion: string
  categoriaId: string
  tipoInsumo: string | null
  medida: string | null
  cantidad: number
  proveedorNombre: string
  precioUnitario: number
  moneda: 'MXN' | 'USD' | string
  subtotal: number
  subtotalMxn: number
  subtotalUsd: number
  referenciaDoc?: string
}

const STORAGE_KEY = 'smv_hub_presupuesto_insumos_v1'

export function usePresupuestoInsumos(usdToMxn: number = TIPO_CAMBIO_DEFAULT_USD_MXN) {
  const [partidas, setPartidas] = useState<PartidaPresupuesto[]>([])
  const [cargado, setCargado] = useState(false)

  // Cargar estado inicial desde localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as PartidaPresupuesto[]
        if (Array.isArray(parsed)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setPartidas(parsed)
        }
      }
    } catch {
      // Ignorar error de parsing
    } finally {
      setCargado(true)
    }
  }, [])

  // Persistir cambios en localStorage
  useEffect(() => {
    if (!cargado) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(partidas))
    } catch {
      // Ignorar quota error
    }
  }, [partidas, cargado])

  const agregarPartida = useCallback(
    (
      item: CompraOdooItem,
      cantidad: number = 1,
      proveedorOverride?: string,
      precioOverride?: number,
      monedaOverride?: string
    ) => {
      setPartidas((prev) => {
        const prov = proveedorOverride ?? item.proveedorNombre
        const precio = precioOverride ?? item.precioUnitario
        const mon = (monedaOverride ?? item.moneda ?? 'MXN') as 'MXN' | 'USD'

        // Si ya existe la partida con mismo item e igual proveedor, incrementar cantidad
        const indexExistente = prev.findIndex(
          (p) => p.itemId === item.id && p.proveedorNombre === prov
        )

        if (indexExistente >= 0) {
          return prev.map((p, idx) => {
            if (idx !== indexExistente) return p
            const nuevaCant = p.cantidad + cantidad
            const sub = nuevaCant * p.precioUnitario
            return {
              ...p,
              cantidad: nuevaCant,
              subtotal: sub,
              subtotalMxn: aMXN(sub, p.moneda as 'USD' | 'MXN', usdToMxn),
              subtotalUsd: aUSD(sub, p.moneda as 'USD' | 'MXN', usdToMxn),
            }
          })
        }

        const sub = cantidad * precio
        const nuevaPartida: PartidaPresupuesto = {
          id: `partida_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          itemId: item.id,
          descripcion: item.descripcion,
          categoriaId: item.categoriaId,
          tipoInsumo: item.tipoInsumo ?? item.tipoMetal ?? null,
          medida: item.medida ?? null,
          cantidad,
          proveedorNombre: prov,
          precioUnitario: precio,
          moneda: mon,
          subtotal: sub,
          subtotalMxn: aMXN(sub, mon, usdToMxn),
          subtotalUsd: aUSD(sub, mon, usdToMxn),
          referenciaDoc: item.referenciaDoc,
        }

        return [...prev, nuevaPartida]
      })
    },
    [usdToMxn]
  )

  const removerPartida = useCallback((id: string) => {
    setPartidas((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const actualizarCantidad = useCallback(
    (id: string, nuevaCantidad: number) => {
      if (nuevaCantidad <= 0) {
        removerPartida(id)
        return
      }
      setPartidas((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p
          const sub = nuevaCantidad * p.precioUnitario
          return {
            ...p,
            cantidad: nuevaCantidad,
            subtotal: sub,
            subtotalMxn: aMXN(sub, p.moneda as 'USD' | 'MXN', usdToMxn),
            subtotalUsd: aUSD(sub, p.moneda as 'USD' | 'MXN', usdToMxn),
          }
        })
      )
    },
    [removerPartida, usdToMxn]
  )

  const cambiarProveedorPartida = useCallback(
    (id: string, proveedorNombre: string, precioUnitario: number, moneda: string) => {
      const mon = (moneda ?? 'MXN') as 'MXN' | 'USD'
      setPartidas((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p
          const sub = p.cantidad * precioUnitario
          return {
            ...p,
            proveedorNombre,
            precioUnitario,
            moneda: mon,
            subtotal: sub,
            subtotalMxn: aMXN(sub, mon, usdToMxn),
            subtotalUsd: aUSD(sub, mon, usdToMxn),
          }
        })
      )
    },
    [usdToMxn]
  )

  const limpiarPresupuesto = useCallback(() => {
    setPartidas([])
  }, [])

  // Recalcular sub-totales
  const totalMxn = partidas.reduce(
    (acc, p) => acc + aMXN(p.subtotal, p.moneda as 'USD' | 'MXN', usdToMxn),
    0
  )
  const totalUsd = partidas.reduce(
    (acc, p) => acc + aUSD(p.subtotal, p.moneda as 'USD' | 'MXN', usdToMxn),
    0
  )
  const totalPartidas = partidas.length

  const exportarAExcel = useCallback(async () => {
    if (partidas.length === 0) return

    try {
      const { generarExcelPresupuestoInsumos } = await import(
        '@/lib/presupuesto-insumos-export'
      )
      const { descargarExcelEnNavegador } = await import(
        '@/lib/excel-export-base'
      )

      const buffer = await generarExcelPresupuestoInsumos({
        partidas,
        usdToMxn,
        totalMxn,
        totalUsd,
      })

      const fecha = new Date().toISOString().slice(0, 10)
      descargarExcelEnNavegador(buffer, `Presupuesto_Insumos_SMV_${fecha}.xlsx`)
    } catch (err) {
      console.error('Error al exportar presupuesto a Excel:', err)
    }
  }, [partidas, usdToMxn, totalMxn, totalUsd])

  return {
    partidas,
    agregarPartida,
    removerPartida,
    actualizarCantidad,
    cambiarProveedorPartida,
    limpiarPresupuesto,
    totalMxn,
    totalUsd,
    totalPartidas,
    exportarAExcel,
    cargado,
  }
}
