import { useQuery } from '@tanstack/react-query'

import {
  catalogPlaces,
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

export type PlaceImportRejectReason = 'NOT_FOUND' | 'INSUFFICIENT_REVIEWS' | 'LOW_RATING' | 'OUT_OF_AREA'

export interface PlaceImportResult {
  status: 'verified' | 'rejected'
  reasonCode?: PlaceImportRejectReason
  place?: {
    name: string
    address: string
    area: string
    rating: number
    reviewCount: number
    img: string
  }
}

// Mock of the BE verification pipeline (SRS §8.9 / BE-BFF-013): resolves the
// Google Maps link, checks existence + acceptance gates, returns normalized
// provider data. Demo: URLs containing 'fail' are rejected for review count.
function verifyPlaceImport(url: string): Promise<PlaceImportResult> {
  const rejected = url.includes('fail')
  const result: PlaceImportResult = rejected
    ? { status: 'rejected', reasonCode: 'INSUFFICIENT_REVIEWS' }
    : {
        status: 'verified',
        place: {
          name: 'Bánh Mì 362',
          address: '362 Võ Văn Kiệt, Q1, TP.HCM',
          area: 'Q1',
          rating: 4.6,
          reviewCount: 1284,
          img: 'photo-1748591633516-94b4b80cdc6a',
        },
      }
  return new Promise(resolve => setTimeout(() => resolve(result), 1500))
}

export const mockApi = {
  verifyPlaceImport,
  suggestedPlans: (): Promise<SuggestedPlan[]> => respond(suggestedPlans),
  swipeCards: (): Promise<SwipeCard[]> => respond(swipeCards),
  timeline: (): Promise<TimelineStop[]> => respond(timeline),
  savedPlaces: (): Promise<SavedPlace[]> => respond(savedPlaces),
  catalogPlaces: (): Promise<SavedPlace[]> => respond(catalogPlaces),
  pastDates: (): Promise<PastDate[]> => respond(pastDates),
  groupMembers: (): Promise<GroupMemberMock[]> => respond(groupMembers),
}

export const queryKeys = {
  suggestedPlans: ['suggested-plans'] as const,
  swipeCards: ['swipe-cards'] as const,
  timeline: (planId: string) => ['timeline', planId] as const,
  savedPlaces: ['saved-places'] as const,
  catalogPlaces: ['catalog-places'] as const,
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

export function useCatalogPlaces() {
  return useQuery({ queryKey: queryKeys.catalogPlaces, queryFn: mockApi.catalogPlaces })
}

export function usePastDates() {
  return useQuery({ queryKey: queryKeys.pastDates, queryFn: mockApi.pastDates })
}
