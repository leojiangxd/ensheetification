import { expect, test } from 'vitest'
import { validate } from './auth'

test('login needs email and password, not a name', () => {
  expect(validate('login', '', '', '')).toEqual({ email: 'Enter your email address.', password: 'Enter your password.' })
  expect(validate('login', '', 'a@b.co', 'x')).toEqual({})
})

test('register checks name, email format and password length', () => {
  expect(validate('register', ' ', 'not-an-email', 'short')).toEqual({
    name: 'Enter your name.',
    email: 'Enter an email address like name@example.com.',
    password: 'Use at least 8 characters.',
  })
  expect(validate('register', 'Ada', ' ada@example.com ', '12345678')).toEqual({})
})
