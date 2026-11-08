import * as ImagePicker from 'expo-image-picker'

import { avatarGeometry, type AvatarAdjustment } from './avatar-crop'

import type { LocalImage } from '@/shared/api'

/** Longest edge sent to the server; it crops to 512 px, so more is waste. */
export const AVATAR_MAX_EDGE = 1024

export type PickAvatarResult =
  | { status: 'picked'; image: LocalImage }
  | { status: 'canceled' }
  | { status: 'denied' }
  /** HEIC with no way to convert it: the server refuses HEIC for avatars. */
  | { status: 'unsupported' }

type Manipulator = typeof import('expo-image-manipulator')

/**
 * `expo-image-manipulator` is a native module, and a dev-client binary built
 * before it was added throws at import time — the same trap `expo-location`
 * set (see `use-current-location.ts`). Loading it lazily turns that into a
 * graceful path: the original is uploaded as-is, and HEIC is refused here
 * rather than after the bytes crossed the network.
 */
function loadManipulator(): Manipulator | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-image-manipulator') as Manipulator
  } catch {
    return null
  }
}

export type PickedAsset = {
  uri: string
  width?: number | undefined
  height?: number | undefined
  mimeType?: string | null | undefined
}

/**
 * Re-encode to JPEG at most `AVATAR_MAX_EDGE` on the long edge. Re-encoding is
 * what turns HEIC into something the server decodes and what drops the EXIF
 * block on the client side too — the server drops it again regardless
 * (ADR-0022), this only keeps the upload small.
 */
export async function normaliseForUpload(asset: PickedAsset): Promise<PickAvatarResult> {
  const manipulator = loadManipulator()
  if (manipulator) {
    const width = asset.width ?? 0
    const height = asset.height ?? 0
    const actions =
      Math.max(width, height) > AVATAR_MAX_EDGE
        ? [width >= height ? { resize: { width: AVATAR_MAX_EDGE } } : { resize: { height: AVATAR_MAX_EDGE } }]
        : []
    const out = await manipulator.manipulateAsync(asset.uri, actions, {
      compress: 0.9,
      format: manipulator.SaveFormat.JPEG,
    })
    return { status: 'picked', image: { uri: out.uri, mimeType: 'image/jpeg' } }
  }

  const type = (asset.mimeType ?? '').toLowerCase()
  const looksHeic = type === 'image/heic' || type === 'image/heif' || /\.hei[cf]$/i.test(asset.uri)
  if (looksHeic) return { status: 'unsupported' }
  return { status: 'picked', image: { uri: asset.uri, ...(asset.mimeType ? { mimeType: asset.mimeType } : {}) } }
}

/**
 * Ask for the library in context, let the person crop a square, and hand back
 * something the upload hook can send. Every outcome is a value, never a throw:
 * the screen turns each into copy.
 */
export async function pickAvatar(): Promise<PickAvatarResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) return { status: 'denied' }

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.9,
    exif: false,
  })
  const asset = picked.canceled ? null : picked.assets[0]
  if (!asset) return { status: 'canceled' }
  return normaliseForUpload(asset)
}

export type AvatarSource = 'camera' | 'library'
export type SelectAvatarResult =
  | { status: 'selected'; asset: PickedAsset & { width: number; height: number } }
  | { status: 'canceled' | 'denied' | 'unavailable' }

/** No system crop: the Stitch editor owns all adjustments before any upload. */
export async function selectAvatar(source: AvatarSource): Promise<SelectAvatarResult> {
  try {
    let permission = source === 'camera'
      ? await ImagePicker.getCameraPermissionsAsync()
      : await ImagePicker.getMediaLibraryPermissionsAsync()
    // Ask the system on the first in-context tap. A previous refusal belongs
    // to the shared permission sheet; never repeatedly trigger system prompts.
    if (permission.status === 'undetermined') {
      permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync()
    }
    if (!permission.granted) return { status: 'denied' }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: false, quality: 1, exif: false }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options)
    const asset = result.canceled ? null : result.assets[0]
    if (!asset) return { status: 'canceled' }
    if (!asset.width || !asset.height) return { status: 'unavailable' }
    return { status: 'selected', asset }
  } catch {
    return { status: 'unavailable' }
  }
}

export async function cropAvatar(asset: PickedAsset & { width: number; height: number }, value: AvatarAdjustment, viewport: number): Promise<LocalImage> {
  const manipulator = loadManipulator()
  // Never upload the original when the binary cannot apply the visible crop.
  if (!manipulator) throw new Error('Avatar image editor unavailable')
  const { crop } = avatarGeometry(asset.width, asset.height, viewport, value)
  const actions: Parameters<Manipulator['manipulateAsync']>[1] = []
  if (value.rotation) actions.push({ rotate: value.rotation })
  if (value.flipped) actions.push({ flip: manipulator.FlipType.Horizontal })
  actions.push({ crop }, { resize: { width: Math.min(AVATAR_MAX_EDGE, crop.width) } })
  const result = await manipulator.manipulateAsync(asset.uri, actions, { compress: 0.9, format: manipulator.SaveFormat.JPEG })
  return { uri: result.uri, mimeType: 'image/jpeg' }
}
