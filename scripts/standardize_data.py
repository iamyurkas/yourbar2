import re

def standardize_text(text):
    if text and text[-1] not in ('.', '!', '?'):
        text += '.'

    text = re.sub(r' (\d+) gr\b', r' \1 g', text)
    text = re.sub(r' (\d+) grams\b', r' \1 g', text)

    # 1. Capitalize after volume
    # Pattern: [volume] of [a-z]
    text = re.sub(r'(\d+(?:\.\d+)?(?:ml|oz|cl| dashes| drops| bar spoon| bar spoons) of (?:the )?)([a-z])',
                  lambda m: m.group(1) + m.group(2).upper(), text)

    # 2. Capitalize after Add/Pour/etc
    text = re.sub(r'(\b(?:Add|Pour|Layer|Top with|Combine) (?:the )?)([a-z])',
                  lambda m: m.group(1) + m.group(2).upper(), text)

    # 3. Capitalize after and/with in garnish/instructions
    text = re.sub(r'(\b(?:and|with) (?:a |an |the |fresh )?)([a-z])',
                  lambda m: m.group(1) + m.group(2).upper(), text)

    # 4. Capitalize after comma in lists
    text = re.sub(r'(, )([a-z])', lambda m: m.group(1) + m.group(2).upper(), text)

    # 5. Capitalize after period (start of sentence)
    text = re.sub(r'(\. )([a-z])', lambda m: m.group(1) + m.group(2).upper(), text)

    # Specific common ingredients
    ingredients = ["amaretto", "cognac", "absinthe", "vodka", "gin", "rum", "whiskey", "whisky", "vermouth", "bitters", "liqueur", "syrup", "juice"]
    for ing in ingredients:
        text = re.sub(r'(\s)' + ing + r'(\s|[,.])', lambda m: m.group(1) + ing.capitalize() + m.group(2), text)

    # Juice clarification
    fruits = ["Orange", "Blood Orange", "Lime", "Lemon", "Grapefruit", "Pineapple"]
    for fruit in fruits:
        pattern = r'(\d+(?:\.\d+)?(?:ml|oz|cl) of ' + fruit + r')(?![ a-zA-Z]* Juice)(?=[,.\n]|$| and)'
        text = re.sub(pattern, r'\1 Juice', text)

    text = re.sub(r'  +', ' ', text)
    text = text.replace('\\"brain\\."', '\\"brain\\"')
    text = text.replace('\\"crash\\."', '\\"crash\\"')

    return text

with open('assets/data/data.json', 'r') as f:
    content = f.read()

# Target "instructions" and "description" values
def replacer(match):
    return f'"{match.group(1)}": "{standardize_text(match.group(2))}"'

new_content = re.sub(r'"(instructions|description)": "(.*?)"', replacer, content, flags=re.DOTALL)

with open('assets/data/data.json', 'w') as f:
    f.write(new_content)
