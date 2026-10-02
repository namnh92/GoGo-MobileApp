const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['node_modules/*', 'ios/*', 'android/*', '.expo/*', 'dist/*'],
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
    files: ['src/features/**/*.{ts,tsx}', 'src/shared/ui/**/*.{ts,tsx}'],
    ignores: ['src/shared/ui/text.tsx', 'src/shared/ui/tokens.ts', '**/__tests__/**'],
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
])
