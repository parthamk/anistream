
import { supabase, isSupabaseConfigured } from './supabaseClient';

const TABLES = {
  library: 'library_entries',
  watched: 'watched_episodes',
  progress: 'watch_progress',
  sources: 'sources',
};

function normalizeError(error) {
  return error instanceof Error
    ? error
    : new Error(error?.message || 'A database operation failed.');
}

function unavailableError() {
  return new Error('Supabase is not configured. Check your environment variables.');
}

async function runQuery(query) {
  try {
    const { data, error } = await query;
    return { data, error: error ? normalizeError(error) : null };
  } catch (error) {
    return { data: null, error: normalizeError(error) };
  }
}

async function getCurrentUserId() {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: unavailableError() };
  }

  const result = await runQuery(supabase.auth.getUser());
  return {
    data: result.data?.user?.id || null,
    error: result.error,
  };
}

function animeFields(anime) {
  return {
    anime_id: Number(anime?.id),
    title:
      anime?.title?.english ||
      anime?.title?.romaji ||
      anime?.name ||
      `Anime ${anime?.id ?? ''}`,
    cover_url:
      anime?.coverImage?.extraLarge ||
      anime?.coverImage?.large ||
      anime?.cover_url ||
      null,
  };
}

export async function getLibraryEntries() {
  const { data: userId, error } = await getCurrentUserId();
  if (error) return { data: null, error };
  if (!userId) return { data: [], error: null };

  return runQuery(
    supabase.from(TABLES.library)
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),
  );
}

export async function getLibraryEntry(animeId) {
  const { data: userId, error } = await getCurrentUserId();
  if (error) return { data: null, error };
  if (!userId) return { data: null, error: null };

  return runQuery(
    supabase.from(TABLES.library)
      .select('*')
      .eq('user_id', userId)
      .eq('anime_id', Number(animeId))
      .maybeSingle(),
  );
}

