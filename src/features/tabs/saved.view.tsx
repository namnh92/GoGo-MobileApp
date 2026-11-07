import { useAssistantFabScroll } from '@/features/assistant/assistant-entry'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAppAreaStore } from '@/shared/location/app-area'
import { discoveryLabels, isApiError, useTaxonomies, useSavedEntries, useToggleSaved, type SavedEntry } from '@/shared/api'
import { useDiscoveryScope } from '@/shared/location/use-discovery-scope'
import { useSession } from '@/shared/providers/session-provider'
import { EmptyState, ErrorState, OfflineState } from '@/shared/ui/async-state.view'
import { PlaceCard } from '@/shared/ui/place-card.view'
import { Icon } from '@/shared/ui/icons'
import { Atmosphere, Card, GhostBtn, IconBtn } from '@/shared/ui/primitives'
import { PlaceCardSkeleton } from '@/shared/ui/skeleton.view'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'

import { groupSavedByArea, type CurrentArea } from './saved-groups'
import { styles } from './saved.style'
import { HeaderNotificationButton } from '@/shared/ui/header-notification-button.view'
import { Sheet } from '@/shared/ui/sheet.view'
import { ResultSheet } from '@/shared/ui/result-sheet.view'
import { savedDistance, savedUnavailable } from './saved-facts'
import { SavedLink } from './saved-link.view'

