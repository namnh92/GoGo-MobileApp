import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Text, View } from 'react-native'

import { isApiError } from '@/shared/api'
import { resolveShareLink } from '@/shared/api/endpoints/share-links'
import { track } from '@/shared/analytics'
import { Atmosphere, GlassCard, PrimaryBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { colors } from '@/shared/ui/tokens'

import { styles } from './share-link.style'

const { brand } = colors

/**
 * The landing screen for a canonical share link (`https://<host>/l/{slug}`).
 *
 * The link claim is made in two places outside this file — the AASA/assetlinks
 * documents baked into the share-link Worker, and `associatedDomains` in
 * `app.config.ts` — so the app *promises* to handle `/l/*`. Before this screen
 * existed it did not, and a real click landed on expo-router's developer
 * "Unmatched Route" page (GoGo-MobileApp#139).
 *
 * A slug names a target but does not authorise anything: the BFF answers type
 * and id, and the destination screen does its own authorisation. So this screen
 * resolves, then replaces itself — it never stays in the back stack, because
 * "back" from a room should leave the room, not return to a redirector.
 */
type Phase =
  | { kind: 'resolving' }
  /** 404/410 — the link is dead, and saying which is not useful to the person. */
  | { kind: 'gone' }
  /** Network or 5xx: the link may well be fine, so offer a retry. */
  | { kind: 'failed' }
  /** A type this build does not know (a newer link from a newer app). */
  | { kind: 'unsupported' }

export default function ShareLinkScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { slug } = useLocalSearchParams<{ slug: string }>()

  /**
   * Server state belongs to TanStack Query (CLAUDE.md), and this screen used to
   * hand-roll the fetch in a `useEffect` with a `useState` phase machine and a
   * router held in a ref to keep the effect from re-running forever. That shape
   * is what `react-hooks/set-state-in-effect` and `react-hooks/refs` were both
   * objecting to, and the objections were right: a ref written during render is
   * unsafe under concurrent rendering, and setting state synchronously from an
   * effect cascades a render before the effect has settled.
   *
   * The query owns resolving, retrying and caching. What is left below is the
   * one thing that genuinely is a side effect: navigating away once the answer
   * arrives.
   */
  const query = useQuery({
    queryKey: ['share-link', slug],
    queryFn: () => resolveShareLink(slug!),
    enabled: Boolean(slug),
    // A dead link stays dead; retrying 404/410 only delays telling the person.
    retry: (count, error) => !(isApiError(error) && (error.status === 404 || error.status === 410)) && count < 2,
    staleTime: 0,
    gcTime: 0,
  })

  const link = query.data

  useEffect(() => {
    if (!link) return
    // The slug itself is a credential for a room invite, so only the type goes
    // to analytics — never the slug and never the target id.
    track('deep_link_opened', { source: 'share_link', type: link.type })

    switch (link.type) {
      case 'ROOM_INVITE':
        // The slug doubles as the invite code (LNK-BE-002), and `/r/[code]`
        // already handles both the guest and the signed-in path.
        router.replace(`/r/${link.target?.inviteCode ?? slug}`)
        return
      case 'PLAN':
        if (link.target?.planId) router.replace(`/plans/${link.target.planId}`)
        return
      case 'PLACE':
        if (link.target?.placeId) router.replace(`/places/${link.target.placeId}`)
        return
      default:
        // COLLECTION and REFERRAL are reserved in the contract and no screen
        // claims them yet. Saying so is honest; silently dropping to home is not.
        return
    }
  }, [link, router, slug])

  /**
   * Derived, not stored. A route with no slug, a dead link and a network
   * failure are all facts about this render, so none of them needs a state
   * transition to describe it.
   */
  const shown: Phase = !slug
    ? { kind: 'gone' }
    : query.isPending
      ? { kind: 'resolving' }
      : query.isError
        ? isApiError(query.error) && (query.error.status === 404 || query.error.status === 410)
          ? { kind: 'gone' }
          : { kind: 'failed' }
        : link && !['ROOM_INVITE', 'PLAN', 'PLACE'].includes(link.type)
          ? { kind: 'unsupported' }
          : { kind: 'resolving' }

  if (shown.kind === 'resolving') {
    return (
      <Atmosphere>
        <View style={styles.centre}>
          <ActivityIndicator color={brand.coral} accessibilityLabel={t('shareLink.resolving')} />
          <Text style={styles.hint}>{t('shareLink.resolving')}</Text>
        </View>
      </Atmosphere>
    )
  }

  const copy = {
    gone: { emoji: '🔗', title: t('shareLink.goneTitle'), body: t('shareLink.goneBody') },
    failed: { emoji: '📡', title: t('shareLink.failedTitle'), body: t('shareLink.failedBody') },
    unsupported: {
      emoji: '🆕',
      title: t('shareLink.unsupportedTitle'),
      body: t('shareLink.unsupportedBody'),
    },
  }[shown.kind]

  return (
    <Atmosphere>
      <View style={styles.centre}>
        <GlassCard style={styles.card}>
          <Text style={styles.emoji}>{copy.emoji}</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {copy.title}
          </Text>
          <Text accessibilityLiveRegion="polite" style={styles.body}>
            {copy.body}
          </Text>
        </GlassCard>

        <View style={styles.actions}>
          {shown.kind === 'failed' ? (
            <PrimaryBtn label={t('shareLink.retry')} onPress={() => void query.refetch()} />
          ) : null}
          <SecondaryBtn label={t('shareLink.goHome')} onPress={() => router.replace('/(tabs)')} />
        </View>
      </View>
    </Atmosphere>
  )
}
