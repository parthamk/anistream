import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const ANILIST_SEARCH = `
  query ($search: String) {
    Page(page: 1, perPage: 10) {
      media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
        id
        title {
          romaji
          english
          native
        }
        coverImage {
          medium
        }
        episodes
        seasonYear
      }
    }
  }
`;

const MAGNET_PREFIX = 'magnet:?xt=urn:btih:';

function getAnimeTitle(anime) {
  return (
    anime?.title?.english ||
    anime?.title?.romaji ||
    anime?.title?.native ||
    `AniList anime ${anime?.id || ''}`
  );
}

function validateMagnet(value) {
  const magnet = String(value || '').trim();

  if (!magnet.startsWith(MAGNET_PREFIX)) {
    return 'Magnet must start with magnet:?xt=urn:btih:.';
  }

  if (!/magnet:\?xt=urn:btih:[a-zA-Z0-9]{32,40}/i.test(magnet)) {
    return 'The magnet URI does not contain a valid-looking BitTorrent info hash.';
  }

  return '';
}

function parseOptionalInteger(value, label) {
  if (value === '' || value === null || value === undefined) {
    return { value: null, error: '' };
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return {
      value: null,
      error: `${label} must be a non-negative whole number.`,
    };
  }

  return { value: parsed, error: '' };
}

function normalizeSource(source) {
  return {
    episode_number: Number(source.episode_number),
    language: source.language,
    magnet_uri: String(source.magnet_uri || '').trim(),
    file_index: source.file_index === '' ? null : source.file_index,
    quality: String(source.quality || '').trim() || null,
  };
}

function validateSource(source) {
  const episode = parseOptionalInteger(
    source.episode_number,
    'Episode number'
  );

  if (episode.error || episode.value === null || episode.value < 1) {
    return episode.error || 'Episode number must be at least 1.';
  }

  if (!['sub', 'dub'].includes(source.language)) {
    return 'Language must be sub or dub.';
  }

  const magnetError = validateMagnet(source.magnet_uri);

  if (magnetError) return magnetError;

  const fileIndex = parseOptionalInteger(source.file_index, 'File index');

  if (fileIndex.error) return fileIndex.error;

  return '';
}

const EMPTY_FORM = {
  episode_number: '1',
  language: 'sub',
  magnet_uri: '',
  file_index: '',
  quality: '',
};

