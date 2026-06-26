import json
from pathlib import Path

# Agent 1 result (docs)
agent1_json = {
  "nodes": [{"id": "claude_md_project_instructions", "label": "Project Instructions (CLAUDE.md)", "file_type": "document", "source_file": "CLAUDE.md"}, {"id": "smv_compras_project", "label": "SMV Compras Americanas App", "file_type": "rationale", "source_file": "CLAUDE.md"}, {"id": "modulo_nueva_compra", "label": "Nueva Compra Module — Image-based invoice extraction", "file_type": "rationale", "source_file": "CLAUDE.md"}, {"id": "modulo_ordenes", "label": "Órdenes Module — List, detail, delete orders", "file_type": "rationale", "source_file": "CLAUDE.md"}, {"id": "modulo_importar", "label": "Importar Module — CSV bulk import with preview and validation", "file_type": "rationale", "source_file": "CLAUDE.md"}, {"id": "modulo_reportes", "label": "Reportes Module — KPIs, grouped table, PDF export", "file_type": "rationale", "source_file": "CLAUDE.md"}, {"id": "modulo_login", "label": "Login Module — Google Sign-In authentication", "file_type": "rationale", "source_file": "CLAUDE.md"}, {"id": "stack_nextjs_16", "label": "Next.js 16 App Router", "file_type": "rationale", "source_file": "CLAUDE.md"}, {"id": "stack_react_19", "label": "React 19 with Server Components", "file_type": "rationale", "source_file": "CLAUDE.md"}, {"id": "stack_tailwind_v4", "label": "Tailwind CSS v4 with PostCSS @theme", "file_type": "rationale", "source_file": "CLAUDE.md"}, {"id": "stack_typescript", "label": "TypeScript strict mode", "file_type": "rationale", "source_file": "CLAUDE.md"}, {"id": "stack_firebase_v12", "label": "Firebase v12 Firestore", "file_type": "rationale", "source_file": "CLAUDE.md"}, {"id": "stack_anthropic_sdk", "label": "Anthropic SDK for structured invoice extraction", "file_type": "rationale", "source_file": "CLAUDE.md"}, {"id": "stack_vitest", "label": "Vitest for unit testing", "file_type": "rationale", "source_file": "CLAUDE.md"}, {"id": "lib_schemas", "label": "lib/schemas.ts — Zod schemas for data validation", "file_type": "code", "source_file": "CLAUDE.md"}, {"id": "lib_extraer_ia", "label": "lib/extraer-ia.ts — Invoice extraction with Anthropic", "file_type": "code", "source_file": "CLAUDE.md"}, {"id": "lib_ordenes", "label": "lib/ordenes.ts — Firestore CRUD for orders", "file_type": "code", "source_file": "CLAUDE.md"}, {"id": "lib_importar", "label": "lib/importar.ts — CSV parsing, validation, batch write", "file_type": "code", "source_file": "CLAUDE.md"}, {"id": "lib_reportes", "label": "lib/reportes.ts — Pure reporting logic with KPIs", "file_type": "code", "source_file": "CLAUDE.md"}, {"id": "lib_auth", "label": "lib/auth.ts — Google Sign-In and user hooks", "file_type": "code", "source_file": "CLAUDE.md"}, {"id": "lib_firebase", "label": "lib/firebase.ts — Firebase SDK initialization", "file_type": "code", "source_file": "CLAUDE.md"}, {"id": "lib_storage", "label": "lib/storage.ts — Firebase Storage utilities", "file_type": "code", "source_file": "CLAUDE.md"}, {"id": "app_nueva_compra", "label": "app/nueva-compra/ — Single invoice capture form", "file_type": "code", "source_file": "CLAUDE.md"}, {"id": "app_ordenes", "label": "app/ordenes/ — List, detail, delete orders", "file_type": "code", "source_file": "CLAUDE.md"}, {"id": "app_importar", "label": "app/importar/ — CSV upload and bulk import UI", "file_type": "code", "source_file": "CLAUDE.md"}, {"id": "app_reportes", "label": "app/reportes/ — KPI dashboard and grouped report table", "file_type": "code", "source_file": "CLAUDE.md"}, {"id": "app_login", "label": "app/login/ — Google Sign-In page", "file_type": "code", "source_file": "CLAUDE.md"}, {"id": "app_auth_guard", "label": "app/AuthGuard.tsx — Session protection wrapper", "file_type": "code", "source_file": "CLAUDE.md"}, {"id": "design_importar_csv", "label": "Design: CSV Import (2026-06-16)", "file_type": "document", "source_file": "docs/superpowers/specs/2026-06-16-importar-csv-design.md"}, {"id": "design_importar_mejoras_ux", "label": "Design: Import UX Enhancements (2026-06-18)", "file_type": "document", "source_file": "docs/superpowers/specs/2026-06-18-importar-mejoras-ux-design.md"}, {"id": "design_reportes", "label": "Design: Reports Module (2026-06-18)", "file_type": "document", "source_file": "docs/superpowers/specs/2026-06-18-reportes-compras-design.md"}, {"id": "plan_importar_csv", "label": "Plan: CSV Import Implementation (2026-06-16)", "file_type": "document", "source_file": "docs/superpowers/plans/2026-06-16-importar-csv.md"}, {"id": "plan_importar_mejoras_ux", "label": "Plan: Import UX Enhancements (2026-06-18)", "file_type": "document", "source_file": "docs/superpowers/plans/2026-06-18-importar-mejoras-ux.md"}, {"id": "plan_reportes", "label": "Plan: Reports Implementation (2026-06-18)", "file_type": "document", "source_file": "docs/superpowers/plans/2026-06-18-reportes-compras.md"}],
  "edges": [],
  "hyperedges": [],
  "input_tokens": 104256,
  "output_tokens": 0
}

