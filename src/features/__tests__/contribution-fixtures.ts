import { fireEvent, screen } from '@testing-library/react-native'

/** Contract-shaped reference data, only for tests; labels are supplied by the API. */
export const contributionTaxonomies = {
  kinds: {
    suitability: [{ key: 'date', labels: { vi: 'Hẹn hò', en: 'Date' } }],
    mood: ['quiet', 'acoustic', 'garden', 'lively'].map((key, i) => ({
      key,
      labels: { vi: ['Yên tĩnh', 'Nhạc nhẹ', 'Sân vườn', 'Sôi động'][i], en: key },
    })),
    amenity: [{ key: 'car_parking', labels: { vi: 'Chỗ đỗ ô tô', en: 'Car parking' } }],
    checkin_tag: [
      { key: 'service_friendly', labels: { vi: 'Nhân viên thân thiện', en: 'Friendly staff' } },
      { key: 'space_quiet', labels: { vi: 'Không gian yên tĩnh', en: 'Quiet space' } },
    ],
  },
}
export function contributionHooks() {
  return {
    useContributionCredits: () => ({}),
    useTaxonomies: () => ({ data: contributionTaxonomies, isPending: false, isError: false }),
    useContributionDrafts: () => ({ data: { items: [] }, isPending: false, isError: false }),
    useReadContributionDraft: () => ({}),
    useSaveContributionDraft: () => ({}),
    useDeleteContributionDraft: () => ({}),
  }
}
export async function completeWizard() {
  if (screen.queryByText('Tiếp tục sang Bước 2')) {
    await fireEvent.press(screen.getByRole('button', { name: 'Hẹn hò' }))
    await fireEvent.press(screen.getByText('Tiếp tục sang Bước 2'))
    await fireEvent.press(screen.getByRole('button', { name: 'Yên tĩnh' }))
    await fireEvent.press(screen.getByText('Tiếp tục sang Bước 3'))
    await fireEvent.press(screen.getByRole('radio', { name: 'Phục vụ: 4 sao' }))
    await fireEvent.press(screen.getByRole('radio', { name: 'Không gian: 3 sao' }))
  }
}
