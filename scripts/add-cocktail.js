#!/usr/bin/env node

const fs = require('fs');
const path = require('node:path');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

const GLASSWARE_MAPPING = [
    { id: "bowl", names: ["bowl"] },
    { id: "flute", names: ["flute", "champagne flute"] },
    { id: "martini", names: ["martini", "cocktail glass"] },
    { id: "collins_glass", names: ["collins", "highball"] },
    { id: "copper_mug", names: ["copper mug", "mule mug"] },
    { id: "coupe", names: ["coupe", "champagne saucer"] },
    { id: "cup", names: ["cup"] },
    { id: "goblet", names: ["goblet"] },
    { id: "highball_glass", names: ["highball"] },
    { id: "hurricane_glass", names: ["hurricane"] },
    { id: "toddy_glass", names: ["toddy", "heat-resistant"] },
    { id: "margarita_glass", names: ["margarita"] },
    { id: "nick_and_nora", names: ["nick & nora", "nick and nora"] },
    { id: "pitcher", names: ["pitcher"] },
    { id: "pub_glass", names: ["pub glass", "pint glass"] },
    { id: "rocks_glass", names: ["rocks glass", "old fashioned", "lowball"] },
    { id: "shooter", names: ["shooter", "shot glass"] },
    { id: "snifter", names: ["snifter", "brandy balloon"] },
    { id: "tiki_glass", names: ["tiki"] },
    { id: "wine_glass", names: ["wine glass"] },
];

const METHOD_MAPPING = {
    "SHAKE": "shake",
    "STIR": "stir",
    "BLEND": "blend",
    "MUDDLE": "muddle",
    "LAYER": "layer",
    "FLOAT": "layer",
    "BUILD": "build",
    "POUR": "build",
    "THROW": "throw",
    "HEAT": "heat"
};

const UNIT_MAPPING = {
    "fl oz": 11,
    "dash": 6,
    "dashes": 6,
    "drop": 7,
    "drops": 7,
    "fresh": 1,
    "leaf": 10,
    "leaves": 10,
    "wedge": 27,
    "wedges": 27,
    "slice": 19,
    "slices": 19,
    "pinch": 15,
    "pinches": 15,
    "g": 8,
    "ml": 11,
    "cl": 3,
    "bar spoon": 2,
    "teaspoon": 24,
    "tablespoon": 23,
    "peel": 14,
    "twist": 26,
    "splash": 20,
    "splashes": 20
};

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  return await response.text();
}

function convertOzToMl(ozStr) {
    const oz = parseFloat(ozStr);
    if (isNaN(oz)) return ozStr;
    if (oz === 0.25) return "7.5";
    if (Math.abs(oz - 0.333) < 0.01) return "10";
    if (oz === 0.5) return "15";
    if (Math.abs(oz - 0.666) < 0.01) return "20";
    if (oz === 0.75) return "22.5";
    if (oz === 1) return "30";
    if (oz === 1.25) return "37.5";
    if (oz === 1.5) return "45";
    if (oz === 2) return "60";
    return (oz * 30).toString();
}

