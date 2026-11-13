
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getWatchedEpisodes,
  markWatched,
  markWatchedUpTo,
  unmarkWatched,
} from '../lib/db';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export function useWatched(animeId) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [watchedEpisodes, setWatchedEpisodes] = useState([]);
  const [loading, setLoading] = useState(Boolean(user && animeId));

  const refresh = useCallback(async () => {
    if (!user || !animeId) {
      setWatchedEpisodes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await getWatchedEpisodes(animeId);
    if (error) showToast(error.message, 'error');
    else setWatchedEpisodes(data || []);
    setLoading(false);
  }, [animeId, showToast, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const watchedSet = useMemo(
    () => new Set(watchedEpisodes.map((item) => Number(item.episode_number))),
    [watchedEpisodes],
  );

  const isWatched = useCallback(
    (episode) => watchedSet.has(Number(episode)),
    [watchedSet],
  );

  const toggleWatched = useCallback(
    async (episode) => {
      if (!user) return { data: null, error: new Error('Please sign in first.') };

      const number = Number(episode);
      const wasWatched = watchedSet.has(number);

      setWatchedEpisodes((current) =>
        wasWatched
          ? current.filter((item) => Number(item.episode_number) !== number)
          : [
              ...current,
              { anime_id: Number(animeId), episode_number: number },
            ],
      );

      const result = wasWatched
        ? await unmarkWatched(animeId, number)
        : await markWatched(animeId, number);

      if (result.error) {
        setWatchedEpisodes((current) =>
          wasWatched
            ? [...current, { anime_id: Number(animeId), episode_number: number }]
            : current.filter((item) => Number(item.episode_number) !== number),
        );
        showToast(result.error.message, 'error');
      } else {
        showToast(
          wasWatched ? 'Episode unmarked.' : 'Episode marked as watched.',
          'success',
        );
      }

      return result;
    },
    [animeId, showToast, user, watchedSet],
  );

  const markUpTo = useCallback(
    async (episode) => {
      if (!user) return { data: null, error: new Error('Please sign in first.') };

      const last = Number(episode);
      const previous = watchedEpisodes;

      setWatchedEpisodes((current) => {
        const byEpisode = new Map(
          current.map((item) => [Number(item.episode_number), item]),
        );
        for (let number = 1; number <= last; number += 1) {
          byEpisode.set(number, {
            anime_id: Number(animeId),
            episode_number: number,
          });
        }
        return [...byEpisode.values()].sort(
          (a, b) => a.episode_number - b.episode_number,
        );
      });

      const result = await markWatchedUpTo(animeId, last);

      if (result.error) {
        setWatchedEpisodes(previous);
        showToast(result.error.message, 'error');
      } else {
        showToast(`Episodes 1–${last} marked as watched.`, 'success');
      }

      return result;
    },
    [animeId, showToast, user, watchedEpisodes],
  );

  return {
    watchedEpisodes,
    watchedSet,
    isWatched,
    toggleWatched,
    markWatchedUpTo: markUpTo,
    loading,
    refresh,
  };
}
