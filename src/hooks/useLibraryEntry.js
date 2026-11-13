
import { useCallback, useEffect, useState } from 'react';
import { getLibraryEntry, setFavorite as saveFavorite, setWatchlist as saveWatchlist } from '../lib/db';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export function useLibraryEntry(anime) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(Boolean(user && anime?.id));

  useEffect(() => {
    let active = true;

    if (!user || !anime?.id) {
      setEntry(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    getLibraryEntry(anime.id).then(({ data, error }) => {
      if (!active) return;
      if (error) showToast(error.message, 'error');
      setEntry(data || null);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [user?.id, anime?.id, showToast]);

  const updateFlag = useCallback(
    async (field, enabled) => {
      if (!user) {
        return { data: null, error: new Error('Please sign in first.') };
      }

      const previous = entry;
      const next = {
        ...(previous || {}),
        anime_id: Number(anime.id),
        title:
          anime.title?.english ||
          anime.title?.romaji ||
          `Anime ${anime.id}`,
        cover_url:
          anime.coverImage?.extraLarge ||
          anime.coverImage?.large ||
          null,
        [field]: Boolean(enabled),
      };

      setEntry(next);

      const result =
        field === 'is_favorite'
          ? await saveFavorite(anime, enabled)
          : await saveWatchlist(anime, enabled);

      if (result.error) {
        setEntry(previous);
        showToast(result.error.message, 'error');
      } else {
        setEntry(result.data || next);
        showToast(
          enabled
            ? field === 'is_favorite'
              ? 'Added to favourites.'
              : 'Added to Watch Later.'
            : field === 'is_favorite'
              ? 'Removed from favourites.'
              : 'Removed from Watch Later.',
          'success',
        );
      }

      return result;
    },
    [anime, entry, showToast, user],
  );

  const toggleFavorite = useCallback(
    (enabled) => updateFlag('is_favorite', enabled ?? !entry?.is_favorite),
    [entry?.is_favorite, updateFlag],
  );

  const toggleWatchlist = useCallback(
    (enabled) => updateFlag('in_watchlist', enabled ?? !entry?.in_watchlist),
    [entry?.in_watchlist, updateFlag],
  );

  return {
    entry,
    loading,
    toggleFavorite,
    toggleWatchlist,
    isFavorite: Boolean(entry?.is_favorite),
    isInWatchlist: Boolean(entry?.in_watchlist),
  };
}
