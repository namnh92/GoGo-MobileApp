import { Stack, usePathname } from 'expo-router'
import { renderRouter } from 'expo-router/testing-library'
import { screen, waitFor } from '@testing-library/react-native'
import { Text } from 'react-native'
import RoomLegacyRedirect from '@/app/room/[roomId]/manage'

jest.mock('expo-router/build/testing-library/expect', () => ({}))
const roomId = '311f5bd8-f853-4ced-af68-e04398d1451a'
function Lobby() { return <Text testID="restored-lobby">{usePathname()}</Text> }
it('redirects an old manage navigation entry to the lobby', async () => {
  await renderRouter({
    _layout: () => <Stack screenOptions={{ headerShown: false }} />,
    'room/[roomId]/index': Lobby,
    'room/[roomId]/manage': RoomLegacyRedirect,
  }, { initialUrl: `/room/${roomId}/manage` })
  await waitFor(() => expect(screen.getByTestId('restored-lobby')).toHaveTextContent(`/room/${roomId}`))
})
