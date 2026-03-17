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

const GARNISH_TRAILING_UNIT_ID_BY_TOKEN = {
  leaf: 10,
  leaves: 10,
  slice: 19,
  slices: 19,
  wedge: 27,
  wedges: 27,
  peel: 14,
  peels: 14,
  twist: 26,
  twists: 26,
  sprig: 21,
  sprigs: 21,
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

  if (unitId === 1 && /\bleaves?\b/i.test(name)) {
    unitId = 10;
  }
  if (unitId === 1 && /\bslices?\b|\bwheels?\b/i.test(name)) {
    unitId = 19;
  }

  if (!name) return null;

  const lowered = normalizeText(working);
  const garnish = /\bgarnish\b|\bto garnish\b|\bfor garnish\b/.test(lowered);
  const process = /\bice\b|\bto rinse\b|\brinse\b|\bto rim\b|\brim\b|\btop up\b|\btop with\b/.test(lowered);

  return { amount, unitId, name, garnish, process };
}

function parseGarnishPart(part) {
  let text = String(part || '')
    .replace(/^\s*(with|and)\s+/i, '')
    .replace(/^\s*(a|an|the)\s+/i, '')
    .replace(/^\s*fresh\s+/i, '')
    .replace(/[.;:!?]+$/g, '')
    .trim();

  if (!text) return null;

  let amount = '1';
  let unitId = 1;

  const amountMatch = text.match(/^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s+(.+)$/);
  if (amountMatch) {
    const parsedAmount = parseFraction(amountMatch[1]);
    if (parsedAmount != null) {
      amount = Number.isInteger(parsedAmount)
        ? String(parsedAmount)
        : String(Number(parsedAmount.toFixed(2)));
      text = amountMatch[2].trim();
    }
  }

  const tokens = text.split(/\s+/);
  const lastToken = tokens[tokens.length - 1]?.toLowerCase();
  const trailingUnitId = GARNISH_TRAILING_UNIT_ID_BY_TOKEN[lastToken];
  if (trailingUnitId) {
    unitId = trailingUnitId;
    text = tokens.slice(0, -1).join(' ').trim();
  }

  if (unitId === 1 && /\bslices?\s+wheels?\b/i.test(text)) {
    unitId = 19;
    text = text.replace(/\bslices?\s+wheels?\b/gi, '').replace(/\s+/g, ' ').trim();
  }
  if (unitId === 1 && /\bwheels?\b/i.test(text)) {
    unitId = 19;
    text = text.replace(/\bwheels?\b/gi, '').replace(/\s+/g, ' ').trim();
  }

  const name = toTitleCase(text);
  if (!name) return null;

  return {
    amount,
    unitId,
    name,
    garnish: true,
  };
}

