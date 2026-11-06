/** Owner 2026-11-06: registration/reset only. Login remains 1..128. */
export function passwordRequirements(value: string) {
  return {
    length: value.length >= 8,
    upper: /[A-Z]/.test(value),
    lower: /[a-z]/.test(value),
    digit: /[0-9]/.test(value),
    special: /[^A-Za-z0-9\s]/.test(value),
  }
}
export const meetsPasswordRequirements = (value: string) => Object.values(passwordRequirements(value)).every(Boolean)
