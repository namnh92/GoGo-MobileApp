import { act, fireEvent, screen, within } from '@testing-library/react-native'
import { onlineManager } from '@tanstack/react-query'
import { ApiError, NetworkError } from '@/shared/api/errors'
import { clearSession } from '@/shared/api/session'
import { renderScreen } from './harness'
import { completeWizard } from './contribution-fixtures'
import i18n from '@/shared/i18n'

const mockResolve = jest.fn()
const mockSubmit = jest.fn()
const mockSave = jest.fn()
const mockRetry = jest.fn()
const mockFeedback = jest.fn()
let mockParams: { savedLink?: string } = {}
let mockHistory: string[] = []
const mockRouter = {
  push: jest.fn(({ pathname, params }) => { mockHistory.push(pathname); mockParams = params }),
  replace: jest.fn(({ pathname, params }) => { mockHistory[mockHistory.length - 1] = pathname; mockParams = params }),
  back: jest.fn(() => { mockHistory.pop() }),
}
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ dispatch: jest.fn() }),
  useFocusEffect: (effect: () => void | (() => void)) => {
    jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect])
  },
}))
jest.mock('@react-navigation/native', () => ({ usePreventRemove: jest.fn() }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/shared/ui/header-notification-button.view', () => ({ HeaderNotificationButton: () => null }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  ...jest.requireActual('./contribution-fixtures').contributionHooks(),
  resolveGoogleMapsLink: (body: unknown) => mockResolve(body),
  useResolveGoogleMapsLink: () => ({ mutate: mockRetry, reset: jest.fn(), isPending: false }),
  submitPlace: (body: unknown) => mockSubmit(body),
  useToggleSaved: () => ({ mutateAsync: mockSave }),
}))
import { SavedLink } from '@/features/tabs/saved-link.view'
import PlaceImportScreen, { SavedContributionScreen } from '@/features/place-import/import.view'
import { prepareSavedLinkHandoff, readSavedLinkHandoff } from '@/features/place-import/saved-link-handoff'

const LINK = 'https://maps.app.goo.gl/new'
const resolution = { status: 'RESOLVED' as const, candidate: { googlePlaceId: 'google-new', name: 'New café' }, resolutionToken: 'proof' }
beforeEach(() => {
  jest.clearAllMocks()
  mockParams = {}
  mockHistory = ['/saved']
  onlineManager.setOnline(true)
  mockResolve.mockReset().mockResolvedValue(resolution)
  mockSave.mockResolvedValue({})
  mockSubmit.mockResolvedValue({ status: 'PENDING', submissionId: 'proposal', deduped: true })
})

async function save(url = LINK) {
  const view = await renderScreen(<SavedLink onFeedback={mockFeedback} />)
  await fireEvent.changeText(screen.getByTestId('saved-link-input'), url)
  await fireEvent.press(screen.getByText('Lưu'))
  return view
}
async function openWizard() {
  const saved = await save()
  await saved.unmount()
  const importing = await renderScreen(<PlaceImportScreen />)
  expect(screen.queryByTestId('import-link-input')).toBeNull()
  expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/places/contribution', params: { savedLink: expect.any(String) } })
  await importing.unmount()
  return renderScreen(<SavedContributionScreen />)
}

it('resolves once, replaces import with the wizard, and Back returns to Saved', async () => {
  await openWizard()
  expect(screen.getByTestId('contribution-wizard')).toBeTruthy()
  expect(screen.getByText(i18n.t('placeImport.metaTitle'))).toBeTruthy()
  expect(screen.queryByTestId('import-link-input')).toBeNull()
  expect(mockResolve).toHaveBeenCalledTimes(1)
  expect(mockResolve).toHaveBeenCalledWith({ url: LINK })
  expect(mockRetry).not.toHaveBeenCalled()
  expect(mockHistory).toEqual(['/saved', '/places/contribution'])
  await fireEvent.press(within(screen.getByTestId('import-header')).getByRole('button', { name: 'Quay lại' }))
  expect(mockRouter.back).toHaveBeenCalledTimes(1)
  expect(mockHistory).toEqual(['/saved'])
})

it('opens an invalid link in import with the existing format warning and no resolve', async () => {
  const saved = await save('https://instagram.com/place')
  await saved.unmount()
  await renderScreen(<PlaceImportScreen />)
  expect(screen.getByTestId('import-link-input').props.value).toBe('https://instagram.com/place')
  expect(screen.getByText(i18n.t('placeImport.invalidUrl'))).toBeTruthy()
  expect(mockResolve).not.toHaveBeenCalled()
  expect(mockRouter.replace).not.toHaveBeenCalled()
})

