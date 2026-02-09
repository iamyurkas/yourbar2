import re

def fix_corruption(text):
    text = re.sub(r',([0-9A-Z])', r', \1', text)
    text = re.sub(r'(\bAnd)([0-9])', r'\1 \2', text)
    text = re.sub(r'(\b(?:Add|Pour|Layer|Top with|Combine))([0-9])', r'\1 \2', text)
    text = re.sub(r'([a-zA-Z])&', r'\1 &', text)
    text = re.sub(r'&([a-zA-Z])', r'& \1', text)

    # Fix "And" in the middle of instructions
    # If not at the start of a sentence (i.e. preceded by comma or space but not period)
    text = re.sub(r'([^.!?]\s)And\s', r'\1and ', text)
    text = re.sub(r'([^.!?]\s)The\s', r'\1the ', text)
    text = re.sub(r'([^.!?]\s)A\s', r'\1a ', text)
    text = re.sub(r'([^.!?]\s)An\s', r'\1an ', text)

    text = re.sub(r'  +', ' ', text)
    return text

with open('assets/data/data.json', 'r') as f:
    content = f.read()

def replacer(match):
    return f'"{match.group(1)}": "{fix_corruption(match.group(2))}"'

new_content = re.sub(r'"(instructions|description)": "(.*?)"', replacer, content, flags=re.DOTALL)

with open('assets/data/data.json', 'w') as f:
    f.write(new_content)
