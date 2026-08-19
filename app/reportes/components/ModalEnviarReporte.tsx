'use client'

import { useState } from 'react'
import { Mail } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import type { Grupo, Kpis } from '@/lib/reportes'

type Props = {
  abierto: boolean
  onCerrar: () => void
  titulo: string
  subtitulo: string
  moneda: string
  kpis: Kpis
  grupos: Grupo[]
  totalGeneral: number
}

function fmt(monto: number, moneda: string): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: 2,
  }).format(monto)
}

function generarCuerpo(
  titulo: string,
  subtitulo: string,
  moneda: string,
  kpis: Kpis,
  grupos: Grupo[],
  totalGeneral: number
): string {
  const sep = '─'.repeat(48)

  let txt = `${titulo} — ${subtitulo}\n${sep}\n\n`

  txt += `RESUMEN\n${sep}\n`
  txt += `Órdenes:       ${kpis.numOrdenes}\n`
  txt += `Artículos:     ${kpis.numArticulos}\n`
  txt += `Proveedores:   ${kpis.numProveedores}\n`
  txt += `Total gastado: ${fmt(kpis.totalComprado, moneda)}\n\n`

  txt += `DETALLE POR GRUPO\n${sep}\n`
  for (const g of grupos) {
    txt += `▸ ${g.clave}  →  ${fmt(g.total, moneda)}\n`
    for (const l of g.lineas) {
      txt += `   - ${l.referencia} | ${l.descripcion} (${l.cantidad ?? 1}x): ${fmt(l.total, moneda)}\n`
    }
    txt += '\n'
  }

  txt += `\n${sep}\n`
  txt += `TOTAL GENERAL: ${fmt(totalGeneral, moneda)}\n`
  txt += `${sep}\n\n`
  txt += `Generado automáticamente — SMV Hub`

  return txt
}

export default function ModalEnviarReporte({
  abierto,
  onCerrar,
  titulo,
  subtitulo,
  moneda,
  kpis,
  grupos,
  totalGeneral,
}: Props) {
  const [destinatarios, setDestinatarios] = useState('')

  function cerrar() {
    setDestinatarios('')
    onCerrar()
  }

  function handleEnviar() {
    const asunto = `Reporte de compras — ${subtitulo} (${moneda})`
    const cuerpo = generarCuerpo(titulo, subtitulo, moneda, kpis, grupos, totalGeneral)
    const mailtoUrl = `mailto:${encodeURIComponent(destinatarios)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`
    window.open(mailtoUrl, '_blank')
    cerrar()
  }

  const valido = destinatarios.trim().length > 0

  return (
    <Dialog open={abierto} onOpenChange={(open) => !open && cerrar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar reporte por correo</DialogTitle>
          <DialogDescription>
            Se abrirá tu cliente de correo con el reporte prellenado.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="reporte-destinatarios">
              Destinatarios
              <span className="ml-1 font-normal text-muted-foreground">(separados por coma)</span>
            </FieldLabel>
            <Textarea
              id="reporte-destinatarios"
              value={destinatarios}
              onChange={(e) => setDestinatarios(e.target.value)}
              rows={3}
              placeholder="gerencia@empresa.com, contabilidad@empresa.com"
              autoFocus
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={cerrar} type="button">
            Cancelar
          </Button>
          <Button onClick={handleEnviar} disabled={!valido}>
            <Mail data-icon="inline-start" />
            Abrir correo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
