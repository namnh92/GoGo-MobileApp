import type { ComponentPropsWithRef } from 'react'
// eslint-disable-next-line no-restricted-imports -- This bootstrap configures RN itself, before AppText loads.
import type { Text, TextInput } from 'react-native'

/**
 * Owner decision (2026-11-06): design sizes on iOS and Android, regardless of
 * Dynamic Type / system font scale. Load before Router or any UI module.
 *
 * RN 0.81 exports function components; React 19's automatic JSX runtime ignores
 * their defaultProps. Wrap those exports once, forwarding refs and input statics.
 * Updating the source modules also covers RN's own Button and deep imports, not
 * just our AppText. Revisit these pinned module paths when upgrading RN.
 */
export function configureFixedFontScaling() {
  // CommonJS module objects let RN's internal imports share the same policy.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const textModule = require('react-native/Libraries/Text/Text') as { default: typeof Text }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const inputModule = require('react-native/Libraries/Components/TextInput/TextInput') as { default: typeof TextInput }
  const NativeText = textModule.default
  const NativeInput = inputModule.default

  // Class components (including RN's Jest host mocks) still support defaults.
  if (!setClassDefaults(NativeText)) {
    function FixedText(props: ComponentPropsWithRef<typeof Text>) {
      return <NativeText {...props} allowFontScaling={false} />
    }
    textModule.default = Object.assign(FixedText, NativeText) as unknown as typeof Text
  }
  if (!setClassDefaults(NativeInput)) {
    function FixedTextInput(props: ComponentPropsWithRef<typeof TextInput>) {
      return <NativeInput {...props} allowFontScaling={false} />
    }
    inputModule.default = Object.assign(FixedTextInput, NativeInput) as unknown as typeof TextInput
  }
}

function setClassDefaults(component: unknown) {
  const klass = component as {
    prototype?: { isReactComponent?: boolean }
    defaultProps?: { allowFontScaling?: boolean }
  }
  if (!klass.prototype?.isReactComponent) return false
  klass.defaultProps = { ...klass.defaultProps, allowFontScaling: false }
  return true
}

configureFixedFontScaling()
