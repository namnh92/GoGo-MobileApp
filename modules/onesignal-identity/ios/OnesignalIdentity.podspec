require 'json'

# This module's own package.json, one level up. Expo's Apple autolinking only
# scans a package's *subdirectories* for a podspec (listFilesInDirectories),
# so this file has to live in ios/ — at the package root it is invisible and
# the module silently never registers, which is exactly what happened.
package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'OnesignalIdentity'
  s.version        = package['version'] || '0.1.0'
  s.summary        = 'OneSignal identity-verified login (NTF-APP-004)'
  s.description    = 'Exposes the OneSignal native SDK login(externalId:token:) that the JS wrapper omits.'
  s.author         = 'GoGo'
  s.homepage       = 'https://github.com/namnh92/GoGo-MobileApp'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: 'https://github.com/namnh92/GoGo-MobileApp' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # Resolved to whatever react-native-onesignal already pins, so there is one
  # copy of the SDK in the binary and one user state to reason about.
  s.dependency 'OneSignalXCFramework'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule',
  }

  # Relative to this file, so only the iOS sources.
  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
