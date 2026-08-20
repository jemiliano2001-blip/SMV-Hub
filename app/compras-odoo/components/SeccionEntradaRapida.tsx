'use client'

import { ClipboardPaste, Loader2, Plus, Sparkles, Upload } from 'lucide-react'
import type { RefObject } from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'

export interface SeccionEntradaRapidaProps {
  textoPegado: string
  extrayendoIa: boolean
  fileInputRef: RefObject<HTMLInputElement | null>
  fileInputIaRef: RefObject<HTMLInputElement | null>
  onTextoChange: (v: string) => void
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void
  onProcesarTexto: () => void
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onFileIaUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onAgregarFila: () => void
}

export default function SeccionEntradaRapida({
  textoPegado,
  extrayendoIa,
  fileInputRef,
  fileInputIaRef,
  onTextoChange,
  onPaste,
  onProcesarTexto,
  onFileUpload,
  onFileIaUpload,
  onAgregarFila,
}: SeccionEntradaRapidaProps) {
  return (
    <Card className="gap-4 py-4 shadow-sm">
      <CardHeader className="flex flex-col gap-2 px-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
          <ClipboardPaste className="text-primary" aria-hidden />
          3. Entrada Rápida de Partidas
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv,.tsv,.txt"
            onChange={onFileUpload}
            className="hidden"
          />
          <input
            type="file"
            ref={fileInputIaRef}
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={onFileIaUpload}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={extrayendoIa}
            onClick={() => fileInputIaRef.current?.click()}
          >
            {extrayendoIa ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : (
              <Sparkles data-icon="inline-start" />
            )}
            {extrayendoIa ? 'Extrayendo con IA...' : 'Escanear PDF / Imagen (IA)'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload data-icon="inline-start" />
            Subir CSV/TSV
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onAgregarFila}>
            <Plus data-icon="inline-start" />
            Agregar Fila
          </Button>
        </div>
      </CardHeader>
      <CardContent className="relative px-4">
        <Textarea
          rows={3}
          placeholder="Pega aquí (Ctrl + V) la tabla de Excel / Sheets, o una captura de pantalla para que la IA la procese..."
          value={textoPegado}
          onChange={(e) => onTextoChange(e.target.value)}
          onPaste={onPaste}
          disabled={extrayendoIa}
          className="border-dashed font-mono text-xs"
        />
        {extrayendoIa && (
          <div className="bg-background/80 absolute inset-4 flex items-center justify-center rounded-lg backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs font-bold">
              <Loader2 className="size-4 animate-spin" />
              La IA está leyendo las partidas de la cotización...
            </div>
          </div>
        )}
        {textoPegado.trim().length > 0 && !extrayendoIa && (
          <div className="mt-2 flex justify-end">
            <Button type="button" size="sm" onClick={onProcesarTexto}>
              <Sparkles data-icon="inline-start" />
              Procesar Tabla Pegada
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
