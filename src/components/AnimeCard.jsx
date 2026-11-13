
import { Link } from 'react-router-dom'
import { Star } from 'lucide-react'
import { getTitle, getEpisodeCount } from '../lib/anilist'

export default function AnimeCard({ anime }) {
  if (!anime) return null

  const title = getTitle(anime)
  const cover =
    anime.coverImage?.extraLarge ||
    anime.coverImage?.large

  return (
    <Link
      to={`/anime/${anime.id}`}
      className="group block min-w-0"
      aria-label={`View ${title}`}
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-dark-800">
        {cover ? (
          <img
            src={cover}
            alt={`${title} cover`}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            No image available
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />

        {anime.averageScore > 0 && (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-xs font-semibold text-yellow-400 backdrop-blur">
            <Star size={12} fill="currentColor" />
            {(anime.averageScore / 10).toFixed(1)}
          </div>
        )}

        <div className="absolute bottom-2 left-2 right-2">
          <span className="rounded bg-black/60 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-zinc-200">
            {anime.format || 'Anime'}
          </span>
        </div>
      </div>

      <h3 className="mt-3 line-clamp-2 text-sm font-semibold leading-snug text-zinc-200 transition group-hover:text-brand-400">
        {title}
      </h3>

      <p className="mt-1 text-xs text-zinc-500">
        {anime.episodes
          ? `${anime.episodes} Episodes`
          : `${getEpisodeCount(anime)}+ Episodes`}
        {anime.seasonYear ? ` · ${anime.seasonYear}` : ''}
      </p>
    </Link>
  )
}
