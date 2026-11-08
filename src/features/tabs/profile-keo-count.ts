import type { OpResponse } from '@/shared/api/types'

/** Replace this projection with the exact server total when GoGo-BE#809 lands. */
export function profileKeoCount(pages: readonly OpResponse<'listRooms'>[] | undefined): string | undefined {
  if (!pages?.length) return undefined
  const count = new Set(pages.flatMap(page => page.items.map(room => room.id))).size
  return `${count}${pages[pages.length - 1].nextCursor ? '+' : ''}`
}
