import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
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
  // The navigator is read through a ref so it stays out of `resolve`'s deps: a
  // `useRouter()` that returns a fresh object each render would otherwise make
  // the effect re-run forever, resolving the slug on every frame.
  //
  // Synced in an effect rather than assigned during render. Writing a ref while
  // rendering is what `react-hooks/refs` forbids — a render can be thrown away
  // or replayed, and a ref written during one is a side effect that survives
  // work React decided not to keep. The reason the ref exists is unchanged.
  const routerRef = useRef(router)
  useEffect(() => {
    routerRef.current = router
  }, [router])
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const [phase, setPhase] = useState<Phase>({ kind: 'resolving' })

  // Resolving reports its outcome; it does not write state. That split is what
  // lets the caller decide whether the answer still matters — the effect below
  // drops it if the screen has gone, and a slow link that resolves after the
  // user navigated away no longer sets state on an unmounted screen.
  //
  // `null` means "nothing to show": either there was no slug, or the link
  // resolved and we navigated, and in both cases this screen is not what the
  // person is looking at.
  //
  // A missing slug is a fact about the route rather than an event, so it is
  // read at render. And the opening `setPhase({ kind: 'resolving' })` only ever
  // mattered for the retry button: on mount it wrote the value the state
  // already had — a fresh object, so React could not bail out, and every launch
  // paid one extra render for nothing. Retry sets it now, where it is a real
  // transition.
  const resolve = useCallback(async (): Promise<Phase | null> => {
    if (!slug) return null
    try {
      const link = await resolveShareLink(slug)
      // The slug itself is a credential for a room invite, so only the type goes
      // to analytics — never the slug and never the target id.
      track('deep_link_opened', { source: 'share_link', type: link.type })

      switch (link.type) {
        case 'ROOM_INVITE': {
          // The slug doubles as the invite code (LNK-BE-002), and `/r/[code]`
          // already handles both the guest and the signed-in path.
          const code = link.target?.inviteCode ?? slug
          routerRef.current.replace(`/r/${code}`)
          return null
        }
        case 'PLAN': {
          const planId = link.target?.planId
          if (!planId) break
          routerRef.current.replace(`/plans/${planId}`)
          return null
        }
        case 'PLACE': {
          const placeId = link.target?.placeId
          if (!placeId) break
          routerRef.current.replace(`/places/${placeId}`)
          return null
        }
        default:
          break
      }
      // COLLECTION and REFERRAL are reserved in the contract and no screen
      // claims them yet. Saying so is honest; silently dropping to home is not.
      return { kind: 'unsupported' }
    } catch (caught) {
      if (isApiError(caught) && (caught.status === 404 || caught.status === 410)) {
        return { kind: 'gone' }
      }
      return { kind: 'failed' }
    }
  }, [slug])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const next = await resolve()
      if (!cancelled && next) setPhase(next)
    })()
    return () => {
      cancelled = true
    }
  }, [resolve])

  // A route with no slug can only be a malformed link, and it is knowable
  // without waiting for anything.
  const kind = slug ? phase.kind : 'gone'

  if (kind === 'resolving') {
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
  }[kind]

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
          {kind === 'failed' ? (
            <PrimaryBtn
              label={t('shareLink.retry')}
              onPress={() => {
                setPhase({ kind: 'resolving' })
                void resolve().then(next => {
                  if (next) setPhase(next)
                })
              }}
            />
          ) : null}
          <SecondaryBtn label={t('shareLink.goHome')} onPress={() => router.replace('/(tabs)')} />
        </View>
      </View>
    </Atmosphere>
  )
}
