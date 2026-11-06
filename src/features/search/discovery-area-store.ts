import { create } from 'zustand'
import type { AdministrativeSelection } from '@/shared/administrative/snapshot'

/** Search's area choice survives pushed screens within a session; purged by SessionProvider. Never persisted. */
export const useDiscoveryAreaStore = create<{
  area: AdministrativeSelection | null
  setArea: (area: AdministrativeSelection | null) => void
}>(set => ({ area: null, setArea: area => set({ area }) }))
