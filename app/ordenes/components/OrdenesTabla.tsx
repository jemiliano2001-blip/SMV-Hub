import { useState, useCallback, type Dispatch, type SetStateAction } from 'react'
import type { OrdenCompra } from '@/lib/schemas'
import { formatPrecio } from '@/lib/format'
import { notificarOrdenPorWhatsApp } from '@/lib/notificar-orden-whatsapp'
import ModuleSurface from '@/components/layout/ModuleSurface'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useFilePreview } from '@/components/FilePreviewProvider'
import { useQuickLook } from '@/lib/hooks/useQuickLook'
import OrdenFilaRow from './OrdenFilaRow'

type ColFiltros = { proveedor: string; requisitor: string; empresa: string; cuentaCargo: string }

interface OrdenesTablaProps {
  ordenesFiltradas: OrdenCompra[];
  selectedIds: Set<string>;
  toggleAllSelection: (e: React.ChangeEvent<HTMLInputElement>) => void;
  toggleSelection: (id: string, e: React.MouseEvent) => void;
  colFiltros: ColFiltros;
  setColFiltros: Dispatch<SetStateAction<ColFiltros>>;
  proveedoresUnicos: string[];
  requisitoresUnicos: string[];
  empresasUnicas: string[];
  cuentasUnicas: string[];
  onSelectOrden: (o: OrdenCompra) => void;
  onApproveClick: (id: string, e: React.MouseEvent) => void;
  onRejectClick: (id: string, e: React.MouseEvent) => void;
  onDeleteClick: (id: string, e: React.MouseEvent) => void;
  onPrepararFiltros: () => void;
  onPreviewExcel: (orden: OrdenCompra) => void;
}

const thFiltro = 'h-auto px-3 py-2.5 align-top font-bold whitespace-normal'

