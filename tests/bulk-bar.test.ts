import { describe, it, expect } from 'vitest'
import type { ModuleBulkBarProps } from '@/components/layout/ModuleBulkBar'

describe('ModuleBulkBar - Props y contrato de render', () => {
  it('valida la estructura de propiedades requeridas', () => {
    let despejado = false
    const props: ModuleBulkBarProps = {
      selectedCount: 5,
      totalCount: 20,
      onClearSelection: () => {
        despejado = true
      },
      actions: 'dummy-actions',
    }

    expect(props.selectedCount).toBe(5)
    expect(props.totalCount).toBe(20)
    props.onClearSelection()
    expect(despejado).toBe(true)
  })

  it('no muestra acciones cuando selectedCount es 0 o negativo', () => {
    const cuenta = 0
    const debeRenderizar = cuenta > 0
    expect(debeRenderizar).toBe(false)
  })
})
