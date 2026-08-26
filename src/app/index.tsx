import { Redirect } from 'expo-router'

// Splash is handled by expo-splash-screen; first route decides the entry.
// Session-aware routing (guest/user) arrives with APP-002.
export default function Index() {
  return <Redirect href="/onboarding" />
}
