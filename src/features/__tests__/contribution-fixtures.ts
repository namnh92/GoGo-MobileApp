import { fireEvent, screen } from '@testing-library/react-native'

/** Contract-shaped reference data, only for tests; labels are supplied by the API. */
export const contributionTaxonomies = {
  kinds: {
    suitability: [
      { key: 'couple', labels: { vi: 'Cặp đôi', en: 'Couple' } },
      {
        key: 'work_reading',
        labels: { vi: 'Làm việc / đọc sách', en: 'Work / reading' },
      },
      { key: 'group', labels: { vi: 'Nhóm bạn', en: 'Group' } },
      { key: 'family', labels: { vi: 'Gia đình', en: 'Family' } },
    ],
    mood: [
      { key: 'festive', labels: { vi: 'Sôi động', en: 'Festive' } },
      { key: 'chill', labels: { vi: 'Thư giãn', en: 'Chill' } },
    ],
    amenity: [
      { key: 'car_parking', labels: { vi: 'Đỗ ô tô', en: 'Car parking' } },
      {
        key: 'pets_allowed',
        labels: { vi: 'Cho phép thú cưng', en: 'Pets allowed' },
      },
      { key: 'wifi', labels: { vi: 'Wi-Fi', en: 'Wi-Fi' } },
    ],
    checkin_tag: [{ key: 'quiet', labels: { vi: 'Yên tĩnh', en: 'Quiet' } }],
  },
}

export function contributionHooks() {
  return {
    listContributionDrafts: async () => ({ items: [] }),
    useContributionCredits: () => ({}),
    useTaxonomies: () => ({
      data: contributionTaxonomies,
      isPending: false,
      isError: false,
    }),
    useContributionDrafts: () => ({
      data: { items: [] },
      isPending: false,
      isError: false,
    }),
    useReadContributionDraft: () => ({}),
    useSaveContributionDraft: () => ({}),
    useDeleteContributionDraft: () => ({}),
  }
}
export async function completeWizard() {
  if (screen.queryByText('Tiếp tục')) {
    await fireEvent.press(screen.getByRole('button', { name: 'Cặp đôi' }))
    await fireEvent.press(screen.getByText('Tiếp tục'))
    await fireEvent.press(screen.getByRole('button', { name: 'Sôi động' }))
    await fireEvent.press(screen.getByText('Tiếp tục'))
  }
}
