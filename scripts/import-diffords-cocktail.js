#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.resolve(__dirname, '..', 'assets', 'data', 'data.json');
const DEFAULT_COCKTAIL_TAGS = [6];
const DEFAULT_GLASS_ID = 'coupe';
const DEFAULT_METHOD_ID = 'shake';

const UNIT_ID_BY_TOKEN = {
  'ml': 11,
  'milliliter': 11,
  'milliliters': 11,
  'millilitre': 11,
  'millilitres': 11,
  'cl': 3,
  'oz': 12,
  'ounce': 12,
  'ounces': 12,
  'dash': 6,
  'dashes': 6,
  'drop': 7,
  'drops': 7,
  'part': 13,
  'parts': 13,
  'barspoon': 2,
  'barspoons': 2,
  'bar spoon': 2,
  'bar spoons': 2,
  'tsp': 24,
  'teaspoon': 24,
  'teaspoons': 24,
  'tbsp': 23,
  'tablespoon': 23,
  'tablespoons': 23,
  'cup': 5,
  'cups': 5,
  'sprig': 21,
  'sprigs': 21,
  'leaf': 10,
  'leaves': 10,
  'slice': 19,
  'slices': 19,
  'wedge': 27,
  'wedges': 27,
  'peel': 14,
  'peels': 14,
  'twist': 26,
  'twists': 26,
  'cube': 4,
  'cubes': 4,
};

const METHOD_HINTS = [
  ['build', 'build'],
  ['stir', 'stir'],
  ['muddle', 'muddle'],
  ['blend', 'blend'],
  ['throw', 'throw'],
  ['layer', 'layer'],
  ['shake', 'shake'],
  ['heat', 'heat'],
];

const GLASS_HINTS = {
  margarita: 'margarita_glass',
  coupe: 'coupe',
  'nick & nora': 'nick_and_nora',
  nick: 'nick_and_nora',
  highball: 'highball_glass',
  collins: 'collins_glass',
  martini: 'martini',
  rocks: 'rocks_glass',
  'old-fashioned': 'rocks_glass',
};

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function toTitleCase(value) {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function parseFraction(token) {
  const trimmed = token.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  if (/^\d+\/\d+$/.test(trimmed)) {
    const [a, b] = trimmed.split('/').map(Number);
    if (b !== 0) return a / b;
  }
  if (/^\d+\s+\d+\/\d+$/.test(trimmed)) {
    const [whole, frac] = trimmed.split(/\s+/);
    return Number(whole) + parseFraction(frac);
  }
  return undefined;
}

function parseIngredientLine(line) {
  let working = String(line || '').replace(/\s+/g, ' ').trim();
  if (!working) return null;

  working = working.replace(/^\d+\)\s*/, '').replace(/^[-•]\s*/, '');

  let amount = '1';
  let unitId = 1;
  let name = working;

  const amountMatch = working.match(/^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s+(.+)$/);
  if (amountMatch) {
    const parsedAmount = parseFraction(amountMatch[1]);
    if (parsedAmount != null) {
      amount = Number.isInteger(parsedAmount)
        ? String(parsedAmount)
        : String(Number(parsedAmount.toFixed(2)));
      let rest = amountMatch[2].trim();

      const restTokens = rest.split(/\s+/);
      const oneWordUnit = restTokens[0]?.toLowerCase().replace(/\.$/, '');
      const twoWordUnit = restTokens.slice(0, 2).join(' ').toLowerCase().replace(/\.$/, '');

      const twoWordUnitId = UNIT_ID_BY_TOKEN[twoWordUnit] || UNIT_ID_BY_TOKEN[twoWordUnit.replace(/\s+/g, '')];
      const oneWordUnitId = UNIT_ID_BY_TOKEN[oneWordUnit] || UNIT_ID_BY_TOKEN[(oneWordUnit || '').replace(/\s+/g, '')];

      if (twoWordUnitId) {
        unitId = twoWordUnitId;
        rest = restTokens.slice(2).join(' ');
      } else if (oneWordUnitId) {
        unitId = oneWordUnitId;
        rest = restTokens.slice(1).join(' ');
      }

      name = rest || working;
    }
  }

  name = toTitleCase(
    name
      .replace(/^of\s+/i, '')
      .replace(/^fresh\s+/i, '')
      .replace(/^top\s+up\s+with\s+/i, '')
      .replace(/^top\s+with\s+/i, '')
      .replace(/^with\s+/i, '')
      .replace(/\s*\([^)]*\)\s*/g, ' ')
      .replace(/\b(for garnish|to garnish|garnish)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim(),
  );

  if (!name) return null;

  const lowered = normalizeText(working);
  const garnish = /\bgarnish\b|\bto garnish\b|\bfor garnish\b/.test(lowered);
  const process = /\bice\b|\bto rinse\b|\brinse\b|\bto rim\b|\brim\b|\btop up\b|\btop with\b/.test(lowered);

  return { amount, unitId, name, garnish, process };
}

