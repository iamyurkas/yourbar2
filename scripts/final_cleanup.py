import re

def final_cleanup(text):
    text = text.replace(' Punt E Mes', ' Punt e Mes')
    text = text.replace(' Creme De ', ' Creme de ')
    text = text.replace(' Lillet Blanc', ' Lillet Blanc')
    text = text.replace(' Into A ', ' into a ')
    text = text.replace(' On Top Of ', ' on top of ')
    text = text.replace(' In A ', ' in a ')
    text = text.replace(' Into The ', ' into the ')
    text = text.replace(' Over The ', ' over the ')
    return text

with open('assets/data/data.json', 'r') as f:
    content = f.read()

def replacer(match):
    return f'"{match.group(1)}": "{final_cleanup(match.group(2))}"'

new_content = re.sub(r'"(instructions|description)": "(.*?)"', replacer, content, flags=re.DOTALL)

with open('assets/data/data.json', 'w') as f:
    f.write(new_content)
