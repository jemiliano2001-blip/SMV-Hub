/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · tone: utilitario · scope: auditoria */
'use client'

import { useEffect, useState } from 'react'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import AuthGuard from '@/app/AuthGuard'

export default function AuditoriaPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [logs, setLogs] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function fetchLogs() {
      try {
        const q = query(collection(db, 'auditoria'), orderBy('fechaHora', 'desc'), limit(100))
        const snapshot = await getDocs(q)
        setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
      } catch (error) {
        console.error('Error fetching logs:', error)
      } finally {
        setCargando(false)
      }
    }
    fetchLogs()
  }, [])

  return (
    <AuthGuard>
      <main className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 space-y-4">
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">Bitácora de Auditoría</h1>
              <span className="text-[10px] font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200 px-1.5 py-0.5 rounded">
                Seguridad Logs
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Registro inmutable utilitario de operaciones, modificaciones y borrados en el sistema.
            </p>
          </div>

          <div className="md:hidden bg-white rounded-xl shadow-xs border border-slate-200 divide-y divide-slate-100">
            {cargando ? (
              <p className="px-4 py-6 text-center text-xs font-mono text-slate-500">Cargando bitácora...</p>
            ) : logs.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs font-mono text-slate-500">No hay registros de auditoría aún.</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="p-3.5 space-y-1.5 text-xs font-sans">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-slate-900 break-all">{log.emailUsuario}</span>
                    <span
                      className={`shrink-0 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase rounded border ${
                        log.accion === 'CREAR'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : log.accion === 'EDITAR'
                            ? 'bg-sky-50 text-sky-800 border-sky-200'
                            : log.accion === 'BORRAR'
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {log.accion}
                    </span>
                  </div>
                  <p className="text-slate-600 font-mono text-[11px]">
                    {log.fechaHora?.toDate ? log.fechaHora.toDate().toLocaleString('es-MX') : ''}
                    {log.coleccion ? ` · ${log.coleccion}` : ''}
                    {log.idDoc ? ` · ${log.idDoc}` : ''}
                  </p>
                  {log.resumen && <p className="text-slate-700">{log.resumen}</p>}
                </div>
              ))
            )}
          </div>

          <div className="hidden md:block bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-600 font-mono text-[11px] uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-3.5 py-2.5">Fecha y Hora</th>
                    <th className="px-3.5 py-2.5">Usuario</th>
                    <th className="px-3.5 py-2.5">Acción</th>
                    <th className="px-3.5 py-2.5">Colección</th>
                    <th className="px-3.5 py-2.5">ID Doc</th>
                    <th className="px-3.5 py-2.5">Resumen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cargando ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-xs font-mono text-slate-500">Cargando bitácora...</td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-xs font-mono text-slate-500">No hay registros de auditoría aún.</td>
                    </tr>
                  ) : (
                    logs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50 font-sans">
                        <td className="px-3.5 py-2 text-slate-600 font-mono text-[11px]">
                          {log.fechaHora?.toDate ? log.fechaHora.toDate().toLocaleString('es-MX') : ''}
                        </td>
                        <td className="px-3.5 py-2 font-semibold text-slate-900">{log.emailUsuario}</td>
                        <td className="px-3.5 py-2">
                          <span className={`px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase rounded border ${
                            log.accion === 'CREAR' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                            log.accion === 'EDITAR' ? 'bg-sky-50 text-sky-800 border-sky-200' :
                            log.accion === 'BORRAR' ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {log.accion}
                          </span>
                        </td>
                        <td className="px-3.5 py-2 text-slate-600 font-mono text-[11px]">{log.coleccion}</td>
                        <td className="px-3.5 py-2 text-slate-500 font-mono text-[11px]">{log.idDoc}</td>
                        <td className="px-3.5 py-2 text-slate-700">{log.resumen}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </AuthGuard>
  )
}
