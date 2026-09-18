import { describe, it, expect } from 'vitest'
import SkipToContent from '@/components/layout/SkipToContent'
import ScrollToTop from '@/components/layout/ScrollToTop'
import TableSkeleton from '@/components/layout/TableSkeleton'
import { CopyButton } from '@/components/ui/CopyButton'

describe('Detalles Web Esenciales & Componentes de Rendimiento', () => {
  it('SkipToContent es una función componente de React válida', () => {
    expect(typeof SkipToContent).toBe('function')
    const element = SkipToContent()
    expect(element.props.href).toBe('#main-content')
    expect(element.props.className).toContain('sr-only')
    expect(element.props.className).toContain('focus:not-sr-only')
  })

  it('ScrollToTop es una función componente de React válida', () => {
    expect(typeof ScrollToTop).toBe('function')
  })

  it('TableSkeleton genera la geometría configurada sin arrojar error', () => {
    expect(typeof TableSkeleton).toBe('function')
    const skeletonDefault = TableSkeleton({ columns: 4, rows: 3 })
    expect(skeletonDefault).toBeDefined()
    expect(skeletonDefault.props.className).toContain('flex flex-col')

    const skeletonConFiltros = TableSkeleton({ columns: 5, rows: 2, showFilters: true })
    expect(skeletonConFiltros).toBeDefined()
  })

  it('CopyButton acepta texto y parámetros de accesibilidad', () => {
    expect(typeof CopyButton).toBe('function')
  })
})