function buildIngredientNameVariants(name) {
  const raw = String(name || '').trim();
  if (!raw) return [];

  const title = toTitleCase(raw);
  const normalized = normalizeText(title);
  const variants = new Set([normalized]);

  const words = title.split(/\s+/).filter(Boolean);
  if (words.length === 2) {
    variants.add(normalizeText(`${words[1]} ${words[0]}`));
  }
  if (words.length === 3) {
    variants.add(normalizeText(`${words[2]} ${words[0]} ${words[1]}`));
  }

  const patterns = [
    [/^reposado tequila$/i, 'tequila reposado'],
    [/^blanco tequila$/i, 'tequila blanco'],
    [/^anejo tequila$/i, 'tequila añejo'],
    [/^gold tequila$/i, 'tequila gold'],
    [/^silver tequila$/i, 'tequila blanco'],
    [/^agave nectar$/i, 'agave syrup'],
    [/^aromatic bitters$/i, 'bitters'],
    [/^(dark|black) rum$/i, 'dark rum'],
    [/^(dark\/?black|black\/?dark) rum$/i, 'dark rum'],
    [/^basil leaves?$/i, 'basil'],
    [/^mint leaves?$/i, 'mint'],
    [/^sugar syrup$/i, 'simple syrup'],
    [/^kummel liqueur$/i, 'kümmel liqueur'],
    [/^maraschino liqueur$/i, 'luxardo maraschino'],
  ];

  patterns.forEach(([regex, replacement]) => {
    if (regex.test(title)) {
      variants.add(normalizeText(replacement));
    }
  });

  return [...variants];
}

function extractJsonLd(html) {
  const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const script of scripts) {
    const raw = script[1].trim();
    try {
      const parsed = JSON.parse(raw);
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const candidate of candidates) {
        if (candidate?.['@type'] === 'Recipe') return candidate;
        if (candidate?.mainEntity?.['@type'] === 'Recipe') return candidate.mainEntity;
      }
    } catch {
      // ignore invalid blocks
    }
  }
  return null;
}

