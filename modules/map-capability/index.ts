import { requireOptionalNativeModule } from 'expo-modules-core'

interface MapCapabilityNativeModule {
  isGoogleMapsConfigured(): boolean
}

/** The installed Android binary has a non-empty Google Maps manifest key. */
export function isGoogleMapsConfigured(): boolean {
  return requireOptionalNativeModule<MapCapabilityNativeModule>('GoGoMapCapability')?.isGoogleMapsConfigured() === true
}
