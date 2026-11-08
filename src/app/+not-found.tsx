import { Redirect } from 'expo-router'

export default function NotFoundRoute() {
  return <Redirect href="/(tabs)" />
}
