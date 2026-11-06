const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

// Native rendering is confined to two shared primitives.
function nativeImports(allowed = []) {
  return ['error', { paths: [
    {
      name: 'react-native',
      importNames: ['Text', 'TextInput', 'Button', 'StyleSheet'].filter(name => !allowed.includes(name)),
      message: "Use shared fixed-font text/input/button primitives and Unistyles StyleSheet.",
    },
  ] }]
}

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['node_modules/*', 'ios/*', 'android/*', '.expo/*', 'dist/*', 'vendor/*'],
  },
  {
    // Jest config and setup run in Node with jest globals, not in the app.
    files: ['jest.setup.js', 'jest.config.js'],
    languageOptions: {
      globals: { beforeEach: 'readonly', afterEach: 'readonly', jest: 'readonly', require: 'readonly', module: 'writable', process: 'readonly' },
    },
  },
  {
    // A jest.mock factory is hoisted above the imports, so a component spec has
    // to declare its mocks before importing the screen under test.
    files: ['**/*.spec.tsx'],
    rules: { 'import/first': 'off' },
  },
  {
    // #298 + fixed-font policy: every src surface uses the shared primitives.
    files: ['src/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': nativeImports() },
  },
  {
    files: ['src/shared/ui/tokens.ts', 'src/shared/ui/theme.ts'],
    rules: { 'no-restricted-imports': nativeImports(['StyleSheet']) },
  },
  {
    files: ['src/shared/ui/text.tsx'],
    rules: { 'no-restricted-imports': nativeImports(['Text']) },
  },
  {
    files: ['src/shared/ui/text-input.tsx'],
    rules: { 'no-restricted-imports': nativeImports(['TextInput']) },
  },
  {
    // Tests intentionally query native hosts and build native component mocks.
    files: ['src/**/__tests__/**', 'src/**/*.spec.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // #382 (extends #298): pressed is a colour change and nothing else —
    // `accent.pressed` on a filled control, `surface.subtle` on a neutral one.
    // A scale moves the layout under the finger; an opacity fades the label
    // below the contrast it was measured at. Both the inline form
    // (`pressed && { … }`) and a named `*Pressed` style are caught.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['**/__tests__/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "LogicalExpression:has(Identifier[name='pressed']) > ObjectExpression > Property[key.name=/^(transform|opacity)$/]",
          message: 'Pressed changes colour only (theme.accent.pressed / theme.surface.subtle), never scale or opacity (#382).',
        },
        {
          selector:
            "ConditionalExpression[test.name='pressed'] > ObjectExpression > Property[key.name=/^(transform|opacity)$/]",
          message: 'Pressed changes colour only (theme.accent.pressed / theme.surface.subtle), never scale or opacity (#382).',
        },
        {
          // Owner 2026-11-06 D1: this shared Stitch variant alone adds press scale.
          selector: "Property[key.name=/[Pp]ressed$/][key.name!='stitchPressed'] > ObjectExpression > Property[key.name=/^(transform|opacity)$/]",
          message: 'A pressed style changes colour only, never scale or opacity (#382).',
        },
      ],
    },
  },
])
