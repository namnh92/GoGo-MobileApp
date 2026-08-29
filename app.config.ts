import type { ExpoConfig } from 'expo/config'

/**
 * Which app a build *is*, decided before any React code runs.
 *
 * Three installable flavours, one identifier scheme: `max.gogo.{flavor}`. They
 * differ in identifier, display name and URL scheme so a phone can hold all
 * three at once — a tester running staging next to the store build is the
 * normal case, two apps cannot share an identifier at all, and two apps
 * sharing a scheme make `gogo://` open whichever the OS picked last.
 *
 * Everything here is inline on purpose: Expo evaluates this file in Node
 * before the TypeScript path aliases or the app's runtime modules exist, so it
 * cannot import them. The mapping is covered by
 * `src/shared/config/__tests__/app-config.test.ts`, which loads this very file.
 */
export const FLAVORS = ['dev', 'stag', 'prod'] as const

export type Flavor = (typeof FLAVORS)[number]

/** Home-screen labels stay readable — an icon is not an identifier. */
const NAMES: Record<Flavor, string> = {
  dev: 'GoGo Dev',
  stag: 'GoGo Staging',
  prod: 'GoGo',
}

/** Only production keeps the bare `gogo://` contract. */
const SCHEMES: Record<Flavor, string> = {
  dev: 'gogo-dev',
  stag: 'gogo-stag',
  prod: 'gogo',
}

/**
 * Resolved from `EXPO_PUBLIC_ENV` — the same variable the running app
 * validates in `src/shared/config/env.ts`, so a build cannot be a dev app
 * pointed at production.
 *
 * An unknown value throws rather than defaulting: defaulting would let a typo
 * in a CI variable produce a store build named "GoGo Dev", discovered after
 * upload rather than before.
 */
function resolveFlavor(value: string | undefined): Flavor {
  const flavor = value ?? 'dev'
  if (!(FLAVORS as readonly string[]).includes(flavor)) {
    throw new Error(`EXPO_PUBLIC_ENV must be one of ${FLAVORS.join(', ')} — received "${flavor}"`)
  }
  return flavor as Flavor
}

const flavor = resolveFlavor(process.env.EXPO_PUBLIC_ENV)
const identity = {
  flavor,
  /** iOS `bundleIdentifier` and Android `package` — always the same string. */
  bundleId: `max.gogo.${flavor}`,
  appName: NAMES[flavor],
  scheme: SCHEMES[flavor],
  /**
   * Whether the build claims `https://gogo.app/...`.
   *
   * Only production does. Universal links verify against the app IDs listed in
   * the domain's `apple-app-site-association` / `assetlinks.json`; a dev build
   * claiming a domain that never names it ships a claim that cannot verify —
   * Android then offers an unverified handler in the chooser and iOS ignores
   * it, which is worse than not claiming at all.
   */
  claimsWebLinks: flavor === 'prod',
}

const WEB_LINK_PREFIXES = ['/r', '/plans', '/places', '/room']

const config: ExpoConfig = {
  name: identity.appName,
  slug: 'gogo',
  version: '0.1.0',
  scheme: identity.scheme,
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  backgroundColor: '#F6F3EE',
  icon: './assets/icon.png',
  ios: {
    bundleIdentifier: identity.bundleId,
    supportsTablet: false,
    // Only the flavour the domain actually names can verify (see app-identity).
    ...(identity.claimsWebLinks ? { associatedDomains: ['applinks:gogo.app'] } : {}),
  },
  android: {
    package: identity.bundleId,
    ...(identity.claimsWebLinks
      ? {
          intentFilters: [
            {
              action: 'VIEW',
              autoVerify: true,
              data: WEB_LINK_PREFIXES.map((pathPrefix) => ({
                scheme: 'https',
                host: 'gogo.app',
                pathPrefix,
              })),
              category: ['BROWSABLE', 'DEFAULT'],
            },
          ],
        }
      : {}),
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#D84F4A',
    },
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 180,
        resizeMode: 'contain',
        backgroundColor: '#F6F3EE',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'GoGo cần truy cập thư viện ảnh để bạn thêm ảnh check-in tại địa điểm.',
      },
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'GoGo dùng vị trí của bạn để gợi ý địa điểm gần đó. Bạn có thể chọn khu vực thủ công thay vì cấp quyền.',
        locationWhenInUsePermission:
          'GoGo dùng vị trí của bạn để gợi ý địa điểm gần đó. Bạn có thể chọn khu vực thủ công thay vì cấp quyền.',
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    'expo-secure-store',
  ],
  extra: {
    // Readable at runtime via `expo-constants`, so a bug report can say which
    // flavour it came from without guessing from the icon.
    flavor: identity.flavor,
  },
}

export default config
