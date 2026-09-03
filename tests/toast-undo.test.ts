import { describe, it, expect, vi, beforeEach } from 'vitest'
import { toastConDeshacer } from '@/lib/toast-undo'

const { mockToast, mockSuccess, mockError } = vi.hoisted(() => {
  return {
    mockToast: vi.fn().mockImplementation(() => 'mock_toast_id_123'),
    mockSuccess: vi.fn(),
    mockError: vi.fn(),
  }
})

vi.mock('sonner', () => ({
  toast: Object.assign(
    (...args: unknown[]) => mockToast(...args),
    {
      success: (...args: unknown[]) => mockSuccess(...args),
      error: (...args: unknown[]) => mockError(...args),
    }
  ),
}))

describe('toastConDeshacer - Patrón Undo SaaS', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('llama a toast con action Deshacer y duración configurable', () => {
    const onUndo = vi.fn()
    const id = toastConDeshacer({
      mensaje: 'Elemento eliminado',
      descripcion: 'Se aplicó el cambio.',
      duracionMs: 4000,
      onUndo,
    })

    expect(id).toBe('mock_toast_id_123')
    expect(mockToast).toHaveBeenCalledWith(
      'Elemento eliminado',
      expect.objectContaining({
        description: 'Se aplicó el cambio.',
        duration: 4000,
        action: expect.objectContaining({
          label: 'Deshacer',
          onClick: expect.any(Function),
        }),
      })
    )
  })

  it('ejecuta onUndo cuando se presiona la acción Deshacer', async () => {
    const onUndo = vi.fn().mockResolvedValue(undefined)
    toastConDeshacer({
      mensaje: 'Cambio aplicado',
      onUndo,
    })

    const callArgs = mockToast.mock.calls[0]
    const action = callArgs?.[1]?.action as { label: string; onClick: () => Promise<void> }
    expect(action).toBeDefined()
    expect(action.label).toBe('Deshacer')

    await action.onClick()
    expect(onUndo).toHaveBeenCalledTimes(1)
  })
})