function stripHtmlTags(value) {
  return String(value || '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function isLikelyHumanText(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (/[{}]/.test(text)) return false;
  if (/\b(background|font-family|border|padding|margin|display|@media)\b/i.test(text)) return false;

  const words = text.match(/[a-zA-Z][a-zA-Z'-]*/g) || [];
  if (words.length < 5) return false;

  const punctuationNoise = (text.match(/[;:]/g) || []).length;
  if (punctuationNoise > Math.max(6, Math.floor(text.length / 20))) return false;

  return true;
}

function extractReviewText(html) {
  const sanitizedHtml = String(html || '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');

  const headingRegex = /<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi;
  const headings = [...sanitizedHtml.matchAll(headingRegex)].map((match) => ({
    full: match[0],
    start: match.index,
    end: (match.index || 0) + match[0].length,
    text: stripHtmlTags(match[2]),
  }));

  const reviewHeading = headings.find((heading) => /^review\s*:?\s*$/i.test(heading.text));
  if (!reviewHeading) {
    return '';
  }

  const nextHeading = headings.find((heading) => heading.start > reviewHeading.start);
  const sectionEnd = nextHeading ? nextHeading.start : sanitizedHtml.length;
  const scopedHtml = sanitizedHtml.slice(reviewHeading.end, sectionEnd);
  if (!scopedHtml) {
    return '';
  }

  const candidates = [
    ...scopedHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi),
    ...scopedHtml.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi),
  ];

  for (const candidate of candidates) {
    const text = stripHtmlTags(candidate[1]);
    if (isLikelyHumanText(text)) {
      return text;
    }
  }
  return '';
}

function extractGlassText(html) {
  const sanitizedHtml = String(html || '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');

  const patterns = [
    /<dt[^>]*>\s*Glass\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i,
    /\bGlass\s*:\s*([^\n<]+)/i,
  ];

  for (const pattern of patterns) {
    const match = sanitizedHtml.match(pattern);
    if (!match) continue;
    const text = stripHtmlTags(match[1]);
    if (text) return text;
  }

  return '';
}

function getTextInstructions(recipe) {
  const source = recipe?.recipeInstructions;
  if (!source) return [];
  if (typeof source === 'string') {
    return source.split(/\n+/).map((x) => x.trim()).filter(Boolean);
  }
  if (Array.isArray(source)) {
    return source
      .map((step) => {
        if (typeof step === 'string') return step.trim();
        if (step && typeof step.text === 'string') return step.text.trim();
        return '';
      })
      .filter(Boolean);
  }
  return [];
}

function findMethodIds(textLines) {
  const joined = normalizeText(textLines.join(' '));
  const methodIds = METHOD_HINTS.filter(([hint]) => joined.includes(hint)).map(([, id]) => id);
  return methodIds.length > 0 ? [...new Set(methodIds)] : [DEFAULT_METHOD_ID];
}

function findGlassId(recipe, explicitGlassText) {
  const explicitHaystack = normalizeText(explicitGlassText || '');
  if (explicitHaystack) {
    for (const [token, id] of Object.entries(GLASS_HINTS)) {
      if (explicitHaystack.includes(normalizeText(token))) {
        return id;
      }
    }
  }

  const haystack = normalizeText(`${recipe?.recipeCategory || ''} ${recipe?.description || ''} ${recipe?.name || ''}`);
  for (const [token, id] of Object.entries(GLASS_HINTS)) {
    if (haystack.includes(normalizeText(token))) {
      return id;
    }
  }
  return DEFAULT_GLASS_ID;
}

function guessIngredientTagId(name) {
  const normalized = normalizeText(name);
  if (/syrup|cordial|grenadine|orgeat|honey/.test(normalized)) return 5;
  if (/bitters/.test(normalized)) return 4;
  if (/juice|lemon|lime|orange|grapefruit|pineapple|mint|basil|cucumber/.test(normalized)) return 7;
  if (/vodka|gin|rum|tequila|mezcal|whisk|bourbon|scotch|brandy|cognac/.test(normalized)) return 0;
  if (/liqueur|amaro|triple sec|cointreau|aperol|campari|chartreuse/.test(normalized)) return 1;
  if (/vermouth|sherry|port|wine|prosecco|champagne/.test(normalized)) return 2;
  if (/soda|tonic|cola|water|ginger beer|ginger ale/.test(normalized)) return 6;
  return 9;
}

async function fetchRecipe(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; yourbar2-import-script/1.0)',
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${url}`);
  }

  const html = await response.text();
  const recipe = extractJsonLd(html);
  if (!recipe) {
    throw new Error('Unable to locate Recipe JSON-LD in the page');
  }
  return {
    recipe,
    review: extractReviewText(html),
    glassText: extractGlassText(html),
  };
}

function shouldSkipInstructionStep(step) {
  const normalized = normalizeText(step);
  return (
    (/\b(select|choose|pick)\b/.test(normalized) &&
      /\b(pre chill|prechill|chill)\b/.test(normalized) &&
      /\bglass\b/.test(normalized)) ||
    (/\bprepare\b/.test(normalized) && /\bgarnish\b/.test(normalized))
  );
}

function toSentenceCase(text) {
  const lowered = String(text || '').toLowerCase();
  return lowered.replace(/^[a-z]/, (char) => char.toUpperCase());
}

function normalizeInstructionStep(step) {
  let text = String(step || '')
    .replace(/^\s*\d+[.)]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text || shouldSkipInstructionStep(text)) {
    return '';
  }

  text = toSentenceCase(text)
    .replace(/\binto chilled glass\b/i, 'into a chilled glass')
    .replace(/\binto chilled coupe\b/i, 'into a chilled coupe')
    .replace(/^Garnish with (?!a\b|an\b|the\b)([a-z])/i, 'Garnish with a $1');

  if (!/[.!?]$/.test(text)) {
    text += '.';
  }

  return text;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function emphasizeIngredients(text, ingredientRows) {
  let result = String(text || '');
  const names = [...new Set((ingredientRows || []).map((row) => row?.name).filter(Boolean))]
    .sort((a, b) => b.length - a.length);

  if (!names.some((name) => normalizeText(name) === 'ice')) {
    names.push('Ice');
    names.push('Crushed ice');
  }

  for (const name of names) {
    const escaped = escapeRegExp(name);
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${escaped})(?=[^\\p{L}\\p{N}]|$)`, 'giu');
    result = result.replace(pattern, (full, prefix, match, offset, source) => {
      const start = offset + String(prefix).length;
      const end = start + String(match).length;
      const before = source.slice(Math.max(0, start - 2), start);
      const after = source.slice(end, end + 2);
      if (before === '**' && after === '**') {
        return full;
      }
      return `${prefix}**${match}**`;
    });
  }

  return result;
}

