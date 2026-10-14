/**
 * Component tests need a real React Native renderer, which vitest cannot give
 * without transforming React Native's Flow source. vitest keeps the pure
 * TypeScript suites (API client, view models, money, schedule); jest-expo — the
 * preset Expo maintains for exactly this — renders screens.
 */
module.exports = {
  preset: 'jest-expo',
  // `.spec.ts` too: pure-logic jest suites (GoGo-MobileApp#336). vitest owns
  // `*.test.ts`, so the two runners never pick the same file.
  testMatch: ['<rootDir>/src/**/*.spec.tsx', '<rootDir>/src/**/*.spec.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // No native runtime under jest, and no spec may ever send an event.
    '^@sentry/react-native$': '<rootDir>/__mocks__/@sentry/react-native.ts',
  },
  // Unistyles has no native runtime under jest. Its mocks stub the Nitro
  // module and resolve every `StyleSheet.create(theme => …)` against the first
  // registered theme, so the config must load right after them — and before
  // any screen module, which is why both sit in `setupFiles` rather than
  // `setupFilesAfterEnv`. jest concatenates these with the preset's own.
  setupFiles: ['react-native-unistyles/mocks', '<rootDir>/src/shared/ui/unistyles.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // pnpm stores every package under `.pnpm/<name>@<version>_<hash>/node_modules/`,
  // so the usual `node_modules/(?!react-native|...)` pattern never matches. Match
  // inside the .pnpm directory name instead, and transform the RN/Expo packages
  // that still ship untranspiled ESM.
  transformIgnorePatterns: [
    '/node_modules/\.pnpm/(?!.*(react-native|expo|@callstack|@react-navigation|@testing-library|test-renderer))',
  ],
}
