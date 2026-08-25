import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { puedeVibrar, vibrarTap, vibrarExito, vibrarAlerta, vibrarError } from '@/lib/haptics'

describe('lib/haptics', () => {
  const originalNavigator = global.navigator

  beforeEach(() => {
    // Mock navigator.vibrate
    Object.defineProperty(global, 'navigator', {
      value: {
        vibrate: vi.fn().mockReturnValue(true),
      },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    })
  })

  it('detecta soporte de vibración', () => {
    expect(puedeVibrar()).toBe(true)
  })

  it('ejecuta vibrarTap con pulso de 20ms', () => {
    const res = vibrarTap()
    expect(res).toBe(true)
    expect(navigator.vibrate).toHaveBeenCalledWith(20)
  })

  it('ejecuta vibrarExito con patrón doble', () => {
    const res = vibrarExito()
    expect(res).toBe(true)
    expect(navigator.vibrate).toHaveBeenCalledWith([25, 40, 25])
  })

  it('ejecuta vibrarAlerta con patrón de advertencia', () => {
    const res = vibrarAlerta()
    expect(res).toBe(true)
    expect(navigator.vibrate).toHaveBeenCalledWith([50, 60, 50])
  })

  it('ejecuta vibrarError con patrón de error', () => {
    const res = vibrarError()
    expect(res).toBe(true)
    expect(navigator.vibrate).toHaveBeenCalledWith([80, 50, 80])
  })

  it('maneja con gracia cuando navigator.vibrate no está disponible', () => {
    Object.defineProperty(global, 'navigator', {
      value: {},
      writable: true,
      configurable: true,
    })

    expect(puedeVibrar()).toBe(false)
    expect(vibrarTap()).toBe(false)
    expect(vibrarExito()).toBe(false)
  })
})
