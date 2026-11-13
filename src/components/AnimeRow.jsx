
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import AnimeCard from './AnimeCard'

export default function AnimeRow({
  title,
  anime = [],
  loading = false,
  emptyMessage = 'No anime found.'
}) {
  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
          {title}
        </h2>

        <Link
          to="/search"
          className="flex items-center gap-1 text-sm text-brand-400 transition hover:text-brand-300"
        >
          Explore
          <ChevronRight size={17} />
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-flow-col auto-cols-[42%] gap-4 overflow-hidden sm:auto-cols-[28%] md:auto-cols-[20%] lg:auto-cols-[15%]">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="animate-pulse"
            >
              <div className="aspect-[3/4] rounded-xl bg-dark-700" />
              <div className="mt-3 h-4 w-4/5 rounded bg-dark-700" />
            </div>
          ))}
        </div>
      ) : anime.length > 0 ? (
        <div className="scrollbar-none flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3">
          {anime.map((item) => (
            <div
              key={item.id}
              className="w-[42%] shrink-0 snap-start sm:w-[28%] md:w-[20%] lg:w-[15%]"
            >
              <AnimeCard anime={item} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">
          {emptyMessage}
        </p>
      )}
    </section>
  )
}
