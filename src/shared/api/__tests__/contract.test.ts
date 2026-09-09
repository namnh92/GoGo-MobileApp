import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import * as meApi from '../endpoints/me'
import * as placesApi from '../endpoints/places'
import * as plansApi from '../endpoints/plans'
import * as preferencesApi from '../endpoints/preferences'
import * as roomsApi from '../endpoints/rooms'
import * as sessionsApi from '../endpoints/sessions'
import * as suggestionsApi from '../endpoints/suggestions'
import { ApiError } from '../errors'
import { clearSession, getSession, persistSession, type Session } from '../session'
import type { Plan, PlaceSearchResult, RoomSummary, SuggestionsCurrent } from '../types'

/**
 * Drives the shipped API client against a deployed GoGo-BE. This is the gate
 * that catches contract drift the generated types cannot see — state-machine
 * preconditions, authorization, token rotation, and the locked-stop invariant.
 *
 *   GOGO_CONTRACT_TEST=1 pnpm test:contract
 *
 * Runs against whatever `EXPO_PUBLIC_API_URL` names, which `.env.example` points
 * at DEV: https://api-dev.gogo.id.vn/v1. DEV is deployed — nothing here needs
 * GoGo-BE, PostgreSQL or Redis on the machine (GoGo-Infra INF-038).
 *
 * It writes. Each run signs up `host.<timestamp>@gogo.test`, creates a room and
 * leaves both behind in whatever environment it pointed at. That is fine in DEV
 * and is the reason it must never be pointed at production.
 *
 * Standing GoGo-BE up locally still works, and is the right move when the change
 * under test is a BE change: point EXPO_PUBLIC_API_URL at it and know it is a
 * different database from the one everyone else sees.
 *
 * Skipped by default so `pnpm test` stays runnable offline.
 */
const enabled = process.env.GOGO_CONTRACT_TEST === '1'

/** Resolves with whatever the promise rejected with, keeping the type honest. */
async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
    throw new Error('expected the call to reject')
  } catch (error) {
    return error
  }
}

const stamp = Date.now()
const hostEmail = `host.${stamp}@gogo.test`
const password = 'ContractTestPassword123!'

let placeIds: string[] = []
let hostCredentials: Session
let room: RoomSummary
let inviteCode: string
let guestSession: Session
let suggestions: SuggestionsCurrent
let plan: Plan

