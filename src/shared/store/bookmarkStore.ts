import { create } from 'zustand'

import { savedPlaces } from '@/data/mockData'

// Bookmarked place titles. Seeded with the fixture saved places so the Saved
// tab and search hearts agree. Client state for the mock app — the real app
// syncs via PUT /v1/me/saved.
interface BookmarkStoreState {
  bookmarked: string[]
  toggleBookmark: (title: string) => void
  isBookmarked: (title: string) => boolean
}

export const useBookmarkStore = create<BookmarkStoreState>()((set, get) => ({
  bookmarked: savedPlaces.map(p => p.title),
  toggleBookmark: title =>
    set(state => ({
      bookmarked: state.bookmarked.includes(title)
        ? state.bookmarked.filter(x => x !== title)
        : [...state.bookmarked, title],
    })),
  isBookmarked: title => get().bookmarked.includes(title),
}))
