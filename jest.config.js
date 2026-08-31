/**
 * Component tests need a real React Native renderer, which vitest cannot give
 * without transforming React Native's Flow source. vitest keeps the pure
 * TypeScript suites (API client, view models, money, schedule); jest-expo — the
 * preset Expo maintains for exactly this — renders screens.
 */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/src/**/*.spec.tsx'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // pnpm stores every package under `.pnpm/<name>@<version>_<hash>/node_modules/`,
  // so the usual `node_modules/(?!react-native|...)` pattern never matches. Match
  // inside the .pnpm directory name instead, and transform the RN/Expo packages
  // that still ship untranspiled ESM.
  transformIgnorePatterns: [
    '/node_modules/\.pnpm/(?!.*(react-native|expo|@callstack|@react-navigation|@testing-library|test-renderer))',
  ],
}
