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

/**
 * Share-link hosts, one per flavour. The owned domain is gogo.id.vn — `gogo.app`
 * was never registered by this project, so every link built against it was
 * unverifiable regardless of fingerprints.
 */
const WEB_HOSTS: Record<Flavor, string> = {
  dev: 'go-dev.gogo.id.vn',
  stag: 'go-stag.gogo.id.vn',
  prod: 'go.gogo.id.vn',
}

const flavor = resolveFlavor(process.env.EXPO_PUBLIC_ENV)
const identity = {
  flavor,
  /** iOS `bundleIdentifier` and Android `package` — always the same string. */
  bundleId: `max.gogo.${flavor}`,
  appName: NAMES[flavor],
  scheme: SCHEMES[flavor],
  /** Share-link host for this flavour, served by that environment's Worker. */
  webHost: WEB_HOSTS[flavor],
  /**
   * Whether the build claims `https://<webHost>/...`.
   *
   * A universal link verifies against the app IDs listed in the host's
   * `apple-app-site-association` / `assetlinks.json`. Claiming a host that
   * never names the build ships a claim that cannot verify — Android offers an
   * unverified handler in the chooser and iOS ignores it, which is worse than
   * not claiming at all. So this follows what is actually served.
   *
   * dev is served today:
   *   https://go-dev.gogo.id.vn/.well-known/apple-app-site-association
   *   → appIDs ["HLSABWU9U8.max.gogo.dev"]
   *
   * This used to name `gogo.app`, a domain this project does not own, so
   * production's claim could never verify either. stag stays off until its host
   * serves the files.
   */
  claimsWebLinks: flavor !== 'stag',
}

// Matches the components served in the association files. `/l` is the canonical
// share link the Worker resolves, and leaving it out meant the one path the
// product actually generates was the one path the app did not claim.
const WEB_LINK_PREFIXES = ['/l', '/r', '/plans', '/places', '/room']

/** Native Maps keys are required at prebuild; restrict them by app and SDK.
 * Never expose keys through EXPO_PUBLIC_* or extra. See ADR 0008. */
const googleMapsIosApiKey = process.env.GOOGLE_MAPS_IOS_API_KEY?.trim() || undefined
const googleMapsAndroidApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim() || undefined
// A map-enabled binary must not silently ship Apple Maps or crash on Android.
if (!googleMapsIosApiKey || !googleMapsAndroidApiKey) {
  throw new Error('GOOGLE_MAPS_IOS_API_KEY and GOOGLE_MAPS_ANDROID_API_KEY are required for Expo commands and native builds')
}

// Same required contract in every remote environment. The marker prevents a
// DEV-generated file being reused accidentally for a staging/production build.
const configEnvironment = flavor === 'stag' ? 'staging' : flavor
const oneSignalAppId = process.env.ONESIGNAL_APP_ID?.trim()
if (!oneSignalAppId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(oneSignalAppId)) {
  throw new Error('ONESIGNAL_APP_ID is required and must be a UUID in every environment')
}
if (process.env.ONESIGNAL_CONFIG_ENV !== configEnvironment) {
  throw new Error('ONESIGNAL_CONFIG_ENV must match the build environment')
}
const oneSignalApnsMode = process.env.ONESIGNAL_APNS_MODE
if (oneSignalApnsMode !== 'development' && oneSignalApnsMode !== 'production') {
  throw new Error('ONESIGNAL_APNS_MODE must explicitly select development or production signing')
}

const tenjinIosSdkKey = process.env.TENJIN_IOS_SDK_KEY?.trim()
const tenjinAndroidSdkKey = process.env.TENJIN_ANDROID_SDK_KEY?.trim()
if (process.env.TENJIN_CONFIG_ENV !== configEnvironment) {
  throw new Error('TENJIN_CONFIG_ENV must match the build environment')
}
if (![tenjinIosSdkKey, tenjinAndroidSdkKey].every(key => key && /^[A-Za-z0-9_-]+$/.test(key))) {
  throw new Error('Both TENJIN SDK keys are required in every environment')
}

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
    buildNumber: process.env.IOS_BUILD_NUMBER || '1',
    supportsTablet: false,
    // Only the flavour the domain actually names can verify (see app-identity).
    ...(identity.claimsWebLinks ? { associatedDomains: [`applinks:${identity.webHost}`] } : {}),
    config: { googleMapsApiKey: googleMapsIosApiKey },
  },
  android: {
    package: identity.bundleId,
    config: { googleMaps: { apiKey: googleMapsAndroidApiKey } },
    allowBackup: false,
    ...(identity.claimsWebLinks
      ? {
          intentFilters: [
            {
              action: 'VIEW',
              autoVerify: true,
              data: WEB_LINK_PREFIXES.map((pathPrefix) => ({
                scheme: 'https',
                host: identity.webHost,
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
    './plugins/with-tenjin-android.js',
    // Registered BEFORE onesignal-expo-plugin on purpose. Expo composes mods
    // like middleware, so the last one registered runs first — and this has to
    // run *after* onesignal-expo-plugin has written the extension target's
    // OneSignalXCFramework constraint, in order to rewrite it (NTF-APP-004).
    //
    // The `.js` is deliberate: CI asserts every `./`-prefixed path in the
    // resolved config exists on disk, and Node's extension resolution does not
    // help `fs.existsSync`.
    './plugins/with-onesignal-identity-beta.js',
    ['onesignal-expo-plugin', { mode: oneSignalApnsMode, iPhoneDeploymentTarget: '15.1' }],
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
    // Public App ID only. Never spread process.env into the client manifest.
    oneSignalAppId,
    tenjinIosSdkKey,
    tenjinAndroidSdkKey,
  },
}

export default config
