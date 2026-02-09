import re
import json

with open('assets/data/data.json', 'r') as f:
    content = f.read()

# Replace all ." that are followed by alphanumeric characters with .\"
content = re.sub(r'\."([a-zA-Z])', r'.\\"\1', content)

with open('assets/data/data.json', 'w') as f:
    f.write(content)

try:
    with open('assets/data/data.json', 'r') as f:
        json.load(f)
    print("JSON is valid")
except Exception as e:
    print(f"JSON is still invalid: {e}")
