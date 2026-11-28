import { useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Header } from '../components/Header'
import { MIN_PASSWORD, validate, type Errors, type Mode } from '../auth'

const COPY = {
  login: { title: 'Welcome back', lede: 'Log in to pick up where you left off.', submit: 'Log in' },
  register: { title: 'Create your account', lede: 'Sign up to keep your arrangements in one place.', submit: 'Create account' },
}

export function Auth({ mode }: { mode: Mode }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  // Errors belong to the mode they were found in, so switching tabs clears them but keeps what was typed.
  const [checked, setChecked] = useState<{ mode: Mode; errors: Errors }>({ mode, errors: {} })
  const errors = checked.mode === mode ? checked.errors : {}
  const id = useId()
  const copy = COPY[mode]

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const found = validate(mode, name, email, password)
    setChecked({ mode, errors: found })
    const firstInvalid = (['name', 'email', 'password'] as const).find((k) => found[k])
    if (firstInvalid) return document.getElementById(`${id}-${firstInvalid}`)?.focus()
    alert(
      mode === 'login'
        ? `Log in as ${email.trim()}.\n\nComing soon: this will check your password with the server and sign you in.`
        : `Create an account for ${name.trim()} (${email.trim()}).\n\nComing soon: this will create the account on the server and sign you in.`,
    )
  }

  function field(key: keyof Errors) {
    return {
      id: `${id}-${key}`,
      'aria-invalid': !!errors[key],
      'aria-describedby': errors[key] ? `${id}-${key}-error` : key === 'password' && mode === 'register' ? `${id}-password-hint` : undefined,
    }
  }

  function error(key: keyof Errors) {
    return errors[key] && <p className="error" id={`${id}-${key}-error`}>{errors[key]}</p>
  }

  return (
    <>
      <title>{`${copy.submit} - ensheetification`}</title>
      <Header />
      <main className="auth wrap">
        <div className="auth-copy">
          <h1>{copy.title}</h1>
          <p className="lede">{copy.lede}</p>
        </div>

        <form className="submit auth-form" onSubmit={submit} noValidate>
          <nav className="tabs" aria-label="Account">
            <Link to="/login" aria-current={mode === 'login' ? 'page' : undefined}>Log in</Link>
            <Link to="/register" aria-current={mode === 'register' ? 'page' : undefined}>Sign up</Link>
          </nav>

          {mode === 'register' && (
            <>
              <label className="field-label" htmlFor={`${id}-name`}>Name</label>
              <input {...field('name')} className="text-input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
              {error('name')}
            </>
          )}

          <label className="field-label" htmlFor={`${id}-email`}>Email</label>
          <input {...field('email')} className="text-input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {error('email')}

          <div className="label-row">
            <label className="field-label" htmlFor={`${id}-password`}>Password</label>
            {mode === 'login' && (
              <button
                type="button"
                className="link-button small"
                onClick={() => alert(`Coming soon: this will email ${email.trim() || 'you'} a link to reset your password.`)}
              >
                Forgot password?
              </button>
            )}
          </div>
          <div className="password-row">
            <input
              {...field('password')}
              className="text-input"
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" className="link-button small" aria-pressed={showPassword} onClick={() => setShowPassword((v) => !v)}>
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {error('password') ||
            (mode === 'register' && <p className="hint" id={`${id}-password-hint`}>At least {MIN_PASSWORD} characters.</p>)}

          <button type="submit" className="primary">{copy.submit}</button>
        </form>
      </main>
    </>
  )
}
