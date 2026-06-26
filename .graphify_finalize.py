import json
from pathlib import Path
from datetime import datetime, timezone

# Update cumulative cost tracker
extract = json.loads(Path('.graphify_ast.json').read_text(encoding="utf-8"))
detect = json.loads(Path('.graphify_detect.json').read_text(encoding="utf-8-sig"))
input_tok = 142754 # From semantic extraction
output_tok = 0

cost_path = Path('graphify-out/cost.json')
if cost_path.exists():
    cost = json.loads(cost_path.read_text(encoding="utf-8"))
else:
    cost = {'runs': [], 'total_input_tokens': 0, 'total_output_tokens': 0}

cost['runs'].append({
    'date': datetime.now(timezone.utc).isoformat(),
    'input_tokens': input_tok,
    'output_tokens': output_tok,
    'files': detect.get('total_files', 0),
})
cost['total_input_tokens'] += input_tok
cost['total_output_tokens'] += output_tok
cost_path.write_text(json.dumps(cost, indent=2, ensure_ascii=False), encoding="utf-8")

print(f"This run: {input_tok:,} input tokens, {output_tok:,} output tokens")
print(f"All time: {cost['total_input_tokens']:,} input, {cost['total_output_tokens']:,} output ({len(cost['runs'])} runs)")
