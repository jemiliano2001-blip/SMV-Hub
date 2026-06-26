## 2026-06-16T21:18:53Z
You are worker_importar_page_1. Your working directory is D:\proyectos_code\SMV\compras-americanas\.agents\worker_importar_page_1.
Please implement the /importar page in the Next.js application.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Specifications:
- Read `docs/superpowers/specs/2026-06-16-importar-csv-design.md` for specific details about the /importar page states and functionality.
- Create `app/importar/page.tsx` (Server Component) to render the overall layout/structure and navigation headers (Inicio -> `/`, Ver Órdenes -> `/ordenes`, Nueva Compra -> `/nueva-compra`).
- Create `app/importar/ImportarCSV.tsx` (Client Component) to handle the 3-state flow:
  1. **Upload**: Drag-and-drop / select file input area. Accepts `.csv` files. Parses CSV text in the browser using `procesarCSV(text)` from `@/lib/importar`.
  2. **Preview**: Renders a table of parsed rows.
     - Row styling: Highlight rows with blocking errors (`errores.length > 0`) in Red (e.g. bg-red-50), and rows with warnings (`advertencias.length > 0` and `errores.length === 0`) in Yellow (e.g. bg-yellow-50).
     - Row selection: Checkbox to toggle the row's `seleccionada` property. Rows with blocking errors cannot be selected (checkbox disabled/hidden).
     - Counter: Display text indicating how many rows are ready to import, e.g., `"48 de 50 filas listas para importar"`.
     - Import Button: Triggers `importarOrdenes(...)` from `@/lib/importar`.
     - Cancel Button: Returns to Upload state.
  3. **Importing & Result**: Displays progress (spinner/progress bar/percentage) while batching calls to Firestore in groups of 10. When completed, displays a checkmark success message showing the count of imported orders (e.g. `✓ 48 órdenes importadas`) and a button to view orders (`/ordenes`).
- Ensure all styling uses modern Tailwind CSS v4, matching the `/nueva-compra` and `/ordenes` pages.
- Handle edge cases, parsing errors, empty inputs.

Verification:
- Verify that `npm run lint` and `npm run build` run without errors or warnings.

Write a handoff.md in your directory D:\proyectos_code\SMV\compras-americanas\.agents\worker_importar_page_1\ when done. Then send a message to me.
