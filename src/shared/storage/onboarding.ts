import AsyncStorage from '@react-native-async-storage/async-storage'

export const ONBOARDING_COMPLETE_KEY = 'gogo.onboarding.v1'

export async function hasCompletedOnboarding(): Promise<boolean> {
  return AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY)
    .then(value => value === '1')
    .catch(() => false)
}

/** Completion must never trap someone in intro when local storage is unavailable. */
export async function markOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, '1').catch(() => {})
}
