require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', '..', 'package.json')))

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

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
