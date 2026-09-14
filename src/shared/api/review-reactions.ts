import type { MyReviewReactions, PlaceReviewPreview, ReviewReactionState } from './types'

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

export function withHelpfulDelta(
  preview: PlaceReviewPreview | undefined,
  reviewId: string,
  delta: -1 | 0 | 1,
): PlaceReviewPreview | undefined {
  if (!preview || delta === 0) return preview
  return {
    ...preview,
    reviews: preview.reviews.map(review =>
      review.id === reviewId ? { ...review, helpfulCount: Math.max(0, review.helpfulCount + delta) } : review,
    ),
  }
}

/** The server's answer is the truth; it replaces whatever was guessed. */
export function withServerState(
  preview: PlaceReviewPreview | undefined,
  state: ReviewReactionState,
): PlaceReviewPreview | undefined {
  if (!preview) return preview
  return {
    ...preview,
    reviews: preview.reviews.map(review =>
      review.id === state.reviewId ? { ...review, helpfulCount: state.helpfulCount } : review,
    ),
  }
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
  return Boolean(
    preview &&
      preview.order === 'helpful' &&
      preview.reviews.length > 0 &&
      preview.reviews.every(review => review.helpfulCount === 0),
  )
}
