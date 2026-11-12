import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ScrollView, View } from 'react-native'

import { isApiError, useRenameRoom, useUpdateRoomConstraints, type RoomSummary } from '@/shared/api'
import type { OpBody } from '@/shared/api/types'
import { AdministrativePicker, type AdministrativePickerLevel } from '@/shared/administrative/administrative-picker.view'
import { BudgetPicker } from '@/features/create-date/budget-picker.view'
import { useCurrentLocation } from '@/shared/location/use-current-location'
import { BlockingLoadingOverlay } from '@/shared/ui/blocking-loading-overlay.view'
import { Chip, IconBtn, PrimaryBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { Icon } from '@/shared/ui/icons'
import { SheetActions } from '@/shared/ui/sheet-actions.view'
import { Text } from '@/shared/ui/text'
import type { ConfirmConditions } from './room-condition-confirmation.view'
import { RoomScheduleField, RoomTitleField } from './room-edit-fields.view'
import { localScheduleToIso } from './room-schedule'
import { roomEditorChanges, roomEditorDefaults, roomEditorSchema, validRoomEditorSchedule, type RoomEditorValues } from './room-editor'
import { styles } from './room-editor.style'

const EDITABLE: readonly RoomSummary['status'][] = ['draft', 'collecting', 'matching', 'ready']

/** Query updates never replace an open draft. Conflict recovery explicitly
 * reloads the baseline while preserving fields the user still wants to change. */
export function RoomEditor({ room, reloadRoom, close, confirmConditions, onPendingChange, onChoosingChange }: {
  room: RoomSummary
  reloadRoom: () => Promise<RoomSummary>
  close: () => void
  confirmConditions: ConfirmConditions
  onPendingChange: (value: boolean) => void
  onChoosingChange: (value: boolean) => void
}) {
  const { t } = useTranslation()
  const [initial, setInitial] = useState(room)
  const [base, setBase] = useState(() => roomEditorDefaults(initial))
  const [scheduleWindow, setScheduleWindow] = useState({ start: initial.constraints?.startAt ?? initial.scheduledDate, end: initial.constraints?.endAt })
  const [areaReselected, setAreaReselected] = useState(false)
  const [areaNeedsReselection, setAreaNeedsReselection] = useState(initial.constraints?.administrativeArea?.status === 'needs_reselection')
  const [areaValid, setAreaValid] = useState(false)
  const [choosingLevel, setChoosingLevel] = useState<AdministrativePickerLevel>(null)
  const choosing = choosingLevel !== null
  const [requestPending, setPending] = useState(false)
  const submitting = useRef(false)
  const constraintVersion = useRef(initial.constraintVersion)
  const [notice, setNotice] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const rename = useRenameRoom(room.id)
  const update = useUpdateRoomConstraints(room.id)
  const location = useCurrentLocation()
  const pending = requestPending || rename.isPending || update.isPending
  useEffect(() => { onPendingChange(pending) }, [pending, onPendingChange])
  const form = useForm<RoomEditorValues>({ resolver: zodResolver(roomEditorSchema), defaultValues: base, mode: 'onChange' })
  const values = useWatch({ control: form.control }) as RoomEditorValues
  const changed = roomEditorChanges(values, base, areaReselected && areaNeedsReselection)
  const constraintsChanged = Object.entries(changed).some(([key, dirty]) => key !== 'title' && dirty)
  const scheduleValid = validRoomEditorSchedule(values, changed, scheduleWindow)
  const canEdit = room.myRole === 'host' && EDITABLE.includes(room.status) && initial.myRole === 'host' && EDITABLE.includes(initial.status)
  const valid = roomEditorSchema.safeParse(values).success && scheduleValid && (!changed.area || areaValid)
    && (!changed.participantCount || room.type !== 'group' || values.participantCount >= 3) && (!constraintsChanged || !!initial.constraints)

  async function reloadAfterConflict() {
    if (submitting.current || pending || !conflict) return
    submitting.current = true
    setPending(true)
    try {
      const fresh = await reloadRoom()
      const draft = form.getValues()
      const dirty = roomEditorChanges(draft, base, areaReselected && areaNeedsReselection)
      const freshBase = roomEditorDefaults(fresh)
      // Untouched fields adopt concurrent edits. Still-different draft fields
      // stay dirty against the new baseline; equal fields naturally become clean.
      form.reset({
        ...freshBase,
        ...(dirty.title ? { title: draft.title } : {}),
        ...(dirty.area || dirty.gps ? { area: draft.area, gps: draft.gps } : {}),
        ...(dirty.radiusM || dirty.gps ? { radiusM: draft.radiusM } : {}),
        ...(dirty.budgetAmount ? { budgetAmount: draft.budgetAmount } : {}),
        ...(dirty.budgetMode ? { budgetMode: draft.budgetMode } : {}),
        ...(dirty.participantCount ? { participantCount: draft.participantCount } : {}),
        ...(dirty.start ? { start: draft.start } : {}),
        ...(dirty.end ? { end: draft.end } : {}),
      })
      setBase(freshBase)
      setInitial(fresh)
      constraintVersion.current = fresh.constraintVersion
      setScheduleWindow({ start: fresh.constraints?.startAt ?? fresh.scheduledDate, end: fresh.constraints?.endAt })
      setAreaNeedsReselection(fresh.constraints?.administrativeArea?.status === 'needs_reselection')
      setAreaReselected(areaReselected && (dirty.area || dirty.gps))
      setConflict(false)
      setNotice(t('roomEdit.reloaded'))
    } catch {
      setNotice(t('roomEdit.reloadFailed'))
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  async function submit(value: RoomEditorValues) {
    if (submitting.current || pending || conflict || !canEdit || !valid || (!changed.title && !constraintsChanged)) return
    submitting.current = true
    // Guard repeated presses while waiting for the stale warning too.
    if (constraintsChanged && !await confirmConditions()) { submitting.current = false; return }
    setPending(true)
    setNotice(null)
    let failedFields = t('roomTitle.title')
    try {
      if (changed.title) {
        await rename.mutateAsync(value.title.trim() || null)
        // Commit only this part of the baseline. A failed constraint request
        // leaves its values dirty and the successful rename out of the retry.
        setBase(previous => ({ ...previous, title: value.title.trim() }))
      }
      if (constraintsChanged && initial.constraints) {
        failedFields = [
          (changed.area || changed.gps) && t('roomLobby.area'),
          (changed.budgetAmount || changed.budgetMode) && t('roomManage.budgetTitle'),
          (changed.start || changed.end) && t('roomSchedule.title'),
          changed.participantCount && t('groupSetup.countTitle'),
          changed.radiusM && t('createLocation.maxDistance'),
        ].filter(Boolean).join(', ')
        // RoomConstraintPatch requires this budget pair even for area/time
        // edits. All optional fields remain absent unless changed.
        const patch: OpBody<'updateRoomConstraints'> = {
          expectedConstraintVersion: constraintVersion.current,
          budgetMode: value.budgetMode,
          budgetAmount: value.budgetAmount,
          ...(changed.area && value.area ? {
            administrativeArea: { datasetVersion: value.area.datasetVersion, provinceCode: value.area.provinceCode, communeCode: value.area.communeCode },
            // F-04: a manual area replaces the GPS filter atomically.
            originLat: null, originLng: null, radiusM: null,
          } : {}),
          ...(changed.gps && value.gps ? {
            administrativeArea: null,
            originLat: value.gps.lat, originLng: value.gps.lng, radiusM: value.radiusM,
          } : {}),
          ...(changed.radiusM ? { radiusM: value.radiusM } : {}),
          ...(changed.participantCount ? { participantCount: value.participantCount } : {}),
          ...(changed.start ? { startAt: localScheduleToIso(value.start)! } : {}),
          ...(changed.end ? { endAt: value.end.trim() ? localScheduleToIso(value.end)! : null } : {}),
        }
        const updated = await update.mutateAsync(patch)
        constraintVersion.current = updated.constraintVersion
        setScheduleWindow(previous => ({ start: patch.startAt ?? previous.start, end: patch.endAt === null ? undefined : patch.endAt ?? previous.end }))
        setBase(value)
        if (changed.area || changed.gps) setAreaNeedsReselection(false)
        setAreaReselected(false)
      }
      setNotice(t(constraintsChanged ? 'roomManage.savedStale' : value.title.trim() ? 'roomTitle.saved' : 'roomTitle.cleared'))
    } catch (error) {
      if (isApiError(error) && error.status === 409 && error.code !== 'ROOM_NOT_EDITABLE') setConflict(true)
      const reason = isApiError(error) && error.code === 'ROOM_NOT_EDITABLE' ? t('roomTitle.locked')
        : isApiError(error) && error.status === 409 ? t('roomManage.conflict') : t('roomManage.saveFailed')
      setNotice(t('roomEdit.failedFields', { fields: failedFields, reason }))
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  async function chooseGps() {
    if (pending || !canEdit || submitting.current) return
    submitting.current = true
    setPending(true)
    if (!conflict) setNotice(null)
    try {
      const result = await location.request()
      if (result?.status === 'granted') {
        form.setValue('gps', { lat: result.lat, lng: result.lng, label: result.label }, { shouldDirty: true })
        form.setValue('area', null, { shouldDirty: true })
        if (values.area) form.setValue('radiusM', 5000, { shouldDirty: true })
      } else setNotice(t(result?.status === 'denied' ? 'createLocation.permissionDenied' : 'createLocation.locationUnavailable'))
    } catch {
      setNotice(t('createLocation.locationUnavailable'))
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  const body = <View style={[styles.body, choosing && styles.flex]}>
    <BlockingLoadingOverlay visible={pending} />
    <View style={choosing ? styles.hidden : styles.section}>
      <Controller control={form.control} name="title" render={({ field, fieldState }) => <RoomTitleField {...field} disabled={pending || !canEdit} invalid={!!fieldState.error} />} />
    </View>
    <View testID="room-manage-area-editor" style={[styles.section, choosing && styles.flex]} pointerEvents={pending || !canEdit ? 'none' : 'auto'}>
      {!choosing ? <Text variant="label">{t('roomLobby.area')}</Text> : null}
      <Controller control={form.control} name="area" render={({ field }) => <AdministrativePicker embedded value={field.value}
        onChange={area => { setAreaReselected(true); form.setValue('gps', null); field.onChange(area) }} onValidityChange={setAreaValid}
        choosingLevel={choosingLevel} onChoosingLevelChange={setChoosingLevel} onChoosingChange={onChoosingChange} />} />
    </View>
    <View style={choosing ? styles.hidden : styles.section}>
      <SecondaryBtn label={t('home.useLocation')} disabled={pending || !canEdit} onPress={() => void chooseGps()} />
      {values.gps?.label ? <Text variant="bodySmall" color="text.secondary">{values.gps.label}</Text> : null}
      {!values.area ? <>
        <Text variant="label">{t('createLocation.maxDistance')}</Text>
        <View style={styles.chips}>{([2000, 5000, 10000, null] as const).map(radius => <Chip key={String(radius)}
          label={radius === null ? t('createLocation.anywhere') : `${radius / 1000} km`}
          appearance="soft" variant={values.radiusM === radius ? 'selected' : 'default'} disabled={pending || !canEdit}
          onPress={() => form.setValue('radiusM', radius, { shouldDirty: true })} />)}</View>
      </> : null}
      <Text variant="label">{t('roomManage.budgetTitle')}</Text>
      {room.type === 'group' ? <View style={styles.chips}>{(['per_person', 'total'] as const).map(mode => <Chip key={mode}
        label={t(mode === 'per_person' ? 'groupSetup.perPerson' : 'groupSetup.groupTotal')}
        variant={values.budgetMode === mode ? 'selected' : 'default'} disabled={pending || !canEdit}
        onPress={() => form.setValue('budgetMode', mode, { shouldDirty: true })} />)}</View> : null}
      <Controller control={form.control} name="budgetAmount" render={({ field }) =>
        <BudgetPicker {...field} roomType={room.type} budgetMode={values.budgetMode} disabled={pending || !canEdit} />
      } />
      <View testID="room-schedule-section" style={styles.section}>
        <Text variant="label">{t('roomSchedule.title')}</Text>
        <Text variant="bodySmall" color="text.secondary">{t('roomSchedule.format')}</Text>
        <View style={styles.scheduleFields}>{(['start', 'end'] as const).map(name => <Controller key={name} control={form.control} name={name}
          render={({ field }) => <RoomScheduleField {...field} name={name} disabled={pending || !canEdit} invalid={!scheduleValid} />} />)}</View>
      </View>
      {room.type === 'group' ? <>
        <Text variant="label">{t('groupSetup.countTitle')}</Text>
        <View style={styles.stepper}>
          <IconBtn accessibilityLabel={t('groupSetup.decrease')} disabled={pending || !canEdit || values.participantCount <= 3}
            onPress={() => form.setValue('participantCount', values.participantCount - 1, { shouldDirty: true })}><Text variant="title1">−</Text></IconBtn>
          <Text variant="title1" accessibilityLiveRegion="polite">{t('groupSetup.people', { n: values.participantCount })}</Text>
          <IconBtn accessibilityLabel={t('groupSetup.increase')} disabled={pending || !canEdit || values.participantCount >= 12}
            onPress={() => form.setValue('participantCount', values.participantCount + 1, { shouldDirty: true })}><Icon name="plus" size={20} /></IconBtn>
        </View>
      </> : null}
      {!canEdit ? <Text variant="caption" color="status.warningText">{t('roomTitle.locked')}</Text> : null}
      <SheetActions>
        <SecondaryBtn label={t('common.cancel')} onPress={close} disabled={pending} />
        <PrimaryBtn label={t('roomEdit.saveSchedule')} disabled={pending || conflict || !canEdit || !valid || (!changed.title && !constraintsChanged)}
          loading={pending} onPress={() => void form.handleSubmit(submit)()} />
      </SheetActions>
      {notice ? <Text variant="bodySmall" color="text.secondary" accessibilityLiveRegion="polite">{notice}</Text> : null}
      {conflict ? <SecondaryBtn label={t('roomEdit.reload')} disabled={pending} onPress={() => void reloadAfterConflict()} /> : null}
    </View>
  </View>
  return choosing ? body : <ScrollView style={styles.shrink} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" bounces={false}>{body}</ScrollView>
}