describe.skipIf(!enabled)('BFF contract', () => {
  beforeAll(async () => {
    await clearSession()
  })

  afterAll(async () => {
    await clearSession()
  })

  describe('sessions', () => {
    it('registers a user and persists a rotatable session', async () => {
      const session = await sessionsApi.register({
        email: hostEmail,
        password,
        displayName: 'Contract Host',
      })

      expect(session.kind).toBe('user')
      expect(session.accessToken).toBeTruthy()
      expect(session.refreshToken).toBeTruthy()
      expect(session.expiresAt).toBeGreaterThan(Date.now())
    })

    it('reports a user actor from /me', async () => {
      const me = await sessionsApi.getMe()
      expect(me.actorType).toBe('user')
      expect(me.id).toBeTruthy()
    })

    it('logs in with the same credentials', async () => {
      const session = await sessionsApi.login({ email: hostEmail, password })
      expect(session.kind).toBe('user')
    })
  })

  describe('reference data', () => {
    it('returns taxonomies as stable keys with locale labels', async () => {
      const taxonomies = await preferencesApi.listTaxonomies()
      expect(Object.keys(taxonomies.kinds ?? {}).length).toBeGreaterThan(0)
    })

    it('searches places server-side with distance and cursor', async () => {
      const page = await placesApi.searchPlaces({
        lat: 10.7769,
        lng: 106.7009,
        radiusM: 20_000,
        sort: 'distance',
        limit: 5,
      })

      expect(page.results.length).toBeGreaterThan(0)
      expect(page).toHaveProperty('nextCursor')
      // `sort=distance` is rejected without lat/lng, and distance is only
      // computed when an origin is supplied.
      expect(typeof (page.results[0] as PlaceSearchResult).distanceM).toBe('number')

      placeIds = page.results.map(place => place.id)
    })

    it('returns a place detail payload', async () => {
      const detail = await placesApi.getPlaceDetail(placeIds[0])
      expect(detail.id).toBe(placeIds[0])
    })

    it('autocompletes areas behind the BFF proxy', async () => {
      const areas = await placesApi.suggestAreas({
        query: 'Quan 1',
        sessionToken: `contract-${stamp}`,
      })

      expect(Array.isArray(areas.predictions)).toBe(true)
      expect(['provider', 'fallback']).toContain(areas.source)
    })
  })

  describe('rooms', () => {
    it('creates a room and leaves it joinable', async () => {
      room = await roomsApi.createAndOpenRoom({
        type: 'group',
        decisionMode: 'vote',
        participantCount: 2,
        title: 'Contract room',
        constraint: {
          budgetMode: 'per_person',
          budgetAmount: 300_000,
          currency: 'VND',
          areaKey: 'hcm_q1',
          originLat: 10.7769,
          originLng: 106.7009,
          radiusM: 15_000,
        },
        seedPlaceIds: placeIds.slice(0, 2),
      })

      expect(room.myRole).toBe('host')
      expect(room.code).toBeTruthy()
      // A room left in `draft` never auto-flips to `matching`, so the whole
      // suggestion flow would dead-end later.
      expect(room.status).toBe('collecting')
    })

    it('replays a repeated Idempotency-Key instead of creating a second room', async () => {
      const key = `contract-idem-${stamp}`
      const body = {
        type: 'couple' as const,
        decisionMode: 'match' as const,
        participantCount: 2,
        constraint: { budgetMode: 'total' as const, budgetAmount: 500_000, currency: 'VND' },
      }

      const first = await roomsApi.createRoom(body, key)
      const replay = await roomsApi.createRoom(body, key)

      expect(replay.id).toBe(first.id)
    })

    it('returns budget facts in integer minor units', async () => {
      const fetched = await roomsApi.getRoom(room.id)
      expect(fetched.participantCount).toBe(2)
      expect(fetched.constraints?.budgetMode).toBe('per_person')
      expect(fetched.constraints?.budgetAmount).toBe(300_000)
    })

    it('bumps constraintVersion on a constraint edit', async () => {
      const before = await roomsApi.getRoom(room.id)
      const updated = await roomsApi.updateRoomConstraints(room.id, {
        budgetMode: 'per_person',
        budgetAmount: 400_000,
        currency: 'VND',
        areaKey: 'hcm_q1',
        expectedConstraintVersion: before.constraintVersion,
      })

      expect(updated.constraintVersion).toBeGreaterThan(before.constraintVersion)
    })

    it('rejects a stale expectedConstraintVersion with 409', async () => {
      const error = await catchError(
        roomsApi.updateRoomConstraints(room.id, {
          budgetMode: 'per_person',
          budgetAmount: 450_000,
          currency: 'VND',
          expectedConstraintVersion: 1,
        }),
      )

      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).status).toBe(409)
    })

    it('issues an invite code exactly once', async () => {
      const invite = await roomsApi.createRoomInvite(room.id, { maxUses: 5 })
      expect(invite.code).toBeTruthy()
      inviteCode = invite.code
    })

    it('lists the host as a member', async () => {
      const members = await roomsApi.listRoomMembers(room.id)
      expect(members.some(member => member.role === 'host')).toBe(true)
    })
  })

  describe('preferences', () => {
    it('saves with optimistic concurrency', async () => {
      const current = await preferencesApi.getMyPreferences(room.id)
      const saved = await preferencesApi.saveMyPreferences(room.id, {
        selections: { mood: ['chill', 'romantic'], category: ['cafe'] },
        expectedVersion: current.version ?? 0,
      })

      expect(saved.version).toBeGreaterThan(current.version ?? 0)
    })

    it('rejects a stale expectedVersion with 409', async () => {
      const error = await catchError(
        preferencesApi.saveMyPreferences(room.id, {
          selections: { mood: ['festive'] },
          expectedVersion: 0,
        }),
      )

      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).status).toBe(409)
    })

    it('is not ready for matching while another member is pending', async () => {
      const result = await preferencesApi.completeMyPreferences(room.id)
      expect(result.roomReadyForMatching).toBe(false)
    })
  })

  describe('guest session', () => {
    it('joins by invite code with a room-scoped session', async () => {
      hostCredentials = getSession() as Session

      guestSession = await roomsApi.joinRoomAsGuest({
        inviteCode,
        displayName: 'Contract Guest',
      })

      expect(guestSession.kind).toBe('guest')
      expect(guestSession.roomId).toBe(room.id)
      expect(guestSession.guestToken).toBeTruthy()
    })

    it('reports a guest actor from /me', async () => {
      const me = await sessionsApi.getMe()
      expect(me.actorType).toBe('guest')
    })

    it('cannot create a room', async () => {
      const error = await catchError(
        roomsApi.createRoom({
          type: 'couple',
          decisionMode: 'match',
          participantCount: 2,
          constraint: { budgetMode: 'total', budgetAmount: 100_000, currency: 'VND' },
        }),
      )

      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).status).toBe(403)
    })

    it('cannot finalize votes even with a hand-made request', async () => {
      const error = await catchError(suggestionsApi.finalizeVotes(room.id, {}))

      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).status).toBe(403)
    })

    it('flips the room to matching when the last member completes', async () => {
      const current = await preferencesApi.getMyPreferences(room.id)
      await preferencesApi.saveMyPreferences(room.id, {
        selections: { mood: ['romantic'], category: ['cafe'] },
        expectedVersion: current.version ?? 0,
      })

      const result = await preferencesApi.completeMyPreferences(room.id)
      expect(result.roomReadyForMatching).toBe(true)

      const updated = await roomsApi.getRoom(room.id)
      expect(updated.status).toBe('matching')
    })

    it('renews access from the guestToken', async () => {
      await persistSession({ ...guestSession, expiresAt: Date.now() - 1_000 })

      const me = await sessionsApi.getMe()
      expect(me.actorType).toBe('guest')

      const after = getSession() as Session
      expect(after.expiresAt).toBeGreaterThan(Date.now())
      expect(after.guestToken).toBe(guestSession.guestToken)
    })
  })

  describe('suggestions and votes', () => {
    beforeAll(async () => {
      await persistSession(hostCredentials)
    })

    it('leaves an already-matching room untouched', async () => {
      const before = await roomsApi.getRoom(room.id)
      // `matching` has no self-loop in the state machine — re-transitioning 409s.
      const after = await roomsApi.ensureRoomMatching(before)
      expect(after.status).toBe('matching')
    })

    it('runs the deterministic pipeline and records its versions', async () => {
      suggestions = await suggestionsApi.generateSuggestions(room.id)

      expect(suggestions.candidates?.length).toBeGreaterThan(0)
      expect(suggestions.run?.id).toBeTruthy()
      // Audit trail for A/B and reproducibility (RULE-AI-006).
      expect(suggestions.run?.engineVersion).toBeTruthy()
    })

    it('accepts a repeated vote idempotently', async () => {
      const placeId = suggestions.candidates?.[0]?.placeId as string

      const first = await suggestionsApi.castVote(room.id, placeId, 'star')
      const again = await suggestionsApi.castVote(room.id, placeId, 'star')

      expect(first.voted).toBe(true)
      expect(again.voted).toBe(true)
    })

    it('reflects my vote and the tally', async () => {
      const placeId = suggestions.candidates?.[0]?.placeId as string
      const current = await suggestionsApi.getCurrentSuggestions(room.id)

      expect(current.votes?.mine?.[placeId]).toBe('star')
      expect(current.votes?.progress?.find(entry => entry.placeId === placeId)?.star).toBe(1)
    })

    it('finalizes into plan v1', async () => {
      const result = await suggestionsApi.finalizeVotes(room.id, {})

      expect(result.finalized).toBe(true)
      expect(result.planId).toBeTruthy()

      plan = await plansApi.getPlan(result.planId as string)
    })
  })

  describe('plans', () => {
    it('returns stops and computed totals', () => {
      expect(plan.stops?.length).toBeGreaterThan(0)
      expect(typeof plan.totals?.overBudget).toBe('boolean')
    })

    it('exposes the same plan as the room current plan', async () => {
      const current = await plansApi.getCurrentPlan(room.id)
      expect(current.id).toBe(plan.id)
    })

    it('locks a stop', async () => {
      const stopId = plan.stops?.[0]?.id as string
      const updated = await plansApi.lockPlanStop(plan.id as string, stopId, true)

      expect(updated.stops?.find(stop => stop.id === stopId)?.isLocked).toBe(true)
    })

    it('preserves the locked stop across regenerate (RULE-CORE-007)', async () => {
      const lockedPlaceId = plan.stops?.[0]?.placeId
      const regenerated = await plansApi.regeneratePlan(plan.id as string, {})

      const survivor = regenerated.stops?.find(stop => stop.placeId === lockedPlaceId)
      expect(survivor).toBeDefined()
      expect(survivor?.isLocked).toBe(true)
    })
  })

  describe('me', () => {
    it('saves and unsaves a place', async () => {
      await meApi.saveItem('place', placeIds[0])
      const saved = await meApi.listSaved()
      expect(saved.some(item => item.targetId === placeIds[0])).toBe(true)

      await meApi.unsaveItem('place', placeIds[0])
      const after = await meApi.listSaved()
      expect(after.some(item => item.targetId === placeIds[0])).toBe(false)
    })

    it('creates a review as pending moderation', async () => {
      const review = await meApi.createReview({
        placeId: placeIds[0],
        rating: 5,
        text: 'Contract review',
      })

      expect(review.status).toBe('pending')
    })

    it('returns a cursor-shaped notification inbox', async () => {
      const inbox = await meApi.listNotifications()
      expect(Array.isArray(inbox.notifications)).toBe(true)
      expect(inbox).toHaveProperty('nextCursor')
    })

    it('refuses a push subscription the provider does not confirm', async () => {
      // #171 / GoGo-BE#515. This account exists only for this run and has never
      // bound a OneSignal identity, so the server must not take its word for it.
      //
      // The old version of this test called `PUT /me/device-tokens` and asserted
      // it resolved — which is how three throwaway accounts became the entire
      // audience of every DEV campaign. A registration that a real subscription
      // cannot back has to be refused, and asserting the refusal is what keeps
      // this suite from manufacturing recipients again.
      const error = (await catchError(
        meApi.registerPushSubscription({
          platform: 'ios',
          subscriptionId: `contract-${stamp}`,
        }),
      )) as ApiError

      expect(error).toBeInstanceOf(ApiError)
      expect(['PUSH_SUBSCRIPTION_NOT_CONFIRMED', 'PUSH_SUBSCRIPTION_UNVERIFIED']).toContain(
        error.code,
      )
    })
  })

  describe('token lifecycle', () => {
    it('refreshes an expired access token transparently', async () => {
      const before = getSession() as Session
      await persistSession({ ...before, expiresAt: Date.now() - 1_000 })

      const me = await sessionsApi.getMe()
      expect(me.actorType).toBe('user')

      const renewed = getSession() as Session
      expect(renewed.accessToken).not.toBe(before.accessToken)
      expect(renewed.refreshToken).not.toBe(before.refreshToken)
    })

    it('serialises concurrent refreshes into one rotation', async () => {
      const before = getSession() as Session
      await persistSession({ ...before, expiresAt: Date.now() - 1_000 })

      // Replaying a single-use refresh token in parallel revokes the whole
      // session family, so all three calls must share one in-flight refresh.
      const results = await Promise.all([
        sessionsApi.getMe(),
        sessionsApi.getMe(),
        sessionsApi.getMe(),
      ])

      expect(results.every(me => me.actorType === 'user')).toBe(true)
    })

    it('revokes the session server-side on logout', async () => {
      const before = getSession() as Session
      await sessionsApi.logout()
      expect(getSession()).toBeNull()

      // Restoring revoked credentials must not grant access again.
      await persistSession(before)
      const error = await sessionsApi.getMe().catch(e => e)

      expect(error).toBeInstanceOf(ApiError)
      expect(error.status).toBe(401)
      expect(getSession()).toBeNull()
    })
  })
})
