
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, CheckCircle2, Clock3, Heart, Play } from 'lucide-react';
import { getAllWatched, getLibraryEntries } from '../lib/db';
import { useContinueWatching } from '../hooks/useContinueWatching';
import { useToast } from '../context/ToastContext';

const TABS = [
  { id: 'favorites', label: 'Favourites', icon: Heart },
  { id: 'watchlist', label: 'Watch Later', icon: Bookmark },
  { id: 'watched', label: 'Watched', icon: CheckCircle2 },
  { id: 'continue', label: 'Continue Watching', icon: Clock3 },
];

function AnimeTile({ anime, children }) {
  const animeId = anime.anime_id;
  const title = anime.title || `Anime ${animeId}`;

  return (
    <article className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      <Link to={`/anime/${animeId}`} className="block">
        <div className="aspect-[3/4] overflow-hidden bg-white/5">
          {anime.cover_url ? (
            <img
              src={anime.cover_url}
              alt={title}
              className="h-full w-full object-cover transition duration-300 hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              No cover
            </div>
          )}
        </div>
        <div className="p-3">
          <h3 className="line-clamp-2 min-h-10 font-semibold text-white">{title}</h3>
        </div>
      </Link>
      {children && <div className="px-3 pb-3">{children}</div>}
    </article>
  );
}

function EmptyState({ message }) {
  return (
    <div className="col-span-full rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
      <p className="text-gray-400">{message}</p>
      <Link
        to="/search"
        className="mt-4 inline-flex rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500"
      >
        Browse anime
      </Link>
    </div>
  );
}

export default function Library() {
  const [activeTab, setActiveTab] = useState('favorites');
  const [entries, setEntries] = useState([]);
  const [watchedRows, setWatchedRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const { items: continueItems, loading: continueLoading } = useContinueWatching(30);
  const { showToast } = useToast();

  useEffect(() => {
    let active = true;

    async function loadLibrary() {
      setLoading(true);
      const [libraryResult, watchedResult] = await Promise.all([
        getLibraryEntries(),
        getAllWatched(),
      ]);

      if (!active) return;

      if (libraryResult.error) showToast(libraryResult.error.message, 'error');
      if (watchedResult.error) showToast(watchedResult.error.message, 'error');

      setEntries(libraryResult.data || []);
      setWatchedRows(watchedResult.data || []);
      setLoading(false);
    }

    loadLibrary();

    return () => {
      active = false;
    };
  }, [showToast]);

  const entryById = useMemo(
    () => new Map(entries.map((entry) => [Number(entry.anime_id), entry])),
    [entries],
  );

  const favorites = entries.filter((entry) => entry.is_favorite);
  const watchlist = entries.filter((entry) => entry.in_watchlist);

  const watchedGroups = useMemo(() => {
    const groups = new Map();

    for (const row of watchedRows) {
      const id = Number(row.anime_id);
      if (!groups.has(id)) {
        const entry = entryById.get(id);
        groups.set(id, {
          anime_id: id,
          title: entry?.title || `Anime ${id}`,
          cover_url: entry?.cover_url || null,
          episodes: new Set(),
        });
      }
      groups.get(id).episodes.add(Number(row.episode_number));
    }

    return [...groups.values()].map((group) => ({
      ...group,
      episodeCount: group.episodes.size,
    }));
  }, [entryById, watchedRows]);

  const continueWithAnime = continueItems.map((item) => {
    const entry = entryById.get(Number(item.anime_id));
    return {
      ...item,
      title: item.title || entry?.title || `Anime ${item.anime_id}`,
      cover_url: item.cover_url || entry?.cover_url || null,
    };
  });

  const selectedItems = {
    favorites,
    watchlist,
    watched: watchedGroups,
    continue: continueWithAnime,
  }[activeTab];

  const isLoading =
    loading || (activeTab === 'continue' && continueLoading);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-10">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-purple-400">
          Your collection
        </p>
        <h1 className="mt-2 text-3xl font-extrabold text-white">My Library</h1>
      </div>

      <div className="mb-8 flex gap-2 overflow-x-auto border-b border-white/10 pb-3">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeTab === id
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="animate-pulse">
              <div className="aspect-[3/4] rounded-xl bg-white/5" />
              <div className="mt-3 h-4 rounded bg-white/5" />
            </div>
          ))}
        </div>
      ) : selectedItems.length === 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          <EmptyState
            message={
              activeTab === 'favorites'
                ? 'You have not added any favourites yet.'
                : activeTab === 'watchlist'
                  ? 'Your Watch Later list is empty.'
                  : activeTab === 'watched'
                    ? 'You have not marked any episodes as watched.'
                    : 'No unfinished episodes to continue right now.'
            }
          />
        </div>
      ) : activeTab === 'continue' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {continueWithAnime.map((item) => {
            const duration = Number(item.duration_seconds) || 0;
            const position = Number(item.position_seconds) || 0;
            const ratio = duration > 0 ? Math.min(1, position / duration) : 0;

            return (
              <article
                key={`${item.anime_id}-${item.episode_number}`}
                className="flex gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3"
              >
                <Link
                  to={`/anime/${item.anime_id}`}
                  className="h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-white/5"
                >
                  {item.cover_url && (
                    <img
                      src={item.cover_url}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  )}
                </Link>
                <div className="min-w-0 flex-1 py-1">
                  <Link
                    to={`/anime/${item.anime_id}`}
                    className="line-clamp-2 font-semibold text-white hover:text-purple-300"
                  >
                    {item.title}
                  </Link>
                  <p className="mt-2 text-sm text-gray-400">
                    Ep {item.episode_number}
                  </p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-purple-500"
                      style={{ width: `${ratio * 100}%` }}
                    />
                  </div>
                  <Link
                    to={`/watch/${item.anime_id}/${item.episode_number}`}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-purple-300 hover:text-purple-200"
                  >
                    <Play size={14} fill="currentColor" />
                    Resume
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {activeTab === 'watched'
            ? watchedGroups.map((anime) => (
                <AnimeTile key={anime.anime_id} anime={anime}>
                  <p className="text-xs text-green-400">
                    {anime.episodeCount} episode
                    {anime.episodeCount === 1 ? '' : 's'} watched
                  </p>
                </AnimeTile>
              ))
            : selectedItems.map((anime) => (
                <AnimeTile key={anime.anime_id} anime={anime} />
              ))}
        </div>
      )}
    </main>
  );
}
