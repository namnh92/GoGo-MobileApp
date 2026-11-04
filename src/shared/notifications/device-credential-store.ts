import { z } from 'zod'

/**
 * GoGo-MobileApp#398 (shape D2, D3, R-17) — where the device credential lives.
 * Keychain/Keystore only, never a log.
 *
 * Two entries. `push.device` is the identity in use. `push.device.retiring` holds
 * credentials waiting for the server to retire them (R-17b): a credential moves
 * there before anything else happens to it, survives restarts, is never read back
 * as an identity, and leaves only when the server answered 2xx or GONE.
 */
export const DEVICE_CREDENTIAL_KEY = 'push.device'
export const DEVICE_RETIRING_KEY = 'push.device.retiring'

/** Android warns above 2048 bytes per value. A credential is under 100. */
export const MAX_RETIRING_CREDENTIALS = 16

const credentialSchema = z.object({ deviceId: z.string().min(1), deviceSecret: z.string().min(1) })

export type DeviceCredential = z.infer<typeof credentialSchema>

export interface DeviceCredentialStorage {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
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

export function createDeviceCredentialStore(
  storage: DeviceCredentialStorage,
  report: (event: string) => void = () => {},
) {
  async function retiring(): Promise<DeviceCredential[]> {
    return parse(await storage.get(DEVICE_RETIRING_KEY), z.array(credentialSchema)) ?? []
  }

  async function writeRetiring(list: DeviceCredential[]): Promise<void> {
    if (list.length === 0) await storage.remove(DEVICE_RETIRING_KEY)
    else await storage.set(DEVICE_RETIRING_KEY, JSON.stringify(list))
  }

  return {
    read: async (): Promise<DeviceCredential | null> =>
      parse(await storage.get(DEVICE_CREDENTIAL_KEY), credentialSchema),

    write: (credential: DeviceCredential): Promise<void> =>
      storage.set(DEVICE_CREDENTIAL_KEY, JSON.stringify(credential)),

    clear: (): Promise<void> => storage.remove(DEVICE_CREDENTIAL_KEY),

    retiring,

    /** Written to the retiring list first: a crash between the two leaves it in both, never in neither. */
    async quarantine(credential: DeviceCredential): Promise<void> {
      const list = await retiring()
      if (!list.some(entry => entry.deviceId === credential.deviceId)) {
        const next = [...list, credential]
        // The oldest gives way: the server expires a quiet identity without us.
        if (next.length > MAX_RETIRING_CREDENTIALS) {
          next.shift()
          report('push_device_retiring_overflow')
        }
        await writeRetiring(next)
      }
      await storage.remove(DEVICE_CREDENTIAL_KEY)
    },

    async retired(deviceId: string): Promise<void> {
      await writeRetiring((await retiring()).filter(entry => entry.deviceId !== deviceId))
    },
  }
}

export type DeviceCredentialStore = ReturnType<typeof createDeviceCredentialStore>
