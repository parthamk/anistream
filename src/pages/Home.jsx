
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import { getTrending, getPopular } from '../lib/anilist';
import { useAuth } from '../context/AuthContext';
import { useContinueWatching } from '../hooks/useContinueWatching';
import { useToast } from '../context/ToastContext';
import AnimeCard from '../components/AnimeCard';
import { AnimeCardSkeleton } from '../components/Skeletons';

function AnimeSection({ title, items, loading }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-xl font-bold text-white sm:text-2xl">{title}</h2>
      <div className="flex gap-4 overflow-x-auto pb-3">
        {loading
          ? Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="w-36 shrink-0 sm:w-44">
                <AnimeCardSkeleton />
              </div>
            ))
          : items.map((anime) => (
              <div key={anime.id} className="w-36 shrink-0 sm:w-44">
                <AnimeCard anime={anime} />
              </div>
            ))}
      </div>
    </section>
  );
}

function ContinueWatchingRow({ items }) {
  if (!items.length) return null;

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white sm:text-2xl">
          Continue Watching
        </h2>
        <Link
          to="/library"
          className="text-sm font-medium text-purple-400 hover:text-purple-300"
        >
          View library
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-3">
        {items.map((item) => {
          const duration = Number(item.duration_seconds) || 0;
          const position = Number(item.position_seconds) || 0;
          const ratio = duration > 0 ? Math.min(1, position / duration) : 0;
          const title = item.title || `Anime ${item.anime_id}`;

          return (
            <article
              key={`${item.anime_id}-${item.episode_number}`}
              className="w-64 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"
            >
              <Link
                to={`/anime/${item.anime_id}`}
                className="relative block aspect-video overflow-hidden bg-white/5"
              >
                {item.cover_url ? (
                  <img
                    src={item.cover_url}
                    alt={title}
                    className="h-full w-full object-cover transition duration-300 hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-gray-500">
                    AniStream
                  </div>
                )}
              </Link>

              <div className="p-3">
                <Link
                  to={`/anime/${item.anime_id}`}
                  className="line-clamp-1 font-semibold text-white hover:text-purple-300"
                >
                  {title}
                </Link>
                <p className="mt-1 text-sm text-gray-400">
                  Ep {item.episode_number}
                </p>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-purple-500"
                    style={{ width: `${ratio * 100}%` }}
                  />
                </div>
                <Link
                  to={`/watch/${item.anime_id}/${item.episode_number}`}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-500"
                >
                  <Play size={15} fill="currentColor" />
                  Resume
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function Home() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { items: continueItems, loading: continueLoading } =
    useContinueWatching(12);

  const [trending, setTrending] = useState([]);
  const [popular, setPopular] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [popularLoading, setPopularLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadTrending() {
      setTrendingLoading(true);
      try {
        const result = await getTrending(1);
        if (active) setTrending(result.media || []);
      } catch (error) {
        if (active) showToast(error.message || 'Could not load trending anime.', 'error');
      } finally {
        if (active) setTrendingLoading(false);
      }
    }

    async function loadPopular() {
      setPopularLoading(true);
      try {
        const result = await getPopular(1);
        if (active) setPopular(result.media || []);
      } catch (error) {
        if (active) showToast(error.message || 'Could not load popular anime.', 'error');
      } finally {
        if (active) setPopularLoading(false);
      }
    }

    loadTrending();
    loadPopular();

    return () => {
      active = false;
    };
  }, [showToast]);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8">
      <section className="relative mb-10 overflow-hidden rounded-2xl bg-gradient-to-r from-purple-950 via-slate-900 to-[#09090f] px-6 py-12 sm:px-10 sm:py-16">
        <div className="relative z-10 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-purple-300">
            Your anime destination
          </p>
          <h1 className="mt-3 text-4xl font-extrabold text-white sm:text-5xl">
            Discover your next favourite anime.
          </h1>
          <p className="mt-4 max-w-xl leading-7 text-gray-300">
            Explore trending series, find something new, and keep your
            episodes together in one place.
          </p>
          <Link
            to="/search"
            className="mt-7 inline-flex rounded-lg bg-purple-600 px-5 py-3 font-semibold text-white transition hover:bg-purple-500"
          >
            Explore anime
          </Link>
        </div>
      </section>

      {user && (
        continueLoading ? (
          <section className="mb-10 animate-pulse">
            <div className="mb-4 h-7 w-48 rounded bg-white/5" />
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 3 }, (_, index) => (
                <div
                  key={index}
                  className="h-52 w-64 shrink-0 rounded-xl bg-white/5"
                />
              ))}
            </div>
          </section>
        ) : (
          <ContinueWatchingRow items={continueItems} />
        )
      )}

      <AnimeSection
        title="Trending Now"
        items={trending}
        loading={trendingLoading}
      />

      <AnimeSection
        title="Popular Anime"
        items={popular}
        loading={popularLoading}
      />
    </main>
  );
}
