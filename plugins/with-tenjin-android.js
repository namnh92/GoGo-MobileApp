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

const LOG_STRIP_MARKER = '// gogo: strip Tenjin SDK debug logs from release (GoGo-MobileApp#402)'

// The SDK calls Log.d unconditionally, connect parameters and device identifiers
// included, and has no switch in 1.23.0, 1.24.0 or 2.0.2. Release builds run
// without R8, so the calls are rewritten here, in com.tenjin.android only: the
// arguments are popped and the int Log.d returns is replaced by 0, leaving the
// stack as it was. Log.w and Log.e stay. Debug builds keep every line.
const LOG_STRIP = `
${LOG_STRIP_MARKER}
abstract class GogoTenjinLogStrip implements com.android.build.api.instrumentation.AsmClassVisitorFactory<com.android.build.api.instrumentation.InstrumentationParameters.None> {
    @Override
    org.objectweb.asm.ClassVisitor createClassVisitor(com.android.build.api.instrumentation.ClassContext context, org.objectweb.asm.ClassVisitor next) {
        return new org.objectweb.asm.ClassVisitor(org.objectweb.asm.Opcodes.ASM9, next) {
            @Override
            org.objectweb.asm.MethodVisitor visitMethod(int access, String name, String descriptor, String signature, String[] exceptions) {
                def method = cv.visitMethod(access, name, descriptor, signature, exceptions)
                return new org.objectweb.asm.MethodVisitor(org.objectweb.asm.Opcodes.ASM9, method) {
                    @Override
                    void visitMethodInsn(int opcode, String owner, String callee, String calleeDescriptor, boolean isInterface) {
                        if (opcode == org.objectweb.asm.Opcodes.INVOKESTATIC && owner == 'android/util/Log' && callee in ['v', 'd', 'i']) {
                            org.objectweb.asm.Type.getArgumentTypes(calleeDescriptor).each { mv.visitInsn(org.objectweb.asm.Opcodes.POP) }
                            mv.visitInsn(org.objectweb.asm.Opcodes.ICONST_0)
                        } else {
                            mv.visitMethodInsn(opcode, owner, callee, calleeDescriptor, isInterface)
                        }
                    }
                }
            }
        }
    }

    @Override
    boolean isInstrumentable(com.android.build.api.instrumentation.ClassData classData) {
        return classData.className.startsWith('com.tenjin.android.')
    }
}
androidComponents {
    onVariants(selector().withBuildType('release')) { variant ->
        variant.instrumentation.transformClassesWith(GogoTenjinLogStrip, com.android.build.api.instrumentation.InstrumentationScope.ALL) {}
    }
}
`

function addLogStrip(contents) {
  if (contents.includes(LOG_STRIP_MARKER)) return contents
  if (!/^android\s*\{/m.test(contents)) {
    throw new Error('Tenjin: cannot find the android block in app/build.gradle')
  }
  return `${contents.trimEnd()}\n${LOG_STRIP}`
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
    cfg.modResults.contents = addLogStrip(addDependencies(cfg.modResults.contents))
    return cfg
  })
}

module.exports.addDependencies = addDependencies
module.exports.addLogStrip = addLogStrip
module.exports.LOG_STRIP_MARKER = LOG_STRIP_MARKER
