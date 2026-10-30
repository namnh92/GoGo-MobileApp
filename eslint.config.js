const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['node_modules/*', 'ios/*', 'android/*', '.expo/*', 'dist/*', 'vendor/*'],
  },
  {
    // Jest config and setup run in Node with jest globals, not in the app.
    files: ['jest.setup.js', 'jest.config.js'],
    languageOptions: {
      globals: { jest: 'readonly', require: 'readonly', module: 'writable', process: 'readonly' },
    },
  },
  {
    // A jest.mock factory is hoisted above the imports, so a component spec has
    // to declare its mocks before importing the screen under test.
    files: ['**/*.spec.tsx'],
    rules: { 'import/first': 'off' },
  },
  {
    // #298 (#293 §4): screens draw text through the `Text` primitive (variant +
    // semantic colour) and style through Unistyles, so an accent change reaches
    // every surface. The primitive itself wraps React Native's `Text`; tests
    // query the host component and are not screens.
    files: ['src/features/**/*.{ts,tsx}', 'src/shared/**/*.{ts,tsx}'],
    ignores: ['src/shared/ui/text.tsx', 'src/shared/ui/tokens.ts', 'src/shared/ui/theme.ts', '**/__tests__/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['Text'],
              message: "Use `Text` from '@/shared/ui/text' (variant + semantic colour).",
            },
            {
              name: 'react-native',
              importNames: ['StyleSheet'],
              message: "Use `StyleSheet` from 'react-native-unistyles' so styles follow the theme.",
            },
          ],
        },
      ],
    },
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
          selector: 'Property[key.name=/[Pp]ressed$/] > ObjectExpression > Property[key.name=/^(transform|opacity)$/]',
          message: 'A pressed style changes colour only, never scale or opacity (#382).',
        },
      ],
    },
  },
])
