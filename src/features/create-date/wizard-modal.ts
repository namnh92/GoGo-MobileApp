import { useCallback, useLayoutEffect, useState } from 'react'
import { create } from 'zustand'

/** Wizard presenters stay registered through their native dismissal. */
export const useWizardModalStore = create<{
  modals: Set<symbol>
  exitVersion: number
}>(() => ({ modals: new Set(), exitVersion: 0 }))

export function cancelWizardRecovery() {
  useWizardModalStore.setState(state => ({ exitVersion: state.exitVersion + 1 }))
}

export function useWizardModal(visible: boolean) {
  const [id] = useState(() => Symbol('wizard-modal'))
  const onClosed = useCallback(() => {
    useWizardModalStore.setState(state => {
      if (!state.modals.has(id)) return state
      const modals = new Set(state.modals)
      modals.delete(id)
      return { modals }
    })
  }, [id])
  useLayoutEffect(() => {
    if (visible) useWizardModalStore.setState(state => ({ modals: new Set(state.modals).add(id) }))
  }, [id, visible])
  useLayoutEffect(() => onClosed, [onClosed])
  return onClosed
}