/** Saved places grouped by city, then ward. City actions filter this list. */
export default function SavedScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { status } = useSession()
  // The float button (#379) collapses on scroll; the list's end clears it.
  const fab = useAssistantFabScroll('saved')

  const canSave = status === 'user'
  const saved = useSavedEntries({ enabled: canSave })
  const toggleSaved = useToggleSaved()
  const [feedback, setFeedback] = useState('')
  const [menu, setMenu] = useState<SavedEntry | null>(null)
  const [cityKey, setCityKey] = useState<string | null>(null)
  const [resultError, setResultError] = useState(false)
  const pendingRemoval = useRef<SavedEntry | null>(null)
  useEffect(() => { if (!feedback) return; const timer = setTimeout(() => setFeedback(''), 3500); return () => clearTimeout(timer) }, [feedback])
  const taxonomy = useTaxonomies()
  const labels = useMemo(() => discoveryLabels(taxonomy.data, i18n.language), [taxonomy.data, i18n.language])

  const { scope } = useDiscoveryScope()
  const area = useAppAreaStore(state => state.area)
  const current: CurrentArea = area ? { provinceCode: area.provinceCode, communeCode: area.communeCode } : null

  const visible = saved.entries.filter(entry => entry.type === 'place')
  const groups = groupSavedByArea(
    visible.map(entry => ({ key: entry.key, area: entry.area, value: entry })),
    current,
  )

  const selectedCity = groups.find(group => group.key === cityKey)
  const visibleGroups = selectedCity ? [selectedCity] : groups
  function unsave(entry: SavedEntry) {
    if (!canSave || toggleSaved.isPending) return
    toggleSaved.mutate({ type: entry.type, id: entry.id, saved: true }, {
      onSuccess: () => setFeedback(t('saved.feedback.removed')),
      onError: () => setResultError(true),
    })
  }
  function renderEntry(entry: SavedEntry) {
    if (entry.detailError && !(isApiError(entry.detailError) && [403, 404, 410].includes(entry.detailError.status))) {
      return <ErrorState key={entry.key} error={entry.detailError} onRetry={() => void saved.refetch()} />
    }
    if (!entry.place) {
      return (
        <Card padded={false} key={entry.key} style={styles.unavailable}>
          <View style={styles.unavailableRow}>
            <Icon name="alert" size={16} color="status.warningText" />
            <Text variant="bodySmall" color="text.secondary" style={styles.unavailableText}>{t('saved.placeUnavailable')}</Text>
          </View>
          <GhostBtn label={t('saved.remove')} onPress={() => unsave(entry)} />
        </Card>
      )
    }
    const reason = savedUnavailable(entry.place)
    const tagLabels = [...new Set(entry.place.taxonomies?.flatMap(tag => tag.kind && tag.key && labels[tag.kind]?.[tag.key] ? [labels[tag.kind]![tag.key]!] : []) ?? [])]
    const categories = entry.place.taxonomies?.filter(tag => tag.kind === 'category').map(tag => tag.key) ?? []
    const canFindSimilar = categories.length > 0 && !!entry.area.provinceCode && !!entry.area.datasetVersion
    return (
      <PlaceCard
        key={entry.key}
        place={{ ...entry.place, distanceM: savedDistance(entry.place, scope.status === 'ready' && scope.source === 'gps' ? scope.position : null), discovery: { ...entry.place.discovery, tagLabels } }}
        appearance="saved"
        photoCategoryLabel={entry.place.taxonomies?.filter(tag => tag.kind === 'category').flatMap(tag => tag.key && labels.category?.[tag.key] ? [labels.category[tag.key]!] : []).join(' · ') || undefined}
        unavailableLabel={reason ? t(`saved.unavailable.${reason}`) : undefined}
        headerAction={<IconBtn accessibilityLabel={t('saved.actions')} style={styles.cardMenu} onPress={() => setMenu(entry)}><Text>⋮</Text></IconBtn>}
        footer={reason ? <>
          <GhostBtn label={t('saved.remove')} onPress={() => unsave(entry)} />
          {canFindSimilar ? <GhostBtn label={t('saved.similar')} onPress={() => {
            router.push({ pathname: '/places/search', params: { categories: categories.join(','), suggestions: '1', suggestionScope: JSON.stringify({ status: 'ready', source: 'selected_area', area: { datasetVersion: entry.area.datasetVersion, provinceCode: entry.area.provinceCode, provinceName: entry.area.provinceName, communeCode: entry.area.communeCode, communeName: entry.area.communeName } }) } })
          }} /> : null}
        </> : undefined}
        onPress={() => router.push(`/places/${entry.id}`)}
        saved
        onToggleSave={() => unsave(entry)}
        style={styles.placeItem}
      />
    )
  }

  return (
    <Atmosphere>
      <View style={[styles.header, { paddingTop: insets.top + spacing[3] }]}>
        <View style={styles.headerRow}>
          <Text variant="title2" color="redesign.primaryText">GoGo · {t('saved.title')}</Text>
          <HeaderNotificationButton testID="saved-bell" unreadDotTestID="saved-unread" />
        </View>
        {canSave ? <SavedLink onFeedback={setFeedback} /> : null}
        {canSave && feedback ? <Text accessibilityLiveRegion="polite" testID="saved-feedback" variant="bodySmall" color="status.successText">{feedback}</Text> : null}
      </View>

      {/* Saving requires an account: a guest token gets 403 USER_ONLY. */}
      {!canSave ? (
        <EmptyState
          title={t('saved.signInTitle')}
          body={t('saved.signInBody')}
          action={<GhostBtn label={t('auth.signInCta')} onPress={() => router.push('/auth/sign-in?next=saved')} />}
        />
      ) : saved.isPaused ? <OfflineState /> : saved.isPending ? (
        <View style={[styles.grid, styles.list]}>
          {[0, 1, 2, 3].map(index => (
            <View key={index} style={styles.placeItem}>
              <PlaceCardSkeleton />
            </View>
          ))}
        </View>
      ) : saved.isError ? (
        <ErrorState error={saved.error} onRetry={() => void saved.refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={t('saved.emptyTitle')}
          body={t('saved.emptyBody')}
          action={<GhostBtn label={t('saved.browse')} onPress={() => router.push('/places/search')} />}
        />
      ) : (
        <ScrollView
          testID="saved-list"
          onScroll={fab.onScroll}
          scrollEventThrottle={fab.scrollEventThrottle}
          contentContainerStyle={[styles.list, { paddingBottom: fab.bottomInset }]}
        >
          {selectedCity ? <GhostBtn label={t('saved.allCities')} onPress={() => setCityKey(null)} style={styles.back} /> : null}
          {visibleGroups.map(group => (
            <View key={group.key} style={styles.group}>
              <View style={styles.groupHeader}>
                <Text variant="title2" accessibilityRole="header" style={styles.groupTitle}>
                  {group.kind === 'province'
                    ? group.provinceName
                    : t(group.kind === 'unknown' ? 'saved.group.unknown' : 'saved.group.multipleProvinces')}
                </Text>
                <View style={styles.countBadge}><Text variant="caption" color="text.secondary">{group.kind === 'province' ? group.communes.reduce((count, commune) => count + commune.entries.length, 0) : group.entries.length}</Text></View>
                {group.kind === 'province' && !selectedCity ? <GhostBtn label={t('saved.viewGroup')} accessibilityHint={t('saved.cityListHint', { city: group.provinceName })} style={styles.cityAction} onPress={() => setCityKey(group.key)} /> : null}
              </View>
              {group.kind === 'province' ? (
                group.communes.map(commune => (
                  <View key={commune.key} style={styles.subgroup}>
                    <View style={styles.groupHeader}>
                      <Text variant="bodySmall" color="text.secondary" accessibilityRole="header" style={styles.groupTitle}>
                        {commune.kind === 'commune' ? commune.communeName : t('saved.group.multipleCommunes')}
                      </Text>
                      <View style={styles.countBadge}><Text variant="caption" color="text.secondary">{commune.entries.length}</Text></View>
                    </View>
                    <View style={styles.grid}>{commune.entries.map(item => renderEntry(item.value))}</View>
                  </View>
                ))
              ) : (
                <View style={styles.grid}>{group.entries.map(item => renderEntry(item.value))}</View>
              )}
            </View>
          ))}
        </ScrollView>
      )}
      <Sheet visible={canSave && menu !== null} onClose={() => setMenu(null)} onClosed={() => { const entry = pendingRemoval.current; pendingRemoval.current = null; if (entry) unsave(entry) }} testID="saved-actions">
        <GhostBtn label={t('saved.remove')} disabled={toggleSaved.isPending} onPress={() => { pendingRemoval.current = menu; setMenu(null) }} />
      </Sheet>
      <ResultSheet visible={resultError} variant="error" title={t('saved.actionFailed')} body={t('saved.retryBody')}
        primaryAction={{ label: t('common.close'), onPress: () => setResultError(false) }} onClose={() => setResultError(false)} />
    </Atmosphere>
  )
}
