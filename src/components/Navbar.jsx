
import { useEffect, useState } from 'react'
import {
  Link,
  useLocation,
  useNavigate
} from 'react-router-dom'

import {
  Search,
  Menu,
  X,
  User,
  Library,
  LogOut,
  ShieldCheck,
  ChevronDown,
  Home
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const { showToast } = useToast()

  const navigate = useNavigate()
  const location = useLocation()

  const [search, setSearch] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(location.search)

    if (location.pathname === '/search') {
      setSearch(params.get('q') || '')
    }
  }, [location.pathname, location.search])

  useEffect(() => {
    const query = search.trim()

    if (!query) return undefined

    const timer = setTimeout(() => {
      navigate(`/search?q=${encodeURIComponent(query)}`)
    }, 500)

    return () => clearTimeout(timer)
  }, [search, navigate])

  function submitSearch(event) {
    event.preventDefault()

    const query = search.trim()

    if (!query) return

    navigate(`/search?q=${encodeURIComponent(query)}`)
    setMobileOpen(false)
  }

  async function handleLogout() {
    try {
      await signOut()

      setAccountOpen(false)
      setMobileOpen(false)

      showToast('You have been logged out.', 'success')
      navigate('/')
    } catch (error) {
      showToast(
        error.message || 'Unable to log out.',
        'error'
      )
    }
  }

  const navLinkClass =
    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white'

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-dark-950/90 backdrop-blur-xl">
      <nav
        className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8"
        aria-label="Main navigation"
      >
        <Link
          to="/"
          className="shrink-0 text-2xl font-extrabold tracking-tight text-white"
          aria-label="AniStream home"
        >
          Ani<span className="text-brand-500">Stream</span>
        </Link>

        <form
          onSubmit={submitSearch}
          className="relative ml-auto hidden max-w-md flex-1 md:block"
          role="search"
        >
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
          />

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search anime..."
            aria-label="Search anime"
            className="w-full rounded-full border border-white/10 bg-dark-800 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
        </form>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            to="/"
            className={navLinkClass}
          >
            <Home size={17} />
            Home
          </Link>

          <Link
            to="/library"
            className={navLinkClass}
          >
            <Library size={17} />
            Library
          </Link>

          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setAccountOpen(!accountOpen)}
                aria-expanded={accountOpen}
                aria-label="Account menu"
                className="flex items-center gap-2 rounded-full border border-white/10 bg-dark-800 px-3 py-2 text-sm text-white transition hover:bg-dark-700"
              >
                <User size={17} />
                <span className="max-w-28 truncate">
                  {profile?.username || user.email}
                </span>
                <ChevronDown size={15} />
              </button>

              {accountOpen && (
                <div className="absolute right-0 top-12 w-52 rounded-xl border border-white/10 bg-dark-800 p-2 shadow-2xl">
                  {profile?.is_admin && (
                    <Link
                      to="/admin/sources"
                      onClick={() => setAccountOpen(false)}
                      className={navLinkClass}
                    >
                      <ShieldCheck size={17} />
                      Admin
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={handleLogout}
                    className={`${navLinkClass} w-full`}
                  >
                    <LogOut size={17} />
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                to="/login"
                className={navLinkClass}
              >
                Log in
              </Link>

              <Link
                to="/signup"
                className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500"
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="ml-auto rounded-lg p-2 text-zinc-300 hover:bg-white/5 md:hidden"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={23} /> : <Menu size={23} />}
        </button>
      </nav>

      {mobileOpen && (
        <div className="border-t border-white/5 bg-dark-900 px-4 py-5 md:hidden">
          <form
            onSubmit={submitSearch}
            className="relative mb-4"
            role="search"
          >
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search anime..."
              aria-label="Search anime"
              className="w-full rounded-lg border border-white/10 bg-dark-800 py-3 pl-10 pr-4 text-sm text-white outline-none focus:border-brand-500"
            />
          </form>

          <div className="flex flex-col gap-1">
            <Link
              to="/"
              onClick={() => setMobileOpen(false)}
              className={navLinkClass}
            >
              <Home size={17} />
              Home
            </Link>

            <Link
              to="/library"
              onClick={() => setMobileOpen(false)}
              className={navLinkClass}
            >
              <Library size={17} />
              Library
            </Link>

            {user ? (
              <>
                {profile?.is_admin && (
                  <Link
                    to="/admin/sources"
                    onClick={() => setMobileOpen(false)}
                    className={navLinkClass}
                  >
                    <ShieldCheck size={17} />
                    Admin
                  </Link>
                )}

                <button
                  type="button"
                  onClick={handleLogout}
                  className={`${navLinkClass} text-left`}
                >
                  <LogOut size={17} />
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className={navLinkClass}
                >
                  Log in
                </Link>

                <Link
                  to="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="mt-2 rounded-lg bg-brand-600 px-4 py-3 text-center text-sm font-semibold text-white"
                >
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
