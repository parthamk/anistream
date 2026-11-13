
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function EpisodeNav({ animeId, episode, totalEpisodes, onNext }) {
  const previous = Number(episode) - 1;
  const next = Number(episode) + 1;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {previous >= 1 ? (
        <Link
          to={`/watch/${animeId}/${previous}`}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-white hover:bg-white/10"
        >
          <ChevronLeft size={16} />
          Previous episode
        </Link>
      ) : <span />}

      {next <= totalEpisodes && (
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500"
        >
          Next episode
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}
