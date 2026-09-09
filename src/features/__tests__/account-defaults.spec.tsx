import { act, fireEvent } from '@testing-library/react-native'

import { failed, loaded, renderScreen, type QueryLike } from './harness'

/** A press that changes state flushes only inside an awaited act here. */
async function press(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(element)
  })
}

/**
 * PROF-APP-003 (#178), ADR-0022 — the defaults card: home area from the
 * curated list, interests (mood), usual budget per person. Edits are local
 * until one save, the patch carries only what moved, and a cleared field
 * travels as null.
 */

const mockUpdate = jest.fn()
const mockAreas: { query: QueryLike } = { query: loaded({ areas: [] }) }
const mockTaxonomies: { query: QueryLike } = { query: loaded({ kinds: {} }) }

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useUpdateProfile: () => ({ mutateAsync: mockUpdate, isPending: false }),
  useServiceAreas: () => mockAreas.query,
  useTaxonomies: () => mockTaxonomies.query,
}))

import { ProfileDefaultsCard, areaDisplayName } from '@/features/account/profile-defaults.view'
import type { Me } from '@/shared/api'

const AREAS = {
  areas: [
    { key: 'hcm_q1', name: 'Quận 1', city: 'TP.HCM', lat: 10.7769, lng: 106.7009 },
    { key: 'hcm_td', name: 'Thủ Đức', city: 'TP.HCM', lat: 10.85, lng: 106.77 },
    { key: 'hn_hk', name: 'Hoàn Kiếm', city: 'Hà Nội', lat: 21.03, lng: 105.85 },
  ],
}
const TAXONOMIES = {
  kinds: {
    mood: [
      { key: 'chill', sortOrder: 0, labels: { vi: 'Thư giãn', en: 'Chill' } },
      { key: 'lively', sortOrder: 1, labels: { vi: 'Sôi động', en: 'Lively' } },
    ],
  },
}

function profile(overrides: Partial<Me> = {}): Me {
  return {
    actorType: 'user',
    id: 'u1',
    displayName: 'An',
    locale: 'vi',
    avatarUrl: null,
    homeArea: null,
    interests: { mood: [] },
    usualBudget: null,
    capabilities: { avatarUpload: 'available' },
    ...overrides,
  } as Me
}

beforeEach(() => {
  mockUpdate.mockReset()
  mockUpdate.mockResolvedValue(profile())
  mockAreas.query = loaded(AREAS)
  mockTaxonomies.query = loaded(TAXONOMIES)
})

describe('profile defaults card', () => {
  it('shows what is set, and the save is disabled until something moves', async () => {
    const view = await renderScreen(
      <ProfileDefaultsCard
        profile={profile({
          homeArea: { key: 'hcm_q1', name: 'Quận 1', city: 'TP.HCM' },
          interests: { mood: ['chill'] },
          usualBudget: { perPerson: 500_000, currency: 'VND' },
        })}
      />,
    )
    expect(view.getByText('Quận 1, TP.HCM')).toBeTruthy()
    expect(view.getByText('✓ Thư giãn')).toBeTruthy()
    expect(view.getByText('✓ 300–500k')).toBeTruthy()
    const save = view.getByText('Lưu mặc định')
    fireEvent.press(save)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('sends only the interests when only a chip moved', async () => {
    const view = await renderScreen(<ProfileDefaultsCard profile={profile()} />)
    await press(view.getByText('Thư giãn'))
    await press(view.getByText('Lưu mặc định'))
    expect(mockUpdate).toHaveBeenCalledWith({ interests: { mood: ['chill'] } })
    expect(await view.findByText('✓ Đã lưu mặc định')).toBeTruthy()
  })

  it('a cleared area and an unset budget travel as null', async () => {
    const view = await renderScreen(
      <ProfileDefaultsCard
        profile={profile({
          homeArea: { key: 'hcm_q1', name: 'Quận 1', city: 'TP.HCM' },
          usualBudget: { perPerson: 500_000, currency: 'VND' },
        })}
      />,
    )
    await press(view.getByText('Bỏ chọn'))
    await press(view.getByText('Không đặt'))
    expect(view.getByText('Chưa chọn')).toBeTruthy()
    await press(view.getByText('Lưu mặc định'))
    expect(mockUpdate).toHaveBeenCalledWith({ homeAreaKey: null, usualBudget: null })
  })

  it('picks an area from the curated list, grouped by city, and sends its key', async () => {
    const view = await renderScreen(<ProfileDefaultsCard profile={profile()} />)
    await press(view.getByText('Chọn khu vực'))
    expect(view.getByText('Hà Nội')).toBeTruthy()
    expect(view.getByText('TP.HCM')).toBeTruthy()
    await press(view.getByText('Hoàn Kiếm'))
    expect(view.getByText('Hoàn Kiếm, Hà Nội')).toBeTruthy()
    await press(view.getByText('Lưu mặc định'))
    expect(mockUpdate).toHaveBeenCalledWith({ homeAreaKey: 'hn_hk' })
  })

  it('a budget tier sends the per-person amount in minor units', async () => {
    const view = await renderScreen(<ProfileDefaultsCard profile={profile()} />)
    await press(view.getByText('500–800k'))
    await press(view.getByText('Lưu mặc định'))
    expect(mockUpdate).toHaveBeenCalledWith({ usualBudget: { perPerson: 800_000, currency: 'VND' } })
  })

  it('says so when the save fails and keeps the edits', async () => {
    mockUpdate.mockRejectedValue(new Error('boom'))
    const view = await renderScreen(<ProfileDefaultsCard profile={profile()} />)
    await press(view.getByText('Sôi động'))
    await press(view.getByText('Lưu mặc định'))
    expect(await view.findByText('Chưa lưu được mặc định. Thử lại nhé.')).toBeTruthy()
    expect(view.getByText('✓ Sôi động')).toBeTruthy()
  })

  it('loads and fails honestly: a list that cannot load says so with a retry', async () => {
    mockTaxonomies.query = failed()
    mockAreas.query = failed()
    const view = await renderScreen(<ProfileDefaultsCard profile={profile()} />)
    expect(view.getByText('Không tải được danh sách sở thích.')).toBeTruthy()
    await press(view.getByText('Chọn khu vực'))
    expect(view.getByText('Không tải được danh sách khu vực.')).toBeTruthy()
  })

  it('names a city once when the area is the city', () => {
    expect(areaDisplayName({ name: 'Đà Lạt', city: 'Đà Lạt' })).toBe('Đà Lạt')
    expect(areaDisplayName({ name: 'Quận 1', city: 'TP.HCM' })).toBe('Quận 1, TP.HCM')
    expect(areaDisplayName({ name: 'Vũng Tàu', city: null })).toBe('Vũng Tàu')
  })
})
