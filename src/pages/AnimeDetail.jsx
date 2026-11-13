
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Bookmark, Check, CheckCircle2, Heart, Play, RotateCcw } from 'lucide-react';
import { getAnimeById, getEpisodeCount, getTitle } from '../lib/anilist';
import { getProgress, getSourcesForAnime } from '../lib/db';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLibraryEntry } from '../hooks/useLibraryEntry';
import { useWatched } from '../hooks/useWatched';

function cleanDescription(description = '') {
  return description
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export default function AnimeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [anime, setAnime] = useState(null);
  const [sources, setSources] = useState([]);
  const [progressByEpisode, setProgressByEpisode] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyEpisode, setBusyEpisode] = useState(null);

  const {
    toggleFavorite,
    toggleWatchlist,
    isFavorite,
    isInWatchlist,
  } = useLibraryEntry(anime);

  const {
    isWatched,
    toggleWatched,
    markWatchedUpTo,
    loading: watchedLoading,
  } = useWatched(id);

  useEffect(() => {
    let active = true;

    async function loadAnime() {
      setLoading(true);
      setAnime(null);
      setSources([]);
      setProgressByEpisode({});

      try {
        const result = await getAnimeById(id);
        if (!active) return;

        if (!result) {
          setLoading(false);
          return;
        }

        setAnime(result);

        const sourceResult = await getSourcesForAnime(id);
        if (!active) return;

        if (sourceResult.error) {
          showToast(sourceResult.error.message, 'error');
        } else {
          setSources(sourceResult.data || []);
        }

        const count = getEpisodeCount(result);

        if (user && count > 0) {
          const results = await Promise.all(
            Array.from({ length: count }, (_, index) =>
              getProgress(id, index + 1),
            ),
          );

          if (!active) return;

          const nextProgress = {};
          results.forEach((item, index) => {
            if (item.data) nextProgress[index + 1] = item.data;
          });
          setProgressByEpisode(nextProgress);
        }
      } catch (error) {
        if (active) {
          showToast(error.message || 'Could not load anime details.', 'error');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAnime();

    return () => {
      active = false;
    };
  }, [id, showToast, user?.id]);

  const episodeCount = anime ? getEpisodeCount(anime) : 0;
  const title = anime ? getTitle(anime) : 'Anime';

  const episodes = useMemo(
    () => Array.from({ length: episodeCount }, (_, index) => index + 1),
    [episodeCount],
  );

  const sourcesByEpisode = useMemo(() => {
    const grouped = new Map();

    for (const source of sources) {
      const number = Number(source.episode_number);
      if (!grouped.has(number)) grouped.set(number, new Set());
      grouped.get(number).add(source.language);
    }

    return grouped;
  }, [sources]);

  const requireLogin = useCallback(() => {
    navigate('/login', {
      state: {
        from: {
          pathname: location.pathname,
          search: location.search,
          hash: location.hash,
        },
      },
    });
  }, [location.hash, location.pathname, location.search, navigate]);

  const handleSave = async (action, enabled) => {
    if (!user) {
      requireLogin();
      return;
    }
    await action(enabled);
  };

  const handleWatchedToggle = async (episode) => {
    if (!user) {
      requireLogin();
      return;
    }

    setBusyEpisode(episode);
    await toggleWatched(episode);
    setBusyEpisode(null);
  };

  const handleMarkUpTo = async (episode) => {
    if (!user) {
      requireLogin();
      return;
    }
    await markWatchedUpTo(episode);
  };

  const continueEpisode = useMemo(() => {
    if (!episodeCount) return 1;

    const unfinished = Object.entries(progressByEpisode)
      .map(([number, progress]) => {
        const duration = Number(progress.duration_seconds) || 0;
        const position = Number(progress.position_seconds) || 0;

        return {
          episode: Number(number),
          ratio: duration > 0 ? position / duration : 0,
        };
      })
      .filter((item) => item.ratio < 0.9)
      .sort((a, b) => b.episode - a.episode);

    if (unfinished.length) return unfinished[0].episode;

    return episodes.find((episode) => !isWatched(episode)) || 1;
  }, [episodeCount, episodes, isWatched, progressByEpisode]);

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-7xl animate-pulse px-4 py-10">
        <div className="h-64 rounded-2xl bg-white/5" />
        <div className="mt-6 h-8 w-1/2 rounded bg-white/5" />
        <div className="mt-4 h-4 w-3/4 rounded bg-white/5" />
      </main>
    );
  }

  if (!anime) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-white">Anime not found</h1>
        <Link to="/" className="mt-4 inline-block text-purple-400 hover:text-purple-300">
          Back to home
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-16">
      <div className="relative h-56 overflow-hidden sm:h-80 lg:h-[26rem]">
        {anime.bannerImage ? (
          <img src={anime.bannerImage} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-purple-950 to-slate-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090f] via-[#09090f]/50 to-black/20" />
      </div>

      <section className="relative mx-auto -mt-32 flex max-w-7xl flex-col gap-6 px-4 sm:-mt-40 sm:flex-row sm:items-end">
        <img
          src={anime.coverImage?.extraLarge || anime.coverImage?.large}
          alt={title}
          className="h-56 w-40 rounded-xl object-cover shadow-2xl sm:h-64 sm:w-44"
        />

        <div className="min-w-0 flex-1 pb-2">
          <p className="text-sm font-semibold uppercase tracking-widest text-purple-300">
            {anime.format || 'Anime'}
            {anime.seasonYear ? ` · ${anime.seasonYear}` : ''}
          </p>
          <h1 className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">{title}</h1>

          {anime.title?.romaji && anime.title.english && (
            <p className="mt-1 text-sm text-gray-400">{anime.title.romaji}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-300">
            {anime.episodes && <span>{anime.episodes} episodes</span>}
            {anime.status && <span>{anime.status.replaceAll('_', ' ')}</span>}
            {anime.averageScore && <span>Score {anime.averageScore}%</span>}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => handleSave(toggleFavorite, !isFavorite)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                isFavorite ? 'bg-pink-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Heart size={17} fill={isFavorite ? 'currentColor' : 'none'} />
              {isFavorite ? 'Favourited' : 'Favourite'}
            </button>

            <button
              type="button"
              onClick={() => handleSave(toggleWatchlist, !isInWatchlist)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                isInWatchlist ? 'bg-purple-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Bookmark size={17} fill={isInWatchlist ? 'currentColor' : 'none'} />
              {isInWatchlist ? 'In Watch Later' : 'Watch Later'}
            </button>

            <button
              type="button"
              onClick={() => navigate(`/watch/${id}/${continueEpisode}`)}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500"
            >
              <Play size={17} fill="currentColor" />
              Continue · Ep {continueEpisode}
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-7xl px-4">
        {anime.description && (
          <div className="max-w-4xl">
            <h2 className="mb-3 text-xl font-bold text-white">Synopsis</h2>
            <p className="whitespace-pre-line leading-7 text-gray-300">
              {cleanDescription(anime.description)}
            </p>
          </div>
        )}

        {anime.genres?.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {anime.genres.map((genre) => (
              <span
                key={genre}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300"
              >
                {genre}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto mt-12 max-w-7xl px-4">
        <div className="mb-5">
          <h2 className="text-2xl font-bold text-white">Episodes</h2>
          <p className="mt-1 text-sm text-gray-400">
            {episodeCount} episodes · Select an episode to watch
          </p>
        </div>

        {episodeCount > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {episodes.map((episode) => {
              const languages = sourcesByEpisode.get(episode) || new Set();
              const hasSource = languages.size > 0;
              const progress = progressByEpisode[episode];
              const duration = Number(progress?.duration_seconds) || 0;
              const position = Number(progress?.position_seconds) || 0;
              const ratio = duration > 0 ? Math.min(1, position / duration) : 0;
              const watched = isWatched(episode) || ratio >= 0.9;

              return (
                <div
                  key={episode}
                  className={`rounded-xl border p-3 transition ${
                    hasSource
                      ? 'border-white/10 bg-white/[0.04] hover:border-purple-500/60 hover:bg-white/[0.07]'
                      : 'border-white/5 bg-white/[0.02] opacity-50'
                  }`}
                >
                  <button
                    type="button"
                    disabled={!hasSource}
                    onClick={() => navigate(`/watch/${id}/${episode}`)}
                    className="block w-full text-left disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white">Episode {episode}</span>
                      {watched && <Check size={17} className="text-green-400" />}
                    </div>

                    <div className="mt-3 flex min-h-5 flex-wrap gap-1.5">
                      {languages.has('sub') && (
                        <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-300">
                          SUB
                        </span>
                      )}
                      {languages.has('dub') && (
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                          DUB
                        </span>
                      )}
                    </div>

                    {!hasSource ? (
                      <p className="mt-3 text-xs text-gray-500">No source yet</p>
                    ) : (
                      <p className="mt-3 text-xs text-gray-400">
                        {watched ? 'Watched' : ratio > 0 ? 'In progress' : 'Ready to play'}
                      </p>
                    )}

                    {ratio > 0 && ratio < 0.9 && (
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-purple-500"
                          style={{ width: `${ratio * 100}%` }}
                        />
                      </div>
                    )}
                  </button>

                  {user && (
                    <div className="mt-3 grid gap-2">
                      <button
                        type="button"
                        disabled={busyEpisode === episode}
                        onClick={() => handleWatchedToggle(episode)}
                        className="w-full rounded-md border border-white/10 px-2 py-1.5 text-xs text-gray-300 hover:bg-white/10 disabled:opacity-50"
                      >
                        {watched ? (
                          <span className="inline-flex items-center gap-1">
                            <RotateCcw size={12} /> Unmark watched
                          </span>
                        ) : (
                          'Mark watched'
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMarkUpTo(episode)}
                        className="w-full rounded-md border border-white/10 px-2 py-1.5 text-xs text-gray-400 hover:bg-white/10 hover:text-white"
                      >
                        Mark all up to here
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-gray-400">
            Episode information is not available for this anime yet.
          </p>
        )}

        {watchedLoading && user && (
          <p className="mt-3 text-xs text-gray-500">Syncing watched episodes…</p>
        )}
      </section>
    </main>
  );
}
