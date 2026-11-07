import { Redirect, useLocalSearchParams, type Href } from 'expo-router'

/** Keep existing links usable while reviews live and paginate in Place Detail. */
export default function PlaceReviewsPage() {
  const { placeId } = useLocalSearchParams<{ placeId: string }>()
  return <Redirect href={`/places/${placeId}?section=reviews` as Href} />
}
