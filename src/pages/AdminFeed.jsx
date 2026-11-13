import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const ANILIST_SEARCH = `
  query ($search: String) {
    Page(page: 1, perPage: 8) {
      media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
        id
        title { romaji english native }
        coverImage { medium }
        episodes
      }
    }
  }
`;

function titleOf(anime) {
  return anime?.title?.english || anime?.title?.romaji || anime?.title?.native || `Anime ${anime?.id}`;
}

function dateLabel(value) {
  if (!value) return 'Unknown date';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function AdminFeed() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [searchFor, setSearchFor] = useState({});
  const [results, setResults] = useState({});
  const [searchingId, setSearchingId] = useState(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase
      .from('rss_release_catalog')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(100);
    if (queryError) {
      setError(queryError.message);
      setRows([]);
    } else {
      setRows(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadRows(); }, [loadRows]);

  async function syncNow() {
    setSyncing(true);
    setError('');
    setNotice('');
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Your admin session has expired. Please sign in again.');

      const response = await fetch('/api/rss-sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'RSS sync failed.');
      setNotice(`Checked ${payload.fetched} feed entries; ${payload.inserted} new metadata records added.`);
      await loadRows();
    } catch (syncError) {
      setError(syncError.message || 'RSS sync failed.');
    } finally {
      setSyncing(false);
    }
  }

  async function searchAniList(row) {
    const queryText = (searchFor[row.id] || row.anime_title_guess || '').trim();
    if (!queryText) {
      setError('Enter an anime title before searching.');
      return;
    }
    setSearchingId(row.id);
    setError('');
    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: ANILIST_SEARCH, variables: { search: queryText } }),
      });
      const payload = await response.json();
      if (!response.ok || payload.errors?.length) {
        throw new Error(payload.errors?.[0]?.message || `AniList request failed (${response.status}).`);
      }
      setResults((current) => ({ ...current, [row.id]: payload.data?.Page?.media || [] }));
    } catch (searchError) {
      setError(searchError.message || 'AniList search failed.');
    } finally {
      setSearchingId(null);
    }
  }

  async function setMatch(row, anime) {
    const { error: updateError } = await supabase
      .from('rss_release_catalog')
      .update({
        anime_id: anime.id,
        match_status: 'matched',
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setNotice(`Matched “${row.title}” to ${titleOf(anime)}.`);
    setResults((current) => ({ ...current, [row.id]: [] }));
    await loadRows();
  }

  async function ignoreRow(row) {
    const { error: updateError } = await supabase
      .from('rss_release_catalog')
      .update({ match_status: 'ignored', updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (updateError) setError(updateError.message);
    else await loadRows();
  }

  async function clearMatch(row) {
    const { error: updateError } = await supabase
      .from('rss_release_catalog')
      .update({ anime_id: null, match_status: 'unmatched', updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (updateError) setError(updateError.message);
    else await loadRows();
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-400">Administration</p>
          <h1 className="mt-2 text-3xl font-bold">RSS release catalog</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            A metadata-only RSS scraping showcase. Review release titles and match them to AniList entries.
            This catalog does not collect magnet URIs, info hashes, or playable torrent sources.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/sources" className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/5">Source manager</Link>
          <button type="button" onClick={syncNow} disabled={syncing} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50">
            {syncing ? 'Syncing…' : 'Sync RSS now'}
          </button>
        </div>
      </div>

      {error && <div role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
      {notice && <div role="status" className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{notice}</div>}

      <div className="mb-4 flex flex-wrap gap-3 text-xs text-zinc-400">
        <span className="rounded-full bg-zinc-900 px-3 py-1">Showing latest {rows.length} records</span>
        <span className="rounded-full bg-zinc-900 px-3 py-1">{rows.filter((row) => row.match_status === 'matched').length} matched</span>
        <span className="rounded-full bg-zinc-900 px-3 py-1">{rows.filter((row) => row.match_status === 'unmatched').length} awaiting review</span>
      </div>

      {loading ? <p className="py-12 text-center text-zinc-400">Loading RSS catalog…</p> :
        rows.length === 0 ? <div className="rounded-xl border border-white/10 bg-zinc-900 p-8 text-center text-sm text-zinc-400">No feed metadata yet. Select “Sync RSS now” or wait for the scheduled poll.</div> :
        <div className="space-y-4">
          {rows.map((row) => (
            <article key={row.id} className="rounded-xl border border-white/10 bg-zinc-900 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <a href={row.detail_url || 'https://nyaa.si/'} target="_blank" rel="noreferrer" className="font-semibold text-white hover:text-violet-300">{row.title}</a>
                  <p className="mt-1 text-xs text-zinc-500">{dateLabel(row.published_at)} · {row.category || 'Uncategorized'} · {row.size_label || 'Size unavailable'}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded bg-zinc-800 px-2 py-1">Episode: {row.episode_number ?? 'Not detected'}</span>
                    <span className="rounded bg-zinc-800 px-2 py-1">Language: {row.language}</span>
                    <span className="rounded bg-zinc-800 px-2 py-1">Quality: {row.quality || 'Unknown'}</span>
                    <span className="rounded bg-zinc-800 px-2 py-1">Seeders: {row.seeders ?? '—'}</span>
                  </div>
                </div>
                <span className={row.match_status === 'matched' ? 'rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300' : row.match_status === 'ignored' ? 'rounded-full bg-zinc-700 px-3 py-1 text-xs text-zinc-300' : 'rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-200'}>
                  {row.match_status}
                </span>
              </div>

              {row.match_status === 'matched' ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-zinc-950 p-3 text-sm">
                  <span className="text-zinc-300">AniList ID: {row.anime_id}</span>
                  <button type="button" onClick={() => clearMatch(row)} className="text-xs text-zinc-400 hover:text-white">Clear match</button>
                </div>
              ) : row.match_status !== 'ignored' ? (
                <div className="mt-4">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input value={searchFor[row.id] ?? row.anime_title_guess ?? ''} onChange={(event) => setSearchFor((current) => ({ ...current, [row.id]: event.target.value }))} placeholder="Search AniList title" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-violet-500" />
                    <button type="button" onClick={() => searchAniList(row)} disabled={searchingId === row.id} className="rounded-lg border border-violet-500/40 px-4 py-2 text-sm text-violet-200 hover:bg-violet-500/10 disabled:opacity-50">{searchingId === row.id ? 'Searching…' : 'Find anime'}</button>
                    <button type="button" onClick={() => ignoreRow(row)} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-400 hover:text-white">Ignore</button>
                  </div>
                  {(results[row.id] || []).length > 0 && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {results[row.id].map((anime) => (
                        <button key={anime.id} type="button" onClick={() => setMatch(row, anime)} className="flex items-center gap-3 rounded-lg border border-white/10 bg-zinc-950 p-2 text-left hover:border-violet-500/60">
                          {anime.coverImage?.medium && <img src={anime.coverImage.medium} alt="" className="h-14 w-10 rounded object-cover" />}
                          <span className="min-w-0"><span className="block text-sm font-medium">{titleOf(anime)}</span><span className="text-xs text-zinc-500">AniList #{anime.id}{anime.episodes ? ` · ${anime.episodes} eps` : ''}</span></span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      }

      <p className="mt-6 text-xs text-zinc-500">
        RSS item details link to Nyaa for source attribution. No torrent files are downloaded and no magnet data is persisted by this feature.
      </p>
    </main>
  );
}
