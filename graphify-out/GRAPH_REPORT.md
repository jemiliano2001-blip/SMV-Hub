# Graph Report - .  (2026-06-20)

## Corpus Check
- 77 files · ~156,905 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 330 nodes · 525 edges · 18 communities (14 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Invoice Extraction Logic|Invoice Extraction Logic]]
- [[_COMMUNITY_Firestore Database Integration|Firestore Database Integration]]
- [[_COMMUNITY_CSV Import & Batch Write|CSV Import & Batch Write]]
- [[_COMMUNITY_TypeScript & Type System|TypeScript & Type System]]
- [[_COMMUNITY_Authentication & Auth Guards|Authentication & Auth Guards]]
- [[_COMMUNITY_React Components|React Components]]
- [[_COMMUNITY_Next.js App Router|Next.js App Router]]
- [[_COMMUNITY_Tailwind CSS Styling|Tailwind CSS Styling]]
- [[_COMMUNITY_Planning & Design Docs|Planning & Design Docs]]
- [[_COMMUNITY_Testing & Validation|Testing & Validation]]
- [[_COMMUNITY_Firebase Configuration|Firebase Configuration]]
- [[_COMMUNITY_Error Handling|Error Handling]]
- [[_COMMUNITY_Server Components & Actions|Server Components & Actions]]
- [[_COMMUNITY_Schema & Data Validation|Schema & Data Validation]]
- [[_COMMUNITY_Reporting Logic|Reporting Logic]]
- [[_COMMUNITY_UI Components|UI Components]]

## God Nodes (most connected - your core abstractions)
1. `useUsuario()` - 8 edges
2. `mapearFila()` - 7 edges
3. `ExtraccionInvoice` - 7 edges
4. `OrdenCompra` - 7 edges
5. `ReporteView()` - 6 edges
6. `mapearFilaCotizacion()` - 6 edges
7. `erroresRequeridos()` - 6 edges
8. `filtrarPorRango()` - 6 edges
9. `procesarCSVCotizaciones()` - 5 edges
10. `cotizacionesRef()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `AuthGuard()` --calls--> `useUsuario()`  [EXTRACTED]
  app/AuthGuard.tsx → lib/auth.ts
- `BotonSesion()` --calls--> `useUsuario()`  [EXTRACTED]
  app/BotonSesion.tsx → lib/auth.ts
- `POST()` --calls--> `esMediaTypeValido()`  [EXTRACTED]
  app/api/extraer-lote/route.ts → lib/extraer-ia.ts
- `refrescarFila()` --calls--> `erroresRequeridos()`  [EXTRACTED]
  app/importar/PreviewImportacion.tsx → lib/importar.ts
- `LoginPage()` --calls--> `useUsuario()`  [EXTRACTED]
  app/login/page.tsx → lib/auth.ts

## Communities (18 total, 4 thin omitted)

### Community 0 - "Invoice Extraction Logic"
Cohesion: 0.06
Nodes (41): ESTATUS_BADGE, FiltroEstatus, FiltroUbicacion, Modo, cls, claveDedupCotizacion(), clavesExistentes(), cotizacionConverter (+33 more)

### Community 1 - "Firestore Database Integration"
Cohesion: 0.06
Nodes (43): cls, cls, Modo, CampoManual, COLUMNAS_DISPLAY, refrescarFila(), ALIAS, COLUMNAS_REQUERIDAS (+35 more)

### Community 2 - "CSV Import & Batch Write"
Cohesion: 0.06
Nodes (35): Props, FiltrosReporte(), PresetTipo, Props, toInputDate(), Props, Props, agrupar() (+27 more)

### Community 3 - "TypeScript & Type System"
Cohesion: 0.09
Nodes (26): CamposManual, CamposManualSchema, CotizacionSchema, EstadoOrdenSchema, EstatusCotizacionSchema, ItemFactura, ItemFacturaSchema, NuevaCompraForm (+18 more)

### Community 4 - "Authentication & Auth Guards"
Cohesion: 0.08
Nodes (24): detectarColumnas(), procesarCSV(), COL, colSinLink, { columnasDetectadas }, { columnasDetectadas, error }, completo, csv (+16 more)

### Community 5 - "React Components"
Cohesion: 0.13
Nodes (13): AuthGuard(), BotonSesion(), authBypassActivo(), cerrarSesion(), EstadoSesion, iniciarSesionConGoogle(), proveedorGoogle, useUsuario() (+5 more)

### Community 6 - "Next.js App Router"
Cohesion: 0.1
Nodes (19): args, cargarExistentes(), COLUMNAS, CONCURRENCY, consolidarCSV(), CSV_PATH, __dirname, DRY_RUN (+11 more)

### Community 7 - "Tailwind CSS Styling"
Cohesion: 0.24
Nodes (11): POST(), POST(), ErrorIA, esMediaTypeValido(), extraerFactura(), extraerRegistros(), getCliente(), LoteExtraccionSchema (+3 more)

### Community 8 - "Planning & Design Docs"
Cohesion: 0.22
Nodes (4): db, firebaseConfig, storage, subirImagenOrden()

### Community 9 - "Testing & Validation"
Cohesion: 0.33
Nodes (3): { mockExtraerRegistros }, pdf, REGISTRO

### Community 10 - "Firebase Configuration"
Cohesion: 0.33
Nodes (3): { mockExtraerFactura }, pdf, VALID_EXTRACTION

### Community 11 - "Error Handling"
Cohesion: 0.4
Nodes (3): firaCode, firaSans, metadata

## Knowledge Gaps
- **136 isolated node(s):** `eslintConfig`, `nextConfig`, `config`, `firaCode`, `firaSans` (+131 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `OrdenCompra` connect `Firestore Database Integration` to `CSV Import & Batch Write`, `TypeScript & Type System`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `ExtraccionInvoice` connect `Firestore Database Integration` to `TypeScript & Type System`, `Authentication & Auth Guards`, `Tailwind CSS Styling`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `nextConfig`, `config` to the rest of the system?**
  _136 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Invoice Extraction Logic` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Firestore Database Integration` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `CSV Import & Batch Write` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `TypeScript & Type System` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._