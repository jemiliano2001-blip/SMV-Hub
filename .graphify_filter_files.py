import json
from pathlib import Path

detect = json.loads(Path('.graphify_detect.json').read_text(encoding="utf-8-sig"))

# Get only doc and image files (code is already extracted via AST)
doc_files = detect['files'].get('document', [])
image_files = detect['files'].get('image', [])
non_code_files = doc_files + image_files

print(f'Non-code files needing semantic extraction: {len(non_code_files)}')
print(f'  Docs: {len(doc_files)}')
print(f'  Images: {len(image_files)}')

# Write them to a file for splitting
Path('.graphify_semantic_files.txt').write_text('\n'.join(non_code_files), encoding="utf-8")
