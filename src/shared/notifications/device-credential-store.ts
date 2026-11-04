import { z } from 'zod'

import { deleteSecureItem, getSecureItem, setSecureItem } from '@/shared/storage/secure-store'

/**
 * GoGo-MobileApp#398 (shape D2, D3, R-17) — where the device credential lives.
 * Keychain/Keystore only, never a log.
 *
 * Two kinds of entry. `push.device` is the identity in use. `push.device.retiring`
 * and its numbered pages hold credentials waiting for the server to retire them
 * (R-17b): a credential moves there before anything else happens to it, survives
 * restarts, and leaves only when the server answered 2xx or GONE. The retiring
 * list wins: a credential on it is never read back as the identity in use, even
 * when removing the active entry failed.
 *
 * Reads are strict. "Could not look" must not pass for "nothing there", or the
 * next write would replace a list nobody read. A device whose Keychain keeps
 * refusing therefore holds no identity at all, and says so in the reason codes.
 */
export const DEVICE_CREDENTIAL_KEY = 'push.device'
export const DEVICE_RETIRING_KEY = 'push.device.retiring'

/** Android warns above 2048 bytes per value. A credential is under 100. */
export const RETIRING_PAGE_SIZE = 16

const credentialSchema = z.object({ deviceId: z.string().min(1), deviceSecret: z.string().min(1) })

export type DeviceCredential = z.infer<typeof credentialSchema>

export interface DeviceCredentialStorage {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

export const secureDeviceCredentialStorage: DeviceCredentialStorage = {
  get: key => getSecureItem(key, true),
  set: setSecureItem,
  remove: key => deleteSecureItem(key, true),
}

function parse<T>(raw: string | null, schema: z.ZodType<T>): T | null {
  if (!raw) return null
  try {
    const parsed = schema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

const pageKey = (page: number) => (page === 0 ? DEVICE_RETIRING_KEY : `${DEVICE_RETIRING_KEY}.${page}`)

export function createDeviceCredentialStore(storage: DeviceCredentialStorage) {
  async function retiring(): Promise<DeviceCredential[]> {
    const all: DeviceCredential[] = []
    for (let page = 0; ; page += 1) {
      const raw = await storage.get(pageKey(page))
      if (raw === null) return all
      all.push(...(parse(raw, z.array(credentialSchema)) ?? []))
    }
  }

  /** New pages first, the one past the end last: a crash leaves extra entries, never fewer. */
  async function writeRetiring(list: DeviceCredential[], previousLength: number): Promise<void> {
    const pages = Math.ceil(list.length / RETIRING_PAGE_SIZE)
    for (let page = 0; page < pages; page += 1) {
      const slice = list.slice(page * RETIRING_PAGE_SIZE, (page + 1) * RETIRING_PAGE_SIZE)
      await storage.set(pageKey(page), JSON.stringify(slice))
    }
    const previousPages = Math.ceil(previousLength / RETIRING_PAGE_SIZE)
    for (let page = previousPages - 1; page >= pages; page -= 1) await storage.remove(pageKey(page))
  }

  return {
    async read(): Promise<DeviceCredential | null> {
      const active = parse(await storage.get(DEVICE_CREDENTIAL_KEY), credentialSchema)
      if (!active) return null
      if ((await retiring()).some(entry => entry.deviceId === active.deviceId)) {
        await storage.remove(DEVICE_CREDENTIAL_KEY).catch(() => {})
        return null
      }
      return active
    },

    write: (credential: DeviceCredential): Promise<void> =>
      storage.set(DEVICE_CREDENTIAL_KEY, JSON.stringify(credential)),

    clear: (): Promise<void> => storage.remove(DEVICE_CREDENTIAL_KEY),

    retiring,

    /**
     * Written to the retiring list first: a crash between the two leaves it in
     * both, never in neither. Resolves once the list names the credential; a
     * failed removal of the active entry is reported in the result, not thrown,
     * because the list is what decides (`read()` excludes it, `retired()` drops
     * it) and the caller must know the quarantine holds (Sol r3 F-11).
     */
    async quarantine(credential: DeviceCredential): Promise<{ activeRemoved: boolean }> {
      const list = await retiring()
      if (!list.some(entry => entry.deviceId === credential.deviceId)) {
        await writeRetiring([...list, credential], list.length)
      }
      const activeRemoved = await storage.remove(DEVICE_CREDENTIAL_KEY).then(
        () => true,
        () => false,
      )
      return { activeRemoved }
    },

    /**
     * The active entry goes first when it is the same identity: a removal that
     * failed at quarantine time would otherwise come back as the identity in use
     * the moment the list stops naming it (Sol r2 F-10). A failure here leaves the
     * entry on the list; the next DELETE answers GONE and ends here again.
     */
    async retired(deviceId: string): Promise<void> {
      const active = parse(await storage.get(DEVICE_CREDENTIAL_KEY), credentialSchema)
      if (active?.deviceId === deviceId) await storage.remove(DEVICE_CREDENTIAL_KEY)
      const list = await retiring()
      await writeRetiring(list.filter(entry => entry.deviceId !== deviceId), list.length)
    },
  }
}

export type DeviceCredentialStore = ReturnType<typeof createDeviceCredentialStore>
