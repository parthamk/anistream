
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LockKeyhole, Mail, User } from 'lucide-react'

import { useAuth } from '../context/AuthContext'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Signup() {
  const { signUp, user, loading: authLoading } = useAuth()

  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (authLoading) {
    return <div className="min-h-[70vh]" />
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()

    setError('')
    setMessage('')

    if (username.trim().length < 3) {
      setError('Username must contain at least 3 characters.')
      return
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      setError('Please enter a valid email address.')
      return
    }

    if (password.length < 8) {
      setError('Password must contain at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)

    try {
      const result = await signUp(
        email,
        password,
        username
      )

      setMessage(result.message)

      if (result.requiresEmailConfirmation) {
        return
      }

      navigate('/')
    } catch (err) {
      setError(
        err.message || 'Unable to create your account.'
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
            Join <span className="text-brand-500">AniStream</span>
          </h1>

          <p className="mt-3 text-sm text-zinc-400">
            Create an account to save your anime journey.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          <div>
            <label
              htmlFor="username"
              className="mb-2 block text-sm font-medium text-zinc-300"
            >
              Username
            </label>

            <div className="relative">
              <User
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
              />

              <input
                id="username"
                type="text"
                autoComplete="username"
                required
                minLength={3}
                maxLength={30}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Your username"
                className="w-full rounded-lg border border-white/10 bg-dark-800 py-3 pl-10 pr-4 text-sm text-white outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="signup-email"
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
                id="signup-email"
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
              htmlFor="signup-password"
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
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
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

          <div>
            <label
              htmlFor="confirm-password"
              className="mb-2 block text-sm font-medium text-zinc-300"
            >
              Confirm password
            </label>

            <input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Enter your password again"
              className="w-full rounded-lg border border-white/10 bg-dark-800 px-4 py-3 text-sm text-white outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400"
            >
              {error}
            </div>
          )}

          {message && (
            <div
              role="status"
              className="rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-sm leading-relaxed text-green-400"
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brand-600 py-3 font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-7 text-center text-sm text-zinc-400">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-semibold text-brand-400 hover:text-brand-300"
          >
            Log in
          </Link>
        </p>
      </div>
    </main>
  )
}