it.each([
  ['generic', new Error('resolve failed')],
  ['provider', new ApiError(503, { code: 'PLACE_PROVIDER_UNAVAILABLE', message: 'unavailable' })],
  ['network', new NetworkError()],
] as const)('opens import with its existing error/offline warning after a %s error', async (_kind, error) => {
  mockResolve.mockRejectedValue(error)
  const saved = await save()
  await saved.unmount()
  await renderScreen(<PlaceImportScreen />)
  expect(screen.getByTestId('import-link-input').props.value).toBe(LINK)
  expect(screen.getByText(i18n.t(error instanceof NetworkError ? 'placeImport.offline'
    : error instanceof ApiError ? 'placeImport.providerUnavailableTitle' : 'placeImport.rejectedTitle'))).toBeTruthy()
  expect(mockRouter.replace).not.toHaveBeenCalled()
  expect(mockResolve).toHaveBeenCalledTimes(1)
  expect(mockRetry).not.toHaveBeenCalled()
})

it('shows the shared LoadingIndicator and blocks repeated saves during verification', async () => {
  let finish!: (value: typeof resolution) => void
  mockResolve.mockReturnValue(new Promise(resolve => { finish = resolve }))
  await save()
  expect(screen.getByTestId('blocking-loading-modal').props.visible).toBe(true)
  expect(screen.getByTestId('loading-indicator', { includeHiddenElements: true })).toBeTruthy()
  expect(screen.getByTestId('saved-link-input').props.editable).toBe(false)
  await fireEvent.press(screen.getByText('Lưu', { includeHiddenElements: true }))
  expect(mockResolve).toHaveBeenCalledTimes(1)
  await act(async () => { finish(resolution) })
})

it('keeps the existing-place quick save behavior', async () => {
  mockResolve.mockResolvedValue({ status: 'ALREADY_EXISTS', existingPlaceId: 'canonical' })
  await save()
  expect(mockSave).toHaveBeenCalledWith({ type: 'place', id: 'canonical', saved: false })
  expect(mockFeedback).toHaveBeenCalledWith(i18n.t('saved.feedback.saved'))
  expect(mockRouter.push).not.toHaveBeenCalled()
})

it.each(['UNRESOLVED', 'CANDIDATE_SELECTION'])('preserves the %s import branch without another resolve', async status => {
  mockResolve.mockResolvedValue({ status, reasonCodes: ['NOT_FOUND'], candidates: [{ googlePlaceId: 'branch', name: 'Pick this branch' }] })
  const saved = await save()
  await saved.unmount()
  await renderScreen(<PlaceImportScreen />)
  expect(screen.getByText(status === 'UNRESOLVED' ? i18n.t('placeImport.rejectedTitle') : 'Pick this branch')).toBeTruthy()
  expect(mockRouter.replace).not.toHaveBeenCalled()
  expect(mockResolve).toHaveBeenCalledTimes(1)
  expect(mockRetry).not.toHaveBeenCalled()
})

it('keeps the resolution proof and normal deduplicated pending-proposal submit behavior', async () => {
  await openWizard()
  await completeWizard()
  await fireEvent.press(screen.getByText('Gửi'))
  expect(mockSubmit).toHaveBeenCalledTimes(1)
  expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({ googlePlaceId: 'google-new', resolutionToken: 'proof' }))
  expect(mockResolve).toHaveBeenCalledTimes(1)
  expect(screen.queryByTestId('contribution-wizard')).toBeNull()
})

it('never restores a handoff after a session change', async () => {
  const id = prepareSavedLinkHandoff({ url: LINK, resolution })
  await clearSession()
  expect(readSavedLinkHandoff(id)).toBeUndefined()
})

it('clears verification UI and ignores its response when the session ends', async () => {
  let finish!: (value: typeof resolution) => void
  mockResolve.mockReturnValue(new Promise(resolve => { finish = resolve }))
  await save()
  await act(async () => { await clearSession() })
  expect(screen.getByTestId('saved-link-input').props.editable).toBe(true)
  expect(screen.getByTestId('saved-link-input').props.value).toBe('')
  await act(async () => { finish(resolution) })
  expect(mockRouter.push).not.toHaveBeenCalled()
})