function buildCocktailInstructions(cocktailName, ingredientRows, sourceInstructions) {
  const measured = ingredientRows
    .filter((row) => !row.garnish)
    .map((row) => `${formatQuantity(row.amount, row.unitId)} of **${row.name}**`);

  const lines = [];
  if (measured.length > 0) {
    lines.push(`1. Add ${measured.join(', ')}.`);
  }

  sourceInstructions.forEach((step) => {
    const cleaned = normalizeInstructionStep(step);
    if (cleaned) {
      lines.push(`${lines.length + 1}. ${emphasizeIngredients(cleaned, ingredientRows)}`);
    }
  });

  if (lines.length === 0) {
    lines.push(`1. Build ${cocktailName} with measured ingredients from the source recipe.`);
  }

  return lines.join('\n');
}

function formatQuantity(amount, unitId) {
  if (unitId === 1) return amount;
  const unitLabelById = {
    2: 'bar spoon', 3: 'cl', 4: 'cube', 5: 'cup', 6: 'dash', 7: 'drop', 8: 'g', 10: 'leaf',
    11: 'ml', 12: 'oz', 13: 'part', 14: 'peel', 19: 'slice', 21: 'sprig', 23: 'tablespoon',
    24: 'teaspoon', 26: 'twist', 27: 'wedge',
  };
  return `${amount} ${unitLabelById[unitId] || ''}`.trim();
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const url = args.find((arg) => !arg.startsWith('--'));

  if (!url) {
    console.error('Usage: node scripts/import-diffords-cocktail.js <diffords-url> [--dry-run]');
    process.exit(1);
  }

  if (!/^https?:\/\/www\.diffordsguide\.com\/cocktails\/recipe\//.test(url)) {
    console.error('The URL must point to a Difford\'s Guide cocktail recipe page.');
    process.exit(1);
  }

  Promise.resolve()
    .then(async () => {
      const { recipe, review, glassText } = await fetchRecipe(url);
      const recipeName = toTitleCase(recipe.name || 'Unnamed Cocktail');
      const recipeIngredients = Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : [];
      const parsedIngredients = recipeIngredients.map(parseIngredientLine).filter(Boolean);
      const sourceInstructions = getTextInstructions(recipe);

      if (parsedIngredients.length === 0) {
        throw new Error('No ingredients found in recipeIngredient.');
      }

      const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
      const ingredientByNormalized = new Map();
      (data.ingredients || []).forEach((ingredient) => {
        buildIngredientNameVariants(ingredient.name).forEach((variant) => {
          ingredientByNormalized.set(variant, ingredient);
        });
      });

      let nextIngredientId = Math.max(...data.ingredients.map((item) => item.id)) + 1;
      const ingredientRows = [];

      for (const parsed of parsedIngredients) {
        const nameVariants = buildIngredientNameVariants(parsed.name);
        const existing = nameVariants
          .map((variant) => ingredientByNormalized.get(variant))
          .find(Boolean);
        let ingredient = existing;
        if (!ingredient) {
          ingredient = {
            id: nextIngredientId++,
            name: parsed.name,
            description: `Auto-imported ingredient from Difford's recipe: ${parsed.name}.`,
            tags: [guessIngredientTagId(parsed.name)],
          };
          data.ingredients.push(ingredient);
          buildIngredientNameVariants(ingredient.name).forEach((variant) => {
            ingredientByNormalized.set(variant, ingredient);
          });
          console.log(`+ Added ingredient: ${ingredient.name} (#${ingredient.id})`);
        }

        ingredientRows.push({
          order: ingredientRows.length + 1,
          ingredientId: ingredient.id,
          name: ingredient.name,
          amount: parsed.amount,
          unitId: parsed.unitId,
          ...(parsed.garnish ? { garnish: true } : {}),
          ...(parsed.process ? { process: true } : {}),
        });
      }

      const existingCocktail = data.cocktails.find(
        (cocktail) => normalizeText(cocktail.name) === normalizeText(recipeName),
      );

      if (existingCocktail) {
        console.log(`Cocktail already exists: ${existingCocktail.name} (#${existingCocktail.id}). Nothing changed.`);
        return;
      }

      const nextCocktailId = Math.max(...data.cocktails.map((item) => item.id)) + 1;
      const cocktail = {
        id: nextCocktailId,
        name: recipeName,
        description:
          (typeof review === 'string' && review.trim()) ||
          (typeof recipe.description === 'string' && recipe.description.trim()) ||
          `Auto-imported from ${url}`,
        instructions: buildCocktailInstructions(recipeName, ingredientRows, sourceInstructions),
        glassId: findGlassId(recipe, glassText),
        methodIds: findMethodIds(sourceInstructions),
        tags: DEFAULT_COCKTAIL_TAGS,
        defaultServings: 1,
        ingredients: ingredientRows,
      };

      data.cocktails.push(cocktail);
      data.cocktails.sort((a, b) => a.id - b.id);
      data.ingredients.sort((a, b) => a.id - b.id);

      if (dryRun) {
        console.log(`Dry run: parsed cocktail "${cocktail.name}" with ${ingredientRows.length} ingredients.`);
        ingredientRows.forEach((row) => {
          console.log(`  - ${formatQuantity(row.amount, row.unitId)} ${row.name}`.trim());
        });
        return;
      }

      fs.writeFileSync(DATA_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

      console.log(`✓ Added cocktail: ${cocktail.name} (#${cocktail.id})`);
      console.log(`  Source: ${url}`);
      console.log(`  Ingredients: ${ingredientRows.length}`);
    })
    .catch((error) => {
      console.error(`Import failed: ${error.message}`);
      process.exit(1);
    });
}

main();
