import { useQuery } from '@tanstack/react-query'

import {
  groupMembers,
  pastDates,
  savedPlaces,
  suggestedPlans,
  swipeCards,
  timeline,
} from '@/data/mockData'
import type {
  GroupMemberMock,
  PastDate,
  SavedPlace,
  SuggestedPlan,
  SwipeCard,
  TimelineStop,
} from '@/data/types'

// Mock data source behind the same shape the generated OpenAPI client will
// have. Screens consume TanStack Query hooks only — swapping in the real
// client later changes this file, not the features (RULE-API-001/007).
const LATENCY_MS = 350

function respond<T>(data: T): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(data), LATENCY_MS))
}

export const mockApi = {
  suggestedPlans: (): Promise<SuggestedPlan[]> => respond(suggestedPlans),
  swipeCards: (): Promise<SwipeCard[]> => respond(swipeCards),
  timeline: (): Promise<TimelineStop[]> => respond(timeline),
  savedPlaces: (): Promise<SavedPlace[]> => respond(savedPlaces),
  pastDates: (): Promise<PastDate[]> => respond(pastDates),
  groupMembers: (): Promise<GroupMemberMock[]> => respond(groupMembers),
}

export const queryKeys = {
  suggestedPlans: ['suggested-plans'] as const,
  swipeCards: ['swipe-cards'] as const,
  timeline: (planId: string) => ['timeline', planId] as const,
  savedPlaces: ['saved-places'] as const,
  pastDates: ['past-dates'] as const,
}

export function useSuggestedPlans() {
  return useQuery({ queryKey: queryKeys.suggestedPlans, queryFn: mockApi.suggestedPlans })
}

export function useSwipeCards() {
  return useQuery({ queryKey: queryKeys.swipeCards, queryFn: mockApi.swipeCards })
}

export function useTimeline(planId: string) {
  return useQuery({ queryKey: queryKeys.timeline(planId), queryFn: mockApi.timeline })
}

export function useSavedPlaces() {
  return useQuery({ queryKey: queryKeys.savedPlaces, queryFn: mockApi.savedPlaces })
}

export function usePastDates() {
  return useQuery({ queryKey: queryKeys.pastDates, queryFn: mockApi.pastDates })
}
