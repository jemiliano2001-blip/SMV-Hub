import { describe, expect, it } from 'vitest'
import {
  determinarTargetsDeploy,
  TARGETS_COMPLETOS,
} from '../scripts/firebase-deploy-targets.mjs'

describe('selector de targets para deploy de Firebase', () => {
  it('despliega sólo Hosting para cambios de frontend', () => {
    expect(determinarTargetsDeploy([
      'app/proveedores/page.tsx',
      'lib/proveedores.ts',
      'tests/proveedores.test.ts',
    ])).toBe('hosting')
  })

  it('despliega sólo las Functions de SMV Hub para cambios del backend', () => {
    expect(determinarTargetsDeploy(['functions/src/odooSync.ts'])).toBe(
      'functions:smv-hub:syncOdooFacturasScheduled,functions:smv-hub:syncOdooFacturasManual,'
      + 'functions:smv-hub:syncOdooComprasScheduled,functions:smv-hub:syncOdooComprasManual,'
      + 'functions:smv-hub:syncOdooVentasScheduled,functions:smv-hub:syncOdooVentasManual,'
      + 'functions:smv-hub:listarCasosIntegridad,functions:smv-hub:obtenerCasoIntegridad,'
      + 'functions:smv-hub:ejecutarComandoCasoIntegridad'
    )
  })

  it('combina reglas, índices y Storage sin recompilar Hosting', () => {
    expect(determinarTargetsDeploy([
      'firestore.rules',
      'firestore.indexes.json',
      'storage.rules',
    ])).toBe('firestore:rules,firestore:indexes,storage')
  })

  it('omite documentación y usa despliegue completo si cambia firebase.json', () => {
    expect(determinarTargetsDeploy(['docs/infra.md', 'PROJECT.md'])).toBe('')
    expect(determinarTargetsDeploy(['docs/infra.md', 'firebase.json'])).toBe(TARGETS_COMPLETOS)
  })
})
