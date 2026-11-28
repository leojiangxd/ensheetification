import { Link, useLocation } from 'react-router'

export function Header() {
  const onAuthPage = ['/login', '/register'].includes(useLocation().pathname)
  return (
    <header className="site-header wrap">
      <Link to="/" className="wordmark">ensheetification</Link>
      <nav aria-label="Main">
        <a href="/#levels">Levels</a>
        <a href="/#how">How it works</a>
        <a href="/#outputs">What you get</a>
      </nav>
      {!onAuthPage && <Link to="/login" className="secondary header-cta">Log in</Link>}
    </header>
  )
}
