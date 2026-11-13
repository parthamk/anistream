
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#09090f] px-4 py-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-sm text-gray-400 sm:flex-row">
        <Link to="/" className="text-lg font-bold text-white">
          Ani<span className="text-purple-500">Stream</span>
        </Link>

        <p className="text-center">
          Discover and enjoy anime with AniStream.
        </p>

        <div className="flex items-center gap-2">
          <span>Made with</span>
          <Heart size={14} className="fill-red-500 text-red-500" />
          <span>for anime fans</span>
        </div>
      </div>

      <p className="mt-5 text-center text-xs text-gray-600">
        © {new Date().getFullYear()} AniStream. All rights reserved.
      </p>
    </footer>
  );
}
