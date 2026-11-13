
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search as SearchIcon, RefreshCw } from 'lucide-react'

import { searchAnime } from '../lib/anilist'
import AnimeCard from '../components/AnimeCard'
import { GridSkeleton } from '../components/Skeletons'

export default function Search() {
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q')?.trim() || ''

  const [results, setResults] = useState([])
  const [page, setPage] = useState(1)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  const requestId = useRef(0)

  const loadResults = useCallback(async () => {
    const currentRequest = ++requestId.current

    setLoadingMore(false)
    setError('')
    setPage(1)
    setHasNextPage(false)

    if (!query) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    setResults([])

    try {
      const data = await searchAnime(query, 1)

      if (currentRequest !== requestId.current) return

      setResults(data.media || [])
      setHasNextPage(Boolean(data.pageInfo?.hasNextPage))
    } catch (err) {
      if (currentRequest !== requestId.current) return

      setError(err.message || 'Search failed.')
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false)
      }
    }
  }, [query])

  useEffect(() => {
    loadResults()

    return () => {
      requestId.current += 1
    }
  }, [loadResults])

  async function loadMore() {
    if (loadingMore || loading || !hasNextPage) return

    const nextPage = page + 1
    const currentRequest = requestId.current

    setLoadingMore(true)
    setError('')

    try {
      const data = await searchAnime(query, nextPage)

      if (currentRequest !== requestId.current) return

      setResults((current) => [
        ...current,
        ...(data.media || [])
      ])

      setPage(nextPage)
      setHasNextPage(Boolean(data.pageInfo?.hasNextPage))
    } catch (err) {
      if (currentRequest !== requestId.current) return

      setError(err.message || 'Unable to load more results.')
    } finally {
      if (currentRequest === requestId.current) {
        setLoadingMore(false)
      }
    }
  }

  return (
    <main className="mx-auto min-h-[65vh] max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white sm:text-4xl">
          Discover <span className="text-brand-500">Anime</span>
        </h1>

        <p className="mt-3 text-sm text-zinc-400">
          {query
            ? `Search results for "${query}"`
            : 'Search for your favourite anime series and movies.'}
        </p>
      </div>

      {!query ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-dark-900 text-center">
          <SearchIcon size={42} className="text-brand-500" />

          <h2 className="mt-5 text-xl font-bold text-white">
            Find your next anime
          </h2>

          <p className="mt-2 text-sm text-zinc-500">
            Enter an anime title in the search bar above.
          </p>
        </div>
      ) : loading ? (
        <GridSkeleton count={12} />
      ) : error && results.length === 0 ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <p className="text-sm text-red-400">{error}</p>

          <button
            type="button"
            onClick={loadResults}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-500"
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      ) : results.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl bg-dark-900 text-center">
          <SearchIcon size={38} className="text-zinc-600" />

          <h2 className="mt-5 text-xl font-bold text-white">
            No anime found
          </h2>

          <p className="mt-2 text-sm text-zinc-500">
            Try another title or check your spelling.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {results.map((anime) => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>

          {error && (
            <p role="alert" className="mt-6 text-center text-sm text-red-400">
              {error}
            </p>
          )}

          {hasNextPage && (
            <div className="mt-12 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-lg bg-dark-700 px-8 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
              >
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}

          {loadingMore && (
            <div className="mt-8">
              <GridSkeleton count={6} />
            </div>
          )}
        </>
      )}
    </main>
  )
}
