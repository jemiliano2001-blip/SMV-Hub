import json
from pathlib import Path

detect = json.loads(Path('.graphify_detect.json').read_text(encoding="utf-8-sig"))

# Chunk 1: Documentation files
doc_files = detect['files'].get('document', [])
if doc_files:
    chunk1_path = Path('graphify-out/.graphify_chunk_files_1.txt')
    chunk1_path.parent.mkdir(exist_ok=True)
    chunk1_path.write_text('\n'.join(doc_files), encoding="utf-8")
    print(f'Chunk 1 (docs): {len(doc_files)} files')
    print('  ' + '\n  '.join(doc_files[:5]))

# Chunk 2: Image files
image_files = detect['files'].get('image', [])
if image_files:
    chunk2_path = Path('graphify-out/.graphify_chunk_files_2.txt')
    chunk2_path.parent.mkdir(exist_ok=True)
    chunk2_path.write_text('\n'.join(image_files), encoding="utf-8")
    print(f'Chunk 2 (images): {len(image_files)} files')
    print('  ' + '\n  '.join(image_files[:5]))

print()
print(f'Ready to dispatch 2 subagents for {len(doc_files) + len(image_files)} files')
