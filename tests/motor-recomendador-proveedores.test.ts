import { describe, it, expect } from 'vitest'
import {
  evaluarYRecomendarProveedores,
  CONFIGURACION_PESOS_DEFAULT,
} from '../lib/motor-recomendador-proveedores'
import type { Proveedor, EvaluacionProveedor, CompraProveedor } from '../lib/schemas'

describe('Motor Inteligente de Recomendación de Proveedores (Algoritmo Transparente)', () => {
  const mockProveedores: Proveedor[] = [
    {
      id: 'prov-1',
      nombre: 'Shars Tool Company',
      estatus: 'actual',
      tipoProveedor: 'barato',
      barato: true,
      recomendado: true,
      categorias: ['tooling', 'endmills'],
      pais: 'Estados Unidos',
      ubicacion: 'St Charles, IL',
      moneda: 'USD',
      facturaUSD: true,
      metodosPago: ['tarjeta'],
      tiempoRespuesta: 'mismo_dia',
      frecuenciaCompra: 'mensual',
      prioridad: 'alta',
      calificacion: 4.8,
    },
    {
      id: 'prov-2',
      nombre: 'Mala Calidad Inc',
      estatus: 'prospecto',
      tipoProveedor: 'barato',
      barato: true,
      recomendado: false,
      categorias: ['tooling'],
      pais: 'Estados Unidos',
      moneda: 'USD',
      facturaUSD: true,
      metodosPago: ['tarjeta'],
      tiempoRespuesta: 'lento',
      frecuenciaCompra: 'ocasional',
      prioridad: 'baja',
      calificacion: 2.1, // Calidad mala
    },
    {
      id: 'prov-3',
      nombre: 'Kennametal Authorized',
      estatus: 'actual',
      tipoProveedor: 'premium',
      barato: false,
      recomendado: true,
      categorias: ['endmills', 'insertos'],
      pais: 'Estados Unidos',
      moneda: 'USD',
      facturaUSD: true,
      metodosPago: ['tarjeta'],
      tiempoRespuesta: 'inmediato',
      frecuenciaCompra: 'semanal',
      prioridad: 'alta',
      calificacion: 4.9,
    },
  ] as unknown as Proveedor[]

  const mockEvaluaciones: EvaluacionProveedor[] = [
    {
      id: 'eval-1',
      proveedorId: 'prov-1',
      proveedorNombre: 'Shars Tool Company',
      periodo: '2026-Q2',
      calidad: 4.8,
      cumplimiento: 4.7,
      precioCompetitivo: 4.9,
      soporte: 4.5,
      promedioGeneral: 4.7,
      incidentesReportados: 0,
      notasInternas: 'Excelente relación costo-beneficio para endmills',
      evaluador: 'Oscar Pantoja',
    },
    {
      id: 'eval-2',
      proveedorId: 'prov-2',
      proveedorNombre: 'Mala Calidad Inc',
      periodo: '2026-Q2',
      calidad: 2.1,
      cumplimiento: 2.5,
      precioCompetitivo: 5.0,
      soporte: 2.0,
      promedioGeneral: 2.9,
      incidentesReportados: 4,
      notasInternas: 'Rompimiento frecuente de cortadores',
      evaluador: 'Oscar Pantoja',
    },
  ] as unknown as EvaluacionProveedor[]

  it('debe seleccionar al proveedor de mejor balance cuando hay cotizaciones válidas', () => {
    const ofertas = [
      { proveedorId: 'prov-1', proveedorNombre: 'Shars Tool Company', precioTotal: 450, moneda: 'USD' as const, leadTimeDias: 3 },
      { proveedorId: 'prov-3', proveedorNombre: 'Kennametal Authorized', precioTotal: 680, moneda: 'USD' as const, leadTimeDias: 2 },
    ]

    const res = evaluarYRecomendarProveedores(ofertas, mockProveedores, mockEvaluaciones)
    expect(res.estadoGlobal).toBe('recomendacion_clara')
    expect(res.proveedorRecomendado?.proveedorNombre).toBe('Shars Tool Company')
    expect(res.proveedorRecomendado?.scoreTotal).toBeGreaterThan(80)
  })

  it('debe penalizar severamente a un proveedor barato con mala calidad', () => {
    const ofertas = [
      { proveedorId: 'prov-2', proveedorNombre: 'Mala Calidad Inc', precioTotal: 300, moneda: 'USD' as const, leadTimeDias: 2 }, // Más barato
      { proveedorId: 'prov-1', proveedorNombre: 'Shars Tool Company', precioTotal: 450, moneda: 'USD' as const, leadTimeDias: 3 },
    ]

    const res = evaluarYRecomendarProveedores(ofertas, mockProveedores, mockEvaluaciones)
    expect(res.proveedorRecomendado?.proveedorNombre).toBe('Shars Tool Company')
    const malaCalidadEval = res.evaluaciones.find((e) => e.proveedorId === 'prov-2')
    expect(malaCalidadEval?.desglose.penalizaciones).toBe(25)
  })

  it('debe detectar información insuficiente cuando faltan precios o lead times', () => {
    const ofertasIncompletas = [
      { proveedorId: 'prov-1', proveedorNombre: 'Shars Tool Company', precioTotal: 0, moneda: 'USD' as const, leadTimeDias: 0 },
    ]

    const res = evaluarYRecomendarProveedores(ofertasIncompletas, mockProveedores, mockEvaluaciones)
    expect(res.estadoGlobal).toBe('informacion_insuficiente')
    expect(res.proveedorRecomendado).toBeNull()
  })

  it('debe detectar un empate técnico si los scores difieren por 2 puntos o menos', () => {
    const ofertasEmpatadas = [
      { proveedorId: 'prov-1', proveedorNombre: 'Shars Tool Company', precioTotal: 500, moneda: 'USD' as const, leadTimeDias: 3 },
      { proveedorId: 'prov-3', proveedorNombre: 'Kennametal Authorized', precioTotal: 505, moneda: 'USD' as const, leadTimeDias: 3 },
    ]

    const res = evaluarYRecomendarProveedores(ofertasEmpatadas, mockProveedores, mockEvaluaciones)
    expect(res.estadoGlobal).toBe('empate_tecnico')
    expect(res.empateSegundaOpcion).not.toBeNull()
  })

  it('debe permitir recalcular la recomendación al cambiar la ponderación de pesos', () => {
    const ofertas = [
      { proveedorId: 'prov-1', proveedorNombre: 'Shars Tool Company', precioTotal: 500, moneda: 'USD' as const, leadTimeDias: 5 },
      { proveedorId: 'prov-3', proveedorNombre: 'Kennametal Authorized', precioTotal: 700, moneda: 'USD' as const, leadTimeDias: 1 }, // Muy rápido
    ]

    // Pesos con 50% enfocado en Lead Time
    const pesosLeadTime = {
      ...CONFIGURACION_PESOS_DEFAULT,
      pesoPrecio: 0.10,
      pesoLeadTime: 0.50,
    }

    const resLeadTime = evaluarYRecomendarProveedores(ofertas, mockProveedores, mockEvaluaciones, [], pesosLeadTime)
    expect(resLeadTime.proveedorRecomendado?.proveedorNombre).toBe('Kennametal Authorized')
  })

  it('debe activar el Modo Primera Compra si no existen compras historicas previas', () => {
    const ofertas = [
      { proveedorId: 'prov-new', proveedorNombre: 'Nuevo Proveedor USA', precioTotal: 400, moneda: 'USD' as const, leadTimeDias: 2 },
    ]

    const res = evaluarYRecomendarProveedores(ofertas, mockProveedores, [], [])
    expect(res.modoEvaluacion).toBe('primera_compra')
    expect(res.pesosAplicados.pesoPrecio).toBe(0.40)
    expect(res.pesosAplicados.pesoHistorial).toBe(0.00)
  })

  it('debe activar el Modo Recompra si se pasa historial previo de compras', () => {
    const ofertas = [
      { proveedorId: 'prov-1', proveedorNombre: 'Shars Tool Company', precioTotal: 450, moneda: 'USD' as const, leadTimeDias: 3 },
    ]
    const mockCompras: CompraProveedor[] = [
      {
        id: 'comp-1',
        proveedorId: 'prov-1',
        proveedorNombre: 'Shars Tool Company',
        numeroOrden: 'OC-2026-101',
        fecha: '2026-06-15',
        producto: 'Endmills 1/2 AlTiN',
        categoria: 'endmills',
        costoTotal: 450,
        moneda: 'USD',
      } as unknown as CompraProveedor,
    ]

    const res = evaluarYRecomendarProveedores(ofertas, mockProveedores, mockEvaluaciones, mockCompras)
    expect(res.modoEvaluacion).toBe('recompra')
    expect(res.pesosAplicados.pesoCumplimiento).toBe(0.25)
    expect(res.pesosAplicados.pesoCalidad).toBe(0.25)
  })
})
