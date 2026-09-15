import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { EmptyState, ErrorState, LoadingState, StaleNotice } from '@/shared/ui/async-state.view'
import { BackHeader, GhostBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { useAdministrativeUnits, useAdministrativeVersion } from './queries'
import { foldName, type AdministrativeSelection, type AdministrativeUnit } from './snapshot'
import { styles } from './administrative-picker.style'

export function AdministrativePicker({ value, onChange }: {
  value: AdministrativeSelection | null
  onChange: (value: AdministrativeSelection | null) => void
}) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const version = useAdministrativeVersion()
  const datasetVersion = version.data?.datasetVersion
  const [level, setLevel] = useState<'province' | 'commune' | null>(null)
  const [search, setSearch] = useState('')
  const provinces = useAdministrativeUnits(datasetVersion)
  const communes = useAdministrativeUnits(value?.provinceCode ? datasetVersion : undefined, value?.provinceCode)
  const units = level === 'commune' ? communes : provinces
  const changed = Boolean(value && datasetVersion && value.datasetVersion !== datasetVersion)
  const filtered = (units.data ?? []).filter(unit => foldName(unit.fullName).includes(foldName(search)))
  function open(next: 'province' | 'commune') { setSearch(''); setLevel(next) }
  function select(unit: AdministrativeUnit) {
    if (!datasetVersion) return
    if (level === 'province') onChange({ datasetVersion, provinceCode: unit.code, provinceName: unit.fullName, communeCode: null, communeName: null })
    else if (value && unit.parentCode === value.provinceCode) onChange({ ...value, datasetVersion, communeCode: unit.code, communeName: unit.fullName })
    setLevel(null)
  }
  if (!datasetVersion) return version.isError
    ? <ErrorState error={version.error} onRetry={() => void version.refetch()} />
    : <LoadingState />
  return (
    <View style={styles.root}>
      <StaleNotice error={version.error} onRetry={() => void version.refetch()} />
      {changed ? <Text accessibilityLiveRegion="polite" style={styles.hint}>{t('administrative.changed')}</Text> : null}
      <Text style={styles.label}>{t('administrative.province')}</Text>
      <SecondaryBtn label={value?.provinceName ?? t('administrative.selectProvince')} onPress={() => open('province')} />
      <Text style={styles.label}>{t('administrative.commune')}</Text>
      <SecondaryBtn label={value?.communeName ?? t('administrative.wholeProvince')} disabled={!value || changed} onPress={() => open('commune')} />
      {value ? <GhostBtn label={t('administrative.clear')} onPress={() => onChange(null)} /> : null}
      <Modal visible={level !== null} animationType="slide" onRequestClose={() => setLevel(null)}>
        <View style={[styles.modal, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <BackHeader title={t(level === 'commune' ? 'administrative.commune' : 'administrative.province')} onBack={() => setLevel(null)} />
          <TextInput style={styles.input} value={search} onChangeText={setSearch} accessibilityLabel={t('administrative.search')} placeholder={t('administrative.search')} />
          <StaleNotice error={units.error} hasData={Boolean(units.data)} onRetry={() => { void version.refetch(); void units.refetch() }} />
          {level === 'commune' && value ? <GhostBtn label={t('administrative.wholeProvince')} onPress={() => { onChange({ ...value, communeCode: null, communeName: null }); setLevel(null) }} /> : null}
          {units.isPending ? <LoadingState /> : !units.data ? <ErrorState error={units.error} onRetry={() => { void version.refetch(); void units.refetch() }} /> : (
            <FlatList data={filtered} keyExtractor={item => item.code} keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<EmptyState title={t('administrative.empty')} />}
              renderItem={({ item }) => <Pressable style={styles.row} accessibilityRole="button" onPress={() => select(item)}><Text style={styles.text}>{item.fullName}</Text></Pressable>} />
          )}
        </View>
      </Modal>
    </View>
  )
}
