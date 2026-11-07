import { useAssistantFabScroll } from '@/features/assistant/assistant-entry'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAppAreaStore } from '@/shared/location/app-area'
import { useSavedEntries, useToggleSaved, type SavedEntry } from '@/shared/api'
import { useSession } from '@/shared/providers/session-provider'
import { EmptyState, ErrorState } from '@/shared/ui/async-state.view'
import { PlaceCard } from '@/shared/ui/place-card.view'
import { Icon } from '@/shared/ui/icons'
import { Atmosphere, Card, Chip, GhostBtn, IconBtn } from '@/shared/ui/primitives'
import { PlaceCardSkeleton } from '@/shared/ui/skeleton.view'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'

import { groupSavedByArea, type CurrentArea } from './saved-groups'
import { SavedPlanCard } from './saved-plan-card.view'
import { styles } from './saved.style'

type SavedFilter = 'all' | 'places' | 'plans'

const FILTERS: readonly SavedFilter[] = ['all', 'places', 'plans']

/**
 * ADM-205 (#214) — Saved places and plans, grouped by province and commune.
 * No map: the list is the one view, and the user's own area comes first.
 */
export default function SavedScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { status } = useSession()
  // The float button (#379) collapses on scroll; the list's end clears it.
  const fab = useAssistantFabScroll('saved')

  const canSave = status === 'user'
  const saved = useSavedEntries({ enabled: canSave })
  const toggleSaved = useToggleSaved()
  const [filter, setFilter] = useState<SavedFilter>('all')

  const area = useAppAreaStore(state => state.area)
  const current: CurrentArea = area ? { provinceCode: area.provinceCode, communeCode: area.communeCode } : null

  const visible = saved.entries.filter(
    entry => filter === 'all' || entry.type === (filter === 'places' ? 'place' : 'plan'),
  )
  const groups = groupSavedByArea(
    visible.map(entry => ({ key: entry.key, area: entry.area, value: entry })),
    current,
  )

  function unsave(entry: SavedEntry) {
    // Everything in this list is already saved, so the only action is removal.
    toggleSaved.mutate({ type: entry.type, id: entry.id, saved: true })
  }

  function renderEntry(entry: SavedEntry) {
    if (entry.type === 'plan') {
      return (
        <SavedPlanCard
          key={entry.key}
          plan={entry.plan}
          onOpen={() => router.push(`/plans/${entry.id}`)}
          onRemove={() => unsave(entry)}
        />
      )
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
    return (
      <PlaceCard
        key={entry.key}
        place={entry.place}
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
          <Text variant="title1">{t('saved.title')}</Text>
          <IconBtn
            onPress={() => router.push('/places/import')}
            accessibilityLabel={t('saved.addPlace')}
            style={styles.addPlaceBtn}
          >
            <Icon name="plus" size={20} color="accent.primary" />
          </IconBtn>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map(option => (
            <Chip
              key={option}
              label={t(`saved.filter.${option}`)}
              variant={filter === option ? 'selected' : 'default'}
              onPress={() => setFilter(option)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Saving requires an account: a guest token gets 403 USER_ONLY. */}
      {!canSave ? (
        <EmptyState
          title={t('saved.signInTitle')}
          body={t('saved.signInBody')}
          action={<GhostBtn label={t('auth.signInCta')} onPress={() => router.push('/auth/sign-in?next=saved')} />}
        />
      ) : saved.isPending ? (
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
          {groups.map(group => (
            <View key={group.key} style={styles.group}>
              <View style={styles.groupHeader}>
                <View style={styles.groupDot} />
                <Text variant="title2" accessibilityRole="header">
                  {group.kind === 'province'
                    ? group.provinceName
                    : t(group.kind === 'unknown' ? 'saved.group.unknown' : 'saved.group.multipleProvinces')}
                </Text>
                {group.kind === 'province' && group.isCurrent ? (
                  <Chip label={t('saved.currentArea')} variant="info" />
                ) : null}
              </View>
              {group.kind === 'province' ? (
                group.communes.map(commune => (
                  <View key={commune.key} style={styles.subgroup}>
                    <View style={styles.groupHeader}>
                      <Text variant="label" accessibilityRole="header">
                        {commune.kind === 'commune' ? commune.communeName : t('saved.group.multipleCommunes')}
                      </Text>
                      {commune.isCurrent ? <Chip label={t('saved.currentArea')} variant="info" /> : null}
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
    </Atmosphere>
  )
}
