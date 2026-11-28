import { Link, NavLink, useLocation } from 'react-router'

export function Header() {
  const { pathname } = useLocation()
  const onAuthPage = pathname === '/login' || pathname === '/register'
  return (
    <header className="site-header wrap">
      <Link to="/" className="wordmark">ensheetification</Link>
      {pathname === '/' && (
        <nav aria-label="Sections">
          <a href="#levels">Levels</a>
          <a href="#how">How it works</a>
          <a href="#outputs">What you get</a>
        </nav>
      )}
      <div className="header-end">
        <NavLink to="/songs" className="header-link">My songs</NavLink>
        {!onAuthPage && <Link to="/login" className="secondary">Log in</Link>}
      </div>
    </header>
  )
}
