#!/usr/bin/env python3
import json
import re
from pathlib import Path

base = Path('libs/i18n/locales/catalog')
en = json.loads((base / 'en-US.json').read_text())
es = json.loads((base / 'es-ES.json').read_text())

catalog_keys = [k for k in en if k.startswith('cocktail.') or k.startswith('ingredient.')]
missing = [k for k in catalog_keys if k not in es]
identical_non_name = [
    k for k in catalog_keys
    if k in es and en[k] == es[k] and not (k.endswith('.name') or k.endswith('.synonyms'))
]

english_markers = {
    'the', 'and', 'with', 'from', 'that', 'this', 'then', 'until',
    'over', 'into', 'shake', 'garnish', 'strain', 'stir'
}
mixed = []
for k, v in es.items():
    if not isinstance(v, str):
        continue
    if k.startswith('cocktail.') and (k.endswith('.description') or k.endswith('.instructions')):
        words = [re.sub(r'[^a-z]', '', w.lower()) for w in v.split()]
        if any(w in english_markers for w in words if w):
            mixed.append(k)
    if k.startswith('ingredient.') and k.endswith('.description'):
        words = [re.sub(r'[^a-z]', '', w.lower()) for w in v.split()]
        if any(w in english_markers for w in words if w):
            mixed.append(k)

print(f'missing_keys={len(missing)}')
print(f'identical_non_name={len(identical_non_name)}')
print(f'entries_with_english_markers={len(mixed)}')

if missing:
    print('sample_missing=', ', '.join(missing[:10]))
if identical_non_name:
    print('sample_identical_non_name=', ', '.join(identical_non_name[:10]))
if mixed:
    print('sample_english_marker_entries=', ', '.join(mixed[:10]))
