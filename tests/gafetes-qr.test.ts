import { describe, expect, it } from 'vitest'
import {
  construirPayloadQROperador,
  parsearPayloadQROperador,
  resolverOperadorPorQR,
} from '@/lib/gafetes-qr'
import { generarMatrizQR, generarQRSVG } from '@/lib/qr'
import type { Operador } from '@/lib/schemas'

const MOCK_OPERADORES: Operador[] = [
  {
    id: 'op-1',
    nombre: 'Juan Pérez',
    area: 'taller',
    activo: true,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  },
  {
    id: 'op-2',
    nombre: 'Carlos Gómez',
    area: 'cnc',
    activo: true,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  },
  {
    id: 'op-3',
    nombre: 'Pedro Inactivo',
    area: 'diseno',
    activo: false,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  },
]

describe('Gafetes QR & Scanner Logic', () => {
  it('construye payload canónico con prefijo smv:op:', () => {
    const payload = construirPayloadQROperador(MOCK_OPERADORES[0])
    expect(payload).toBe('smv:op:op-1')
  })

  it('parsea correctamente payloads con prefijo y texto plano', () => {
    expect(parsearPayloadQROperador('smv:op:op-123')).toEqual({ operadorId: 'op-123' })
    expect(parsearPayloadQROperador(' Juan Pérez ')).toEqual({ textoPlano: 'Juan Pérez' })
    expect(parsearPayloadQROperador('')).toBeNull()
  })

  it('resuelve operador activo por código QR', () => {
    const op = resolverOperadorPorQR('smv:op:op-1', MOCK_OPERADORES)
    expect(op?.id).toBe('op-1')
    expect(op?.nombre).toBe('Juan Pérez')
  })

  it('resuelve operador activo por coincidencia de nombre exacto', () => {
    const op = resolverOperadorPorQR('Carlos Gómez', MOCK_OPERADORES)
    expect(op?.id).toBe('op-2')
  })

  it('ignora operadores inactivos', () => {
    const op = resolverOperadorPorQR('smv:op:op-3', MOCK_OPERADORES)
    expect(op).toBeNull()
  })

  it('genera SVG válido para códigos QR', () => {
    const svg = generarQRSVG('smv:op:op-1', 120, 'qr-gafete')
    expect(svg).toContain('<svg')
    expect(svg).toContain('viewBox="0 0 120 120"')
    expect(svg).toContain('class="qr-gafete"')
  })

  it('genera matriz de bits cuadrada de dimensiones válidas', () => {
    const matriz = generarMatrizQR('smv:op:op-1')
    expect(matriz.length).toBe(25) // V2
    expect(matriz[0].length).toBe(25)
  })
})
