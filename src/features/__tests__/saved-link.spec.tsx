import { act, fireEvent } from '@testing-library/react-native'
import { StyleSheet } from 'react-native-unistyles'
import { StyleSheet as RNStyleSheet, TextInput as NativeTextInput } from 'react-native'
import { buttonSizes, touchTarget } from '@/shared/ui/tokens'
import { themes, type AppTheme } from '@/shared/ui/theme'
import { renderScreen } from './harness'
import { readSavedLinkHandoff } from '@/features/place-import/saved-link-handoff'
import { SavedLink } from '@/features/tabs/saved-link.view'
const mockPush = jest.fn()
const mockResolve = jest.fn()
const mockSave = jest.fn()
const mockFeedback = jest.fn()
let mockSaved: unknown[] = []
let mockFocused = true
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (effect: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react')
    const focused = mockFocused
    useEffect(() => { if (focused) return effect() }, [effect, focused])
  },
}))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  resolveGoogleMapsLink: (body: unknown) => mockResolve(body),
  useToggleSaved: () => ({ mutateAsync: mockSave }),
  useSaved: () => ({ data: mockSaved }),
}))
beforeEach(() => {
  jest.clearAllMocks()
  mockResolve.mockReset()
  mockSave.mockReset()
  mockFocused = true
  mockSaved = []
  mockResolve.mockResolvedValue({ status: 'ALREADY_EXISTS', existingPlaceId: 'canonical' })
  mockSave.mockResolvedValue({})
})
async function enterAndSave(url: string) {
  const view = await renderScreen(<SavedLink onFeedback={mockFeedback} />)
  await fireEvent.changeText(view.getByTestId('saved-link-input'), url)
  await fireEvent.press(view.getByText('Lưu'))
  return view
}
it('saves an existing GoGo place immediately with inline feedback', async () => {
  await enterAndSave('https://maps.app.goo.gl/cafe')
  expect(mockSave).toHaveBeenCalledWith({ type: 'place', id: 'canonical', saved: false })
  expect(mockFeedback).toHaveBeenCalledWith('Đã lưu địa điểm')
  expect(mockPush).not.toHaveBeenCalled()
})
it('keeps an already saved place saved', async () => {
  mockSaved = [{ targetType: 'place', targetId: 'canonical' }]
  await enterAndSave('https://maps.app.goo.gl/cafe')
  expect(mockSave).toHaveBeenCalledWith({ type: 'place', id: 'canonical', saved: false })
  expect(mockFeedback).toHaveBeenCalled()
})
it('confirms a save through PUT after the place is removed while its link resolves', async () => {
  mockSaved = [{ targetType: 'place', targetId: 'canonical' }]
  let finishResolve: (value: unknown) => void = () => {}
  let finishSave: () => void = () => {}
  mockResolve.mockReturnValue(new Promise(resolve => { finishResolve = resolve }))
  mockSave.mockReturnValue(new Promise<void>(resolve => { finishSave = resolve }))
  const view = await enterAndSave('https://maps.app.goo.gl/cafe')
  mockSaved = []
  await view.rerender(<SavedLink onFeedback={mockFeedback} />)
  await act(async () => { finishResolve({ status: 'ALREADY_EXISTS', existingPlaceId: 'canonical' }) })
  expect(mockSave).toHaveBeenCalledWith({ type: 'place', id: 'canonical', saved: false })
  expect(mockFeedback).not.toHaveBeenCalled()
  await act(async () => { finishSave() })
  expect(mockFeedback).toHaveBeenCalledWith('Đã lưu địa điểm')
})
it('hands the resolved new place to the import flow without a second resolve', async () => {
  mockResolve.mockResolvedValue({ status: 'RESOLVED', candidate: { name: 'New café' } })
  await enterAndSave('https://maps.app.goo.gl/new')
  expect(mockSave).not.toHaveBeenCalled()
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/places/import', params: { savedLink: expect.any(String) } })
  expect(readSavedLinkHandoff(mockPush.mock.calls[0][0].params.savedLink)).toMatchObject({ url: 'https://maps.app.goo.gl/new', resolution: { status: 'RESOLVED' } })
})
it('opens import with an invalid link before resolving', async () => {
  await enterAndSave('https://instagram.com/place')
  expect(mockResolve).not.toHaveBeenCalled()
  expect(readSavedLinkHandoff(mockPush.mock.calls[0][0].params.savedLink)).toEqual({ url: 'https://instagram.com/place' })
})
it('shows a shared result error and never claims a failed save succeeded', async () => {
  mockSave.mockRejectedValue(new Error('offline'))
  const view = await enterAndSave('https://maps.app.goo.gl/cafe')
  expect(view.getByText('Chưa lưu được địa điểm')).toBeTruthy()
  expect(mockFeedback).not.toHaveBeenCalled()
})

