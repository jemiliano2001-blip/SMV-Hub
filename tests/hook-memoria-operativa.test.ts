import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { useMemoriaOperativa } from '@/lib/hooks/useMemoriaOperativa'

describe('useMemoriaOperativa Hook', () => {
  it('se inicializa limpiamente sin errores de render', () => {
    let hookResult: ReturnType<typeof useMemoriaOperativa> | null = null

    function TestComp() {
      hookResult = useMemoriaOperativa([{ descripcion: 'Fresa 1/2' }], { enabled: false })
      return null
    }

    renderToStaticMarkup(React.createElement(TestComp))

    expect(hookResult).not.toBeNull()
    expect(hookResult!.contextos.size).toBe(0)
    expect(hookResult!.cargando).toBe(false)
    expect(hookResult!.error).toBeNull()
  })

  it('maneja arreglo vacío de piezas retornando mapa vacío', () => {
    let hookResult: ReturnType<typeof useMemoriaOperativa> | null = null

    function TestComp() {
      hookResult = useMemoriaOperativa([])
      return null
    }

    renderToStaticMarkup(React.createElement(TestComp))

    expect(hookResult).not.toBeNull()
    expect(hookResult!.contextos.size).toBe(0)
  })
})
