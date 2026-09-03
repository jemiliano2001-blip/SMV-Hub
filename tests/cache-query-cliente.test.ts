import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  obtenerCacheQuery,
  guardarCacheQuery,
  invalidarCacheQuery,
  ejecutarConCache,
} from '@/lib/cache-query-cliente'

describe('cache-query-cliente - TTL y gestión de memoria', () => {
  beforeEach(() => {
    invalidarCacheQuery()
  })

  it('guarda y recupera datos dentro del TTL', () => {
    guardarCacheQuery('test_key', { count: 42 })
    const res = obtenerCacheQuery<{ count: number }>('test_key', 5000)
    expect(res).toEqual({ count: 42 })
  })

  it('invalida por prefijo correctamente', () => {
    guardarCacheQuery('ordenes_1', 'val1')
    guardarCacheQuery('ordenes_2', 'val2')
    guardarCacheQuery('proveedores_1', 'val3')

    invalidarCacheQuery('ordenes_')
    expect(obtenerCacheQuery('ordenes_1')).toBeNull()
    expect(obtenerCacheQuery('ordenes_2')).toBeNull()
    expect(obtenerCacheQuery('proveedores_1')).toBe('val3')
  })

  it('ejecutarConCache solo llama al fetcher si no está en caché', async () => {
    const fetcher = vi.fn().mockResolvedValue(['ordenA', 'ordenB'])

    const res1 = await ejecutarConCache('test_fetcher', fetcher, 5000)
    const res2 = await ejecutarConCache('test_fetcher', fetcher, 5000)

    expect(res1).toEqual(['ordenA', 'ordenB'])
    expect(res2).toEqual(['ordenA', 'ordenB'])
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('expira cuando el tiempo supera el TTL', async () => {
    guardarCacheQuery('key_rapida', 'datos')
    // Simular paso del tiempo
    const resInmediato = obtenerCacheQuery('key_rapida', 1000)
    expect(resInmediato).toBe('datos')

    const resExpirado = obtenerCacheQuery('key_rapida', -1)
    expect(resExpirado).toBeNull()
  })
})
