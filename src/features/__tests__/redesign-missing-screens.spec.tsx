import { render, screen } from '@testing-library/react-native'

import { InviteExpired } from '@/features/gogo-room/invite-expired.view'

const mockReplace = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}))

describe('InviteExpired', () => {
  it('names both ways on, and neither is a form', async () => {
    await render(<InviteExpired />)
    expect(screen.getByRole('header')).toHaveTextContent('Lời mời đã hết hạn')
    expect(screen.getByText('Về trang chủ')).toBeTruthy()
    expect(screen.getByText('Vào phòng bằng mã')).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
  })
})
