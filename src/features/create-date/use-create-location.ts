import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking } from 'react-native'

import { useDialog } from '@/shared/ui/dialog.view'

import { useAdministrativeVersion } from '@/shared/administrative/queries'
import { administrativeAreaLabel, type AdministrativeSelection } from '@/shared/administrative/snapshot'
import { useMe } from '@/shared/api'
import { track } from '@/shared/analytics'
import { useAppAreaStore } from '@/shared/location/app-area'
import { useCurrentLocation } from '@/shared/location/use-current-location'
import { useSession } from '@/shared/providers/session-provider'
import { useRoom, useRoomStore } from '@/shared/store/roomStore'
import { useWizardModal, useWizardModalStore } from './wizard-modal'

/** Shared app-start/focus location behaviour, owned by the wizard's first step. */
export function useCreateLocation() {
  const { t } = useTranslation()
  const [areaOpen, setAreaOpen] = useState(false)
  const { area: gpsLabel, setArea } = useRoom()
  const sharedArea = useAppAreaStore(state => state.area)
  const sharedScope = useAppAreaStore(state => state.scope)
  const sharedManual = useAppAreaStore(state => state.manual)
  const selectArea = useAppAreaStore(state => state.setArea)
  const patchDraft = useRoomStore(state => state.patchDraft)
  const administrativeArea = useRoomStore(state => state.administrativeArea)
  const originLat = useRoomStore(state => state.originLat)
  const { status } = useSession()
  const location = useCurrentLocation()
  const { refresh } = location
  const { confirm, dialog } = useDialog({ waitForDismiss: true })
  // Step 1 stays mounted under the other steps in the stack. A fresh wizard
  // mount starts a new session; returning from another step does not re-prompt.
  const autoFailureShown = useRef(false)
  const focused = useRef(false)
  const onAreaClosed = useWizardModal(areaOpen)
  const modals = useWizardModalStore(state => state.modals)
  const exitVersion = useWizardModalStore(state => state.exitVersion)
  const sessionExitVersion = useRef(exitVersion).current
  const recoveryOpen = useRef(false)
  const pendingFailure = useRef<'auto' | 'manual' | null>(null)
  const [settingsFailed, setSettingsFailed] = useState(false)
  const failureHandler = useRef({ auto: () => {}, resume: () => {} })
  useFocusEffect(useCallback(() => {
    focused.current = true
    let active = true
    void refresh().then(result => {
      if (active && useWizardModalStore.getState().exitVersion === sessionExitVersion && !autoFailureShown.current && (result?.status === 'denied' || result?.status === 'unavailable')) {
        failureHandler.current.auto()
      }
    })
    return () => { active = false; focused.current = false; pendingFailure.current = null }
  }, [refresh, sessionExitVersion]))
  const version = useAdministrativeVersion()
  const radiusM = useRoomStore(state => state.radiusM)
  // A restored manual draft is its own choice, even when startup GPS is ready.
  // Only applying the picker releases it back to the shared app selection.
  const [keepDraftArea, setKeepDraftArea] = useState(() => administrativeArea !== null)
  const [staleArea, setStaleArea] = useState(false)

  const usingCurrent = originLat != null && administrativeArea === null

  // ADR-0022: the account area is a default offered only while this draft has
  // no location choice at all, and applied only by a tap. One whose dataset has
  // moved on is not offered; the account screen asks for a reselection instead.
  const me = useMe({ enabled: status === 'user' })
  const homeArea = me.data?.homeAdministrativeArea ?? null
  const offerHomeArea =
    homeArea !== null && homeArea.status === 'current' && administrativeArea === null && originLat === null

  const currentLabel = location.state.status === 'granted' ? location.state.label : gpsLabel || null
  const devicePosition = location.state.status === 'granted' ? location.state : null
  useEffect(() => {
    if (keepDraftArea) return
    // The native fix is usable before the cosmetic area lookup finishes.
    if (devicePosition && !sharedManual) {
      const located = sharedScope.status === 'ready' && sharedScope.source === 'gps'
        && sharedScope.position.lat === devicePosition.lat && sharedScope.position.lng === devicePosition.lng
      setArea(located && sharedArea ? administrativeAreaLabel(sharedArea) : devicePosition.label ?? '')
      patchDraft({ administrativeArea: null, originLat: devicePosition.lat, originLng: devicePosition.lng, ...(originLat === null ? { radiusM: 5000 } : {}) })
      return
    }
    if (sharedScope.status !== 'ready') return
    if (sharedScope.source === 'gps') {
      setArea(sharedArea ? administrativeAreaLabel(sharedArea) : currentLabel ?? '')
      patchDraft({ administrativeArea: null, originLat: sharedScope.position.lat, originLng: sharedScope.position.lng, ...(originLat === null ? { radiusM: 5000 } : {}) })
    } else {
      setArea('')
      patchDraft({ administrativeArea: sharedArea, originLat: null, originLng: null, radiusM: null })
    }
  }, [keepDraftArea, originLat, sharedArea, sharedScope, sharedManual, devicePosition, patchDraft, setArea, currentLabel])

  function openArea() {
    // Seed the shared picker with a restored draft before the user edits it.
    // This also keeps Clear and Use current position working for old drafts.
    if (keepDraftArea) selectArea(administrativeArea)
    setKeepDraftArea(false)
    setAreaOpen(true)
  }

  async function promptLocationFailure() {
    const state = useWizardModalStore.getState()
    if (!focused.current || !pendingFailure.current || state.modals.size || recoveryOpen.current) return
    if (pendingFailure.current === 'auto' && state.exitVersion !== sessionExitVersion) return
    pendingFailure.current = null
    recoveryOpen.current = true
    try {
      setSettingsFailed(false)
      const actions = [
        { key: 'cancel', label: t('common.cancel'), style: 'cancel' as const },
        { key: 'confirm', label: t('createLocation.confirm') },
      ]
      const choice = await confirm({
        title: t('createLocation.failureTitle'), message: t('createLocation.failureBody'), actions, actionLayout: 'row',
        onShown: () => { autoFailureShown.current = true },
      })
      if (!focused.current) return
      if (choice === 'confirm') {
        try { await Linking.openSettings() } catch { setSettingsFailed(true) }
      } else if (choice === 'cancel') {
        const manual = await confirm({
          title: t('createLocation.manualTitle'), message: t('createLocation.manualBody'), actions, actionLayout: 'row',
        })
        if (manual === 'confirm' && focused.current) openArea()
      }
    } finally { recoveryOpen.current = false }
  }

  function queueFailure(manual: boolean) {
    if (!focused.current || recoveryOpen.current) return
    if (!manual && useWizardModalStore.getState().exitVersion !== sessionExitVersion) return
    pendingFailure.current = manual ? 'manual' : pendingFailure.current ?? 'auto'
    // Explicit taps originate inside the area sheet: retain sheet → dialog.
    // An automatic refresh must leave the user's current modal alone.
    if (manual && areaOpen) setAreaOpen(false)
    else void promptLocationFailure()
  }

  function onLocationFailure() { queueFailure(true) }

  useLayoutEffect(() => {
    failureHandler.current = { auto: () => queueFailure(false), resume: () => { void promptLocationFailure() } }
    if (exitVersion !== sessionExitVersion && pendingFailure.current === 'auto') pendingFailure.current = null
  })
  useEffect(() => {
    if (pendingFailure.current) failureHandler.current.resume()
  }, [modals, exitVersion])

  function chooseArea(value: AdministrativeSelection | null) {
    setKeepDraftArea(true)
    selectArea(value)
    setStaleArea(false)
    setArea('')
    patchDraft({ administrativeArea: value, originLat: null, originLng: null, radiusM: null })
  }

  function useHomeArea() {
    if (!homeArea) return
    chooseArea({
      datasetVersion: homeArea.datasetVersion,
      provinceCode: homeArea.provinceCode,
      provinceName: homeArea.provinceName,
      communeCode: homeArea.communeCode ?? null,
      communeName: homeArea.communeName ?? null,
    })
    track('profile_prefill_used', { field: 'homeArea' })
  }

  function validate() {
    const published = version.data?.datasetVersion
    // The server refuses a replaced dataset too; saying it here keeps the user
    // on the step where it can be fixed.
    if (administrativeArea && published && administrativeArea.datasetVersion !== published) {
      setStaleArea(true)
      return false
    }
    // A distance only means something from a position.
    patchDraft({ radiusM: usingCurrent ? radiusM : null })
    return true
  }

  const scopeLabel = administrativeArea ? administrativeAreaLabel(administrativeArea)
    : usingCurrent ? gpsLabel || t('createLocation.locatedNoLabel') : null

  return {
    dialog, settingsFailed, onLocationFailure, onAreaClosed,
    validate, areaOpen, setAreaOpen, openArea, scopeLabel, usingCurrent, radiusM,
    setRadiusM: (value: number | null) => patchDraft({ radiusM: value }),
    locationStatus: location.state.status, offerHomeArea, homeArea, useHomeArea,
    staleArea: staleArea && administrativeArea !== null && administrativeArea.datasetVersion !== version.data?.datasetVersion,
    onApplied: () => { setKeepDraftArea(false); setStaleArea(false) },
  }
}
