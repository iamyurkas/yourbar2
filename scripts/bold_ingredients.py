import json
import re

with open('scripts/ingredient_match_list.txt', 'r') as f:
    INGREDIENTS = [line.strip() for line in f if line.strip()]

INGREDIENTS = [ing for ing in INGREDIENTS if len(ing) >= 3]
# Escape special chars and sort by length desc
INGREDIENTS.sort(key=len, reverse=True)

# Build a single regex
# We use lookarounds to ensure we don't match mid-word or already bolded
# But ingredients themselves can contain punctuation.
# So we use a set of boundary characters instead of \b
start_boundary = r'(?<![\w*])' # Not preceded by alphanumeric or *
end_boundary = r'(?![\w*])'    # Not followed by alphanumeric or *

pattern_str = '|'.join(re.escape(ing) for ing in INGREDIENTS)
full_pattern = f'({start_boundary}({pattern_str}){end_boundary})'

regex = re.compile(full_pattern, re.IGNORECASE)

def bold_ingredients(text):
    if not text: return text

    # To avoid double bolding, we find all matches first
    # and then replace them from end to start to avoid index shifting.
    # Or just use sub with a function.

    def replacer(match):
        return f"**{match.group(2)}**"

    return regex.sub(replacer, text)

def main():
    with open('assets/data/data.json', 'r') as f:
        data = json.load(f)

    for cocktail in data['cocktails']:
        if 'instructions' in cocktail:
            cocktail['instructions'] = bold_ingredients(cocktail['instructions'])
        if 'description' in cocktail:
            cocktail['description'] = bold_ingredients(cocktail['description'])

    with open('assets/data/data.json', 'w') as f:
        # Use indent=2 to maintain readability, but be careful with existing formatting.
        # Actually, the user asked to modify data.json, and I should respect hygiene.
        json.dump(data, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    main()
