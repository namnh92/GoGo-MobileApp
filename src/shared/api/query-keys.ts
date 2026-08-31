import type { PlaceSearchQuery } from './endpoints/places'

/**
 * One key factory for the whole app so invalidation stays predictable.
 * Keys are hierarchical: invalidating `room(id)` also invalidates everything
 * nested under it.
 */
export const queryKeys = {
  me: () => ['me'] as const,
  taxonomies: (kinds?: string) => ['taxonomies', kinds ?? 'all'] as const,

  rooms: () => ['rooms'] as const,
  roomList: (status?: string) => ['rooms', 'list', status ?? 'all'] as const,
  room: (roomId: string) => ['rooms', roomId] as const,
  roomMembers: (roomId: string) => ['rooms', roomId, 'members'] as const,
  roomInvites: (roomId: string) => ['rooms', roomId, 'invites'] as const,
  roomPreferences: (roomId: string) => ['rooms', roomId, 'preferences', 'me'] as const,
  roomSuggestions: (roomId: string) => ['rooms', roomId, 'suggestions'] as const,
  roomCurrentPlan: (roomId: string) => ['rooms', roomId, 'plan', 'current'] as const,

  plan: (planId: string) => ['plans', planId] as const,

  places: () => ['places'] as const,
  placeSearch: (query: PlaceSearchQuery) => ['places', 'search', query] as const,
  place: (placeId: string) => ['places', placeId] as const,
  areas: (query: string) => ['places', 'areas', query] as const,
  placeImport: (importId: string) => ['places', 'imports', importId] as const,
  placeSubmission: (id: string) => ['place-submissions', id] as const,

  saved: () => ['me', 'saved'] as const,
  myReviews: () => ['me', 'reviews'] as const,
  notifications: () => ['me', 'notifications'] as const,
  notificationPreferences: () => ['me', 'notification-preferences'] as const,
} as const
