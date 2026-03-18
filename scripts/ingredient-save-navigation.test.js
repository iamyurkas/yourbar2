const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

function loadTsModule(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  const module = { exports: {} };
  const context = vm.createContext({
    module,
    exports: module.exports,
    require,
    __dirname: path.dirname(filePath),
    __filename: filePath,
  });

  new vm.Script(transpiled, { filename: filePath }).runInContext(context);
  return module.exports;
}

const { getIngredientSaveNavigationPlan } = loadTsModule(
  path.resolve(__dirname, '../libs/ingredient-save-navigation.ts'),
);

test('returns to cocktail create screen after saving when return path exists and stack can go back', () => {
  const plan = getIngredientSaveNavigationPlan({
    returnToPath: '/cocktails/create',
    canGoBack: true,
    fallbackIngredientId: '123',
  });

  assert.equal(plan.kind, 'back_then_navigate_return');
});

test('replaces to cocktail create when return path exists but stack cannot go back', () => {
  const plan = getIngredientSaveNavigationPlan({
    returnToPath: '/cocktails/create',
    canGoBack: false,
    fallbackIngredientId: '123',
  });

  assert.equal(plan.kind, 'replace_return');
});

test('falls back to ingredient details when no return path and cannot go back', () => {
  const plan = getIngredientSaveNavigationPlan({
    canGoBack: false,
    fallbackIngredientId: '777',
  });

  assert.equal(plan.kind, 'replace_ingredient_details');
  assert.equal(plan.ingredientId, '777');
});

test('falls back to ingredients list when no return path, cannot go back and no created id', () => {
  const plan = getIngredientSaveNavigationPlan({
    canGoBack: false,
  });

  assert.equal(plan.kind, 'replace_ingredients_list');
});

test('uses simple back navigation when no return path and stack can go back', () => {
  const plan = getIngredientSaveNavigationPlan({
    canGoBack: true,
    fallbackIngredientId: '42',
  });

  assert.equal(plan.kind, 'back');
});
