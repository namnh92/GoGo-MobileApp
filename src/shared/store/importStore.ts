import { create } from 'zustand'

import type { SavedPlace } from '@/data/types'

// User-imported places (verified community submissions). Client state for the
// mock app — the real app reads these back from the catalog API.
interface ImportStoreState {
  importedPlaces: SavedPlace[]
  addImportedPlace: (place: SavedPlace) => void
}

export const useImportStore = create<ImportStoreState>()(set => ({
  importedPlaces: [],
  addImportedPlace: place =>
    set(state =>
      state.importedPlaces.some(p => p.title === place.title)
        ? state
        : { importedPlaces: [place, ...state.importedPlaces] },
    ),
}))
