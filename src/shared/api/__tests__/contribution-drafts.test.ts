import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../client'
import {
  deleteContributionDraft,
  getContributionDraft,
  listContributionDrafts,
  saveContributionDraft,
} from '../endpoints/contribution-drafts'
import { shouldPersistQuery } from '../persist-policy'

vi.mock('../client', () => ({ api: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

describe('#518 private draft transport', () => {
  beforeEach(() => vi.clearAllMocks())
  it('uses authenticated BFF GET/PUT/DELETE and optimistic versions', async () => {
    const body = { googlePlaceId: 'ChIJtest', expectedVersion: 0, enrichment: { visitTips: 'User text' } }
    await listContributionDrafts()
    await getContributionDraft('draft-id')
    await saveContributionDraft('draft-id', body)
    await deleteContributionDraft('draft-id', 2)
    expect(api.get).toHaveBeenNthCalledWith(1, '/place-contribution-drafts')
    expect(api.get).toHaveBeenNthCalledWith(2, '/place-contribution-drafts/{id}', { pathParams: { id: 'draft-id' } })
    expect(api.put).toHaveBeenCalledWith('/place-contribution-drafts/{id}', body, { pathParams: { id: 'draft-id' } })
    expect(api.delete).toHaveBeenCalledWith('/place-contribution-drafts/{id}', {
      pathParams: { id: 'draft-id' },
      query: { version: 2 },
    })
  })
  it('never persists private drafts to the offline query store', () => {
    expect(shouldPersistQuery(['place-contribution-drafts'])).toBe(false)
    expect(shouldPersistQuery(['place-contribution-drafts', 'draft-id'])).toBe(false)
  })
})
