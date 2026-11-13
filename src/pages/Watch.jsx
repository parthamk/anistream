
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { X } from 'lucide-react';
import VideoPlayer from '../components/Player/VideoPlayer';
import EpisodeNav from '../components/Player/EpisodeNav';
import useTorrentStream from '../hooks/useTorrentStream';
import { getAnimeById, getEpisodeCount, getTitle } from '../lib/anilist';
import {
  getProgress,
  getSourcesForAnime,
  markWatched,
  upsertProgress,
} from '../lib/db';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import PlayerErrorBoundary from '../components/Player/PlayerErrorBoundary';

const LAST_LANGUAGE_KEY = 'anistream:last-language';

function magnetFromSource(source) {
  return source?.magnet || source?.magnet_uri || source?.magnet_link || '';
}

function fileExtension(name = '') {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

function srtToVtt(text) {
  const body = text
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');

  return `WEBVTT\n\n${body}`;
}

function formatTime(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(value / 60);
  const secs = value % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

export default function Watch() {
  const { animeId, episode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const numericEpisode = Number(episode);
  const [anime, setAnime] = useState(null);
  const [sources, setSources] = useState([]);
  const [selectedSource, setSelectedSource] = useState(null);
  const [language, setLanguage] = useState('sub');
  const [loadingPage, setLoadingPage] = useState(true);
  const [switchingLanguage, setSwitchingLanguage] = useState(false);
  const [showGuestBanner, setShowGuestBanner] = useState(true);
  const [subtitleTracks, setSubtitleTracks] = useState([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState('');
  const [playbackProgress, setPlaybackProgress] = useState(0);

  const videoRef = useRef(null);
  const pendingResume = useRef(null);
  const saveTimer = useRef(null);
  const latestAnime = useRef(null);
  const latestSource = useRef(null);
  const autoMarked = useRef(false);
  const torrentState = useTorrentStream(selectedSource);

  const title = anime ? getTitle(anime) : 'AniStream';
  const totalEpisodes = anime ? getEpisodeCount(anime) : 0;

  const availableLanguages = useMemo(
    () => [...new Set(
      sources
        .filter((source) => magnetFromSource(source))
        .map((source) => source.language)
        .filter((value) => value === 'sub' || value === 'dub'),
    )],
    [sources],
  );

  useEffect(() => {
    document.title = anime
      ? `Ep ${episode} – ${title}`
      : `Episode ${episode} – AniStream`;

    return () => {
      document.title = 'AniStream';
    };
  }, [anime, episode, title]);

  useEffect(() => {
    let active = true;

    async function loadPage() {
      setLoadingPage(true);
      setAnime(null);
      setSources([]);
      setSelectedSource(null);
      setSubtitleTracks([]);
      setPlaybackProgress(0);
      autoMarked.current = false;

      try {
        const [animeResult, sourceResult] = await Promise.all([
          getAnimeById(animeId),
          getSourcesForAnime(animeId),
        ]);

        if (!active) return;

        setAnime(animeResult);

        if (sourceResult.error) {
          showToast(sourceResult.error.message, 'error');
          setSources([]);
        } else {
          const episodeSources = (sourceResult.data || []).filter(
            (source) => Number(source.episode_number) === numericEpisode,
          );

          setSources(episodeSources);

          const usable = episodeSources.filter((source) => magnetFromSource(source));
          const lastLanguage = localStorage.getItem(LAST_LANGUAGE_KEY);

          const preferred =
            usable.find((source) => source.language === lastLanguage) ||
            usable.find((source) => source.language === 'sub') ||
            usable[0] ||
            null;

          if (preferred) {
            setLanguage(preferred.language);
            setSelectedSource({
              ...preferred,
              magnet: magnetFromSource(preferred),
            });
          }
        }
      } catch (error) {
        if (active) showToast(error.message || 'Could not load this episode.', 'error');
      } finally {
        if (active) setLoadingPage(false);
      }
    }

    loadPage();

    return () => {
      active = false;
    };
  }, [animeId, numericEpisode, showToast]);

  useEffect(() => {
    latestAnime.current = anime;
    latestSource.current = selectedSource;
  }, [anime, selectedSource]);

  useEffect(() => {
    let active = true;

    async function loadSavedPosition() {
      if (!user || !anime || !selectedSource) return;

      const { data, error } = await getProgress(animeId, numericEpisode);
      if (!active || error || !data) return;

      const duration = Number(data.duration_seconds) || 0;
      const position = Number(data.position_seconds) || 0;

      if (duration > 0 && position / duration >= 0.95) return;
      if (position > 0) pendingResume.current = position;
    }

    loadSavedPosition();

    return () => {
      active = false;
    };
  }, [animeId, numericEpisode, selectedSource?.id, user?.id, anime]);

  useEffect(() => {
    if (!torrentState.torrent) return undefined;

    let active = true;
    const subtitleFiles = torrentState.torrent.files.filter((file) =>
      ['.srt', '.vtt'].includes(fileExtension(file.name)),
    );

    async function createTracks() {
      const tracks = [];

      for (let index = 0; index < subtitleFiles.length; index += 1) {
        const file = subtitleFiles[index];

        try {
          const blob = await file.blob();
          const text = await blob.text();
          const content =
            fileExtension(file.name) === '.srt' ? srtToVtt(text) : text;
          const url = URL.createObjectURL(
            new Blob([content], { type: 'text/vtt;charset=utf-8' }),
          );

          tracks.push({
            id: `${index}-${file.name}`,
            label: file.name.replace(/\.(srt|vtt)$/i, '').replace(/[._]/g, ' '),
            srclang: 'und',
            url,
          });
        } catch (error) {
          console.warn('Could not load subtitle:', file.name, error);
        }
      }

      if (active) {
        setSubtitleTracks(tracks);
        setSelectedSubtitle('');
      } else {
        tracks.forEach((track) => URL.revokeObjectURL(track.url));
      }
    }

    createTracks();

    return () => {
      active = false;
    };
  }, [torrentState.torrent]);

  useEffect(() => {
    return () => {
      subtitleTracks.forEach((track) => URL.revokeObjectURL(track.url));
    };
  }, [subtitleTracks]);

  const saveProgress = useCallback(
    async (video = videoRef.current) => {
      if (!user || !video || !latestAnime.current || !latestSource.current) return;

      const position = Number(video.currentTime) || 0;
      const duration = Number(video.duration) || 0;

      setPlaybackProgress(duration > 0 ? position / duration : 0);

      if (duration > 0 && position / duration >= 0.9 && !autoMarked.current) {
        autoMarked.current = true;
        await markWatched(animeId, numericEpisode);
      }

      const currentAnime = latestAnime.current;
      const currentSource = latestSource.current;

      const result = await upsertProgress({
        anime_id: Number(animeId),
        episode_number: numericEpisode,
        language: currentSource.language || language,
        position_seconds: Math.floor(position),
        duration_seconds: Math.floor(duration),
        title: getTitle(currentAnime),
        cover_url:
          currentAnime.coverImage?.extraLarge ||
          currentAnime.coverImage?.large ||
          null,
      });

      if (result.error) {
        console.warn('Could not save playback progress:', result.error);
      }
    },
    [animeId, language, numericEpisode, user],
  );

  useEffect(() => {
    if (!user) return undefined;

    saveTimer.current = window.setInterval(() => {
      const video = videoRef.current;
      if (video && !video.paused) saveProgress(video);
    }, 10_000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveProgress();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(saveTimer.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      saveProgress();
    };
  }, [saveProgress, user]);

  const handleVideoReady = useCallback(
    (video) => {
      videoRef.current = video;

      if (typeof pendingResume.current === 'number') {
        const requestedPosition = pendingResume.current;
        const safePosition =
          video.duration > 0
            ? Math.min(requestedPosition, Math.max(0, video.duration - 1))
            : requestedPosition;

        if (video.duration > 0 && requestedPosition / video.duration >= 0.95) {
          video.currentTime = 0;
        } else {
          video.currentTime = safePosition;
          showToast(`Resumed from ${formatTime(safePosition)}`, 'success');
        }

        pendingResume.current = null;
      }

      torrentState.setReady();
      setSwitchingLanguage(false);
    },
    [showToast, torrentState.setReady],
  );

  const handleReadyAfterSwap = (video) => {
    const pending = pendingResume.current;

    if (pending && typeof pending === 'object') {
      const position = Number(pending.position) || 0;
      video.currentTime =
        video.duration > 0
          ? Math.min(position, Math.max(0, video.duration - 1))
          : position;

      if (pending.wasPlaying) {
        video.play().catch(() => {});
      }

      pendingResume.current = null;
    }

    handleVideoReady(video);
  };

  const handleLanguageChange = async (nextLanguage) => {
    if (nextLanguage === language || switchingLanguage) return;

    const nextSource = sources.find(
      (source) =>
        source.language === nextLanguage && magnetFromSource(source),
    );

    if (!nextSource) return;

    const video = videoRef.current;
    const position = video?.currentTime || 0;
    const wasPlaying = Boolean(video && !video.paused);

    await saveProgress(video);

    pendingResume.current = { position, wasPlaying };
    setSwitchingLanguage(true);
    setLanguage(nextLanguage);
    localStorage.setItem(LAST_LANGUAGE_KEY, nextLanguage);

    setSelectedSource({
      ...nextSource,
      magnet: magnetFromSource(nextSource),
    });
  };

  const handleTimeUpdate = (video) => {
    const duration = Number(video.duration) || 0;
    const position = Number(video.currentTime) || 0;
    const ratio = duration > 0 ? position / duration : 0;

    setPlaybackProgress(ratio);

    if (user && ratio >= 0.9 && !autoMarked.current) {
      autoMarked.current = true;
      markWatched(animeId, numericEpisode);
    }
  };

  const handlePlaybackSave = (video) => {
    saveProgress(video);
  };

  const nextEpisode = () => {
    if (numericEpisode < totalEpisodes) {
      navigate(`/watch/${animeId}/${numericEpisode + 1}`);
    }
  };

  if (loadingPage) {
    return (
      <main className="mx-auto max-w-7xl animate-pulse px-4 py-10">
        <div className="aspect-video rounded-2xl bg-white/5" />
        <div className="mt-5 h-7 w-1/2 rounded bg-white/5" />
      </main>
    );
  }

  if (!anime) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-white">Anime not found</h1>
        <Link to="/" className="mt-4 inline-block text-purple-400">Back home</Link>
      </main>
    );
  }

  if (!selectedSource) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <p className="mt-2 text-gray-400">Episode {numericEpisode}</p>
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-8">
          <h2 className="text-lg font-semibold text-white">No source available yet</h2>
          <p className="mt-2 text-sm text-gray-400">
            There is no SUB or DUB release listed for this episode. Please check back later.
          </p>
          <Link
            to={`/anime/${animeId}`}
            className="mt-5 inline-flex rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Back to anime
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:py-10">
      {!user && showGuestBanner && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-purple-500/20 bg-purple-500/10 px-4 py-3 text-sm text-purple-100">
          <span>
            <Link
              to="/login"
              state={{ from: { pathname: `/watch/${animeId}/${episode}` } }}
              className="font-semibold underline"
            >
              Log in
            </Link>{' '}
            to save your progress.
          </span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setShowGuestBanner(false)}
            className="rounded p-1 hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to={`/anime/${animeId}`}
            className="text-sm text-gray-400 hover:text-white"
          >
            {title}
          </Link>
          <h1 className="mt-1 text-xl font-bold text-white sm:text-2xl">
            Episode {numericEpisode}
          </h1>
        </div>

        <EpisodeNav
          animeId={animeId}
          episode={numericEpisode}
          totalEpisodes={totalEpisodes}
          onNext={nextEpisode}
        />
      </div>

      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl">
        {torrentState.streamUrl && torrentState.status !== 'error' && (
          <PlayerErrorBoundary>
            <VideoPlayer
              key={`${selectedSource.id || selectedSource.magnet}-${torrentState.streamUrl}`}
              src={torrentState.streamUrl}
              language={language}
              availableLanguages={availableLanguages}
            onLanguage={handleLanguageChange}
            subtitles={subtitleTracks}
            selectedSubtitle={selectedSubtitle}
            onSubtitles={setSelectedSubtitle}
            stats={{
              peers: torrentState.peers,
              downloadSpeed: torrentState.downloadSpeed,
              progress: torrentState.progress,
            }}
            onVideoRef={(video) => {
              videoRef.current = video;
            }}
            onReady={handleReadyAfterSwap}
            onError={torrentState.setPlaybackError}
            onTimeUpdate={handleTimeUpdate}
            onPause={handlePlaybackSave}
            onSeeked={handlePlaybackSave}
          />
          </PlayerErrorBoundary>
        )}

        {(torrentState.status === 'initialising' ||
          torrentState.status === 'connecting' ||
          torrentState.status === 'buffering' ||
          switchingLanguage) && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 p-6 text-center">
            <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-purple-500" />
            <p className="font-semibold text-white">
              {switchingLanguage ? 'Switching language…' : 'Connecting to WebRTC peers…'}
            </p>
            <p className="mt-2 text-sm text-gray-400">
              {torrentState.peers} peers · {(torrentState.progress * 100).toFixed(1)}% downloaded
            </p>
          </div>
        )}

        {torrentState.status === 'error' && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 p-6 text-center">
            <h2 className="text-lg font-bold text-white">
              {torrentState.noPeers
                ? 'No WebRTC peers found for this release'
                : torrentState.error}
            </h2>
            <p className="mt-2 max-w-xl text-sm text-gray-400">
              {torrentState.noPeers
                ? 'This release needs an active WebTorrent/WebRTC seeder. Try again later or choose another source.'
                : torrentState.error}
            </p>
            <button
              type="button"
              onClick={torrentState.retry}
              className="mt-5 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-500"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {playbackProgress >= 0.95 && numericEpisode < totalEpisodes && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-purple-500/20 bg-purple-500/10 p-4">
          <span className="text-sm text-purple-100">Episode almost finished.</span>
          <button
            type="button"
            onClick={nextEpisode}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500"
          >
            Next episode
          </button>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          Browser playback requires a WebRTC-capable seeder. Unsupported containers or codecs may not play on every device.
        </p>
        <Link
          to={`/anime/${animeId}`}
          className="text-sm text-purple-400 hover:text-purple-300"
        >
          All episodes
        </Link>
      </div>
    </main>
  );
}
