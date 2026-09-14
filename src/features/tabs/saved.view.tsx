import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useLocatedArea } from '@/shared/administrative/queries'
import { useMe, useSavedEntries, useToggleSaved, type SavedEntry } from '@/shared/api'
import { useDiscoveryScope } from '@/shared/location/use-discovery-scope'
import { useSession } from '@/shared/providers/session-provider'
import { EmptyState, ErrorState } from '@/shared/ui/async-state.view'
import { PlaceCard } from '@/shared/ui/place-card.view'
import { Atmosphere, Chip, GhostBtn, GlassCard, IconBtn, useTabDockInset } from '@/shared/ui/primitives'
import { PlaceGridSkeleton } from '@/shared/ui/skeleton.view'
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
  const dockInset = useTabDockInset()

  const canSave = status === 'user'
  const saved = useSavedEntries({ enabled: canSave })
  const toggleSaved = useToggleSaved()
  const [filter, setFilter] = useState<SavedFilter>('all')

  // The same source order as Home (ADM-204): the commune of a fresh position
  // when the server can place it, otherwise the account area.
  const me = useMe({ enabled: canSave })
  const profileArea = canSave ? me.data?.homeAdministrativeArea : null
  const { scope } = useDiscoveryScope({
    profileArea,
    profilePending: status === 'hydrating' || (canSave && me.isPending),
  })
  const located = useLocatedArea(scope.status === 'ready' && scope.source === 'gps' ? scope.position : null)
  const current: CurrentArea = useMemo(() => {
    const here = located.data?.area
    if (here && here.scope !== 'unknown' && here.provinceCode) {
      return { provinceCode: here.provinceCode, communeCode: here.communeCode ?? null }
    }
    if (profileArea?.status === 'current') {
      return { provinceCode: profileArea.provinceCode, communeCode: profileArea.communeCode ?? null }
    }
    return null
  }, [located.data, profileArea])

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
        <GlassCard key={entry.key} style={styles.unavailable}>
          <Text style={styles.unavailableLabel}>{t('saved.placeUnavailable')}</Text>
          <GhostBtn label={t('saved.remove')} onPress={() => unsave(entry)} />
        </GlassCard>
      )
    }
    return (
      <PlaceCard
        key={entry.key}
        place={entry.place}
        variant="grid"
        onPress={() => router.push(`/places/${entry.id}`)}
        saved
        onToggleSave={() => unsave(entry)}
        style={styles.gridItem}
      />
    )
  }

  return (
    <Atmosphere>
      <View style={[styles.header, { paddingTop: insets.top + spacing[3] }]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t('saved.title')}</Text>
          <IconBtn
            onPress={() => router.push('/places/import')}
            accessibilityLabel={t('saved.addPlace')}
            style={styles.addPlaceBtn}
          >
            <Text style={styles.addPlaceLabel}>＋</Text>
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
            <View key={index} style={styles.gridItem}>
              <PlaceGridSkeleton />
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
        <ScrollView contentContainerStyle={[styles.list, { paddingBottom: dockInset }]}>
          {groups.map(group => (
            <View key={group.key} style={styles.group}>
              <View style={styles.groupHeader}>
                <Text accessibilityRole="header" style={styles.groupTitle}>
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
                      <Text accessibilityRole="header" style={styles.subgroupTitle}>
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
