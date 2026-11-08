import { cropAvatar, selectAvatar } from '../pick-avatar'
import { DEFAULT_AVATAR_ADJUSTMENT } from '../avatar-crop'

const mockCameraPermission = jest.fn()
const mockLibraryPermission = jest.fn()
const mockGetCameraPermission = jest.fn()
const mockGetLibraryPermission = jest.fn()
const mockCamera = jest.fn()
const mockLibrary = jest.fn()
const mockManipulate = jest.fn()
jest.mock('expo-image-picker', () => ({
  getCameraPermissionsAsync: () => mockGetCameraPermission(),
  getMediaLibraryPermissionsAsync: () => mockGetLibraryPermission(),
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
  mockGetCameraPermission.mockResolvedValue({ status: 'undetermined', granted: false })
  mockGetLibraryPermission.mockResolvedValue({ status: 'undetermined', granted: false })
  mockCameraPermission.mockResolvedValue({ granted: true })
  mockLibraryPermission.mockResolvedValue({ granted: true })
  mockCamera.mockResolvedValue({ canceled: false, assets: [{ uri: 'camera.jpg', width: 800, height: 600 }] })
  mockLibrary.mockResolvedValue({ canceled: false, assets: [{ uri: 'library.heic', width: 800, height: 600 }] })
  mockManipulate.mockResolvedValue({ uri: 'cropped.jpg' })
})

it.each(['camera', 'library'] as const)('%s asks immediately only when undetermined, then opens the selected source', async source => {
  const get = source === 'camera' ? mockGetCameraPermission : mockGetLibraryPermission
  const request = source === 'camera' ? mockCameraPermission : mockLibraryPermission
  const launch = source === 'camera' ? mockCamera : mockLibrary
  expect(await selectAvatar(source)).toMatchObject({ status: 'selected' })
  expect(get).toHaveBeenCalledTimes(1)
  expect(request).toHaveBeenCalledTimes(1)
  expect(launch).toHaveBeenCalledTimes(1)
  expect(get.mock.invocationCallOrder[0]).toBeLessThan(request.mock.invocationCallOrder[0]!)
  expect(request.mock.invocationCallOrder[0]).toBeLessThan(launch.mock.invocationCallOrder[0]!)
})

it.each(['camera', 'library'] as const)('%s opens directly when already granted', async source => {
  const get = source === 'camera' ? mockGetCameraPermission : mockGetLibraryPermission
  const request = source === 'camera' ? mockCameraPermission : mockLibraryPermission
  get.mockResolvedValue({ status: 'granted', granted: true })
  expect(await selectAvatar(source)).toMatchObject({ status: 'selected' })
  expect(request).not.toHaveBeenCalled()
})

it.each([
  ['camera', true], ['camera', false], ['library', true], ['library', false],
] as const)('%s returns denied without another system request (canAskAgain=%s)', async (source, canAskAgain) => {
  const get = source === 'camera' ? mockGetCameraPermission : mockGetLibraryPermission
  const request = source === 'camera' ? mockCameraPermission : mockLibraryPermission
  get.mockResolvedValue({ status: 'denied', granted: false, canAskAgain })
  expect(await selectAvatar(source)).toEqual({ status: 'denied' })
  expect(request).not.toHaveBeenCalled()
  expect(mockCamera).not.toHaveBeenCalled()
  expect(mockLibrary).not.toHaveBeenCalled()
})

it.each(['camera', 'library'] as const)('%s returns denied when the first system request is refused', async source => {
  const request = source === 'camera' ? mockCameraPermission : mockLibraryPermission
  request.mockResolvedValue({ status: 'denied', granted: false })
  expect(await selectAvatar(source)).toEqual({ status: 'denied' })
  expect(request).toHaveBeenCalledTimes(1)
  expect(mockCamera).not.toHaveBeenCalled()
  expect(mockLibrary).not.toHaveBeenCalled()
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
