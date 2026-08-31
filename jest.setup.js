process.env.EXPO_PUBLIC_ENV = 'dev'
process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3000/v1'
process.env.EXPO_PUBLIC_WEB_BASE_URL = 'https://go-dev.gogo.id.vn'

// Native modules the screens reach through their stores and session layer.
// Only the storage backends are faked; the stores themselves stay real, so a
// screen still exercises the code it ships.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

jest.mock('expo-secure-store', () => {
  const store = new Map()
  return {
    getItemAsync: async key => store.get(key) ?? null,
    setItemAsync: async (key, value) => void store.set(key, value),
    deleteItemAsync: async key => void store.delete(key),
    isAvailableAsync: async () => true,
  }
})

jest.mock('expo-crypto', () => ({
  randomUUID: () => '00000000-0000-4000-8000-000000000000',
}))

// The native glass module only exists in a dev-client binary. Reporting it as
// unsupported renders the translucent-solid fallback — the path most devices
// take anyway, and the one the design system requires to work on its own.
jest.mock('@callstack/liquid-glass', () => ({
  isLiquidGlassSupported: false,
  LiquidGlassView: require('react-native').View,
  LiquidGlassContainerView: require('react-native').View,
}))

jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 47, bottom: 34, left: 0, right: 0 }
  const frame = { x: 0, y: 0, width: 390, height: 844 }
  return {
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: require('react-native').View,
    SafeAreaInsetsContext: { Consumer: ({ children }) => children(insets) },
    initialWindowMetrics: { insets, frame },
  }
})
