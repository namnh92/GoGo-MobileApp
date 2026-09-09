// Typed analytics stub ported from the mockup. Events mirror the GoGo core
// event catalog (snake_case). Swap the transport when a real SDK lands.
export type AnalyticsEvent =
  | 'auth_signed_in'
  | 'auth_registered'
  | 'auth_signed_out'
  | 'date_create_started'
  | 'date_context_completed'
  | 'gogo_room_created'
  | 'gogo_invite_shared'
  | 'gogo_partner_joined'
  | 'preference_completed'
  | 'swipe_like'
  | 'swipe_dislike'
  | 'match_generated'
  | 'room_type_selected'
  | 'gogo_invite_copied'
  | 'group_min_participants_reached'
  | 'recommendation_refinement_selected'
  | 'date_plan_viewed'
  | 'date_plan_accepted'
  | 'date_started'
  | 'stop_completed'
  | 'stop_checkin_saved'
  | 'date_completed'
  | 'review_submitted'
  | 'place_search_opened'
  | 'place_saved'
  | 'place_import_submitted'
  | 'place_import_verified'
  | 'place_import_rejected'
  | 'place_import_added'
  | 'deep_link_opened'
  | 'profile_avatar_set'
  | 'profile_avatar_removed'
  | 'profile_defaults_saved'

export type AnalyticsProps = Record<string, string | number | boolean>

export function track(event: AnalyticsEvent, properties?: AnalyticsProps): void {
  console.debug('[analytics]', event, properties ?? {})
}
