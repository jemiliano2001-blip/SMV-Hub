import { useState, useEffect, useCallback } from 'react'
import {
  listarRegistrosBano,
  suscribirRegistrosBano,
  crearRegistroBano,
  actualizarRegistroBano,
  eliminarRegistroBano,
  type NuevoRegistroBanoPayload,
} from '@/lib/banos'
import type { RegistroBano } from '@/lib/schemas'

export function calcularMinutos(entrada: string, llegada: string): number {
  if (!entrada || !llegada) return 0
  const [eH, eM] = entrada.split(':').map(Number)
  const [lH, lM] = llegada.split(':').map(Number)
  
  let mins = (lH * 60 + lM) - (eH * 60 + eM)
  if (mins < 0) mins += 24 * 60 // cross midnight
  return mins
}

export function useBanos(mesFiltro?: string) {
  const [registros, setRegistros] = useState<RegistroBano[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsub = suscribirRegistrosBano(
      (data) => {
        setRegistros(data)
        setLoading(false)
      },
      mesFiltro,
      (err) => {
        console.error('Error suscribiendo a registros de baño:', err)
        setError('No se pudieron cargar los registros en tiempo real. Intenta de nuevo.')
        setLoading(false)
      }
    )
    return () => unsub()
  }, [mesFiltro])

  const fetchRegistros = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listarRegistrosBano(mesFiltro)
      setRegistros(data)
    } catch (err) {
      console.error('Error cargando registros de baño:', err)
      setError('No se pudieron cargar los registros. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [mesFiltro])

  async function registrarEntrada(payload: Omit<NuevoRegistroBanoPayload, 'tiempoMinutos' | 'horaLlegada'>): Promise<void> {
    await crearRegistroBano({
      ...payload,
      horaLlegada: null,
      tiempoMinutos: null,
    })
  }

  async function registrarLlegada(id: string, horaLlegada: string, horaEntrada: string): Promise<void> {
    const tiempoMinutos = calcularMinutos(horaEntrada, horaLlegada)
    await actualizarRegistroBano(id, { horaLlegada, tiempoMinutos })
  }

  async function actualizarHorario(id: string, horaEntrada: string, horaLlegada: string): Promise<void> {
    const tiempoMinutos = calcularMinutos(horaEntrada, horaLlegada)
    await actualizarRegistroBano(id, { horaEntrada, horaLlegada, tiempoMinutos })
  }

  async function borrarRegistro(id: string): Promise<void> {
    await eliminarRegistroBano(id)
  }

  return {
    registros,
    loading,
    error,
    fetchRegistros,
    registrarEntrada,
    registrarLlegada,
    actualizarHorario,
    borrarRegistro,
  }
}
