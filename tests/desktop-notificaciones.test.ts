import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  soportaNotificacionesEscritorio,
  obtenerEstadoPermisoEscritorio,
  solicitarPermisoNotificaciones,
  getPreferenciaEscritorio,
  setPreferenciaEscritorio,
  getPreferenciaSonido,
  setPreferenciaSonido,
  reproducirTimbreNotificacion,
  mostrarNotificacionEscritorio,
  filtrarNotificacionesNuevas,
  __resetAudioContext,
} from '@/lib/desktop-notificaciones'

describe('desktop-notificaciones', () => {
  const store = new Map<string, string>()

  const mockLocalStorage: Storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, String(v))
    },
    removeItem: (k: string) => {
      store.delete(k)
    },
    clear: () => {
      store.clear()
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size
    },
  }

  const originalWindow = globalThis.window
  const originalLocalStorage = globalThis.localStorage
  const originalNotification = globalThis.Notification

  beforeEach(() => {
    store.clear()
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(globalThis, 'window', {
      value: {
        localStorage: mockLocalStorage,
        Notification: undefined,
        focus: vi.fn(),
      },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(globalThis, 'Notification', {
      value: originalNotification,
      writable: true,
      configurable: true,
    })
    vi.restoreAllMocks()
  })

  it('detecta soporte de notificaciones cuando existe Notification en window', () => {
    expect(soportaNotificacionesEscritorio()).toBe(false)
    ;(window as unknown as { Notification: unknown }).Notification = {}
    expect(soportaNotificacionesEscritorio()).toBe(true)
  })

  it('devuelve unsupported si Notification no existe', () => {
    expect(obtenerEstadoPermisoEscritorio()).toBe('unsupported')
  })

  it('guarda y recupera preferencias de sonido y escritorio', () => {
    expect(getPreferenciaEscritorio()).toBe(true)
    expect(getPreferenciaSonido()).toBe(true)

    setPreferenciaEscritorio(false)
    expect(getPreferenciaEscritorio()).toBe(false)

    setPreferenciaSonido(false)
    expect(getPreferenciaSonido()).toBe(false)

    setPreferenciaEscritorio(true)
    expect(getPreferenciaEscritorio()).toBe(true)

    setPreferenciaSonido(true)
    expect(getPreferenciaSonido()).toBe(true)
  })

  it('solicita permisos de notificación cuando Notification está disponible', async () => {
    const mockRequestPermission = vi.fn().mockResolvedValue('granted')
    const mockNotifObj = {
      permission: 'default',
      requestPermission: mockRequestPermission,
    }
    ;(window as unknown as { Notification: unknown }).Notification = mockNotifObj

    const res = await solicitarPermisoNotificaciones()
    expect(res).toBe('granted')
    expect(mockRequestPermission).toHaveBeenCalled()
  })

  it('reproduce timbre de notificación sin arrojar excepciones', () => {
    expect(() => reproducirTimbreNotificacion()).not.toThrow()
  })

  it('muestra notificación de escritorio y maneja onclick correctamente', () => {
    const onClickMock = vi.fn()
    const closeMock = vi.fn()
    let clickHandler: (() => void) | null = null

    class MockNotification {
      title: string
      options: Record<string, unknown>
      close = closeMock
      constructor(title: string, options: Record<string, unknown>) {
        this.title = title
        this.options = options
      }
      set onclick(fn: () => void) {
        clickHandler = fn
      }
      get onclick() {
        return clickHandler as () => void
      }
      static permission = 'granted'
    }

    ;(window as unknown as { Notification: unknown }).Notification = MockNotification

    setPreferenciaEscritorio(true)
    const notif = mostrarNotificacionEscritorio({
      titulo: 'Alerta Test',
      cuerpo: 'Mensaje de prueba',
      onClick: onClickMock,
    })

    expect(notif).toBeDefined()
    expect(clickHandler).toBeDefined()

    if (clickHandler) {
      const runClick = clickHandler as () => void
      runClick()
    }
    expect(onClickMock).toHaveBeenCalled()
    expect(closeMock).toHaveBeenCalled()
  })
})

describe('filtrarNotificacionesNuevas (dedupe entre campanas montadas)', () => {
  type Fake = { id: string; leida: boolean }
  const n = (id: string, leida = false): Fake => ({ id, leida })

  it('devuelve solo las no leídas que aún no se han alertado', () => {
    const alertados = new Set(['a'])
    const items = [n('a'), n('b'), n('c', true)]
    expect(filtrarNotificacionesNuevas(items, alertados).map((x) => x.id)).toEqual(['b'])
  })

  it('la segunda campana no vuelve a alertar lo que ya alertó la primera', () => {
    // NavBar monta <NotificacionesBell /> dos veces (escritorio y móvil, ocultas
    // por CSS pero ambas montadas) y /notificaciones agrega una tercera. Con el
    // registro compartido, solo la primera dispara el timbre.
    const compartido = new Set<string>()
    const items = [n('nueva-1'), n('nueva-2')]

    const primera = filtrarNotificacionesNuevas(items, compartido)
    expect(primera).toHaveLength(2)
    for (const item of primera) compartido.add(item.id)

    expect(filtrarNotificacionesNuevas(items, compartido)).toHaveLength(0)
    expect(filtrarNotificacionesNuevas(items, compartido)).toHaveLength(0)
  })

  it('ignora las ya leídas aunque nunca se hayan alertado', () => {
    expect(filtrarNotificacionesNuevas([n('x', true)], new Set())).toEqual([])
  })

  it('conserva el orden de entrada (más reciente primero)', () => {
    const items = [n('reciente'), n('vieja')]
    expect(filtrarNotificacionesNuevas(items, new Set())[0].id).toBe('reciente')
  })
})

describe('reproducirTimbreNotificacion — reutiliza el AudioContext', () => {
  const originalWindow = globalThis.window

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      writable: true,
      configurable: true,
    })
  })

  it('no construye un AudioContext nuevo en cada timbre', () => {
    // Chrome limita a ~6 AudioContext por documento: creando uno por timbre, el
    // sonido dejaba de funcionar en silencio tras unas cuantas notificaciones.
    __resetAudioContext()
    let construidos = 0
    const fakeCtx = {
      state: 'running',
      currentTime: 0,
      destination: {},
      resume: vi.fn(),
      createOscillator: () => ({
        type: '',
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }),
      createGain: () => ({
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
      }),
    }

    class FakeAudioContext {
      constructor() {
        construidos++
        return fakeCtx as unknown as AudioContext
      }
    }

    Object.defineProperty(globalThis, 'window', {
      value: { AudioContext: FakeAudioContext },
      writable: true,
      configurable: true,
    })

    reproducirTimbreNotificacion()
    reproducirTimbreNotificacion()
    reproducirTimbreNotificacion()

    expect(construidos).toBe(1)
    __resetAudioContext()
  })
})
