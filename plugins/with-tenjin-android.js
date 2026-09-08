// Tenjin's RN wrapper does not bring these optional Android SDK dependencies.
// Keep them in CNG so a clean prebuild cannot silently drop device identifiers.
const { AndroidConfig, withAndroidManifest, withAppBuildGradle } = require('expo/config-plugins')

const DEPENDENCIES = [
  'com.google.android.gms:play-services-ads-identifier:18.3.0',
  'com.google.android.gms:play-services-appset:16.1.0',
  'com.android.installreferrer:installreferrer:2.2',
]

function addDependencies(contents) {
  const missing = DEPENDENCIES.filter(dependency => !contents.includes(dependency))
  if (missing.length === 0) return contents
  if (!/^dependencies\s*\{/m.test(contents)) {
    throw new Error('Tenjin: cannot find the Android app dependencies block')
  }
  return contents.replace(/^dependencies\s*\{/m, match =>
    `${match}\n${missing.map(dependency => `    implementation '${dependency}'`).join('\n')}`)
}

module.exports = function withTenjinAndroid(config) {
  config = AndroidConfig.Permissions.withPermissions(config, [
    'com.google.android.gms.permission.AD_ID',
    'android.permission.ACCESS_NETWORK_STATE',
    'android.permission.INTERNET',
  ])
  config = withAndroidManifest(config, cfg => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults)
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, 'TENJIN_APP_STORE', 'googleplay')
    return cfg
  })
  return withAppBuildGradle(config, cfg => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('Tenjin: expected the Expo Groovy app build.gradle')
    }
    cfg.modResults.contents = addDependencies(cfg.modResults.contents)
    return cfg
  })
}

module.exports.addDependencies = addDependencies
