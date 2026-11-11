import { describe, expect, it } from 'vitest'
import { recoveryPasswordSchema, signInSchema, signUpSchema } from './auth-schema'
import { passwordRequirements } from '@/shared/validation/password-policy'

const register = (password: string) => signUpSchema.safeParse({ displayName: 'An', email: 'an@example.com', password }).success
describe('owner D3 password policy', () => {
  it('accepts exactly eight characters with all four character classes', () => {
    expect(register('Abcdef1!')).toBe(true)
    expect(register('Abcde1!')).toBe(false)
  })
  it.each(['abcdef1!', 'ABCDEF1!', 'Abcdefg!', 'Abcdef12', 'Abcdef1 '])('rejects a missing requirement in %s', password => {
    expect(register(password)).toBe(false)
  })
  it('retains the 128-character ceiling', () => {
    expect(register('Aa1!' + 'x'.repeat(124))).toBe(true)
    expect(register('Aa1!' + 'x'.repeat(125))).toBe(false)
  })
  it.each(['a', '12345678', 'lowercase-only'])('does not apply registration rules to login (%s)', password => {
    expect(signInSchema.safeParse({ email: 'an@example.com', password }).success).toBe(true)
  })
  it('keeps login bounds 1..128', () => {
    for (const password of ['', 'x'.repeat(129)]) expect(signInSchema.safeParse({ email: 'an@example.com', password }).success).toBe(false)
  })
  it('reports individual requirements for the checklist', () => {
    expect(passwordRequirements('abcdefgh')).toEqual({ length: true, upper: false, lower: true, digit: false, special: false })
    expect(Object.values(passwordRequirements('Abcdef1!')).every(Boolean)).toBe(true)
  })
})

describe('recovery password confirmation', () => {
  it('requires matching passwords and the full password policy', () => {
    expect(recoveryPasswordSchema.safeParse({ password: 'Abcdef1!', confirmPassword: 'Abcdef1!' }).success).toBe(true)
    for (const values of [
      { password: 'Abcdef1!', confirmPassword: '' },
      { password: 'Abcdef1!', confirmPassword: 'Abcdef2!' },
      { password: 'weak', confirmPassword: 'weak' },
    ]) expect(recoveryPasswordSchema.safeParse(values).success).toBe(false)
    const result = recoveryPasswordSchema.safeParse({ password: 'Abcdef1!', confirmPassword: 'Abcdef2!' })
    expect(result.success ? [] : result.error.issues).toContainEqual(expect.objectContaining({ path: ['confirmPassword'], code: 'custom' }))
  })
})
