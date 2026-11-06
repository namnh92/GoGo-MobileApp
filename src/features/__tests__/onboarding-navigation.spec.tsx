import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { PanGesture } from 'react-native-gesture-handler'
import i18n from '@/shared/i18n'

const mockGestures: PanGesture[] = []
const mockRouter = { replace: jest.fn() }
const mockRequest = jest.fn(async () => {})
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }))
jest.mock('@/shared/notifications/permission-bootstrap', () => ({ pushPermission: { request: () => mockRequest() } }))
jest.mock('react-native-gesture-handler', () => ({
  ...jest.requireActual('react-native-gesture-handler'),
  // Keep the real gesture builder/config; native recognition needs device QA.
  GestureDetector: ({ gesture, children }: { gesture: PanGesture; children: React.ReactNode }) => {
    if (gesture.config.testId === 'onboarding-swipe') mockGestures.push(gesture)
    return children
  },
}))
import Onboarding from '../onboarding/onboarding.view'

const pan = () => {
  const gesture = mockGestures[mockGestures.length - 1]
  expect(gesture).toBeDefined()
  return gesture
}
const end = (gesture: PanGesture, x: number, y = 0, success = true) => {
  gesture.handlers.onEnd?.({ translationX: x, translationY: y } as never, success)
}
const title = (slide: number) => expect(screen.getByText(i18n.t((['onboarding.slide1.title', 'onboarding.slide2.title', 'onboarding.slide3.title'] as const)[slide]))).toBeTruthy()
beforeEach(() => { mockGestures.length = 0; jest.clearAllMocks() })

it('navigates both ways, clamps edges and never completes onboarding through swipes', async () => {
  await render(<Onboarding />)
  await act(async () => { end(pan(), 100) })
  title(0)
  await act(async () => { end(pan(), -100) })
  title(1)
  await act(async () => { end(pan(), -100) })
  title(2)
  await act(async () => { end(pan(), -100) })
  title(2)
  await act(async () => { end(pan(), 100) })
  title(1)
  await fireEvent.press(screen.getByRole('button', { name: i18n.t('common.back') }))
  title(0)
  expect(mockRequest).not.toHaveBeenCalled()
  expect(mockRouter.replace).not.toHaveBeenCalled()
})

it('rejects cancelled, short and vertical completions and configures preactivation vertical failure', async () => {
  await render(<Onboarding />)
  const gesture = pan()
  expect(gesture.config).toMatchObject({ maxPointers: 1, activeOffsetXStart: -20, activeOffsetXEnd: 20, failOffsetYStart: -12, failOffsetYEnd: 12, runOnJS: true })
  expect(gesture.config.simultaneousWith).toHaveLength(1)
  for (const [x, y, success] of [[-90, 0, false], [-47, 0, true], [-80, 60, true]] as const) {
    await act(async () => { end(gesture, x, y, success) })
    title(0)
  }
})

it('rejects duplicate and stale callbacks across visits and while finishing', async () => {
  await render(<Onboarding />)
  const first = pan()
  await act(async () => { end(first, -100); end(first, -100) })
  title(1)
  await act(async () => { end(first, -100) })
  title(1)
  await act(async () => { end(pan(), -100) })
  const last = pan()
  await fireEvent.press(screen.getByRole('button', { name: i18n.t('onboarding.start') }))
  await act(async () => { end(last, 100) })
  title(2)
  expect(pan().config.enabled).toBe(false)
  expect(mockRouter.replace).toHaveBeenCalledTimes(1)
  expect(mockRequest).not.toHaveBeenCalled()
})