function parseHtml(html) {
  const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || html.match(/<title>([^|]+) Cocktail/i);
  const name = nameMatch ? nameMatch[1].trim() : 'Unknown Cocktail';

  let glasswareName = '';
  const glassMatch = html.match(/Glass:<\/h3>\s*<p>\s*Serve in a\s*(?:<a[^>]*>)?([^<]+)(?:<\/a>)?/i);
  if (glassMatch) {
      glasswareName = glassMatch[1].trim();
  } else {
      const photoGlassMatch = html.match(/Photographed in (?:an?|the)\s+(?:<a[^>]*>)?([^<]+)(?:<\/a>)?/i);
      if (photoGlassMatch) {
          glasswareName = photoGlassMatch[1].trim();
      }
  }
  glasswareName = glasswareName.replace(/ glass$/i, '');

  let glassId = 'coupe';
  const lowerGlassName = glasswareName.toLowerCase();
  for (const mapping of GLASSWARE_MAPPING) {
      if (mapping.names.some(n => lowerGlassName.includes(n))) {
          glassId = mapping.id;
          break;
      }
  }

  const ingredients = [];
  const rows = html.match(/<tr>\s*<td>[\s\S]*?<\/td>\s*<td id="js-container-ingredient-[\s\S]*?<\/tr>/gi);
  if (rows) {
      rows.forEach(row => {
          const cells = row.match(/<td>([\s\S]*?)<\/td>|<td id="js-container-ingredient-[\w]+">([\s\S]*?)<\/td>/gi);
          if (cells && cells.length >= 2) {
              const amountHtml = cells[0].replace(/<\/?td>/gi, '').trim();
              const nameHtml = cells[1].replace(/<td id="js-container-ingredient-[\w]+">/i, '').replace(/<\/td>/i, '').trim();

              let amount = '';
              let unit = '';

              let cleanAmount = amountHtml
                  .replace(/<sup>(\d+)<\/sup>&frasl;<sub>(\d+)<\/sub>/g, (m, n, d) => parseInt(n) / parseInt(d))
                  .replace(/<sup>(\d+)<\/sup>/g, '$1')
                  .replace(/<sub>(\d+)<\/sub>/g, '/$1')
                  .replace(/&frac(\d)(\d);/g, (m, n, d) => parseInt(n) / parseInt(d))
                  .replace(/&frac14;/g, '0.25')
                  .replace(/&frac12;/g, '0.5')
                  .replace(/&frac34;/g, '0.75')
                  .replace(/&frac13;/g, '0.333')
                  .replace(/&frac23;/g, '0.666')
                  .replace(/&frac18;/g, '0.125');

              const multiplierMatch = cleanAmount.match(/^(\d+)\s+([\d.]+)\s+(.*)$/);
              if (multiplierMatch) {
                  amount = (parseFloat(multiplierMatch[1]) * parseFloat(multiplierMatch[2])).toString();
                  unit = multiplierMatch[3].trim();
              } else {
                  const measureMatch = cleanAmount.match(/^([\d.]+)?\s*(.*)$/);
                  if (measureMatch) {
                      amount = measureMatch[1] || '';
                      unit = measureMatch[2].trim();
                  }
              }

              if (unit === 'fl oz') {
                  amount = convertOzToMl(amount);
                  unit = 'ml';
              }

              const name = nameHtml.replace(/<[^>]*>/g, '').trim();
              ingredients.push({ amount, unit, name });
          }
      });
  }

  const rawInstructions = [];
  const howToMakeMatch = html.match(/How to make:<\/h3>([\s\S]*?)<\/ol>/i);
  if (howToMakeMatch) {
    const steps = howToMakeMatch[1].match(/<li>([\s\S]*?)<\/li>/gi);
    if (steps) {
      steps.forEach(step => {
        rawInstructions.push(step.replace(/<[^>]*>/g, '').trim());
      });
    }
  }

  const garnishMatch = html.match(/Garnish:<\/h3>([\s\S]*?)<\/ol>/i);
  if (garnishMatch) {
      const steps = garnishMatch[1].match(/<li>([\s\S]*?)<\/li>/gi);
      if (steps) {
          steps.forEach(step => {
              rawInstructions.push(step.replace(/<[^>]*>/g, '').trim());
          });
      }
  }

  const methodIds = [];
  rawInstructions.forEach(step => {
      const upperStep = step.toUpperCase();
      for (const [key, val] of Object.entries(METHOD_MAPPING)) {
          if (upperStep.includes(key)) {
              if (!methodIds.includes(val)) methodIds.push(val);
          }
      }
  });

  const reviewMatch = html.match(/Review:<\/h2>\s*<p>([\s\S]*?)<\/p>/i) || html.match(/Review:<\/h3>\s*<p>([\s\S]*?)<\/p>/i);
  const description = reviewMatch ? reviewMatch[1].replace(/<[^>]*>/g, '').trim() : '';

  return {
    name,
    glassId,
    ingredients,
    instructions: rawInstructions,
    description,
    methodIds
  };
}

function resolveIngredient(name, existingIngredients) {
    const lowerName = name.toLowerCase();
    if (lowerName === 'ice') return existingIngredients.find(i => i.id === 196);
    let match = existingIngredients.find(i => i.name.toLowerCase() === lowerName);
    if (match) return match;
    const commonMappings = {
        "tequila": 334,
        "mezcal": 238,
        "lime juice": 228,
        "lemon juice": 221,
        "agave syrup": 6,
        "sugar syrup": 316,
        "simple syrup": 316,
        "bitters": 49
    };
    for (const [k, v] of Object.entries(commonMappings)) {
        if (lowerName.includes(k)) return existingIngredients.find(i => i.id === v);
    }
    match = existingIngredients.find(i => i.id !== 196 && ((i.name.length > 3 && lowerName.includes(i.name.toLowerCase())) || (lowerName.length > 3 && i.name.toLowerCase().includes(lowerName))));
    return match || null;
}

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node scripts/add-cocktail.js <url>');
    process.exit(1);
  }

  const dataPath = path.join(process.cwd(), 'assets/data/data.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  try {
    const html = await fetchHtml(url);
    const parsed = parseHtml(html);

    const existingCocktail = data.cocktails.find(c => c.name.toLowerCase() === parsed.name.toLowerCase());
    if (existingCocktail) {
        console.log(`Cocktail already exists: ${existingCocktail.name} (ID: ${existingCocktail.id})`);
        return;
    }

    const newIngredients = [];
    const cocktailIngredients = [];

    if (parsed.methodIds.includes('shake') || parsed.methodIds.includes('stir')) {
        cocktailIngredients.push({
            order: 1,
            ingredientId: 196,
            name: "Ice",
            amount: "150",
            unitId: 8,
            process: true
        });
    }

    parsed.ingredients.forEach((ing, index) => {
        let existing = resolveIngredient(ing.name, data.ingredients);
        let ingredientId;
        if (existing) {
            ingredientId = existing.id;
        } else {
            existing = newIngredients.find(i => i.name.toLowerCase() === ing.name.toLowerCase());
            if (existing) {
                ingredientId = existing.id;
            } else {
                ingredientId = Math.max(...data.ingredients.map(i => i.id), ...newIngredients.map(i => i.id)) + 1;
                const newIng = {
                    id: ingredientId,
                    name: ing.name,
                    description: `A ${ing.name.toLowerCase()} used in cocktails.`,
                    tags: [9]
                };
                if (ing.name.toLowerCase().includes('juice')) newIng.tags = [7];
                else if (ing.name.toLowerCase().includes('syrup')) newIng.tags = [5];
                else if (ing.name.toLowerCase().includes('bitters')) newIng.tags = [4];
                newIngredients.push(newIng);
            }
        }
        const unitId = UNIT_MAPPING[ing.unit] || 1;
        cocktailIngredients.push({
            order: cocktailIngredients.length + 1,
            ingredientId,
            name: ing.name,
            amount: ing.amount,
            unitId
        });
    });

    const needsServingIce = parsed.instructions.some(s => s.toLowerCase().includes('fresh ice') || s.toLowerCase().includes('over ice'));
    if (needsServingIce) {
        cocktailIngredients.push({
            order: cocktailIngredients.length + 1,
            ingredientId: 196,
            name: "Ice",
            amount: "120",
            unitId: 8,
            serving: true
        });
    }

    let finalInstructions = "";
    let currentStep = 1;
    if (parsed.methodIds.includes('shake') || parsed.methodIds.includes('stir')) {
        const glass = parsed.methodIds.includes('shake') ? "shaker" : "mixing glass";
        finalInstructions += `${currentStep++}. Fill a ${glass} with **ice**.\n`;
    }
    const ingList = parsed.ingredients.map(ing => {
        const amountDisp = ing.amount ? `${ing.amount} ${ing.unit} of ` : "";
        return `${amountDisp}**${ing.name.toLowerCase()}**`;
    }).join(", ");
    finalInstructions += `${currentStep++}. Add ${ingList}.\n`;
    parsed.instructions.forEach(step => {
        let s = step;
        parsed.ingredients.forEach(ing => {
            const regex = new RegExp(`\\b${ing.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            s = s.replace(regex, `**${ing.name.toLowerCase()}**`);
        });
        s = s.replace(/\bice\b/gi, '**ice**');
        if (s.toUpperCase().includes("SHAKE ALL INGREDIENTS") || s.toUpperCase().includes("STIR ALL INGREDIENTS")) return;
        finalInstructions += `${currentStep++}. ${s}\n`;
    });

    const cocktailId = Math.max(...data.cocktails.map(c => c.id)) + 1;
    const newCocktail = {
        id: cocktailId,
        name: parsed.name,
        description: parsed.description || `A delicious cocktail featuring ${parsed.ingredients.slice(0, 3).map(i => `**${i.name.toLowerCase()}**`).join(', ')}.`,
        instructions: finalInstructions.trim(),
        glassId: parsed.glassId,
        methodIds: parsed.methodIds,
        tags: [6],
        defaultServings: 1,
        ingredients: cocktailIngredients
    };

    data.cocktails.push(newCocktail);
    if (newIngredients.length > 0) {
        data.ingredients.push(...newIngredients);
    }

    const localesDir = path.join(process.cwd(), 'libs/i18n/locales/catalog');
    const locales = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));
    for (const locale of locales) {
        const localePath = path.join(localesDir, locale);
        const content = fs.readFileSync(localePath, 'utf8');
        const localeData = JSON.parse(content);

        if (Object.keys(localeData).length === 0) continue;
        if (locale !== 'en-US.json' && locale !== 'uk-UA.json') continue;

        const originalKeys = Object.keys(localeData);
        const isOriginallySorted = JSON.stringify(originalKeys) === JSON.stringify([...originalKeys].sort());

        localeData[`cocktail.${newCocktail.id}.name`] = newCocktail.name;
        localeData[`cocktail.${newCocktail.id}.description`] = newCocktail.description;
        localeData[`cocktail.${newCocktail.id}.instructions`] = newCocktail.instructions;
        for (const ing of newIngredients) {
            localeData[`ingredient.${ing.id}.name`] = ing.name;
            localeData[`ingredient.${ing.id}.description`] = ing.description;
        }

        let finalData = localeData;
        if (isOriginallySorted) {
            const sortedKeys = Object.keys(localeData).sort();
            finalData = {};
            sortedKeys.forEach(k => finalData[k] = localeData[k]);
        }

        fs.writeFileSync(localePath, JSON.stringify(finalData, null, 2), 'utf8');
    }

    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Added cocktail: ${newCocktail.name} (ID: ${newCocktail.id})`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
