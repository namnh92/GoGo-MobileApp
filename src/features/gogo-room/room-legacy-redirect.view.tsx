import { Redirect, useLocalSearchParams } from 'expo-router'

/** Retired manage route: old deep links and restored stacks return to the lobby. */
export default function RoomLegacyRedirect() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>()
  return <Redirect href={`/room/${roomId}`} />
}
