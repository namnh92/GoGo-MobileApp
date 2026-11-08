import { AppHeader } from '@/shared/ui/app-header.view'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FlatList, Pressable, View } from 'react-native'
import { useWaitingForNetwork } from '@/shared/api/queries/use-online-status'
import { EmptyState, ErrorState, LoadingState, OfflineState, StaleNotice } from '@/shared/ui/async-state.view'
import { GhostBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { SearchField } from '@/shared/ui/search-field.view'
import { Sheet } from '@/shared/ui/sheet.view'
import { Text } from '@/shared/ui/text'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { useAdministrativeUnits, useAdministrativeVersion } from './queries'
import { foldName, type AdministrativeSelection, type AdministrativeUnit } from './snapshot'
import { styles } from './administrative-picker.style'

export function AdministrativePicker({ value, onChange, embedded = false, onChoosingChange, onValidityChange }: {
  /** Reuse the enclosing area sheet instead of stacking native modals. */
  embedded?: boolean
  onChoosingChange?: (choosing: boolean) => void
  onValidityChange?: (valid: boolean) => void
  value: AdministrativeSelection | null
  onChange: (value: AdministrativeSelection | null) => void
}) {
  const { t } = useTranslation()
  const version = useAdministrativeVersion()
  const datasetVersion = version.data?.datasetVersion
  const [level, setLevel] = useState<'province' | 'commune' | null>(null)
  const [search, setSearch] = useState('')
  const provinces = useAdministrativeUnits(datasetVersion)
  const communes = useAdministrativeUnits(value?.provinceCode ? datasetVersion : undefined, value?.provinceCode)
  const units = level === 'commune' ? communes : provinces
  // Offline with nothing cached, both queries stay pending + paused: without
  // this the picker spins "Đang tải…" forever (GoGo-MobileApp#148).
  const versionWaiting = useWaitingForNetwork(version)
  const unitsWaiting = useWaitingForNetwork(units)
  const changed = Boolean(value && datasetVersion && value.datasetVersion !== datasetVersion)
  useEffect(() => { onValidityChange?.(Boolean(value && datasetVersion && !changed)) }, [value, datasetVersion, changed, onValidityChange])
  useEffect(() => { onChoosingChange?.(level !== null) }, [level, onChoosingChange])
  const filtered = (units.data ?? []).filter(unit => foldName(unit.fullName).includes(foldName(search)))
  function open(next: 'province' | 'commune') { setSearch(''); setLevel(next) }
  function select(unit: AdministrativeUnit) {
    if (!datasetVersion) return
    if (level === 'province') onChange({ datasetVersion, provinceCode: unit.code, provinceName: unit.fullName, communeCode: null, communeName: null })
    else if (value && unit.parentCode === value.provinceCode) onChange({ ...value, datasetVersion, communeCode: unit.code, communeName: unit.fullName })
    setLevel(null)
  }
  const list = (
    <View style={styles.sheetBody}>
      <AppHeader variant="sheet" safeArea={false} title={t(level === 'commune' ? 'administrative.commune' : 'administrative.province')} onBack={() => setLevel(null)} />
      <SearchField value={search} onChangeText={setSearch} accessibilityLabel={t('administrative.search')} placeholder={t('administrative.search')} />
      <StaleNotice error={units.error} hasData={false} onRetry={() => { void version.refetch(); void units.refetch() }} />
      {level === 'commune' && value ? <GhostBtn label={t('administrative.wholeProvince')} onPress={() => { onChange({ ...value, communeCode: null, communeName: null }); setLevel(null) }} /> : null}
      {units.isPending ? (unitsWaiting ? <OfflineState /> : <LoadingState />) : !units.data ? <ErrorState error={units.error} onRetry={() => { void version.refetch(); void units.refetch() }} /> : (
        <FlatList data={filtered} keyExtractor={item => item.code} keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<EmptyState title={t('administrative.empty')} />}
          renderItem={({ item }) => <Pressable style={styles.row} accessibilityRole="button" accessibilityState={{ selected: item.code === (level === 'province' ? value?.provinceCode : value?.communeCode) }} onPress={() => select(item)}><Text>{item.fullName}</Text></Pressable>} />
      )}
    </View>
  )
  if (embedded && level) return list
  if (!datasetVersion) return version.isError
    ? <ErrorState error={version.error} onRetry={() => void version.refetch()} />
    : versionWaiting ? <OfflineState /> : <LoadingState />
  return (
    <View style={styles.root}>
      {/* A form, not a saved copy: the picker never claims its choices are the device's cached data (GoGo-MobileApp#253). */}
      <StaleNotice error={version.error} hasData={false} onRetry={() => void version.refetch()} />
      {changed ? <Text accessibilityLiveRegion="polite" variant="bodySmall" color="text.secondary">{t('administrative.changed')}</Text> : null}
      <Text variant={embedded ? 'introSmall' : 'label'} color={embedded ? 'redesign.secondary' : 'text.primary'}>{t('administrative.province')}</Text>
      {embedded ? <Pressable style={styles.field} accessibilityRole="button" onPress={() => open('province')}>
        <Text variant="introBody" color="redesign.secondary" style={styles.fieldLabel}>{value?.provinceName ?? t('areaPicker.selectProvince')}</Text><MaterialIcon name="expandMore" color="redesign.secondary" size={20} />
      </Pressable> : <SecondaryBtn label={value?.provinceName ?? t('administrative.selectProvince')} onPress={() => open('province')} />}
      <Text variant={embedded ? 'introSmall' : 'label'} color={embedded ? 'redesign.secondary' : 'text.primary'} style={embedded ? styles.communeLabel : undefined}>{t('administrative.commune')}</Text>
      {embedded ? <Pressable style={[styles.field, (!value || changed) && styles.fieldDisabled]} accessibilityRole="button" accessibilityState={{ disabled: !value || changed }} disabled={!value || changed} onPress={() => open('commune')}>
        <Text variant="introBody" color="redesign.secondary" style={styles.fieldLabel}>{value?.communeName ?? t('areaPicker.selectCommune')}</Text><MaterialIcon name="expandMore" color="redesign.secondary" size={20} />
      </Pressable> : <SecondaryBtn label={value?.communeName ?? t('administrative.wholeProvince')} disabled={!value || changed} onPress={() => open('commune')} />}
      {embedded && !value ? <View style={styles.hint}><MaterialIcon name="bolt" size={14} color="redesign.primaryText" /><Text variant="introCaption" color="redesign.primaryText" style={styles.fieldLabel}>{t('areaPicker.provinceFirst')}</Text></View> : null}
      {!embedded && value ? <GhostBtn label={t('administrative.clear')} onPress={() => onChange(null)} /> : null}
      {!embedded ? <Sheet visible={level !== null} onClose={() => setLevel(null)} size="full" scroll={false}>{list}</Sheet> : null}
    </View>
  )
}
