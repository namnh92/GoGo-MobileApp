import { act, renderHook } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import type { RoomRealtimeStatus } from '@/shared/api'

/**
 * GoGo-MobileApp#292 — the status a room screen shows must belong to the
 * subscription that screen holds now. The SSE transport replays its current
 * status on a timer after `subscribe`, so a report can arrive after the
 * subscription it describes is gone.
 */

type Listener = (status: RoomRealtimeStatus) => void
const mockSubscriptions: { roomId: string; listener?: Listener; active: boolean }[] = []

jest.mock('@/shared/api/realtime/transport', () => ({
  ...jest.requireActual('@/shared/api/realtime/transport'),
  roomRealtimeTransport: {
    kind: 'sse',
    subscribe({ roomId, onStatusChange }: { roomId: string; onStatusChange?: Listener }) {
      const record = { roomId, listener: onStatusChange, active: true }
      mockSubscriptions.push(record)
      return () => {
        record.active = false
      }
    },
  },
}))

import { useRoomRealtime } from '@/shared/api/queries/use-room-realtime'

const client = new QueryClient()
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
)

beforeEach(() => {
  mockSubscriptions.length = 0
})

async function report(index: number, status: RoomRealtimeStatus) {
  await act(async () => {
    mockSubscriptions[index].listener?.(status)
  })
}

describe('useRoomRealtime · whose status it is (#292)', () => {
  it('ignores a late report from the previous room', async () => {
    const hook = await renderHook(({ roomId }: { roomId: string }) => useRoomRealtime(roomId, 'lobby'), {
      wrapper,
      initialProps: { roomId: 'room-a' },
    })
    await report(0, 'live')
    expect(hook.result.current.status).toBe('live')

    await hook.rerender({ roomId: 'room-b' })
    expect(mockSubscriptions[0].active).toBe(false)
    // Room A's replay timer fires after it was torn down.
    await report(0, 'live')
    expect(hook.result.current.status).toBe('connecting')

    await report(1, 'polling')
    expect(hook.result.current.status).toBe('polling')
  })

  it('does not carry "live" across a disable and re-enable of the same room', async () => {
    const hook = await renderHook(({ enabled }: { enabled: boolean }) => useRoomRealtime('room-a', 'lobby', { enabled }), {
      wrapper,
      initialProps: { enabled: true },
    })
    await report(0, 'live')
    expect(hook.result.current.status).toBe('live')

    await hook.rerender({ enabled: false })
    expect(hook.result.current.status).toBe('offline')

    await hook.rerender({ enabled: true })
    expect(mockSubscriptions).toHaveLength(2)
    // Nothing reported yet for the new subscription: it is connecting, not live.
    expect(hook.result.current.status).toBe('connecting')
  })

  it('reads as offline with no room to watch', async () => {
    const hook = await renderHook(() => useRoomRealtime(undefined, 'plan'), { wrapper })
    expect(hook.result.current.status).toBe('offline')
    expect(mockSubscriptions).toHaveLength(0)
  })
})
