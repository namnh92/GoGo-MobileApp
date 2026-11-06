import { z } from 'zod'
import { meetsPasswordRequirements } from '@/shared/validation/password-policy'

/**
 * One schema per shape, shared by the form resolver and any other validation of
 * the same input. Login mirrors the existing contract; registration follows
 * the owner policy below while the BE contract gap is reported separately.
 */
export const signInSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128),
})

export const signUpSchema = z.object({
  displayName: z.string().trim().min(1).max(50),
  email: z.email().max(254),
  // Owner D3: min 8 + complexity; BE minLength 10 remains an explicit contract gap.
  password: z.string().min(8).max(128).refine(meetsPasswordRequirements),
})

export type SignInValues = z.infer<typeof signInSchema>
export type SignUpValues = z.infer<typeof signUpSchema>
