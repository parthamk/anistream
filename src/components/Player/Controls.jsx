
import {
  Maximize,
  Minimize,
  Pause,
  Play,
  Volume2,
  VolumeX,
  Settings2,
  Subtitles,
  BarChart3,
} from 'lucide-react';
import SeekBar from './SeekBar';
import LanguageSwitch from './LanguageSwitch';

export default function Controls({
  playing,
  currentTime,
  duration,
  buffered,
  volume,
  muted,
  playbackRate,
  language,
  availableLanguages,
  onPlayPause,
  onSeek,
  onVolume,
  onMute,
  onRate,
  onFullscreen,
  onLanguage,
  onSubtitles,
  subtitles = [],
  selectedSubtitle = '',
  onStats,
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/95 via-black/75 to-transparent px-3 pb-3 pt-12 sm:px-5 sm:pb-5">
      <SeekBar
        currentTime={currentTime}
        duration={duration}
        buffered={buffered}
        onSeek={onSeek}
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={onPlayPause}
            className="rounded-lg p-2 text-white hover:bg-white/15"
          >
            {playing ? <Pause size={21} /> : <Play size={21} />}
          </button>

          <button
            type="button"
            aria-label={muted || volume === 0 ? 'Unmute' : 'Mute'}
            onClick={onMute}
            className="rounded-lg p-2 text-white hover:bg-white/15"
          >
            {muted || volume === 0 ? <VolumeX size={19} /> : <Volume2 size={19} />}
          </button>

          <input
            aria-label="Volume"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={muted ? 0 : volume}
            onChange={(event) => onVolume(Number(event.target.value))}
            className="w-20 accent-purple-500 sm:w-24"
          />

          <LanguageSwitch
            language={language}
            available={availableLanguages}
            onChange={onLanguage}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 rounded-lg bg-black/40 px-2 py-2 text-xs text-white">
            <Settings2 size={14} />
            <select
              aria-label="Playback speed"
              value={playbackRate}
              onChange={(event) => onRate(Number(event.target.value))}
              className="bg-transparent outline-none"
            >
              {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                <option key={rate} value={rate} className="bg-slate-900">
                  {rate}x
                </option>
              ))}
            </select>
          </label>

          {subtitles.length > 0 && (
            <label className="flex items-center gap-1 rounded-lg bg-black/40 px-2 py-2 text-xs text-white">
              <Subtitles size={15} />
              <select
                aria-label="Subtitles"
                value={selectedSubtitle}
                onChange={(event) => onSubtitles(event.target.value)}
                className="max-w-28 bg-transparent outline-none"
              >
                <option value="" className="bg-slate-900">Off</option>
                {subtitles.map((subtitle) => (
                  <option key={subtitle.id} value={subtitle.id} className="bg-slate-900">
                    {subtitle.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button
            type="button"
            onClick={onStats}
            title="Toggle torrent statistics"
            className="rounded-lg p-2 text-white hover:bg-white/15"
          >
            <BarChart3 size={18} />
          </button>

          <button
            type="button"
            onClick={onFullscreen}
            aria-label="Toggle fullscreen"
            className="rounded-lg p-2 text-white hover:bg-white/15"
          >
            <Maximize size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
