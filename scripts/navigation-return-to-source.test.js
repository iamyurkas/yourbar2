const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

function loadNavigationModule(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  const routerCalls = [];
  const stackPopCalls = [];
  const module = { exports: {} };

  const customRequire = (specifier) => {
    if (specifier === '@react-navigation/native') {
      return {
        StackActions: {
          pop: (count) => {
            stackPopCalls.push(count);
            return { type: 'POP', payload: { count } };
          },
        },
      };
    }

    if (specifier === 'expo-router') {
      return {
        router: {
          navigate: (input) => {
            routerCalls.push(input);
          },
        },
      };
    }

    return require(specifier);
  };

  const context = vm.createContext({
    module,
    exports: module.exports,
    require: customRequire,
    __dirname: path.dirname(filePath),
    __filename: filePath,
  });

  new vm.Script(transpiled, { filename: filePath }).runInContext(context);

  return {
    exports: module.exports,
    routerCalls,
    stackPopCalls,
  };
}

test('goes back instead of navigate when history is available', () => {
  const loaded = loadNavigationModule(
    path.resolve(__dirname, '../libs/navigation.ts'),
  );

  let goBackCalls = 0;
  loaded.exports.returnToSourceOrBack(
    {
      canGoBack: () => true,
      goBack: () => {
        goBackCalls += 1;
      },
      dispatch: () => {
        throw new Error('dispatch should not be called');
      },
      getState: () => ({
        index: 1,
        routes: [{ name: 'cocktail' }, { name: 'ingredient' }],
      }),
    },
    {
      returnToPath: '/cocktails/[cocktailId]',
      returnToParams: { cocktailId: '1' },
    },
  );

  assert.equal(goBackCalls, 1);
  assert.equal(loaded.routerCalls.length, 0);
});

test('navigates to return path when no history exists', () => {
  const loaded = loadNavigationModule(
    path.resolve(__dirname, '../libs/navigation.ts'),
  );

  let goBackCalls = 0;
  loaded.exports.returnToSourceOrBack(
    {
      canGoBack: () => false,
      goBack: () => {
        goBackCalls += 1;
      },
      dispatch: () => {
        throw new Error('dispatch should not be called');
      },
      getState: () => ({
        index: 0,
        routes: [{ name: 'ingredient' }],
      }),
    },
    {
      returnToPath: '/cocktails/[cocktailId]',
      returnToParams: { cocktailId: '1' },
    },
  );

  assert.equal(goBackCalls, 0);
  assert.equal(loaded.routerCalls.length, 1);
});
