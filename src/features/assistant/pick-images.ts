import * as ImagePicker from 'expo-image-picker'

import type { LocalImage } from '@/shared/api'
import { normaliseForUpload } from '@/shared/media/pick-avatar'

export type PickImagesResult = { status: 'picked'; images: LocalImage[] } | { status: 'canceled' } | { status: 'denied' }

/**
 * Photos for a GoGo AI message (images only — owner decision on #377): asked
 * for in context, at most `limit`, each re-encoded to JPEG at most 1024 px the
 * way avatars are, which also turns HEIC into something the server accepts
 * (`assistant_image` takes jpeg/png/webp).
 */
export async function pickAssistantImages(limit: number): Promise<PickImagesResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) return { status: 'denied' }
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    quality: 0.9,
    exif: false,
  })
  if (picked.canceled || picked.assets.length === 0) return { status: 'canceled' }
  const images: LocalImage[] = []
  for (const asset of picked.assets.slice(0, limit)) {
    const normalised = await normaliseForUpload(asset)
    if (normalised.status === 'picked') images.push(normalised.image)
  }
  return images.length > 0 ? { status: 'picked', images } : { status: 'canceled' }
}
