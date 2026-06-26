import sys, json
from graphify.build import build_from_json
from graphify.export import to_obsidian, to_canvas
from pathlib import Path

extraction = json.loads(Path('.graphify_extract.json').read_text(encoding="utf-8")) if Path('.graphify_extract.json').exists() else json.loads(Path('.graphify_ast.json').read_text(encoding="utf-8"))
analysis = json.loads(Path('.graphify_analysis.json').read_text(encoding="utf-8"))
labels_raw = json.loads(Path('.graphify_labels.json').read_text(encoding="utf-8")) if Path('.graphify_labels.json').exists() else {}

G = build_from_json(extraction)
communities = {int(k): v for k, v in analysis['communities'].items()}
cohesion = {int(k): v for k, v in analysis['cohesion'].items()}
labels = {int(k): v for k, v in labels_raw.items()}

obsidian_dir = r'C:\Users\emili\claude-obsidian\vaults\smv-compras'

n = to_obsidian(G, communities, obsidian_dir, community_labels=labels or None, cohesion=cohesion)
print(f'Obsidian vault: {n} notes in {obsidian_dir}/')

to_canvas(G, communities, f'{obsidian_dir}/graph.canvas', community_labels=labels or None)
print(f'Canvas: {obsidian_dir}/graph.canvas')
print()
print(f"Open {obsidian_dir}/ as a vault in Obsidian.")
print("  Graph view   - nodes colored by community")
print("  graph.canvas - structured layout with communities as groups")