async function updateLibraryFlag(anime, column, enabled) {
  const { data: userId, error } = await getCurrentUserId();
  if (error) return { data: null, error };
  if (!userId) {
    return { data: null, error: new Error('Please sign in to save anime.') };
  }

  const fields = animeFields(anime);
  if (!Number.isInteger(fields.anime_id) || fields.anime_id <= 0) {
    return { data: null, error: new Error('A valid anime is required.') };
  }

  return runQuery(
    supabase.from(TABLES.library)
      .upsert(
        {
          user_id: userId,
          ...fields,
          [column]: Boolean(enabled),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,anime_id' },
      )
      .select()
      .single(),
  );
}

export function setFavorite(anime, enabled) {
  return updateLibraryFlag(anime, 'is_favorite', enabled);
}

export function setWatchlist(anime, enabled) {
  return updateLibraryFlag(anime, 'in_watchlist', enabled);
}

export async function getWatchedEpisodes(animeId) {
  const { data: userId, error } = await getCurrentUserId();
  if (error) return { data: null, error };
  if (!userId) return { data: [], error: null };

  return runQuery(
    supabase.from(TABLES.watched)
      .select('*')
      .eq('user_id', userId)
      .eq('anime_id', Number(animeId))
      .order('episode_number', { ascending: true }),
  );
}

export async function markWatched(animeId, episodeNumber) {
  const { data: userId, error } = await getCurrentUserId();
  if (error) return { data: null, error };
  if (!userId) {
    return { data: null, error: new Error('Please sign in to track episodes.') };
  }

  return runQuery(
    supabase.from(TABLES.watched)
      .upsert(
        {
          user_id: userId,
          anime_id: Number(animeId),
          episode_number: Number(episodeNumber),
          watched_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,anime_id,episode_number' },
      )
      .select()
      .single(),
  );
}

export async function unmarkWatched(animeId, episodeNumber) {
  const { data: userId, error } = await getCurrentUserId();
  if (error) return { data: null, error };
  if (!userId) {
    return { data: null, error: new Error('Please sign in to track episodes.') };
  }

  return runQuery(
    supabase.from(TABLES.watched)
      .delete()
      .eq('user_id', userId)
      .eq('anime_id', Number(animeId))
      .eq('episode_number', Number(episodeNumber)),
  );
}

export async function markWatchedUpTo(animeId, episodeNumber) {
  const { data: userId, error } = await getCurrentUserId();
  if (error) return { data: null, error };
  if (!userId) {
    return { data: null, error: new Error('Please sign in to track episodes.') };
  }

  const lastEpisode = Math.floor(Number(episodeNumber));
  if (!Number.isInteger(lastEpisode) || lastEpisode < 1) {
    return { data: null, error: new Error('Enter a valid episode number.') };
  }

  const watchedAt = new Date().toISOString();
  const rows = Array.from({ length: lastEpisode }, (_, index) => ({
    user_id: userId,
    anime_id: Number(animeId),
    episode_number: index + 1,
    watched_at: watchedAt,
  }));

  return runQuery(
    supabase.from(TABLES.watched)
      .upsert(rows, { onConflict: 'user_id,anime_id,episode_number' })
      .select(),
  );
}

export async function getAllWatched() {
  const { data: userId, error } = await getCurrentUserId();
  if (error) return { data: null, error };
  if (!userId) return { data: [], error: null };

  return runQuery(
    supabase.from(TABLES.watched)
      .select('*')
      .eq('user_id', userId)
      .order('watched_at', { ascending: false }),
  );
}

export async function getProgress(animeId, episodeNumber) {
  const { data: userId, error } = await getCurrentUserId();
  if (error) return { data: null, error };
  if (!userId) return { data: null, error: null };

  return runQuery(
    supabase.from(TABLES.progress)
      .select('*')
      .eq('user_id', userId)
      .eq('anime_id', Number(animeId))
      .eq('episode_number', Number(episodeNumber))
      .maybeSingle(),
  );
}

export async function upsertProgress(progress) {
  const { data: userId, error } = await getCurrentUserId();
  if (error) return { data: null, error };
  if (!userId) {
    return { data: null, error: new Error('Please sign in to save playback progress.') };
  }

  const row = {
    user_id: userId,
    anime_id: Number(progress.anime_id ?? progress.animeId),
    episode_number: Number(progress.episode_number ?? progress.episodeNumber),
    language: progress.language || 'sub',
    position_seconds: Math.max(
      0,
      Math.floor(Number(progress.position_seconds ?? progress.positionSeconds) || 0),
    ),
    duration_seconds: Math.max(
      0,
      Math.floor(Number(progress.duration_seconds ?? progress.durationSeconds) || 0),
    ),
    title: progress.title || 'Untitled anime',
    cover_url: progress.cover_url || progress.coverUrl || null,
    updated_at: new Date().toISOString(),
  };

  if (
    !Number.isInteger(row.anime_id) ||
    row.anime_id <= 0 ||
    !Number.isInteger(row.episode_number) ||
    row.episode_number <= 0
  ) {
    return { data: null, error: new Error('Anime and episode numbers are required.') };
  }

  return runQuery(
    supabase.from(TABLES.progress)
      .upsert(row, { onConflict: 'user_id,anime_id,episode_number' })
      .select()
      .single(),
  );
}

export async function getContinueWatching(limit = 12) {
  const { data: userId, error } = await getCurrentUserId();
  if (error) return { data: null, error };
  if (!userId) return { data: [], error: null };

  const result = await runQuery(
    supabase.from(TABLES.progress)
      .select('*')
      .eq('user_id', userId)
      .gt('position_seconds', 0)
      .order('updated_at', { ascending: false })
      .limit(100),
  );

  if (result.error) return result;

  const latestByAnime = new Map();

  for (const item of result.data || []) {
    const duration = Number(item.duration_seconds) || 0;
    const position = Number(item.position_seconds) || 0;
    const finished = duration > 0 && position / duration >= 0.9;

    if (!finished && !latestByAnime.has(item.anime_id)) {
      latestByAnime.set(item.anime_id, item);
    }
  }

  return {
    data: [...latestByAnime.values()].slice(0, Math.max(1, Number(limit) || 12)),
    error: null,
  };
}

export async function getSourcesForAnime(animeId) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: unavailableError() };
  }

  return runQuery(
    supabase.from(TABLES.sources)
      .select('*')
      .eq('anime_id', Number(animeId))
      .order('episode_number', { ascending: true }),
  );
}
