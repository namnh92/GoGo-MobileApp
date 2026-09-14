import { describe, expect, it } from 'vitest'

import { redirectSystemPath } from '@/app/+native-intent'

const CODE = 'YDi_00PB1z4FSQZjpLbgdw'
const ID = '311f5bd8-f853-4ced-af68-e04398d1451a'

/**
 * GoGo-MobileApp#203. Smoke 2026-09-10 D7: `gogo-dev://room/<inviteCode>` opened
 * the lobby with the code as a room id and the app asked `GET /rooms/<code>` —
 * 400. Expo Router calls this for the launch URL and for every URL after.
 */
describe('+native-intent', () => {
  it('rewrites an invite code in a room link on cold and warm start alike', () => {
    for (const initial of [true, false]) {
      expect(redirectSystemPath({ path: `gogo-dev://room/${CODE}`, initial })).toBe(`gogo-dev://r/${CODE}`)
    }
  })

  it('leaves a room id, a universal invite link and a share link as they are', () => {
    for (const path of [`gogo-dev://room/${ID}`, `https://go-dev.gogo.id.vn/r/${CODE}`, 'https://go-dev.gogo.id.vn/l/Af82Xc']) {
      expect(redirectSystemPath({ path, initial: true })).toBe(path)
      expect(redirectSystemPath({ path, initial: false })).toBe(path)
    }
  })
})
