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
])
