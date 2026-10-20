/**
 * Whether the native splash has been lifted (`AppProviders`). A sheet or prompt
 * scheduled before it is shown over a screen nobody can see yet.
 */
let hidden = false
const listeners = new Set<() => void>()

export function markSplashHidden(): void {
  if (hidden) return
  hidden = true
  for (const listener of listeners) listener()
}

export function isSplashHidden(): boolean {
  return hidden
}

export function subscribeSplashHidden(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