it('does not save or navigate if the user leaves while link resolution is pending', async () => {
  let finish: (value: unknown) => void = () => {}
  mockResolve.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const view = await enterAndSave('https://maps.app.goo.gl/pending')
  await view.unmount()
  await act(async () => { finish({ status: 'ALREADY_EXISTS', existingPlaceId: 'canonical' }) })
  expect(mockSave).not.toHaveBeenCalled()
  expect(mockPush).not.toHaveBeenCalled()
  expect(mockFeedback).not.toHaveBeenCalled()
})

it.each([false, true])('ignores a late new-place result after tab blur (refocused: %s)', async refocus => {
  let finish: (value: unknown) => void = () => {}
  mockResolve.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const view = await enterAndSave('https://maps.app.goo.gl/pending')
  mockFocused = false
  await view.rerender(<SavedLink onFeedback={mockFeedback} />)
  if (refocus) {
    mockFocused = true
    await view.rerender(<SavedLink onFeedback={mockFeedback} />)
  }
  await act(async () => { finish({ status: 'RESOLVED', candidate: { name: 'Late café' } }) })
  expect(mockPush).not.toHaveBeenCalled()
  expect(mockSave).not.toHaveBeenCalled()
  expect(mockFeedback).not.toHaveBeenCalled()
})

it('keeps a new attempt pending when an older blurred attempt settles', async () => {
  let finishOld: (value: unknown) => void = () => {}
  let finishNew: (value: unknown) => void = () => {}
  mockResolve.mockReturnValueOnce(new Promise(resolve => { finishOld = resolve }))
    .mockReturnValueOnce(new Promise(resolve => { finishNew = resolve }))
  const view = await enterAndSave('https://maps.app.goo.gl/old')
  mockFocused = false
  await view.rerender(<SavedLink onFeedback={mockFeedback} />)
  mockFocused = true
  await view.rerender(<SavedLink onFeedback={mockFeedback} />)
  expect(view.getByTestId('saved-link-input').props.editable).toBe(true)
  await fireEvent.changeText(view.getByTestId('saved-link-input'), 'https://maps.app.goo.gl/new')
  await fireEvent.press(view.getByText('Lưu'))
  expect(mockResolve).toHaveBeenCalledTimes(2)
  await act(async () => { finishOld({ status: 'RESOLVED' }) })
  expect(mockPush).not.toHaveBeenCalled()
  expect(view.getByTestId('saved-link-input').props.editable).toBe(false)
  await act(async () => { finishNew({ status: 'RESOLVED' }) })
  expect(mockPush).toHaveBeenCalledTimes(1)
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/places/import', params: { savedLink: expect.any(String) } })
  expect(readSavedLinkHandoff(mockPush.mock.calls[0][0].params.savedLink)).toMatchObject({ url: 'https://maps.app.goo.gl/new', resolution: { status: 'RESOLVED' } })
})

it('does not save a late existing-place result after tab blur and refocus', async () => {
  let finish: (value: unknown) => void = () => {}
  mockResolve.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const view = await enterAndSave('https://maps.app.goo.gl/pending')
  mockFocused = false
  await view.rerender(<SavedLink onFeedback={mockFeedback} />)
  mockFocused = true
  await view.rerender(<SavedLink onFeedback={mockFeedback} />)
  await act(async () => { finish({ status: 'ALREADY_EXISTS', existingPlaceId: 'canonical' }) })
  expect(mockSave).not.toHaveBeenCalled()
  expect(mockFeedback).not.toHaveBeenCalled()
})

it.each(['resolve', 'save'])('ignores a late %s error after tab blur and refocus', async stage => {
  let reject: (error: Error) => void = () => {}
  const mutation = stage === 'resolve' ? mockResolve : mockSave
  mutation.mockReturnValue(new Promise((_, fail) => { reject = fail }))
  const view = await enterAndSave('https://maps.app.goo.gl/pending')
  mockFocused = false
  await view.rerender(<SavedLink onFeedback={mockFeedback} />)
  mockFocused = true
  await view.rerender(<SavedLink onFeedback={mockFeedback} />)
  await act(async () => { reject(new Error('offline')) })
  expect(view.queryByText('Chưa lưu được địa điểm')).toBeNull()
  expect(mockFeedback).not.toHaveBeenCalled()
})

