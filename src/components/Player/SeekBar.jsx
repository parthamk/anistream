
export default function SeekBar({
  currentTime = 0,
  duration = 0,
  buffered = 0,
  onSeek,
}) {
  const format = (seconds) => {
    if (!Number.isFinite(seconds)) return '0:00';
    const value = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const secs = value % 60;
    return hours
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      : `${minutes}:${String(secs).padStart(2, '0')}`;
  };

  const percent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const bufferedPercent = duration > 0 ? Math.min(100, buffered * 100 / duration) : 0;

  return (
    <div className="flex items-center gap-3">
      <span className="min-w-10 text-right text-xs tabular-nums text-white/80">
        {format(currentTime)}
      </span>
      <input
        aria-label="Seek video"
        type="range"
        min="0"
        max={duration || 0}
        step="0.1"
        value={Math.min(currentTime, duration || 0)}
        onChange={(event) => onSeek?.(Number(event.target.value))}
        className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-purple-500"
        style={{
          background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${percent}%, rgba(255,255,255,.35) ${percent}%, rgba(255,255,255,.35) ${bufferedPercent}%, rgba(255,255,255,.2) ${bufferedPercent}%)`,
        }}
      />
      <span className="min-w-10 text-xs tabular-nums text-white/80">
        {format(duration)}
      </span>
    </div>
  );
}
