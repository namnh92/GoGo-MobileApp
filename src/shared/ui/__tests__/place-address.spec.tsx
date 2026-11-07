import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react-native'
import { PlaceAddressText } from '../place-address.view'

const areaSummary = { label: 'Phường Hoàn Kiếm', communeCode: '00001', provinceCode: '01' }

it('formats short ward and province names from cached facts in every text instance, with identical a11y labels', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  client.setQueryData(['administrative', 'version'], { datasetVersion: '2026-11' })
  client.setQueryData(['administrative', '2026-11', 'provinces'], [{ code: '01', fullName: 'Thành phố Hà Nội', nameEn: 'Hanoi' }])
  const fetch = jest.spyOn(globalThis, 'fetch')
  try {
    const place = { addressText: '24 P. Đường Thành, Phố cổ Hà Nội, Hoàn Kiếm, Hà Nội 100000', areaSummary }
    const view = await render(<QueryClientProvider client={client}>
      <PlaceAddressText place={place} variant="body" />
      <PlaceAddressText place={place} variant="caption" numberOfLines={1} />
    </QueryClientProvider>)
    const expected = '24 P. Đường Thành, Hoàn Kiếm, Hà Nội'
    expect(screen.getAllByText(expected)).toHaveLength(2)
    expect(screen.getAllByLabelText(expected)).toHaveLength(2)
    expect(fetch).not.toHaveBeenCalled()
    await view.unmount()
  } finally {
    fetch.mockRestore()
    client.clear()
  }
})

it('keeps an address as-is without verified administrative facts', async () => {
  await render(<PlaceAddressText place={{ addressText: '  43 Tràng Tiền  ' }} />)
  expect(screen.getByLabelText('  43 Tràng Tiền  ')).toHaveTextContent('43 Tràng Tiền', { exact: true })
})

it('omits text with no address facts', async () => {
  await render(<PlaceAddressText testID="address" place={{}} />)
  expect(screen.queryByTestId('address')).toBeNull()
})
