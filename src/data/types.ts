// Mock-domain models ported from GoGo-Mockup. In the real app these live in
// the shared domain package and are Zod-validated at every untrusted boundary.

export interface SuggestedPlan {
  title: string
  budget: string
  duration: string
  area: string
  tags: string[]
  img: string
}

export interface Mood {
  emoji: string
  label: string
}

export interface SwipeCard {
  title: string
  area: string
  tags: string[]
  priceK: number
  desc: string
  img: string
  category: string
}

export interface TimelineStop {
  time: string
  emoji: string
  label: string
  name: string
  area: string
  priceK: number
  duration: string
  tags: string[]
  img: string
  optional?: boolean
}

export interface SavedPlace {
  title: string
  area: string
  priceK: number
  distanceKm: number
  category: string
  open: boolean
  tags: string[]
  score: string
  img: string
}

export interface PastDate {
  title: string
  date: string
  rating: string
  match: string
  img: string
}

export interface GroupMemberMock {
  name: string
  emoji: string
  progress: number
  goal: number
}
