import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ScrollView, View } from 'react-native'

import { isApiError, useRenameRoom, useUpdateRoomConstraints, type RoomSummary } from '@/shared/api'
import type { OpBody } from '@/shared/api/types'
import { CreateLocationFields } from '@/features/create-date/create-location-fields.view'
import { GlassBar, useBottomBarInset } from '@/shared/ui/glass-bar.view'
import { spacing } from '@/shared/ui/tokens'
import { useRoomEditLocation } from './use-room-edit-location'
import { RoomEditTime } from './room-edit-time.view'
import { BlockingLoadingOverlay } from '@/shared/ui/blocking-loading-overlay.view'
import { IconBtn, PrimaryBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { Icon } from '@/shared/ui/icons'
import { useFieldVisibility } from '@/shared/ui/use-field-visibility'
import { Text } from '@/shared/ui/text'
import type { ConfirmConditions } from './room-condition-confirmation.view'
import { RoomTitleField } from './room-edit-fields.view'
import { RoomBudgetField } from './room-budget-field.view'
import { localScheduleToIso } from './room-schedule'
import { roomEditorChanges, roomEditorDefaults, roomEditorSchemaFor, validRoomEditorSchedule, type RoomEditorValues } from './room-editor'
import { styles } from './room-editor.style'

const EDITABLE: readonly RoomSummary['status'][] = ['draft', 'collecting', 'matching', 'ready']

/** Query updates never replace a dirty draft. Conflict recovery explicitly
 * reloads the baseline while preserving fields the user still wants to change. */
export function RoomEditor({ room, reloadRoom, confirmConditions, onPendingChange, onDirtyChange, onSaved }: {
  room: RoomSummary
  reloadRoom: () => Promise<RoomSummary>
  confirmConditions: ConfirmConditions
  onPendingChange: (value: boolean) => void
  onDirtyChange: (value: boolean) => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const { viewportRef, scrollRef, schedule, onScroll, onScrollBeginDrag } = useFieldVisibility('room-editor')
  const [initial, setInitial] = useState(room)
  const observedRoom = useRef(room)
  const [base, setBase] = useState(() => roomEditorDefaults(initial))
  const [scheduleWindow, setScheduleWindow] = useState({ start: initial.constraints?.startAt ?? initial.scheduledDate, end: initial.constraints?.endAt })
  const [areaReselected, setAreaReselected] = useState(false)
  const [areaNeedsReselection, setAreaNeedsReselection] = useState(initial.constraints?.administrativeArea?.status === 'needs_reselection')
  const [requestPending, setPending] = useState(false)
  const submitting = useRef(false)
  const saveCompleted = useRef(false)
  const constraintVersion = useRef(initial.constraintVersion)
  const [notice, setNotice] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const rename = useRenameRoom(room.id)
  const update = useUpdateRoomConstraints(room.id)
  const [footerHeight, setFooterHeight] = useState(0)
  const footerInset = useBottomBarInset(footerHeight)
  const pending = requestPending || rename.isPending || update.isPending
  useEffect(() => { onPendingChange(pending) }, [pending, onPendingChange])
  const schema = roomEditorSchemaFor(base)
  const form = useForm<RoomEditorValues>({ resolver: zodResolver(schema), defaultValues: base, mode: 'onChange' })
  const values = useWatch({ control: form.control }) as RoomEditorValues
  const location = useRoomEditLocation(form, values, () => setAreaReselected(true), areaNeedsReselection && !areaReselected)
  const changed = roomEditorChanges(values, base, areaReselected && areaNeedsReselection)
  const dirty = Object.values(changed).some(Boolean)
  useEffect(() => { onDirtyChange(dirty) }, [dirty, onDirtyChange])
  useEffect(() => {
    if (observedRoom.current === room) return
    observedRoom.current = room
    // A cached summary may precede the response carrying the stored schedule.
    // Hydrate only an untouched form; mutation results and 409 recovery keep
    // their explicit baseline handling and never overwrite a user's draft.
    if (dirty || pending || submitting.current || conflict || saveCompleted.current) return
    const freshBase = roomEditorDefaults(room)
    form.reset(freshBase)
    setBase(freshBase)
    setInitial(room)
    constraintVersion.current = room.constraintVersion
    setScheduleWindow({ start: room.constraints?.startAt ?? room.scheduledDate, end: room.constraints?.endAt })
    setAreaNeedsReselection(room.constraints?.administrativeArea?.status === 'needs_reselection')
    setAreaReselected(false)
  }, [room, dirty, pending, conflict, form])
  const constraintsChanged = Object.entries(changed).some(([key, dirty]) => key !== 'title' && dirty)
  const scheduleValid = validRoomEditorSchedule(values, changed, scheduleWindow)
  const canEdit = room.myRole === 'host' && EDITABLE.includes(room.status) && initial.myRole === 'host' && EDITABLE.includes(initial.status)
  const valid = schema.safeParse(values).success && scheduleValid && (!changed.area || location.valid)
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
      saveCompleted.current = true
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

  return <>
    <BlockingLoadingOverlay visible={pending} onClosed={() => {
      // A success leaves only after the native blocking modal has gone. Reload
      // and failure dismissals stay here; duplicate native events do nothing.
      if (!saveCompleted.current) return
      saveCompleted.current = false
      onSaved()
    }} />
    <View ref={viewportRef} testID="room-editor-viewport" collapsable={false} style={styles.flex} onLayout={schedule}>
      <ScrollView ref={scrollRef} testID="room-editor-scroll" style={styles.flex}
        contentContainerStyle={[styles.body, { paddingBottom: footerInset + spacing[4] }]}
        onLayout={schedule} onContentSizeChange={schedule} onScroll={onScroll} onScrollBeginDrag={onScrollBeginDrag}
        scrollEventThrottle={16} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.section}>
          <Controller control={form.control} name="title" render={({ field, fieldState }) => <RoomTitleField {...field} disabled={pending || !canEdit} invalid={!!fieldState.error} />} />
        </View>
        <View testID="room-manage-area-editor" pointerEvents={pending || !canEdit ? 'none' : 'auto'} accessibilityState={{ disabled: pending || !canEdit }}>
          <CreateLocationFields embedded disabled={pending || !canEdit} model={location.model} />
        </View>
        {room.type === 'group' ? <View style={styles.section}>
          <Text variant="label">{t('roomEdit.participantCount')}</Text>
          <View style={styles.stepper}>
            <IconBtn accessibilityLabel={t('groupSetup.decrease')} disabled={pending || !canEdit || values.participantCount <= 3}
              onPress={() => form.setValue('participantCount', values.participantCount - 1, { shouldDirty: true })}><Text variant="title1">−</Text></IconBtn>
            <Text variant="title1" accessibilityLiveRegion="polite">{t('groupSetup.people', { n: values.participantCount })}</Text>
            <IconBtn accessibilityLabel={t('groupSetup.increase')} disabled={pending || !canEdit || values.participantCount >= 12}
              onPress={() => form.setValue('participantCount', values.participantCount + 1, { shouldDirty: true })}><Icon name="plus" size={20} /></IconBtn>
          </View>
        </View> : null}
        <RoomBudgetField amount={values.budgetAmount} mode={values.budgetMode} roomType={room.type} disabled={pending || !canEdit}
          onChange={(amount, mode) => {
            form.setValue('budgetAmount', amount, { shouldDirty: true, shouldValidate: true })
            form.setValue('budgetMode', mode, { shouldDirty: true, shouldValidate: true })
          }} />
        <View testID="room-schedule-section" pointerEvents={pending || !canEdit ? 'none' : 'auto'} accessibilityState={{ disabled: pending || !canEdit }}>
          <RoomEditTime key={`${scheduleWindow.start ?? ''}:${scheduleWindow.end ?? ''}`} disabled={pending || !canEdit} form={form} values={values} roomType={room.type} />
          {!scheduleValid ? <Text color="status.warningText">{t('roomSchedule.invalid')}</Text> : null}
        </View>
        {!canEdit ? <Text variant="caption" color="status.warningText">{t('roomTitle.locked')}</Text> : null}
        {notice ? <Text variant="bodySmall" color="text.secondary" accessibilityLiveRegion="polite">{notice}</Text> : null}
        {conflict ? <SecondaryBtn label={t('roomEdit.reload')} disabled={pending} onPress={() => void reloadAfterConflict()} /> : null}
      </ScrollView>
    </View>
    <GlassBar placement="floating" testID="room-edit-footer" onHeightChange={setFooterHeight}>
      <PrimaryBtn label={t('roomEdit.save')} disabled={pending || conflict || !canEdit || !valid || !dirty}
        loading={pending} onPress={() => void form.handleSubmit(submit)()} />
    </GlassBar>
  </>
}
