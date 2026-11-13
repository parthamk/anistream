
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Login() {
  const { signIn, user, loading: authLoading } = useAuth()
  const { showToast } = useToast()

  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (authLoading) {
    return (
      <div className="min-h-[70vh]" />
    )
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!EMAIL_REGEX.test(email.trim())) {
      setError('Please enter a valid email address.')
      return
    }

    if (password.length < 8) {
      setError('Password must contain at least 8 characters.')
      return
    }

    setSubmitting(true)

    try {
      await signIn(email, password)

      showToast('Welcome back!', 'success')

      const destination = location.state?.from

      navigate(
        destination
          ? `${destination.pathname || '/'}${destination.search || ''}${destination.hash || ''}`
          : '/',
        { replace: true }
      )
    } catch (err) {
      setError(
        err.message || 'Unable to sign in. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-[75vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-dark-900 p-6 shadow-2xl sm:p-9">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold text-white">
            Welcome <span className="text-brand-500">back</span>
          </h1>

          <p className="mt-3 text-sm text-zinc-400">
            Sign in to continue your anime journey.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-zinc-300"
            >
              Email address
            </label>

            <div className="relative">
              <Mail
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
              />

              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-white/10 bg-dark-800 py-3 pl-10 pr-4 text-sm text-white outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-zinc-300"
            >
              Password
            </label>

            <div className="relative">
              <LockKeyhole
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
              />

              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-lg border border-white/10 bg-dark-800 py-3 pl-10 pr-12 text-sm text-white outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center rounded-lg bg-brand-600 py-3 font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Signing in...' : 'Log in'}
          </button>
        </form>

        <p className="mt-7 text-center text-sm text-zinc-400">
          Don't have an account?{' '}
          <Link
            to="/signup"
            className="font-semibold text-brand-400 hover:text-brand-300"
          >
            Sign up
          </Link>
        </p>
      </div>
    </main>
  )
}
