"use client";

import React, { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "@/lib/firebase";

export default function ImportExportButtons() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const functions = getFunctions(firebaseApp);

  function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Error desconocido';
  }

  const handleExportSheets = async () => {
    setIsExporting(true);
    setStatusMsg(null);
    try {
      const exportToSheets = httpsCallable<
        { spreadsheetId: string; range: string },
        { success: boolean; updatedCells?: number }
      >(functions, "exportToGoogleSheets");
      await exportToSheets({
        spreadsheetId: "TU_SPREADSHEET_ID", // Sustituir por ID real
        range: "Sheet1!A1",
      });
      setStatusMsg({ type: 'success', text: 'Datos exportados a Google Sheets exitosamente.' });
    } catch (error: unknown) {
      console.error("Export failed:", getErrorMessage(error));
      setStatusMsg({ type: 'error', text: `Error al exportar: ${getErrorMessage(error)}` });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportSheets = async () => {
    setIsImporting(true);
    setStatusMsg(null);
    try {
      const importFromSheets = httpsCallable<
        { spreadsheetId: string; range: string },
        { success: boolean; importedCount: number }
      >(functions, "importFromGoogleSheets");
      const result = await importFromSheets({
        spreadsheetId: "TU_SPREADSHEET_ID", // Sustituir por ID real
        range: "Sheet1!A2:F",
      });
      setStatusMsg({ type: 'success', text: `Datos importados exitosamente. Filas: ${result.data.importedCount || 0}` });
    } catch (error: unknown) {
      console.error("Import failed:", getErrorMessage(error));
      setStatusMsg({ type: 'error', text: `Error al importar: ${getErrorMessage(error)}` });
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    setStatusMsg(null);
    try {
      const exportToExcelFunc = httpsCallable<
        { workbookId: string; worksheetName: string },
        { success: boolean; rowsExported: number }
      >(functions, "exportToExcel");
      await exportToExcelFunc({
        workbookId: "TU_WORKBOOK_ID", // Sustituir por ID de MS Graph
        worksheetName: "Sheet1",
      });
      setStatusMsg({ type: 'success', text: 'Datos exportados a Excel exitosamente.' });
    } catch (error: unknown) {
      console.error("Excel export failed:", getErrorMessage(error));
      setStatusMsg({ type: 'error', text: `Error al exportar a Excel: ${getErrorMessage(error)}` });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mt-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Sincronización de Datos</h3>
      <p className="text-sm text-gray-600 mb-6">
        Exporta el catálogo de productos a una hoja de cálculo o importa cambios masivos de forma automatizada.
      </p>

      {statusMsg && (
        <div className={`mb-4 p-3 rounded-md border ${
          statusMsg.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {statusMsg.text}
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        <button
          onClick={handleExportSheets}
          disabled={isExporting || isImporting}
          className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 rounded-md text-sm font-medium shadow-sm disabled:opacity-50 transition-colors"
        >
          {isExporting ? "Exportando..." : "Exportar a Google Sheets"}
        </button>

        <button
          onClick={handleImportSheets}
          disabled={isExporting || isImporting}
          className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md text-sm font-medium shadow-sm disabled:opacity-50 transition-colors"
        >
          {isImporting ? "Importando..." : "Importar desde Google Sheets"}
        </button>

        <button
          onClick={handleExportExcel}
          disabled={isExporting || isImporting}
          className="bg-green-700 hover:bg-green-800 text-white py-2 px-4 rounded-md text-sm font-medium shadow-sm disabled:opacity-50 transition-colors"
        >
          Exportar a MS Excel
        </button>
      </div>
    </div>
  );
}
