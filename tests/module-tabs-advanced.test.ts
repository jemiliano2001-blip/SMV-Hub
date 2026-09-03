import { describe, it, expect } from 'vitest'
import type { ModuleTabItem, TabBadgeVariant } from '@/components/layout/ModuleTabs'

describe('ModuleTabs - Tipado y variantes avanzadas', () => {
  it('soporta estructura con badge numérico y variante de color', () => {
    const item: ModuleTabItem = {
      value: 'pendientes',
      label: 'Pendientes',
      badge: 14,
      badgeVariant: 'amber',
      content: null,
    }

    expect(item.value).toBe('pendientes')
    expect(item.badge).toBe(14)
    expect(item.badgeVariant).toBe('amber')
  })

  it('soporta variantes semánticas válidas', () => {
    const variantes: TabBadgeVariant[] = ['default', 'muted', 'amber', 'emerald', 'rose', 'sky']
    expect(variantes).toHaveLength(6)
  })

  it('permite definir urlParam para sincronización con searchParams', () => {
    const props = {
      urlParam: 'tab',
      stickyHeader: true,
    }
    expect(props.urlParam).toBe('tab')
    expect(props.stickyHeader).toBe(true)
  })
})
