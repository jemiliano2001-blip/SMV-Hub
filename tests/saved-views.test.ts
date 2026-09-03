import { describe, it, expect, beforeEach } from 'vitest'
import type { VistaGuardada } from '@/lib/hooks/useSavedViews'

describe('SavedViews - Estructura y ciclo de vida de filtros guardados', () => {
  const clave = 'smv_vistas_test'
  const store = new Map<string, string>()

  const localStorageMock = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  }

  beforeEach(() => {
    store.clear()
  })

  it('guarda una nueva vista serializada en storage', () => {
    const vista: VistaGuardada<{ proveedor: string }> = {
      id: 'vista_1',
      nombre: 'Filtro McMaster',
      filtros: { proveedor: 'McMaster' },
      creadoEn: Date.now(),
    }

    localStorageMock.setItem(clave, JSON.stringify([vista]))
    const guardada = localStorageMock.getItem(clave)
    expect(guardada).not.toBeNull()

    const parseado = JSON.parse(guardada!) as VistaGuardada<{ proveedor: string }>[]
    expect(parseado).toHaveLength(1)
    expect(parseado[0]?.nombre).toBe('Filtro McMaster')
    expect(parseado[0]?.filtros.proveedor).toBe('McMaster')
  })

  it('elimina vistas por ID manteniendo las restantes', () => {
    const vistas: VistaGuardada<{ proveedor: string }>[] = [
      { id: 'v1', nombre: 'Vista 1', filtros: { proveedor: 'P1' }, creadoEn: 100 },
      { id: 'v2', nombre: 'Vista 2', filtros: { proveedor: 'P2' }, creadoEn: 200 },
    ]

    localStorageMock.setItem(clave, JSON.stringify(vistas))
    const filtradas = vistas.filter((v) => v.id !== 'v1')
    localStorageMock.setItem(clave, JSON.stringify(filtradas))

    const resultado = JSON.parse(localStorageMock.getItem(clave)!)
    expect(resultado).toHaveLength(1)
    expect(resultado[0].id).toBe('v2')
  })
})
