'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react'
import {
  importarOrdenes,
  erroresRequeridos,
  verificarDuplicados,
  verificarDuplicadosEnLote,
  combinarDuplicados,
  type FilaParseada,
} from '@/lib/importar'
import { sincronizarCamposLegacyOrden } from '@/lib/schemas'
import { buscarPorFacturaYProveedor } from '@/lib/ordenes'
import { normalizarClaveProdServ } from '@/lib/sat/normalizar'

type CampoManual = 'requisitor' | 'ordenTrabajo' | 'empresa'

const COLUMNAS_DISPLAY: Array<{ campo: string; etiqueta: string; requerida: boolean }> = [
  { campo: 'proveedor',     etiqueta: 'Proveedor',        requerida: true  },
  { campo: 'requisitor',    etiqueta: 'Requisitor',       requerida: true  },
  { campo: 'ordenTrabajo',  etiqueta: 'Orden de trabajo', requerida: true  },
  { campo: 'empresa',       etiqueta: 'Empresa',          requerida: true  },
  { campo: 'estado',        etiqueta: 'Estado',           requerida: false },
  { campo: 'fechaFactura',  etiqueta: 'Fecha',            requerida: false },
  { campo: 'cantidad',      etiqueta: 'Cantidad',         requerida: false },
  { campo: 'descripcion',   etiqueta: 'Descripción',      requerida: false },
  { campo: 'linkProveedor', etiqueta: 'Link',             requerida: false },
  { campo: 'fechaEntrega',  etiqueta: 'Fecha entrega',    requerida: false },
  { campo: 'moneda',        etiqueta: 'Moneda',           requerida: false },
  { campo: 'totalLinea',    etiqueta: 'Total',            requerida: false },
]

// Recalcula errores y selección de una fila tras una edición.
function refrescarFila(fila: FilaParseada): FilaParseada {
  const errores = erroresRequeridos(fila.datos)
  return { ...fila, errores, seleccionada: errores.length === 0 }
}

