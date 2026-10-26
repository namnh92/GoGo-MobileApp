import { env } from '@/shared/config/env'

/**
 * Feature gates. Build-time config, like the rest of `env.ts`: there is no
 * remote config in the app, and a gate that needs one can move there when it
 * exists.
 *
 * GoGo AI entry points (GoGo-MobileApp#379): the float button on the tabs, the
 * place-detail questions card, Profile › Help › GoGo AI and the `/assistant`
 * screen. The assistant API (GoGo-BE#713) does not exist yet, so the surface is
 * off unless the build says otherwise — on in `dev` so it can be built and
 * reviewed, off in `stag` and `prod`. `EXPO_PUBLIC_ASSISTANT_ENTRY=on|off`
 * overrides the flavour; the owner turns it on.
 */
export function assistantEntryEnabled(flavor: typeof env.name, override: 'on' | 'off' | undefined): boolean {
  if (override === 'on') return true
  if (override === 'off') return false
  return flavor === 'dev'
}

/** Read at call time from `env`, so a spec can turn the gate either way by mocking `env`. */
export function isAssistantEntryOn(): boolean {
  return assistantEntryEnabled(env.name, env.assistantEntry)
}

/**
 * The scripted GoGo AI backend (`src/data/assistant`, GoGo-MobileApp#378):
 * the assistant API (GoGo-BE#713) is declared but not served, so a dev build
 * would show nothing but errors. Only a `dev` flavour debug build (`__DEV__`)
 * ever uses it — on unless `EXPO_PUBLIC_ASSISTANT_MOCK=off`. stag and prod
 * never do, whatever the variable says, so no build a tester or user installs
 * can answer from a script.
 */
export function assistantMockEnabled(
  flavor: typeof env.name,
  override: 'on' | 'off' | undefined,
  debugBuild: boolean,
): boolean {
  if (!debugBuild || flavor !== 'dev') return false
  return override !== 'off'
}

export function isAssistantMockOn(): boolean {
  const debugBuild = typeof __DEV__ !== 'undefined' && __DEV__
  return assistantMockEnabled(env.name, env.assistantMock, debugBuild)
}
