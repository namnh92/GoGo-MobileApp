import { useRef, useState } from 'react'
import { Linking } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { UseFormReturn } from 'react-hook-form'
import { administrativeAreaLabel } from '@/shared/administrative/snapshot'
import { useAdministrativeVersion } from '@/shared/administrative/queries'
import type { CreateLocationModel } from '@/features/create-date/create-location-fields.view'
import type { RoomEditorValues } from './room-editor'

/** Explicit selections only: opening edit never replaces a room's stored origin. */
export function useRoomEditLocation(form: UseFormReturn<RoomEditorValues>, values: RoomEditorValues, onReselected: () => void, needsReselection = false) {
  const { t } = useTranslation()
  const version = useAdministrativeVersion()
  const [areaOpen, setAreaOpen] = useState(false)
  const [areaMode, setAreaMode] = useState<'default' | 'manualOnly'>('default')
  const [settingsFailed, setSettingsFailed] = useState(false)
  const [recovery, setRecovery] = useState<{ kind: 'info' | 'error'; visible: boolean }>({ kind: 'error', visible: false })
  const next = useRef<'settings' | 'manual' | 'area' | null>(null)
  const failed = useRef(false)
  const staleArea = needsReselection || !!values.area && !!version.data && values.area.datasetVersion !== version.data.datasetVersion
  const model: CreateLocationModel = {
    areaOpen, setAreaOpen, areaMode,
    openArea: (mode = 'default') => { setAreaMode(mode); setAreaOpen(true) },
    scopeLabel: values.area ? administrativeAreaLabel(values.area) : values.gps ? values.gps.label ?? t('createLocation.locatedNoLabel') : null,
    usingCurrent: !values.area,
    radiusM: values.radiusM, setRadiusM: radius => form.setValue('radiusM', radius, { shouldDirty: true }),
    offerHomeArea: false, homeArea: null, useHomeArea: () => {}, staleArea,
    selection: { value: values.area, onApply: area => {
      form.setValue('area', area, { shouldDirty: true }); form.setValue('gps', null); onReselected()
    } },
    onPositionApplied: position => {
      form.setValue('gps', position, { shouldDirty: true }); form.setValue('area', null, { shouldDirty: true })
      if (values.area) form.setValue('radiusM', 5000, { shouldDirty: true })
    },
    onApplied: () => {},
    recovery, settingsFailed,
    onLocationFailure: () => { failed.current = true; setAreaOpen(false) },
    onAreaClosed: () => { if (failed.current) { failed.current = false; setRecovery({ kind: 'error', visible: true }) } },
    closeRecovery: target => { next.current = target; setRecovery(previous => ({ ...previous, visible: false })) },
    onRecoveryClosed: () => {
      const target = next.current; next.current = null
      if (target === 'manual') setRecovery({ kind: 'info', visible: true })
      if (target === 'area') { setAreaMode('manualOnly'); setAreaOpen(true) }
      if (target === 'settings') void Linking.openSettings().catch(() => setSettingsFailed(true))
    },
  }
  return { model, valid: !!values.area && !!version.data && !staleArea && !version.isError }
}
