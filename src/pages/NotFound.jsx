
import { Link } from 'react-router-dom'
import { Home, Search } from 'lucide-react'

export default function NotFound() {
  return (
    <main className="flex min-h-[75vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-8xl font-black tracking-tighter text-brand-500 sm:text-9xl">
        404
      </p>

      <h1 className="mt-5 text-2xl font-bold text-white sm:text-3xl">
        Lost in another dimension?
      </h1>

      <p className="mt-3 max-w-md text-sm leading-7 text-zinc-400">
        The page you're looking for doesn't exist or may have moved.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-500"
        >
          <Home size={17} />
          Go home
        </Link>

        <Link
          to="/search"
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-dark-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-dark-700"
        >
          <Search size={17} />
          Discover anime
        </Link>
      </div>
    </main>
  )
}