function extractGarnishCandidatesFromInstructions(sourceInstructions) {
  const candidates = [];

  for (const line of sourceInstructions || []) {
    const normalizedLine = String(line || '').replace(/\s+/g, ' ').trim();
    if (!normalizedLine) continue;

    const garnishMatch = normalizedLine.match(/\bgarnish\s+with\s+(.+)/i);
    if (!garnishMatch) continue;

    const tail = garnishMatch[1].replace(/[.;:!?]+$/g, '');
    const parts = tail
      .split(/,|\band\b/gi)
      .map((part) => part.trim())
      .filter(Boolean);

    parts.forEach((part) => {
      const parsed = parseGarnishPart(part);
      if (parsed) {
        candidates.push(parsed);
      }
    });
  }

  return candidates;
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
    [/^lime\s+slices?\s+wheels?$/i, 'lime'],
    [/^lime\s+wheels?$/i, 'lime'],
    [/^sugar syrup$/i, 'simple syrup'],
    [/^orgeat syrup$/i, 'almond orgeat syrup'],
    [/^kummel liqueur$/i, 'kümmel liqueur'],
    [/^maraschino liqueur$/i, 'luxardo maraschino'],
    [/^white overproof rum$/i, 'overproof rum'],
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
  const withoutNonContentBlocks = String(value || '')
    .replace(/<style\b[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, ' ');

  return withoutNonContentBlocks
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
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
    .replace(/<style\b[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, ' ');

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
    .replace(/<style\b[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, ' ');

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
  const rawJoined = String((textLines || []).join(' '));
  const joined = normalizeText(rawJoined);

  const stirUpperIndex = rawJoined.search(/\bSTIR\b/);
  const stirAnyIndex = joined.indexOf('stir');

  const methodIds = METHOD_HINTS
    .map(([hint, id]) => {
      if (id === 'stir') {
        if (stirUpperIndex >= 0) {
          return { id, index: stirUpperIndex };
        }
        return null;
      }

      const index = joined.indexOf(normalizeText(hint));
      return index >= 0 ? { id, index } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.id);

  const uniqueMethodIds = [...new Set(methodIds)];
  if (uniqueMethodIds.length > 0) {
    return uniqueMethodIds;
  }

  if (stirAnyIndex >= 0) {
    return ['stir'];
  }

  return [DEFAULT_METHOD_ID];
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
      const afterWord = source.slice(end, end + 7).toLowerCase();
      const isInsideBoldSpan = ((source.slice(0, start).match(/\*\*/g) || []).length % 2) === 1;
      if (isInsideBoldSpan) {
        return full;
      }
      if (normalizeText(match) === 'ice' && afterWord.startsWith('-filled')) {
        return full;
      }
      if (before === '**' && after === '**') {
        return full;
      }
      return `${prefix}**${match}**`;
    });
  }

  return result;
}

function ingredientDisplayName(name) {
  return String(name || '').toLowerCase();
}

function formatIngredientWithAmount(row, options = {}) {
  if (!row) return '';
  const { lowercaseName = true } = options;
  const qty = formatQuantity(row.amount, row.unitId);
  const displayName = lowercaseName ? ingredientDisplayName(row.name) : String(row.name || '');
  return `${qty} of **${displayName}**`;
}

function findIngredientsMentionedInText(text, ingredientRows) {
  const normalizedText = normalizeText(text);
  const mentioned = new Set();
  (ingredientRows || []).forEach((row) => {
    const variants = buildIngredientNameVariants(row.name);
    if (variants.some((variant) => normalizedText.includes(variant))) {
      mentioned.add(row.ingredientId);
    }
  });
  return mentioned;
}

function expandAddNextIngredientsStep(text, ingredientRows, alreadyMentionedIds) {
  if (!/\badd\s+next\s+\w+\s+ingredients\b/i.test(text)) {
    return text;
  }

  const candidates = (ingredientRows || []).filter(
    (row) => !row.garnish && !row.process && !alreadyMentionedIds.has(row.ingredientId),
  );
  if (candidates.length === 0) {
    return text.replace(/\badd\s+next\s+\w+\s+ingredients\b/i, 'Add ingredients');
  }

  const list = candidates.map((row) => formatIngredientWithAmount(row)).join(', ');
  return text.replace(/\badd\s+next\s+\w+\s+ingredients\b/i, `Add ${list}`);
}

function expandPourIngredientsStep(text, ingredientRows, alreadyMentionedIds) {
  if (!/\bpour\b/i.test(text)) {
    return text;
  }

  const hasExplicitAmounts = /\b\d+(?:\.\d+)?\s*(ml|cl|oz|dash|dashes|part|parts|teaspoon|tablespoon|cup|cups)\b/i.test(text);
  if (hasExplicitAmounts) {
    return text;
  }

  const candidates = (ingredientRows || []).filter(
    (row) => !row.garnish && !alreadyMentionedIds.has(row.ingredientId),
  );
  if (candidates.length === 0) {
    return text;
  }

  const list = candidates
    .map((row) => formatIngredientWithAmount(row, { lowercaseName: !!row.process }))
    .join(' and ');
  return text.replace(/\bpour\b/i, `Pour ${list}`);
}

function injectMuddleAmounts(text, ingredientRows) {
  if (!/\bmuddle\b/i.test(text)) {
    return text;
  }

  let updated = text;
  (ingredientRows || [])
    .filter((row) => !row.garnish)
    .forEach((row) => {
      const variants = buildIngredientNameVariants(row.name);
      if (!variants.some((variant) => normalizeText(updated).includes(variant))) {
        return;
      }
      const ingredientWord = ingredientDisplayName(row.name);
      if (/\b\d/.test(updated) && new RegExp(`\\b${escapeRegExp(ingredientWord)}\\b`, 'i').test(updated)) {
        return;
      }

      const qty = formatQuantity(row.amount, row.unitId);
      const muddlePhrase = row.unitId === 10
        ? `${row.amount} ${ingredientWord} ${Number(row.amount) === 1 ? 'leaf' : 'leaves'}`
        : `${qty} of ${ingredientWord}`;
      updated = updated.replace(
        new RegExp(`\\b${escapeRegExp(ingredientWord)}\\b`, 'i'),
        muddlePhrase,
      );
    });

  updated = updated.replace(/^Lightly muddle/i, 'In a shaker lightly muddle');

  return updated;
}

function injectTopProcessIngredient(text, ingredientRows) {
  if (!/\btop\s+with\b/i.test(text)) {
    return text;
  }

  const topIngredient = (ingredientRows || []).find((row) => row.process && /soda|lemonade/i.test(row.name));
  if (!topIngredient) {
    return text;
  }

  let updated = text;
  updated = updated.replace(/\btop\s+with\s+lemonade\b/i, `Top with ${ingredientDisplayName(topIngredient.name)}`);
  if (/\btop\s+with\b/i.test(updated) && !new RegExp(escapeRegExp(ingredientDisplayName(topIngredient.name)), 'i').test(updated)) {
    updated = updated.replace(/\btop\s+with\b/i, `Top with ${ingredientDisplayName(topIngredient.name)},`);
  }
  return updated;
}

function buildCocktailInstructions(cocktailName, ingredientRows, sourceInstructions) {
  const lines = [];
  const alreadyMentionedIds = new Set();

  sourceInstructions.forEach((step) => {
    let cleaned = normalizeInstructionStep(step);
    if (cleaned) {
      const mentionedBefore = findIngredientsMentionedInText(cleaned, ingredientRows);
      mentionedBefore.forEach((id) => alreadyMentionedIds.add(id));

      cleaned = injectMuddleAmounts(cleaned, ingredientRows);
      cleaned = expandAddNextIngredientsStep(cleaned, ingredientRows, alreadyMentionedIds);
      cleaned = expandPourIngredientsStep(cleaned, ingredientRows, alreadyMentionedIds);
      cleaned = injectTopProcessIngredient(cleaned, ingredientRows);

      const mentionedAfter = findIngredientsMentionedInText(cleaned, ingredientRows);
      mentionedAfter.forEach((id) => alreadyMentionedIds.add(id));

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

      const garnishCandidates = extractGarnishCandidatesFromInstructions(sourceInstructions);
      for (const garnishCandidate of garnishCandidates) {
        const nameVariants = buildIngredientNameVariants(garnishCandidate.name);
        const existing = nameVariants
          .map((variant) => ingredientByNormalized.get(variant))
          .find(Boolean);

        let ingredient = existing;
        if (!ingredient) {
          ingredient = {
            id: nextIngredientId++,
            name: garnishCandidate.name,
            description: `Auto-imported ingredient from Difford's recipe: ${garnishCandidate.name}.`,
            tags: [guessIngredientTagId(garnishCandidate.name)],
          };
          data.ingredients.push(ingredient);
          buildIngredientNameVariants(ingredient.name).forEach((variant) => {
            ingredientByNormalized.set(variant, ingredient);
          });
          console.log(`+ Added garnish ingredient: ${ingredient.name} (#${ingredient.id})`);
        }

        const alreadyExists = ingredientRows.some(
          (row) => row.garnish && row.ingredientId === ingredient.id,
        );
        if (alreadyExists) {
          continue;
        }

        ingredientRows.push({
          order: ingredientRows.length + 1,
          ingredientId: ingredient.id,
          name: ingredient.name,
          amount: garnishCandidate.amount,
          unitId: garnishCandidate.unitId,
          garnish: true,
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
