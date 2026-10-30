// GoGo-MobileApp#391 — sign the Android release build with the environment's
// keystore when the Firebase lane builds it, and only then.
//
// The keystore and its passwords are read from the environment at Gradle
// configuration time: never written into the generated project, never on a
// command line (fastlane's `android.injected.signing.*` properties would put
// them in the printed command and in `ps`). Without GOGO_ANDROID_KEYSTORE_FILE
// nothing changes — `expo run:android --variant release` and
// scripts/release-build.sh keep Expo's debug-signed release.
const { withAppBuildGradle } = require('expo/config-plugins')

const MARKER = '// gogo: release signing from the environment (GoGo-MobileApp#391)'

const BLOCK = `
${MARKER}
def gogoKeystoreFile = System.getenv('GOGO_ANDROID_KEYSTORE_FILE')
if (gogoKeystoreFile) {
    ['ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD'].each { name ->
        if (!System.getenv(name)) {
            throw new GradleException("GOGO_ANDROID_KEYSTORE_FILE is set but \${name} is not")
        }
    }
    android {
        signingConfigs {
            gogoRelease {
                storeFile file(gogoKeystoreFile)
                storeType 'pkcs12'
                storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
                keyAlias System.getenv('ANDROID_KEY_ALIAS')
                keyPassword System.getenv('ANDROID_KEY_PASSWORD')
            }
        }
        buildTypes.release.signingConfig signingConfigs.gogoRelease
    }
}
`

function addReleaseSigning(contents) {
  if (contents.includes(MARKER)) return contents
  if (!/^android\s*\{/m.test(contents)) {
    throw new Error('release signing: cannot find the android block in app/build.gradle')
  }
  return `${contents.trimEnd()}\n${BLOCK}`
}

module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, cfg => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('release signing: expected the Expo Groovy app build.gradle')
    }
    cfg.modResults.contents = addReleaseSigning(cfg.modResults.contents)
    return cfg
  })
}

module.exports.addReleaseSigning = addReleaseSigning
module.exports.MARKER = MARKER
