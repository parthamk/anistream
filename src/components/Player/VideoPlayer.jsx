
import { useEffect, useRef, useState } from 'react';
import Controls from './Controls';
import StatsOverlay from './StatsOverlay';

export default function VideoPlayer({
  src,
  onReady,
  onError,
  onTimeUpdate,
  onPause,
  onSeeked,
  language,
  availableLanguages,
  onLanguage,
  subtitles = [],
  selectedSubtitle,
  onSubtitles,
  stats,
  onVideoRef,
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hideTimer = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    if (onVideoRef) onVideoRef(videoRef.current);
  }, [onVideoRef]);

  const revealControls = () => {
    setControlsVisible(true);
    window.clearTimeout(hideTimer.current);
    if (playing) {
      hideTimer.current = window.setTimeout(() => setControlsVisible(false), 3000);
    }
  };

  useEffect(() => {
    revealControls();
    return () => window.clearTimeout(hideTimer.current);
  }, [playing]);

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      try {
        await video.play();
      } catch {
        setPlaying(false);
      }
    } else {
      video.pause();
    }
  };

  const seek = (time) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(time, video.duration || time));
  };

  const changeVolume = (value) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = value;
    setVolume(value);
    if (value > 0) {
      video.muted = false;
      setMuted(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  const changeRate = (rate) => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const fullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else container.requestFullscreen?.();
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const onKeyDown = (event) => {
      if (
        ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName) ||
        event.altKey || event.ctrlKey || event.metaKey
      ) return;

      const key = event.key.toLowerCase();

      if (key === ' ' || key === 'k') {
        event.preventDefault();
        togglePlay();
      } else if (key === 'arrowleft') {
        event.preventDefault();
        seek(video.currentTime - 10);
      } else if (key === 'arrowright') {
        event.preventDefault();
        seek(video.currentTime + 10);
      } else if (key === 'arrowup') {
        event.preventDefault();
        changeVolume(Math.min(1, video.volume + 0.05));
      } else if (key === 'arrowdown') {
        event.preventDefault();
        changeVolume(Math.max(0, video.volume - 0.05));
      } else if (key === 'f') {
        fullscreen();
      } else if (key === 'm') {
        toggleMute();
      }

      revealControls();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const updateBuffered = () => {
    const video = videoRef.current;
    if (!video || !video.buffered.length) {
      setBuffered(0);
      return;
    }

    try {
      setBuffered(video.buffered.end(video.buffered.length - 1));
    } catch {
      setBuffered(0);
    }
  };

  return (
    <div
      ref={containerRef}
      className="group relative aspect-video w-full overflow-hidden bg-black"
      onMouseMove={revealControls}
      onTouchStart={revealControls}
      onDoubleClick={fullscreen}
    >
      <video
        ref={videoRef}
        src={src}
        className="h-full w-full object-contain"
        playsInline
        preload="metadata"
        onClick={togglePlay}
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration || 0);
          onReady?.(event.currentTarget);
        }}
        onTimeUpdate={(event) => {
          const video = event.currentTarget;
          setCurrentTime(video.currentTime);
          setDuration(video.duration || 0);
          updateBuffered();
          onTimeUpdate?.(video);
        }}
        onProgress={updateBuffered}
        onPlay={() => setPlaying(true)}
        onPause={(event) => {
          setPlaying(false);
          onPause?.(event.currentTarget);
        }}
        onSeeked={(event) => onSeeked?.(event.currentTarget)}
        onError={onError}
      >
        {subtitles.map((subtitle) => (
          <track
            key={subtitle.id}
            kind="subtitles"
            src={subtitle.url}
            srcLang={subtitle.srclang || 'und'}
            label={subtitle.label}
            default={subtitle.id === selectedSubtitle}
          />
        ))}
      </video>

      {showStats && <StatsOverlay {...stats} />}

      {controlsVisible && (
        <Controls
          playing={playing}
          currentTime={currentTime}
          duration={duration}
          buffered={buffered}
          volume={volume}
          muted={muted}
          playbackRate={playbackRate}
          language={language}
          availableLanguages={availableLanguages}
          onPlayPause={togglePlay}
          onSeek={seek}
          onVolume={changeVolume}
          onMute={toggleMute}
          onRate={changeRate}
          onFullscreen={fullscreen}
          onLanguage={onLanguage}
          onSubtitles={onSubtitles}
          subtitles={subtitles}
          selectedSubtitle={selectedSubtitle}
          onStats={() => setShowStats((value) => !value)}
        />
      )}
    </div>
  );
}
