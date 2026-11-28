export type Mode = 'login' | 'register'
export type Errors = Partial<Record<'name' | 'email' | 'password', string>>

export const MIN_PASSWORD = 8
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validate(mode: Mode, name: string, email: string, password: string): Errors {
  const errors: Errors = {}
  if (mode === 'register' && !name.trim()) errors.name = 'Enter your name.'
  if (!email.trim()) errors.email = 'Enter your email address.'
  else if (!EMAIL.test(email.trim())) errors.email = 'Enter an email address like name@example.com.'
  if (!password) errors.password = mode === 'login' ? 'Enter your password.' : 'Choose a password.'
  else if (mode === 'register' && password.length < MIN_PASSWORD) errors.password = `Use at least ${MIN_PASSWORD} characters.`
  return errors
}
