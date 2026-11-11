import { Redirect } from 'expo-router'

/** Compatibility for saved links to the location step removed in owner round 3. */
export default function CreateLocationRedirect() {
  return <Redirect href="/create/type" />
}
