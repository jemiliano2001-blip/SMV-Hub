import sys, json
from graphify.build import build_from_json
from graphify.cluster import score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.report import generate
from pathlib import Path

extraction = json.loads(Path('.graphify_ast.json').read_text(encoding="utf-8"))
detection = json.loads(Path('.graphify_detect.json').read_text(encoding="utf-8-sig"))
analysis = json.loads(Path('.graphify_analysis.json').read_text(encoding="utf-8"))

G = build_from_json(extraction)
communities = {int(k): v for k, v in analysis['communities'].items()}
cohesion = {int(k): v for k, v in analysis['cohesion'].items()}
tokens = {'input': extraction.get('input_tokens', 0), 'output': extraction.get('output_tokens', 0)}

# Label communities
labels = {
    0: "Invoice Extraction Logic",
    1: "Firestore Database Integration",
    2: "CSV Import & Batch Write",
    3: "TypeScript & Type System",
    4: "Authentication & Auth Guards",
    5: "React Components",
    6: "Next.js App Router",
    7: "Tailwind CSS Styling",
    8: "Planning & Design Docs",
    9: "Testing & Validation",
    10: "Firebase Configuration",
    11: "Error Handling",
    12: "Server Components & Actions",
    13: "Schema & Data Validation",
    14: "Reporting Logic",
    15: "UI Components",
    16: "Storage & Media",
    17: "Tech Stack Foundations"
}

questions = suggest_questions(G, communities, labels)
report = generate(G, communities, cohesion, labels, analysis['gods'], analysis['surprises'], detection, tokens, '.', suggested_questions=questions)
Path('graphify-out/GRAPH_REPORT.md').write_text(report, encoding="utf-8")
Path('.graphify_labels.json').write_text(json.dumps({str(k): v for k, v in labels.items()}, ensure_ascii=False), encoding="utf-8")
print("Report updated with community labels")