export default function AdminSources() {
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [manualId, setManualId] = useState('');

  const [form, setForm] = useState(EMPTY_FORM);
  const [bulkText, setBulkText] = useState('');
  const [sources, setSources] = useState([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState('');
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const bulkPreview = useMemo(() => {
    if (!bulkText.trim()) return [];

    return bulkText
      .split(/\r?\n/)
      .map((line, index) => {
        const trimmed = line.trim();

        if (!trimmed) return null;

        const parts = trimmed.split('|').map((part) => part.trim());

        if (parts.length !== 3) {
          return {
            line: index + 1,
            raw: trimmed,
            valid: false,
            error: 'Expected episode|language|magnet.',
          };
        }

        const [episode, language, magnet] = parts;
        const candidate = {
          episode_number: episode,
          language: language.toLowerCase(),
          magnet_uri: magnet,
          file_index: '',
          quality: '',
        };

        const error = validateSource(candidate);

        return {
          line: index + 1,
          raw: trimmed,
          candidate,
          valid: !error,
          error,
        };
      })
      .filter(Boolean);
  }, [bulkText]);

  const validBulkRows = useMemo(
    () => bulkPreview.filter((row) => row.valid),
    [bulkPreview]
  );

  const invalidBulkRows = useMemo(
    () => bulkPreview.filter((row) => !row.valid),
    [bulkPreview]
  );

  const searchAniList = useCallback(async () => {
    const query = searchText.trim();

    if (!query) {
      setSearchError('Enter an anime title to search.');
      return;
    }

    setSearching(true);
    setSearchError('');
    setSearchResults([]);

    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: ANILIST_SEARCH,
          variables: { search: query },
        }),
      });

      const payload = await response.json();

      if (!response.ok || payload.errors?.length) {
        throw new Error(
          payload.errors?.[0]?.message ||
            `AniList request failed (${response.status}).`
        );
      }

      setSearchResults(payload.data?.Page?.media || []);
    } catch (error) {
      setSearchError(error.message || 'Could not search AniList.');
    } finally {
      setSearching(false);
    }
  }, [searchText]);

  const selectAnimeById = useCallback(async () => {
    const id = Number(manualId);

    if (!Number.isInteger(id) || id < 1) {
      setSearchError('Enter a valid positive AniList ID.');
      return;
    }

    setSearching(true);
    setSearchError('');

    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query ($id: Int) {
              Media(id: $id, type: ANIME) {
                id
                title {
                  romaji
                  english
                  native
                }
                coverImage {
                  medium
                }
                episodes
                seasonYear
              }
            }
          `,
          variables: { id },
        }),
      });

      const payload = await response.json();

      if (!response.ok || payload.errors?.length) {
        throw new Error(
          payload.errors?.[0]?.message ||
            `AniList request failed (${response.status}).`
        );
      }

      const anime = payload.data?.Media;

      if (!anime) {
        throw new Error('No anime was found for that AniList ID.');
      }

      setSelectedAnime(anime);
      setSearchResults([]);
      setNotice(`Selected ${getAnimeTitle(anime)}.`);
    } catch (error) {
      setSearchError(error.message || 'Could not load that AniList ID.');
    } finally {
      setSearching(false);
    }
  }, [manualId]);

  const loadSources = useCallback(async () => {
    if (!selectedAnime?.id) {
      setSources([]);
      return;
    }

    setLoadingSources(true);
    setPageError('');

    const { data, error } = await supabase
      .from('sources')
      .select('*')
      .eq('anime_id', selectedAnime.id)
      .order('episode_number', { ascending: true })
      .order('language', { ascending: true });

    if (error) {
      setPageError(`Could not load sources: ${error.message}`);
      setSources([]);
    } else {
      setSources(data || []);
    }

    setLoadingSources(false);
  }, [selectedAnime]);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateEditForm(field, value) {
    setEditForm((current) => ({ ...current, [field]: value }));
  }

  async function addSingleSource(event) {
    event.preventDefault();
    setNotice('');
    setPageError('');

    if (!selectedAnime) {
      setPageError('Select an anime first.');
      return;
    }

    const error = validateSource(form);

    if (error) {
      setPageError(error);
      return;
    }

    const source = normalizeSource(form);
    const fileIndex = parseOptionalInteger(form.file_index, 'File index');

    if (fileIndex.error) {
      setPageError(fileIndex.error);
      return;
    }

    setSaving(true);

    const { error: insertError } = await supabase.from('sources').insert({
      anime_id: selectedAnime.id,
      ...source,
      file_index: fileIndex.value,
    });

    setSaving(false);

    if (insertError) {
      setPageError(`Could not add source: ${insertError.message}`);
      return;
    }

    setForm(EMPTY_FORM);
    setNotice('Source added.');
    await loadSources();
  }

  async function addBulkSources() {
    setNotice('');
    setPageError('');

    if (!selectedAnime) {
      setPageError('Select an anime first.');
      return;
    }

    if (bulkPreview.length === 0) {
      setPageError('Enter at least one source line.');
      return;
    }

    if (invalidBulkRows.length > 0) {
      setPageError('Fix all invalid lines in the preview before saving.');
      return;
    }

    const rows = validBulkRows.map(({ candidate }) => ({
      anime_id: selectedAnime.id,
      episode_number: Number(candidate.episode_number),
      language: candidate.language,
      magnet_uri: candidate.magnet_uri,
      file_index: null,
      quality: null,
    }));

    setSaving(true);

    const { error } = await supabase.from('sources').insert(rows);

    setSaving(false);

    if (error) {
      setPageError(`Bulk import failed: ${error.message}`);
      return;
    }

    setBulkText('');
    setNotice(`Added ${rows.length} source${rows.length === 1 ? '' : 's'}.`);
    await loadSources();
  }

  function beginEdit(source) {
    setEditingId(source.id);
    setEditForm({
      episode_number: String(source.episode_number ?? ''),
      language: source.language || 'sub',
      magnet_uri: source.magnet_uri || '',
      file_index:
        source.file_index === null || source.file_index === undefined
          ? ''
          : String(source.file_index),
      quality: source.quality || '',
    });
    setPageError('');
    setNotice('');
  }

  async function saveEdit(sourceId) {
    const error = validateSource(editForm);

    if (error) {
      setPageError(error);
      return;
    }

    const fileIndex = parseOptionalInteger(
      editForm.file_index,
      'File index'
    );

    if (fileIndex.error) {
      setPageError(fileIndex.error);
      return;
    }

    setSaving(true);

    const { error: updateError } = await supabase
      .from('sources')
      .update({
        ...normalizeSource(editForm),
        file_index: fileIndex.value,
      })
      .eq('id', sourceId)
      .eq('anime_id', selectedAnime.id);

    setSaving(false);

    if (updateError) {
      setPageError(`Could not update source: ${updateError.message}`);
      return;
    }

    setEditingId(null);
    setNotice('Source updated.');
    await loadSources();
  }

  async function deleteSource(source) {
    const confirmed = window.confirm(
      `Delete episode ${source.episode_number} (${source.language}) source?`
    );

    if (!confirmed) return;

    setPageError('');
    setNotice('');

    const { error } = await supabase
      .from('sources')
      .delete()
      .eq('id', source.id)
      .eq('anime_id', selectedAnime.id);

    if (error) {
      setPageError(`Could not delete source: ${error.message}`);
      return;
    }

    setNotice('Source deleted.');
    await loadSources();
  }

  function testSource(source) {
    window.open(
      `/watch/${selectedAnime.id}/${source.episode_number}`,
      '_blank',
      'noopener,noreferrer'
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-400">
          Administration
        </p>
        <h1 className="mt-2 text-3xl font-bold">Source manager</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-400">
          Select an AniList anime to manage its SUB and DUB torrent sources.
        </p>
      </div>

      {pageError && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200"
        >
          {pageError}
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="mb-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200"
        >
          {notice}
        </div>
      )}

      <section className="rounded-2xl border border-white/10 bg-zinc-900 p-5">
        <h2 className="text-lg font-semibold">1. Select anime</h2>

        <form
          className="mt-4 flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            searchAniList();
          }}
        >
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search AniList by anime title"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 outline-none focus:border-violet-500"
          />
          <button
            type="submit"
            disabled={searching}
            className="rounded-lg bg-violet-600 px-5 py-2 font-semibold hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {searching ? 'Searching…' : 'Search AniList'}
          </button>
        </form>

        <form
          className="mt-3 flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            selectAnimeById();
          }}
        >
          <input
            inputMode="numeric"
            value={manualId}
            onChange={(event) => setManualId(event.target.value)}
            placeholder="Or enter AniList ID"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 outline-none focus:border-violet-500"
          />
          <button
            type="submit"
            disabled={searching}
            className="rounded-lg border border-white/15 px-5 py-2 font-semibold hover:bg-white/5 disabled:opacity-50"
          >
            Load ID
          </button>
        </form>

        {searchError && (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {searchError}
          </p>
        )}

        {searchResults.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {searchResults.map((anime) => (
              <button
                key={anime.id}
                type="button"
                onClick={() => {
                  setSelectedAnime(anime);
                  setSearchResults([]);
                  setNotice(`Selected ${getAnimeTitle(anime)}.`);
                  setPageError('');
                }}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-950 p-3 text-left hover:border-violet-500/60"
              >
                {anime.coverImage?.medium ? (
                  <img
                    src={anime.coverImage.medium}
                    alt=""
                    className="h-20 w-14 rounded object-cover"
                  />
                ) : (
                  <div className="h-20 w-14 rounded bg-zinc-800" />
                )}
                <span className="min-w-0">
                  <span className="block font-medium">
                    {getAnimeTitle(anime)}
                  </span>
                  <span className="mt-1 block text-xs text-zinc-400">
                    AniList ID: {anime.id}
                    {anime.episodes ? ` · ${anime.episodes} episodes` : ''}
                    {anime.seasonYear ? ` · ${anime.seasonYear}` : ''}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        {selectedAnime && (
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-violet-500/30 bg-violet-500/5 p-3">
            {selectedAnime.coverImage?.medium && (
              <img
                src={selectedAnime.coverImage.medium}
                alt=""
                className="h-16 w-11 rounded object-cover"
              />
            )}
            <div>
              <p className="font-semibold">{getAnimeTitle(selectedAnime)}</p>
              <p className="text-xs text-zinc-400">
                AniList ID: {selectedAnime.id}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedAnime(null);
                setSources([]);
                setEditingId(null);
              }}
              className="ml-auto rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
            >
              Clear selection
            </button>
          </div>
        )}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-zinc-900 p-5">
          <h2 className="text-lg font-semibold">2. Add one source</h2>

          <form className="mt-4 space-y-3" onSubmit={addSingleSource}>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm text-zinc-300">
                Episode number
                <input
                  type="number"
                  min="1"
                  required
                  value={form.episode_number}
                  onChange={(event) =>
                    updateForm('episode_number', event.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-white"
                />
              </label>

              <label className="text-sm text-zinc-300">
                Language
                <select
                  value={form.language}
                  onChange={(event) =>
                    updateForm('language', event.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-white"
                >
                  <option value="sub">SUB</option>
                  <option value="dub">DUB</option>
                </select>
              </label>
            </div>

            <label className="block text-sm text-zinc-300">
              Magnet URI
              <textarea
                required
                rows={3}
                value={form.magnet_uri}
                onChange={(event) =>
                  updateForm('magnet_uri', event.target.value)
                }
                placeholder="magnet:?xt=urn:btih:..."
                className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-white"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm text-zinc-300">
                File index (optional)
                <input
                  type="number"
                  min="0"
                  value={form.file_index}
                  onChange={(event) =>
                    updateForm('file_index', event.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-white"
                />
              </label>

              <label className="text-sm text-zinc-300">
                Quality label (optional)
                <input
                  value={form.quality}
                  onChange={(event) =>
                    updateForm('quality', event.target.value)
                  }
                  placeholder="1080p"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-white"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={!selectedAnime || saving}
              className="w-full rounded-lg bg-violet-600 px-4 py-2.5 font-semibold hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Add source'}
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900 p-5">
          <h2 className="text-lg font-semibold">3. Bulk add sources</h2>
          <p className="mt-2 text-sm text-zinc-400">
            One source per line, using this exact format:
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-950 p-3 text-xs text-violet-200">
            1|sub|magnet:?xt=urn:btih:...
            {'\n'}1|dub|magnet:?xt=urn:btih:...
            {'\n'}2|sub|magnet:?xt=urn:btih:...
          </pre>

          <textarea
            rows={6}
            value={bulkText}
            onChange={(event) => setBulkText(event.target.value)}
            placeholder="1|sub|magnet:?xt=urn:btih:..."
            className="mt-3 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 font-mono text-xs text-white"
          />

          {bulkPreview.length > 0 && (
            <div className="mt-3 rounded-lg border border-white/10 bg-zinc-950 p-3">
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-emerald-300">
                  Valid: {validBulkRows.length}
                </span>
                <span className="text-red-300">
                  Invalid: {invalidBulkRows.length}
                </span>
              </div>

              <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto text-xs">
                {bulkPreview.map((row) => (
                  <li
                    key={row.line}
                    className={row.valid ? 'text-emerald-200' : 'text-red-300'}
                  >
                    Line {row.line}: {row.valid ? 'Valid' : row.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={addBulkSources}
            disabled={
              !selectedAnime ||
              saving ||
              bulkPreview.length === 0 ||
              invalidBulkRows.length > 0
            }
            className="mt-3 w-full rounded-lg border border-violet-500/50 px-4 py-2.5 font-semibold text-violet-200 hover:bg-violet-500/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? 'Saving…' : `Save ${validBulkRows.length} valid sources`}
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-white/10 bg-zinc-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">4. Existing sources</h2>
            <p className="mt-1 text-sm text-zinc-400">
              {selectedAnime
                ? `Sources for ${getAnimeTitle(selectedAnime)}`
                : 'Select an anime to view its sources.'}
            </p>
          </div>
          {selectedAnime && (
            <button
              type="button"
              onClick={loadSources}
              disabled={loadingSources}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
            >
              {loadingSources ? 'Refreshing…' : 'Refresh'}
            </button>
          )}
        </div>

        {loadingSources ? (
          <p className="py-8 text-center text-sm text-zinc-400">
            Loading sources…
          </p>
        ) : selectedAnime && sources.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-400">
            No sources have been added for this anime.
          </p>
        ) : sources.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-3">Episode</th>
                  <th className="px-3 py-3">Language</th>
                  <th className="px-3 py-3">Magnet</th>
                  <th className="px-3 py-3">File index</th>
                  <th className="px-3 py-3">Quality</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <tr
                    key={source.id}
                    className="border-b border-white/5 align-top"
                  >
                    {editingId === source.id ? (
                      <>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            min="1"
                            value={editForm.episode_number}
                            onChange={(event) =>
                              updateEditForm(
                                'episode_number',
                                event.target.value
                              )
                            }
                            className="w-20 rounded bg-zinc-950 px-2 py-1"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={editForm.language}
                            onChange={(event) =>
                              updateEditForm('language', event.target.value)
                            }
                            className="rounded bg-zinc-950 px-2 py-1"
                          >
                            <option value="sub">SUB</option>
                            <option value="dub">DUB</option>
                          </select>
                        </td>
                        <td className="max-w-xs px-3 py-3">
                          <textarea
                            rows={3}
                            value={editForm.magnet_uri}
                            onChange={(event) =>
                              updateEditForm('magnet_uri', event.target.value)
                            }
                            className="w-full min-w-64 rounded bg-zinc-950 px-2 py-1 font-mono text-xs"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            min="0"
                            value={editForm.file_index}
                            onChange={(event) =>
                              updateEditForm('file_index', event.target.value)
                            }
                            className="w-20 rounded bg-zinc-950 px-2 py-1"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            value={editForm.quality}
                            onChange={(event) =>
                              updateEditForm('quality', event.target.value)
                            }
                            className="w-24 rounded bg-zinc-950 px-2 py-1"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => saveEdit(source.id)}
                              disabled={saving}
                              className="text-emerald-300 hover:text-emerald-200"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="text-zinc-400 hover:text-white"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-3 font-semibold">
                          {source.episode_number}
                        </td>
                        <td className="px-3 py-3 uppercase">
                          {source.language}
                        </td>
                        <td className="max-w-xs px-3 py-3">
                          <span className="block truncate font-mono text-xs text-zinc-400">
                            {source.magnet_uri}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {source.file_index ?? 'Auto'}
                        </td>
                        <td className="px-3 py-3">
                          {source.quality || '—'}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() => testSource(source)}
                              className="text-violet-300 hover:text-violet-200"
                            >
                              Test
                            </button>
                            <button
                              type="button"
                              onClick={() => beginEdit(source)}
                              className="text-sky-300 hover:text-sky-200"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSource(source)}
                              className="text-red-300 hover:text-red-200"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <aside className="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100">
        <h3 className="font-semibold">Torrent source requirements</h3>
        <p className="mt-1 text-amber-100/80">
          Magnets should include WebSocket trackers using wss:// and point to
          files with WebRTC-capable seeders. Prefer MP4 (H.264 video + AAC
          audio) or WebM releases. A magnet can be valid while still having no
          reachable browser-compatible peers or an unplayable video codec.
        </p>
      </aside>

      <p className="mt-5 text-sm text-zinc-500">
        Admin access is enforced by the protected route and must also be
        enforced by Supabase Row Level Security.
      </p>
    </main>
  );
}