# Agent 2 result (images)  
agent2_json = {
  "nodes": [{"id": "smv_logo_mark", "label": "SMV Logo Mark", "file_type": "image", "source_file": "SMV MAQUINADOS LOGO_color azul.PNG"}, {"id": "smv_brand_complete", "label": "SMV Brand Complete (Servicios y Maquinados Vázquez)", "file_type": "image", "source_file": "public/smv-logo-completo.png"}, {"id": "file_icon", "label": "File Icon (Document)", "file_type": "image", "source_file": "public/file.svg"}, {"id": "globe_icon", "label": "Globe Icon (International/Web)", "file_type": "image", "source_file": "public/globe.svg"}, {"id": "next_logo", "label": "Next.js Logo", "file_type": "image", "source_file": "public/next.svg"}, {"id": "brand_color_blue", "label": "Brand Color: Blue", "file_type": "rationale", "source_file": "SMV MAQUINADOS LOGO_color azul.PNG"}, {"id": "brand_color_gray", "label": "Brand Color: Light Gray/Beige", "file_type": "rationale", "source_file": "SMV MAQUINADOS LOGO_color azul.PNG"}, {"id": "navigation_icons", "label": "Navigation Icons Set", "file_type": "rationale", "source_file": "public/file.svg"}, {"id": "brand_assets", "label": "SMV Brand Assets", "file_type": "rationale", "source_file": "public/smv-logo-completo.png"}],
  "edges": [],
  "hyperedges": [],
  "input_tokens": 38498,
  "output_tokens": 0
}

# Merge all semantic results
all_nodes = agent1_json['nodes'] + agent2_json['nodes']
all_edges = agent1_json['edges'] + agent2_json['edges']
all_hyperedges = agent1_json['hyperedges'] + agent2_json['hyperedges']

# Save to semantic file
Path('.graphify_semantic.json').write_text(json.dumps({
    'nodes': all_nodes,
    'edges': all_edges,
    'hyperedges': all_hyperedges,
    'input_tokens': 104256 + 38498,
    'output_tokens': 0
}, indent=2, ensure_ascii=False), encoding="utf-8")

print(f"Extraction complete - {len(all_nodes)} nodes, {len(all_edges)} edges")
