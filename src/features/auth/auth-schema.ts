import { z } from 'zod'

/**
 * One schema per shape, shared by the form resolver and any other validation of
 * the same input. Bounds mirror the contract so the server never has to reject
 * something the client could have caught.
 */
export const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
})

export const signUpSchema = z.object({
  displayName: z.string().trim().min(1).max(50),
  email: z.email().max(254),
  // The API enforces 10..128; matching it here keeps the error inline.
  password: z.string().min(10).max(128),
})

export type SignInValues = z.infer<typeof signInSchema>
export type SignUpValues = z.infer<typeof signUpSchema>