export default function PreviewImportacion({
  filasIniciales,
  onReiniciar,
  columnasDetectadas,
}: {
  filasIniciales: FilaParseada[]
  onReiniciar: () => void
  columnasDetectadas?: string[]
}) {
  const [filas, setFilas] = useState<FilaParseada[]>(filasIniciales)
  const [status, setStatus] = useState<'preview' | 'confirmando-dedup' | 'importing' | 'completed'>('preview')
  const [progreso, setProgreso] = useState({ completadas: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [aplicar, setAplicar] = useState(() => ({
    requisitor: typeof window !== 'undefined' ? localStorage.getItem('smv:requisitor') ?? '' : '',
    ordenTrabajo: typeof window !== 'undefined' ? localStorage.getItem('smv:ordenTrabajo') ?? '' : '',
    empresa: '',
  }))
  const [duplicados, setDuplicados] = useState<Array<{ indice: number; motivo: string }>>([])
  const [duplicadosPreview, setDuplicadosPreview] = useState<Map<number, string>>(new Map())
  const [verificandoDuplicados, setVerificandoDuplicados] = useState(true)

  // Al cargar el preview: marca duplicados (BD + mismo lote) y deselecciona por defecto.
  useEffect(() => {
    let cancelado = false

    async function verificarAlCargar() {
      setVerificandoDuplicados(true)
      const enLote = verificarDuplicadosEnLote(filasIniciales)
      let contraBd: Array<{ indice: number; motivo: string }> = []

      const conFactura = filasIniciales.filter(
        (f) => f.datos.numeroFactura !== null && f.datos.numeroFactura.trim() !== ""
      )
      if (conFactura.length > 0) {
        try {
          const pares = conFactura.map((f) => ({
            numeroFactura: f.datos.numeroFactura!,
            proveedor: f.datos.proveedor,
          }))
          const existentes = await buscarPorFacturaYProveedor(pares)
          contraBd = verificarDuplicados(filasIniciales, existentes)
        } catch (err) {
          console.error('Error verificando duplicados al cargar preview:', err)
        }
      }

      if (cancelado) return

      const todos = combinarDuplicados(enLote, contraBd)
      const mapa = new Map(todos.map((d) => [d.indice, d.motivo]))
      setDuplicadosPreview(mapa)
      setFilas((prev) =>
        prev.map((f) => ({
          ...f,
          seleccionada: f.errores.length === 0 && !mapa.has(f.indice),
        }))
      )
      setVerificandoDuplicados(false)
    }

    verificarAlCargar()
    return () => {
      cancelado = true
    }
  }, [filasIniciales])

  const toggleRow = (indice: number) => {
    setFilas(prev =>
      prev.map(f => {
        if (f.indice !== indice) return f
        if (f.errores.length > 0) return f
        return { ...f, seleccionada: !f.seleccionada }
      })
    )
  }

  const toggleAll = () => {
    const validRows = filas.filter(f => f.errores.length === 0)
    const allSelected = validRows.length > 0 && validRows.every(f => f.seleccionada)
    setFilas(prev =>
      prev.map(f => (f.errores.length > 0 ? f : { ...f, seleccionada: !allSelected }))
    )
  }

  const editarCampo = (indice: number, campo: 'proveedor' | CampoManual, valor: string) => {
    setFilas(prev =>
      prev.map(f => {
        if (f.indice !== indice) return f
        if (campo === 'proveedor') {
          return refrescarFila({ ...f, datos: { ...f.datos, proveedor: valor } })
        }
        const items = f.datos.items.map((item) => ({ ...item, [campo]: valor }))
        const datos = sincronizarCamposLegacyOrden({ ...f.datos, items })
        return refrescarFila({ ...f, datos })
      })
    )
  }

  const editarClaveSat = (indice: number, valor: string) => {
    setFilas(prev =>
      prev.map(f => {
        if (f.indice !== indice) return f
        if (f.datos.items.length !== 1) return f
        const claveProdServ = normalizarClaveProdServ(valor)
        const items = f.datos.items.map((item) => ({
          ...item,
          claveProdServ,
          satPendiente: claveProdServ === null,
        }))
        const datos = sincronizarCamposLegacyOrden({ ...f.datos, items })
        return refrescarFila({ ...f, datos })
      })
    )
  }

  const aplicarATodas = () => {
    const req = aplicar.requisitor.trim()
    const ot = aplicar.ordenTrabajo.trim()
    const emp = aplicar.empresa.trim()
    if (req) localStorage.setItem('smv:requisitor', req)
    if (ot) localStorage.setItem('smv:ordenTrabajo', ot)
    setFilas(prev =>
      prev.map(f => {
        const items = f.datos.items.map((item) => {
          const next = { ...item }
          if (req) next.requisitor = req
          if (ot && !next.ordenTrabajo.trim()) next.ordenTrabajo = ot
          if (emp && !next.empresa.trim()) next.empresa = emp
          return next
        })
        const datos = sincronizarCamposLegacyOrden({ ...f.datos, items })
        return refrescarFila({ ...f, datos })
      })
    )
  }

  const ejecutarImport = async () => {
    const validAndSelected = filas.filter(f => f.seleccionada && f.errores.length === 0)
    setStatus('importing')
    setProgreso({ completadas: 0, total: validAndSelected.length })
    try {
      await importarOrdenes(filas, (completadas) => {
        setProgreso(prev => ({ ...prev, completadas }))
      })
      setProgreso(prev => ({ ...prev, completadas: prev.total }))
      setStatus('completed')
    } catch (err) {
      console.error('Error durante la importación:', err)
      setError('Ocurrió un error al guardar las órdenes. Algunas pueden haberse guardado.')
      setStatus('preview')
    }
  }

  const handleImport = async () => {
    const validAndSelected = filas.filter(f => f.seleccionada && f.errores.length === 0)
    if (validAndSelected.length === 0) return
    setError(null)

    const conFactura = validAndSelected.filter(
      (f) => f.datos.numeroFactura !== null && f.datos.numeroFactura.trim() !== ""
    )
    if (conFactura.length > 0) {
      try {
        const pares = conFactura.map((f) => ({
          numeroFactura: f.datos.numeroFactura!,
          proveedor: f.datos.proveedor,
        }))
        const existentes = await buscarPorFacturaYProveedor(pares)
        const dups = combinarDuplicados(
          verificarDuplicados(validAndSelected, existentes),
          verificarDuplicadosEnLote(validAndSelected)
        )
        if (dups.length > 0) {
          setDuplicados(dups)
          setStatus('confirmando-dedup')
          return
        }
      } catch (err) {
        console.error('Error verificando duplicados:', err)
        // fallo no bloqueante: continuar con el import
      }
    }

    await ejecutarImport()
  }

  // Contadores
  const totalFilas = filas.length
  const listosParaImportar = filas.filter(f => f.seleccionada && f.errores.length === 0).length
  const filasConErrores = filas.filter(f => f.errores.length > 0).length
  const filasConAdvertencias = filas.filter(f => f.advertencias.length > 0 && f.errores.length === 0).length
  const filasDuplicadas = duplicadosPreview.size
  const selectableRows = filas.filter(f => f.errores.length === 0)
  const allSelectableChecked = selectableRows.length > 0 && selectableRows.every(f => f.seleccionada)

  if (status === 'confirmando-dedup') {
    return (
      <section className="rounded-xl border border-yellow-200 bg-yellow-50 p-8 shadow-xs max-w-xl mx-auto">
        <div className="flex items-start gap-3 mb-6">
          <AlertTriangle className="h-6 w-6 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-bold text-yellow-900">
              {duplicados.length} posible{duplicados.length !== 1 ? 's' : ''} duplicado{duplicados.length !== 1 ? 's' : ''} detectado{duplicados.length !== 1 ? 's' : ''}
            </h2>
            <p className="text-sm text-yellow-800 mt-1 mb-3">
              Las siguientes órdenes pueden ya existir en la base de datos:
            </p>
            <ul className="space-y-1">
              {duplicados.map(d => (
                <li key={d.indice} className="text-xs text-yellow-900 font-medium">
                  • {d.motivo}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => { setDuplicados([]); setStatus('preview') }}
            className="rounded-lg border border-yellow-300 bg-white px-4 py-2 text-sm font-semibold text-yellow-900 hover:bg-yellow-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => { setDuplicados([]); ejecutarImport() }}
            className="rounded-lg bg-yellow-600 px-5 py-2 text-sm font-semibold text-white hover:bg-yellow-700 transition-colors"
          >
            Importar de todas formas
          </button>
        </div>
      </section>
    )
  }

  if (status === 'importing') {
    const porcentaje = progreso.total > 0 ? Math.round((progreso.completadas / progreso.total) * 100) : 0
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-8 shadow-xs max-w-xl mx-auto text-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-gray-900">Importando órdenes de compra</h2>
        <p className="text-sm text-gray-500 mt-1 mb-6">Guardando en Firestore por lotes…</p>
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-semibold text-gray-500">
            <span>{progreso.completadas} de {progreso.total} completadas</span>
            <span>{porcentaje}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${porcentaje}%` }} />
          </div>
        </div>
      </section>
    )
  }

  if (status === 'completed') {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-8 shadow-xs max-w-xl mx-auto text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mb-4 text-green-600">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Importación exitosa</h2>
        <p className="text-sm font-semibold text-green-700 mt-2">✓ {progreso.total} órdenes importadas</p>
        <p className="text-xs text-gray-500 mt-1 mb-8">
          Las órdenes ya están disponibles en el listado para su visualización y gestión.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/ordenes"
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
          >
            Ver órdenes
          </Link>
          <button
            onClick={onReiniciar}
            className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            Importar más
          </button>
        </div>
      </section>
    )
  }

  // status === 'preview'
  const inputCell =
    'w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm focus:border-blue-400 focus:bg-white focus:outline-none'

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {columnasDetectadas && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <span className="text-xs font-bold text-blue-900 block mb-2">Columnas detectadas</span>
          <div className="flex flex-wrap gap-1.5">
            {COLUMNAS_DISPLAY.map(({ campo, etiqueta, requerida }) => {
              const detectada = columnasDetectadas.includes(campo)
              return (
                <span
                  key={campo}
                  className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                    detectada
                      ? 'bg-green-100 text-green-800'
                      : requerida
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {detectada ? '✓' : requerida ? '✗' : '—'} {etiqueta}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Aplicar a todas */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-900">Completar campos obligatorios</h3>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Los campos obligatorios van por ítem. El requisitor se recuerda entre importaciones.
          Orden de trabajo y empresa solo rellenan celdas vacías (no pisan lo que extrajo la IA en McMaster).
        </p>
        <p className="text-xs text-blue-700 mb-3">
          La clave SAT es opcional en esta pantalla, pero si el renglón tiene un solo ítem puedes capturarla aquí antes de importar.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={aplicar.requisitor}
            onChange={e => setAplicar(a => ({ ...a, requisitor: e.target.value }))}
            placeholder="Requisitor"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          />
          <input
            value={aplicar.ordenTrabajo}
            onChange={e => setAplicar(a => ({ ...a, ordenTrabajo: e.target.value }))}
            placeholder="Orden de trabajo"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          />
          <input
            value={aplicar.empresa}
            onChange={e => setAplicar(a => ({ ...a, empresa: e.target.value }))}
            placeholder="Empresa"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          />
          <button
            onClick={aplicarATodas}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
          >
            Aplicar a todas
          </button>
        </div>
      </div>

      {/* Resumen + acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
        <div className="space-y-1">
          <span className="text-sm font-semibold text-gray-900 block">
            {listosParaImportar} de {totalFilas} filas listas para importar
          </span>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            {filasConErrores > 0 && (
              <span className="text-red-600 font-medium flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                {filasConErrores} con errores (omitidas)
              </span>
            )}
            {filasConAdvertencias > 0 && (
              <span className="text-yellow-700 font-medium flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                {filasConAdvertencias} con advertencias (se usarán defaults)
              </span>
            )}
            {filasDuplicadas > 0 && (
              <span className="text-yellow-700 font-medium flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                {filasDuplicadas} duplicada{filasDuplicadas !== 1 ? 's' : ''} (deseleccionadas)
              </span>
            )}
            {verificandoDuplicados && (
              <span className="text-gray-500 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Verificando duplicados…
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onReiniciar}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={listosParaImportar === 0}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Importar órdenes
          </button>
        </div>
      </div>

      {/* Tabla de preview (campos obligatorios editables) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3.5 text-center w-12">
                  <input
                    type="checkbox"
                    checked={allSelectableChecked}
                    onChange={toggleAll}
                    disabled={selectableRows.length === 0}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3.5 font-semibold">Proveedor</th>
                <th className="px-4 py-3.5 font-semibold">Requisitor</th>
                <th className="px-4 py-3.5 font-semibold">Orden Trab.</th>
                <th className="px-4 py-3.5 font-semibold">Empresa</th>
                <th className="px-4 py-3.5 font-semibold text-center w-16">Cant.</th>
                <th className="px-4 py-3.5 font-semibold">Descripción</th>
                <th className="px-4 py-3.5 font-semibold">Clave SAT</th>
                <th className="px-4 py-3.5 font-semibold">Fecha</th>
                <th className="px-4 py-3.5 font-semibold">Estado</th>
                <th className="px-4 py-3.5 font-semibold text-right">Total</th>
                <th className="px-4 py-3.5 font-semibold">Moneda</th>
                <th className="px-4 py-3.5 font-semibold">Detalles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filas.map((fila) => {
                const tieneErrores = fila.errores.length > 0
                const motivoDuplicado = duplicadosPreview.get(fila.indice)
                const esDuplicada = Boolean(motivoDuplicado)
                const tieneAdvertencias =
                  (fila.advertencias.length > 0 || esDuplicada) && !tieneErrores
                let rowStyle = 'hover:bg-gray-50/50'
                if (tieneErrores) {
                  rowStyle = 'bg-red-50 hover:bg-red-50/80 border-l-4 border-l-red-500'
                } else if (tieneAdvertencias) {
                  rowStyle = 'bg-yellow-50/60 hover:bg-yellow-50/90 border-l-4 border-l-yellow-400'
                }

                return (
                  <tr key={fila.indice} className={`${rowStyle} transition-colors`}>
                    <td className="px-4 py-3.5 text-center">
                      {!tieneErrores ? (
                        <input
                          type="checkbox"
                          checked={fila.seleccionada}
                          onChange={() => toggleRow(fila.indice)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      ) : (
                        <div className="w-4 h-4 mx-auto flex items-center justify-center text-red-500">
                          <X className="h-3.5 w-3.5 stroke-[3]" />
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2 min-w-[140px]">
                      <input
                        value={fila.datos.proveedor}
                        onChange={e => editarCampo(fila.indice, 'proveedor', e.target.value)}
                        placeholder="Proveedor"
                        className={inputCell}
                      />
                    </td>
                    <td className="px-2 py-2 min-w-[120px]">
                      <input
                        value={fila.datos.requisitor}
                        onChange={e => editarCampo(fila.indice, 'requisitor', e.target.value)}
                        placeholder="Requisitor"
                        className={inputCell}
                      />
                    </td>
                    <td className="px-2 py-2 min-w-[120px]">
                      <input
                        value={fila.datos.ordenTrabajo}
                        onChange={e => editarCampo(fila.indice, 'ordenTrabajo', e.target.value)}
                        placeholder="Orden de trabajo"
                        className={inputCell}
                      />
                    </td>
                    <td className="px-2 py-2 min-w-[120px]">
                      <input
                        value={fila.datos.empresa}
                        onChange={e => editarCampo(fila.indice, 'empresa', e.target.value)}
                        placeholder="Empresa"
                        className={inputCell}
                      />
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {fila.datos.items[0]?.cantidad ?? '-'}
                    </td>
                    <td className="px-4 py-3.5 max-w-[200px] truncate" title={fila.datos.items[0]?.descripcion}>
                      {fila.datos.items[0]?.descripcion || '-'}
                    </td>
                    <td className="px-2 py-2 min-w-[150px]">
                      {fila.datos.items.length === 1 ? (
                        <input
                          value={fila.datos.items[0]?.claveProdServ ?? ''}
                          onChange={e => editarClaveSat(fila.indice, e.target.value)}
                          placeholder="31161500"
                          className={inputCell}
                        />
                      ) : (
                        <span className="inline-flex rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">
                          {fila.datos.items.length} ítems
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {fila.datos.fechaFactura || '-'}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap capitalize">
                      {fila.datos.estado}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap text-gray-700">
                      {fila.datos.total != null
                        ? fila.datos.total.toLocaleString('es-MX')
                        : '-'}
                    </td>
                    <td className="px-4 py-3.5">
                      {fila.datos.moneda ? (
                        <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-bold ${
                          fila.datos.moneda === 'USD'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {fila.datos.moneda}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        {fila.errores.map((err, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-xs text-red-700 font-semibold bg-red-100/60 px-2 py-0.5 rounded-sm">
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            {err}
                          </span>
                        ))}
                        {fila.advertencias.map((adv, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-xs text-yellow-800 font-semibold bg-yellow-100/60 px-2 py-0.5 rounded-sm">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            {adv}
                          </span>
                        ))}
                        {fila.datos.items.length === 1 && fila.datos.items[0]?.satPendiente && (
                          <span className="inline-flex items-center gap-1 text-xs text-yellow-800 font-semibold bg-yellow-100/60 px-2 py-0.5 rounded-sm">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            Sin clave SAT
                          </span>
                        )}
                        {esDuplicada && (
                          <span className="inline-flex items-center gap-1 text-xs text-yellow-800 font-semibold bg-yellow-100/60 px-2 py-0.5 rounded-sm">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            Ya existe: {motivoDuplicado}
                          </span>
                        )}
                        {fila.errores.length === 0 && fila.advertencias.length === 0 && !esDuplicada && (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 font-semibold bg-green-50 px-2 py-0.5 rounded-sm">
                            <CheckCircle2 className="h-3 w-3 shrink-0" />
                            Válido
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
