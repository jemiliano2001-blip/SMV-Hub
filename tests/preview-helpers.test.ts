import { describe, expect, it } from 'vitest'
import {
  detectarTipoArchivo,
  obtenerExtensionArchivo,
  obtenerNombreArchivo,
  parsearCsvSimple,
} from '@/lib/preview-helpers'

describe('preview-helpers', () => {
  describe('detectarTipoArchivo', () => {
    it('detecta imágenes por extensión y data URL', () => {
      expect(detectarTipoArchivo('https://storage.googleapis.com/bucket/factura.png')).toBe('image')
      expect(detectarTipoArchivo('foto.JPEG')).toBe('image')
      expect(detectarTipoArchivo('comprobante.webp?alt=media')).toBe('image')
      expect(detectarTipoArchivo('data:image/png;base64,iVBORw0KGgo')).toBe('image')
      expect(detectarTipoArchivo('archivo.bin', 'image/jpeg')).toBe('image')
    })

    it('detecta PDFs por extensión, MIME y data URL', () => {
      expect(detectarTipoArchivo('https://firebase.com/doc.pdf?token=123')).toBe('pdf')
      expect(detectarTipoArchivo('factura.PDF')).toBe('pdf')
      expect(detectarTipoArchivo('data:application/pdf;base64,JVBERi0xLjQK')).toBe('pdf')
      expect(detectarTipoArchivo('archivo', 'application/pdf')).toBe('pdf')
    })

    it('detecta CSVs y XMLs', () => {
      expect(detectarTipoArchivo('reporte.csv')).toBe('csv')
      expect(detectarTipoArchivo('factura.xml')).toBe('xml')
      expect(detectarTipoArchivo('data:text/csv;base64,abc')).toBe('csv')
      expect(detectarTipoArchivo('archivo', 'text/xml')).toBe('xml')
    })

    it('detecta texto y hojas de cálculo', () => {
      expect(detectarTipoArchivo('log.txt')).toBe('text')
      expect(detectarTipoArchivo('datos.json')).toBe('text')
      expect(detectarTipoArchivo('plantilla.xlsx')).toBe('spreadsheet')
      expect(detectarTipoArchivo('nomina.xls')).toBe('spreadsheet')
    })

    it('retorna generic para tipos desconocidos', () => {
      expect(detectarTipoArchivo('https://ejemplo.com/archivo-desconocido')).toBe('generic')
    })
  })

  describe('obtenerExtensionArchivo', () => {
    it('extrae extensiones limpias', () => {
      expect(obtenerExtensionArchivo('https://url.com/factura.pdf?token=xyz')).toBe('pdf')
      expect(obtenerExtensionArchivo('imagen.PNG')).toBe('png')
      expect(obtenerExtensionArchivo('data:image/jpeg;base64,123')).toBe('jpg')
      expect(obtenerExtensionArchivo('sin-extension')).toBe('')
    })
  })

  describe('obtenerNombreArchivo', () => {
    it('prioriza el nombre sugerido si existe', () => {
      expect(obtenerNombreArchivo('https://url.com/12345.pdf', 'Factura_McMaster.pdf')).toBe('Factura_McMaster.pdf')
    })

    it('extrae el nombre de la URL si no hay sugerencia', () => {
      expect(obtenerNombreArchivo('https://url.com/comprobante-123.jpg?alt=media')).toBe('comprobante-123.jpg')
    })
  })

  describe('parsearCsvSimple', () => {
    it('parsea correctamente cabeceras y filas con comas', () => {
      const csv = `ID,Proveedor,Monto\n1,McMaster,120.50\n2,Grainger,45.00`
      const resultado = parsearCsvSimple(csv)
      expect(resultado.cabeceras).toEqual(['ID', 'Proveedor', 'Monto'])
      expect(resultado.filas).toHaveLength(2)
      expect(resultado.filas[0]).toEqual(['1', 'McMaster', '120.50'])
    })

    it('tolera comillas y espacios', () => {
      const csv = `"ID","Nombre con, coma","Precio"\n"10","Herramienta corte","50.00"`
      const resultado = parsearCsvSimple(csv)
      expect(resultado.cabeceras).toEqual(['ID', 'Nombre con, coma', 'Precio'])
      expect(resultado.filas[0]).toEqual(['10', 'Herramienta corte', '50.00'])
    })

    it('maneja strings vacíos', () => {
      expect(parsearCsvSimple('')).toEqual({ cabeceras: [], filas: [] })
    })
  })
})
