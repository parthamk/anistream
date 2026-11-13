
export default function LanguageSwitch({ language, available, onChange, disabled = false }) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-black/40 p-1">
      {['sub', 'dub'].map((option) => {
        const exists = available.includes(option);
        return (
          <button
            key={option}
            type="button"
            disabled={disabled || !exists}
            title={exists ? `Switch to ${option.toUpperCase()}` : 'Not available for this episode'}
            onClick={() => onChange(option)}
            className={`rounded-md px-3 py-1.5 text-xs font-bold uppercase transition ${
              language === option
                ? 'bg-purple-600 text-white'
                : 'text-white/70 hover:bg-white/10'
            } disabled:cursor-not-allowed disabled:opacity-30`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
