import { cropAvatar, selectAvatar } from '../pick-avatar'
import { DEFAULT_AVATAR_ADJUSTMENT } from '../avatar-crop'

const mockCameraPermission = jest.fn()
const mockLibraryPermission = jest.fn()
const mockCamera = jest.fn()
const mockLibrary = jest.fn()
const mockManipulate = jest.fn()
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: () => mockCameraPermission(),
  requestMediaLibraryPermissionsAsync: () => mockLibraryPermission(),
  launchCameraAsync: (options: unknown) => mockCamera(options),
  launchImageLibraryAsync: (options: unknown) => mockLibrary(options),
}))
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: (...args: unknown[]) => mockManipulate(...args),
  SaveFormat: { JPEG: 'jpeg' }, FlipType: { Horizontal: 'horizontal' },
}))

beforeEach(() => {
  jest.clearAllMocks()
  mockCameraPermission.mockResolvedValue({ granted: true })
  mockLibraryPermission.mockResolvedValue({ granted: true })
  mockCamera.mockResolvedValue({ canceled: false, assets: [{ uri: 'camera.jpg', width: 800, height: 600 }] })
  mockLibrary.mockResolvedValue({ canceled: false, assets: [{ uri: 'library.heic', width: 800, height: 600 }] })
  mockManipulate.mockResolvedValue({ uri: 'cropped.jpg' })
})

it('asks for the selected source only and defers cropping to the editor', async () => {
  expect(await selectAvatar('camera')).toMatchObject({ status: 'selected', asset: { uri: 'camera.jpg' } })
  expect(mockLibraryPermission).not.toHaveBeenCalled()
  expect(mockCamera).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: false, exif: false, mediaTypes: ['images'] }))
  expect(mockManipulate).not.toHaveBeenCalled()
})
it('never opens a denied camera; library remains available as an explicit fallback', async () => {
  mockCameraPermission.mockResolvedValue({ granted: false })
  expect(await selectAvatar('camera')).toEqual({ status: 'denied' })
  expect(mockCamera).not.toHaveBeenCalled()
  expect(await selectAvatar('library')).toMatchObject({ status: 'selected' })
})
it('handles missing camera hardware and picker cancellation without an upload', async () => {
  mockCamera.mockRejectedValue(new Error('No camera'))
  expect(await selectAvatar('camera')).toEqual({ status: 'unavailable' })
  mockLibrary.mockResolvedValue({ canceled: true, assets: null })
  expect(await selectAvatar('library')).toEqual({ status: 'canceled' })
  expect(mockManipulate).not.toHaveBeenCalled()
})
it('rotates, flips, crops in transformed coordinates, and re-encodes HEIC before upload', async () => {
  const image = await cropAvatar({ uri: 'a.heic', width: 800, height: 600 }, { ...DEFAULT_AVATAR_ADJUSTMENT, rotation: 90, flipped: true }, 350)
  expect(image).toEqual({ uri: 'cropped.jpg', mimeType: 'image/jpeg' })
  expect(mockManipulate).toHaveBeenCalledWith('a.heic', [
    { rotate: 90 }, { flip: 'horizontal' },
    { crop: { originX: 108, originY: 208, width: 384, height: 384 } }, { resize: { width: 384 } },
  ], { compress: 0.9, format: 'jpeg' })
})
it('propagates conversion failure and never substitutes the uncropped original', async () => {
  mockManipulate.mockRejectedValue(new Error('native failure'))
  await expect(cropAvatar({ uri: 'a.jpg', width: 800, height: 600 }, DEFAULT_AVATAR_ADJUSTMENT, 350)).rejects.toThrow('native failure')
})