export default function OrdenesTabla({
  ordenesFiltradas,
  selectedIds,
  toggleAllSelection,
  toggleSelection,
  colFiltros,
  setColFiltros,
  proveedoresUnicos,
  requisitoresUnicos,
  empresasUnicas,
  cuentasUnicas,
  onSelectOrden,
  onApproveClick,
  onRejectClick,
  onDeleteClick,
  onPrepararFiltros,
  onPreviewExcel,
}: OrdenesTablaProps) {
  const { previewFile } = useFilePreview()
  const [filaActivaIdx, setFilaActivaIdx] = useState<number | null>(0)

  useQuickLook({
    items: ordenesFiltradas,
    selectedIndex: filaActivaIdx,
    getArchivoMetadata: (orden) =>
      orden.imagenUrl
        ? {
            url: orden.imagenUrl,
            tipo: 'image',
            titulo: `Comprobante · ${orden.proveedor}`,
            subtitulo: `Factura #${orden.numeroFactura || 'S/N'} · ${formatPrecio(orden.total, orden.moneda)}`,
          }
        : null,
  })

  const [avisoWhatsApp, setAvisoWhatsApp] = useState<{
    mensaje: string
    whatsappUrl: string
    comprobanteUrl?: string
    abrirWhatsApp: boolean
  } | null>(null)

  const notificar = useCallback(async (orden: OrdenCompra) => {
    const resultado = await notificarOrdenPorWhatsApp(orden)
    if (resultado.ventanaAbierta && resultado.captura.estado === 'copiada') return
    const mensajeCaptura = resultado.captura.estado === 'fallback'
      ? resultado.captura.mensaje
      : 'No se pudo copiar el comprobante como imagen.'

    setAvisoWhatsApp({
      mensaje: resultado.ventanaAbierta
        ? `${mensajeCaptura} WhatsApp ya lleva el texto listo.`
        : 'El navegador bloqueó la pestaña de WhatsApp. Ábrela con el enlace de abajo.',
      whatsappUrl: resultado.whatsappUrl,
      comprobanteUrl: resultado.captura.estado === 'fallback' ? orden.imagenUrl : undefined,
      abrirWhatsApp: !resultado.ventanaAbierta,
    })
  }, [])

  const handleMouseEnterRow = useCallback((index: number) => {
    setFilaActivaIdx(index)
  }, [])

  const handlePreviewComprobante = useCallback((orden: OrdenCompra) => {
    if (!orden.imagenUrl) return
    previewFile(
      {
        url: orden.imagenUrl,
        nombre: `Factura-${orden.numeroFactura || orden.id}`,
        tipo: 'image',
        titulo: `Comprobante · ${orden.proveedor}`,
        subtitulo: `Factura #${orden.numeroFactura || 'S/N'} · ${formatPrecio(orden.total, orden.moneda)}`,
      },
      ordenesFiltradas
        .filter((o) => Boolean(o.imagenUrl))
        .map((o) => ({
          url: o.imagenUrl!,
          nombre: `Factura-${o.numeroFactura || o.id}`,
          tipo: 'image',
          titulo: `Comprobante · ${o.proveedor}`,
          subtitulo: `Factura #${o.numeroFactura || 'S/N'} · ${formatPrecio(o.total, o.moneda)}`,
        }))
    )
  }, [ordenesFiltradas, previewFile])

  return (
    <ModuleSurface className="font-sans">
      {avisoWhatsApp && (
        <div className="m-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950" role="status">
          <p>{avisoWhatsApp.mensaje}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {avisoWhatsApp.abrirWhatsApp && (
              <a
                href={avisoWhatsApp.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-emerald-600 px-2.5 py-1 font-semibold text-white hover:bg-emerald-700"
              >
                Abrir WhatsApp con texto
              </a>
            )}
            {avisoWhatsApp.comprobanteUrl && (
              <button
                type="button"
                onClick={() =>
                  previewFile({
                    url: avisoWhatsApp.comprobanteUrl!,
                    tipo: 'image',
                    titulo: 'Comprobante de Compra',
                  })
                }
                className="rounded-md border border-amber-400 bg-card px-2.5 py-1 font-semibold hover:bg-amber-100 cursor-pointer"
              >
                Ver comprobante
              </button>
            )}
          </div>
        </div>
      )}
      <Table className="text-xs text-left text-muted-foreground">
        <TableHeader className="bg-muted/50 text-[11px] font-mono text-foreground uppercase">
          <TableRow className="hover:bg-transparent">
            <TableHead className={`${thFiltro} w-8 text-center`}>
              <input
                type="checkbox"
                checked={ordenesFiltradas.length > 0 && selectedIds.size === ordenesFiltradas.length}
                onChange={toggleAllSelection}
                className="rounded border-input text-primary focus:ring-ring cursor-pointer"
              />
            </TableHead>
            <TableHead className={thFiltro}>
              <div>Proveedor</div>
              <select
                value={colFiltros.proveedor}
                onChange={e => setColFiltros({...colFiltros, proveedor: e.target.value})}
                onFocus={onPrepararFiltros}
                className="mt-1.5 block w-full max-w-[130px] text-[11px] font-normal border border-input rounded p-1 bg-card text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">Todos</option>
                {proveedoresUnicos.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </TableHead>
            <TableHead className={thFiltro}>
              <div>Requisitor</div>
              <select
                value={colFiltros.requisitor}
                onChange={e => setColFiltros({...colFiltros, requisitor: e.target.value})}
                onFocus={onPrepararFiltros}
                className="mt-1.5 block w-full max-w-[100px] text-[11px] font-normal border border-input rounded p-1 bg-card text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">Todos</option>
                {requisitoresUnicos.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </TableHead>
            <TableHead className={thFiltro}>No. Factura</TableHead>
            <TableHead className={thFiltro}>
              <div>Empresa</div>
              <select
                value={colFiltros.empresa}
                onChange={e => setColFiltros({...colFiltros, empresa: e.target.value})}
                onFocus={onPrepararFiltros}
                className="mt-1.5 block w-full max-w-[100px] text-[11px] font-normal border border-input rounded p-1 bg-card text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">Todos</option>
                {empresasUnicas.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </TableHead>
            <TableHead className={thFiltro}>
              <div>Cuenta cargo</div>
              <select
                value={colFiltros.cuentaCargo}
                onChange={e => setColFiltros({...colFiltros, cuentaCargo: e.target.value})}
                onFocus={onPrepararFiltros}
                className="mt-1.5 block w-full max-w-[130px] text-[11px] font-normal border border-input rounded p-1 bg-card text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">Todos</option>
                {cuentasUnicas.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </TableHead>
            <TableHead className={`${thFiltro} text-right`}>Total</TableHead>
            <TableHead className={thFiltro}>Fecha</TableHead>
            <TableHead className={thFiltro}>Estado</TableHead>
            <TableHead className={`${thFiltro} text-center`}>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordenesFiltradas.map((orden, index) => (
            <OrdenFilaRow
              key={orden.id}
              orden={orden}
              index={index}
              isSelected={selectedIds.has(orden.id)}
              toggleSelection={toggleSelection}
              onSelectOrden={onSelectOrden}
              onMouseEnter={handleMouseEnterRow}
              onApproveClick={onApproveClick}
              onRejectClick={onRejectClick}
              onDeleteClick={onDeleteClick}
              onPreviewExcel={onPreviewExcel}
              onNotificar={notificar}
              onPreviewComprobante={handlePreviewComprobante}
            />
          ))}
        </TableBody>
      </Table>
    </ModuleSurface>
  )
}
