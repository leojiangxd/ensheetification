import { Link, NavLink, useLocation, useNavigate } from 'react-router'
import { useSession } from '../session'

export function Header() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useSession()
  const onAuthPage = pathname === '/login' || pathname === '/register'

  async function logOut() {
    try {
      await logout()
      navigate('/')
    } catch (error) {
      alert((error as Error).message)
    }
  }

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
        {user ? (
          <button type="button" className="secondary" onClick={logOut}>Log out</button>
        ) : (
          user === null && !onAuthPage && <Link to="/login" className="secondary">Log in</Link>
        )}
      </div>
    </header>
  )
}