it('ignores save feedback after tab blur and refocus', async () => {
  let finish: () => void = () => {}
  mockSave.mockReturnValue(new Promise<void>(resolve => { finish = resolve }))
  const view = await enterAndSave('https://maps.app.goo.gl/pending')
  expect(mockSave).toHaveBeenCalledTimes(1)
  mockFocused = false
  await view.rerender(<SavedLink onFeedback={mockFeedback} />)
  mockFocused = true
  await view.rerender(<SavedLink onFeedback={mockFeedback} />)
  await act(async () => { finish() })
  expect(mockFeedback).not.toHaveBeenCalled()
  expect(view.getByTestId('saved-link-input').props.value).toBe('https://maps.app.goo.gl/pending')
})

it('uses the compact row with no separate quick-save title', async () => {
  const view = await renderScreen(<SavedLink onFeedback={mockFeedback} />)
  expect(view.getByPlaceholderText('Dán link Google Maps để lưu')).toBeTruthy()
  expect(view.queryByText('Lưu nhanh từ link')).toBeNull()
  const save = view.getByRole('button', { name: 'Lưu' })
  const height = RNStyleSheet.flatten(save.props.style).minHeight
  expect(height).toBe(buttonSizes.small.minHeight)
  expect(RNStyleSheet.flatten(save.props.style).height).toBe(52)
  expect(RNStyleSheet.flatten(view.getByTestId('saved-link-input').props.style).height).toBe(52)
  expect(height + save.props.hitSlop.top + save.props.hitSlop.bottom).toBeGreaterThanOrEqual(touchTarget.min)
})

it.each(['orange', 'orangeDark'] as const)('uses the common import field and clears a long link while retaining focus (%s)', async themeName => {
  const focus = jest.spyOn(NativeTextInput.prototype, 'focus').mockImplementation(() => {})
  try {
    const view = await renderScreen(<SavedLink onFeedback={mockFeedback} />)
    expect(view.queryByRole('button', { name: 'Xóa liên kết' })).toBeNull()
    const url = 'https://www.google.com/maps/place/' + 'long-place-name'.repeat(40)
    await fireEvent.changeText(view.getByTestId('saved-link-input'), url)
    const input = view.getByTestId('saved-link-input')
    expect(input.props).toMatchObject({ value: url, editable: true })
    const display = view.getByText(url, { includeHiddenElements: true })
    expect(display.props).toMatchObject({ numberOfLines: 1, ellipsizeMode: 'tail' })
    const create = jest.spyOn(StyleSheet, 'create')
    jest.isolateModules(() => { jest.requireActual('@/shared/ui/link-input.style') })
    const factory = create.mock.calls[0]![0] as (theme: AppTheme) => Record<string, Record<string, unknown>>
    expect(factory(themes[themeName]).input).toMatchObject({ height: 52, backgroundColor: themes[themeName].surface.low, paddingLeft: 40, paddingRight: 48 })
    create.mockRestore()
    expect(input.props).toMatchObject({ value: url, multiline: false, numberOfLines: 1, scrollEnabled: true })
    const clear = view.getByRole('button', { name: 'Xóa liên kết' })
    expect(RNStyleSheet.flatten(clear.props.style)).toMatchObject({ width: 44, height: 44 })
    await fireEvent.press(clear)
    expect(view.getByTestId('saved-link-input').props.value).toBe('')
    expect(view.queryByRole('button', { name: 'Xóa liên kết' })).toBeNull()
    expect(focus).toHaveBeenCalledTimes(1)
    expect(view.getByRole('button', { name: 'Lưu' })).toBeDisabled()
    expect(mockResolve).not.toHaveBeenCalled()
    expect(mockSave).not.toHaveBeenCalled()
  } finally { focus.mockRestore() }
})

it.each(['orange', 'orangeDark'] as const)('keeps the quick-save row compact and uses theme colors (%s)', themeName => {
  const create = jest.spyOn(StyleSheet, 'create')
  jest.isolateModules(() => { jest.requireActual('../tabs/saved.style') })
  const factory = create.mock.calls[0]![0] as (theme: AppTheme) => Record<string, Record<string, unknown>>
  const theme = themes[themeName]
  const styles = factory(theme)
  create.mockRestore()
  expect(styles.linkRow).toMatchObject({ minHeight: 52, flexDirection: 'row' })
  expect(styles.linkCard.padding).toBeUndefined()
  expect(styles.linkField).toMatchObject({ flex: 1, minWidth: 0, height: 52 })
  expect(styles.linkSave.height).toBe(52)
  expect(styles.countBadge).toMatchObject({ minWidth: 24, minHeight: 24, borderRadius: 12, backgroundColor: theme.surface.subtle })
})
