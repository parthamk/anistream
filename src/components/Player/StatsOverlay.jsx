
function formatSpeed(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB/s';
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB/s`;
  return `${(bytes / 1024).toFixed(1)} KB/s`;
}

export default function StatsOverlay({ peers = 0, downloadSpeed = 0, progress = 0 }) {
  return (
    <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-lg border border-white/10 bg-black/75 px-3 py-2 font-mono text-xs text-green-300 shadow-lg">
      <div>Peers: {peers}</div>
      <div>Download: {formatSpeed(downloadSpeed)}</div>
      <div>Downloaded: {(Math.max(0, Math.min(1, progress)) * 100).toFixed(1)}%</div>
    </div>
  );
}
