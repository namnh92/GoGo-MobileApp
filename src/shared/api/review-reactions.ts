import type { InfiniteData } from '@tanstack/react-query'
import type { MyReviewReactions, PlaceReviewPreview, ReviewReactionState } from './types'

export type ReviewCache = PlaceReviewPreview | InfiniteData<PlaceReviewPreview>

function mapCache<T extends ReviewCache>(cache: T, update: (page: PlaceReviewPreview) => PlaceReviewPreview): T {
  return ('pages' in cache ? { ...cache, pages: cache.pages.map(update) } : update(cache)) as T
}

/**
 * APP-060 (#219) — cache arithmetic for the optimistic helpful toggle. Kept
 * free of React so the rules that stop a double count can be tested alone.
 */

export function isMarkedHelpful(mine: MyReviewReactions | undefined, reviewId: string): boolean {
  return Boolean(mine?.helpful.includes(reviewId))
}

/**
 * What a tap changes: +1, -1, or nothing when the review is already in the
 * requested state — the tap that slipped through twice must not count twice.
 */
export function helpfulDelta(mine: MyReviewReactions | undefined, reviewId: string, helpful: boolean): -1 | 0 | 1 {
  if (isMarkedHelpful(mine, reviewId) === helpful) return 0
  return helpful ? 1 : -1
}

export function withHelpfulDelta<T extends ReviewCache>(
  preview: T | undefined,
  reviewId: string,
  delta: -1 | 0 | 1,
): T | undefined {
  if (!preview || delta === 0) return preview
  return mapCache(preview, page => ({
    ...page,
    reviews: page.reviews.map(review => review.id === reviewId
      ? { ...review, helpfulCount: Math.max(0, review.helpfulCount + delta) } : review),
    ...(page.items ? { items: page.items.map(review => review.id === reviewId
      ? { ...review, helpfulCount: Math.max(0, review.helpfulCount + delta) } : review) } : {}),
  }))
}

/** The server's answer replaces the guess in every loaded page and order. */
export function withServerState<T extends ReviewCache>(preview: T | undefined, state: ReviewReactionState): T | undefined {
  if (!preview) return preview
  return mapCache(preview, page => ({
    ...page,
    reviews: page.reviews.map(review => review.id === state.reviewId ? { ...review, helpfulCount: state.helpfulCount } : review),
    ...(page.items ? { items: page.items.map(review => review.id === state.reviewId
      ? { ...review, helpfulCount: state.helpfulCount } : review) } : {}),
  }))
}

export function withMyMark(
  mine: MyReviewReactions | undefined,
  placeId: string,
  reviewId: string,
  helpful: boolean,
): MyReviewReactions {
  const others = (mine?.helpful ?? []).filter(id => id !== reviewId)
  return { placeId, helpful: helpful ? [reviewId, ...others] : others }
}

/** `helpful` with no marks anywhere is the server's newest-first fallback. */
export function isHelpfulFallback(preview: PlaceReviewPreview | undefined): boolean {
  const rows = preview?.items ?? preview?.reviews ?? []
  return Boolean(
    preview &&
      preview.order === 'helpful' &&
      rows.length > 0 &&
      rows.every(review => review.helpfulCount === 0),
  )
}
