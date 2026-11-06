import { create } from 'zustand'
import type { AdministrativeSelection } from '@/shared/administrative/snapshot'

/** Search's explicit area choice survives a pushed location/account screen; never persisted. */
export const useDiscoveryAreaStore = create<{
  area: AdministrativeSelection | null
  setArea: (area: AdministrativeSelection | null) => void
}>(set => ({ area: null, setArea: area => set({ area }) }))
