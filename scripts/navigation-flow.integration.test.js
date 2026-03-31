const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

function loadNavigationModule() {
  const filePath = path.resolve(__dirname, '../libs/navigation.ts');
  const source = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  const routerCalls = {
    push: [],
    navigate: [],
  };
  const mockedStackActions = {
    pop: (count) => ({ type: 'POP', payload: { count } }),
  };
  const mockedRouter = {
    push: (value) => {
      routerCalls.push.push(value);
    },
    navigate: (value) => {
      routerCalls.navigate.push(value);
    },
  };

  const customRequire = (specifier) => {
    if (specifier === '@react-navigation/native') {
      return { StackActions: mockedStackActions };
    }
    if (specifier === 'expo-router') {
      return { router: mockedRouter };
    }
    return require(specifier);
  };

  const module = { exports: {} };
  const context = vm.createContext({
    module,
    exports: module.exports,
    require: customRequire,
    __dirname: path.dirname(filePath),
    __filename: filePath,
    console,
  });

  new vm.Script(transpiled, { filename: filePath }).runInContext(context);

  return {
    exports: module.exports,
    routerCalls,
  };
}

function toPlainValue(value) {
  return JSON.parse(JSON.stringify(value));
}

test('navigateToDetailsWithReturnTo pushes route params with serialized returnTo payload', () => {
  const { exports, routerCalls } = loadNavigationModule();

  exports.navigateToDetailsWithReturnTo({
    pathname: '/ingredients/[ingredientId]',
    params: { ingredientId: '22' },
    returnToPath: '/cocktails/create',
    returnToParams: {
      cocktailId: '33',
      mode: 'edit',
      ignored: undefined,
    },
  });

  assert.equal(routerCalls.push.length, 1);
  assert.deepEqual(toPlainValue(routerCalls.push[0]), {
    pathname: '/ingredients/[ingredientId]',
    params: {
      ingredientId: '22',
      returnToPath: '/cocktails/create',
      returnToParams: JSON.stringify({
        cocktailId: '33',
        mode: 'edit',
      }),
    },
  });
});

test('returnToSourceOrBack navigates to explicit source when returnToPath exists and cannot go back', () => {
  const { exports, routerCalls } = loadNavigationModule();
  const navigation = {
    canGoBack: () => false,
    goBack: () => {
      throw new Error('goBack should not be called when returnToPath is provided');
    },
    dispatch: () => {
      throw new Error('dispatch should not be called when returnToPath is provided');
    },
    getState: () => ({ index: 0, routes: [{ name: 'ingredients' }] }),
  };

  exports.returnToSourceOrBack(navigation, {
    returnToPath: '/cocktails/create',
    returnToParams: { cocktailId: '44' },
  });

  assert.equal(routerCalls.navigate.length, 1);
  assert.deepEqual(toPlainValue(routerCalls.navigate[0]), {
    pathname: '/cocktails/create',
    params: { cocktailId: '44' },
  });
});

test('returnToSourceOrBack pops duplicate previous route when no returnToPath is provided', () => {
  const { exports } = loadNavigationModule();
  const calls = {
    goBack: 0,
    dispatch: [],
  };
  const navigation = {
    goBack: () => {
      calls.goBack += 1;
    },
    dispatch: (action) => {
      calls.dispatch.push(action);
    },
    getState: () => ({
      index: 2,
      routes: [
        { name: 'ingredients' },
        { name: 'ingredients/[ingredientId]', params: { ingredientId: '10' } },
        { name: 'ingredients/[ingredientId]', params: { ingredientId: '10' } },
      ],
    }),
  };

  exports.returnToSourceOrBack(navigation, {});

  assert.equal(calls.goBack, 0);
  assert.deepEqual(calls.dispatch, [{ type: 'POP', payload: { count: 2 } }]);
});

test('parseReturnToParams gracefully rejects invalid payloads and keeps string params only', () => {
  const { exports } = loadNavigationModule();
  const originalWarn = console.warn;
  console.warn = () => {};

  try {
    assert.equal(exports.parseReturnToParams(undefined), undefined);
    assert.equal(exports.parseReturnToParams('{invalid'), undefined);
    assert.equal(exports.parseReturnToParams(JSON.stringify([])), undefined);

    const parsed = exports.parseReturnToParams(
      JSON.stringify({
        cocktailId: '12',
        mode: 'edit',
        servings: 2,
        nested: { value: 'nope' },
      }),
    );

    assert.deepEqual(toPlainValue(parsed), {
      cocktailId: '12',
      mode: 'edit',
    });
  } finally {
    console.warn = originalWarn;
  }
});
