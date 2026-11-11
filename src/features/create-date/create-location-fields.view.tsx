import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { DiscoveryLocationSheet } from '@/features/search/discovery-location.view'
import { administrativeAreaLabel } from '@/shared/administrative/snapshot'
import { LocationField } from '@/shared/ui/location-field.view'
import { Icon } from '@/shared/ui/icons'
import { Chip } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { ResultSheet } from '@/shared/ui/result-sheet.view'

import type { useCreateLocation } from './use-create-location'
import { styles } from './create-location-fields.style'

/** `null` means anywhere, so the payload omits the distance. */
const RADIUS_OPTIONS: readonly (number | null)[] = [2000, 5000, 10000, null]

export function CreateLocationFields({ model }: { model: ReturnType<typeof useCreateLocation> }) {
  const { t } = useTranslation()
  const { areaOpen, setAreaOpen, openArea, scopeLabel, locationStatus, usingCurrent, radiusM, setRadiusM,
    offerHomeArea, homeArea, useHomeArea, staleArea, onApplied, recovery, closeRecovery, onRecoveryClosed, settingsFailed, onLocationFailure, onAreaClosed } = model
  const manual = recovery.kind === 'info'
  return (
    <View testID="create-location-section" style={styles.section}>
      <Text variant="label" style={styles.label}>{t('createType.area')}</Text>
      <LocationField testID="create-location-field" label={scopeLabel} onPress={openArea} />
      {locationStatus === 'denied' || locationStatus === 'unavailable' ? (
        <Text variant="bodySmall" color="status.warningText" accessibilityLiveRegion="polite" style={styles.locationFallback}>
          {locationStatus === 'denied'
            ? t('createLocation.permissionDenied')
            : t('createLocation.locationUnavailable')}
        </Text>
      ) : null}

      {usingCurrent ? (
        <>
          <View style={styles.distanceHeader}>
            <Icon name="navigation" size={20} color="text.secondary" />
            <Text variant="discoveryHeading" style={styles.distanceTitle}>{t('createLocation.maxDistance')}</Text>
            <Text variant="discoveryHeading" color="accent.primary">
              {radiusM === null ? t('createLocation.anywhere') : `${radiusM / 1000} km`}
            </Text>
          </View>
          <View style={styles.grid}>
            {RADIUS_OPTIONS.map(option => {
              const active = radiusM === option
              const label = option === null ? t('createLocation.anywhere') : `${option / 1000} km`
              return (
                <Chip key={label} label={label} appearance="soft" variant={active ? 'selected' : 'default'} onPress={() => setRadiusM(option)} />
              )
            })}
          </View>
        </>
      ) : null}

      {offerHomeArea && homeArea ? (
        <View style={styles.prefillRow}>
          <Chip
            icon="home"
            label={t('createLocation.useHomeArea', { area: administrativeAreaLabel(homeArea) })}
            variant="info"
            onPress={useHomeArea}
          />
        </View>
      ) : null}
      {staleArea ? (
        <Text variant="bodySmall" color="status.warningText" accessibilityLiveRegion="polite" style={styles.locationFallback}>
          {t('administrative.changed')}
        </Text>
      ) : null}
      {settingsFailed ? <Text variant="bodySmall" color="status.warningText" accessibilityLiveRegion="polite">{t('notificationSettings.openSettingsFailed')}</Text> : null}
      <DiscoveryLocationSheet onLocationFailure={onLocationFailure} onClosed={onAreaClosed} visible={areaOpen} onClose={() => setAreaOpen(false)} onApplied={onApplied} />
      <ResultSheet visible={recovery.visible} variant={recovery.kind}
        testID="create-location-recovery"
        title={t(manual ? 'createLocation.manualTitle' : 'createLocation.failureTitle')}
        body={t(manual ? 'createLocation.manualBody' : 'createLocation.failureBody')}
        primaryAction={{ label: t('createLocation.confirm'), onPress: () => closeRecovery(manual ? 'area' : 'settings') }}
        secondaryAction={manual ? undefined : { label: t('common.cancel'), onPress: () => closeRecovery('manual') }}
        onClose={() => closeRecovery(manual ? 'area' : 'manual')} onClosed={onRecoveryClosed} />
    </View>
  )
}
