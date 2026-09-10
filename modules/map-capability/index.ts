import { requireOptionalNativeModule } from 'expo-modules-core'

interface MapCapabilityNativeModule {
  googleMapsConfigured: boolean
}

/** The installed Android binary has a non-empty Google Maps manifest key. */
export function isGoogleMapsConfigured(): boolean {
  return requireOptionalNativeModule<MapCapabilityNativeModule>('GoGoMapCapability')?.googleMapsConfigured === true
}
