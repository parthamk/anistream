
export function AnimeCardSkeleton() {
  return (
    <div className="min-w-0 animate-pulse">
      <div className="aspect-[3/4] rounded-xl bg-dark-700" />

      <div className="mt-3 h-4 w-4/5 rounded bg-dark-700" />

      <div className="mt-2 h-3 w-2/5 rounded bg-dark-700" />
    </div>
  )
}

export function AnimeRowSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-flow-col auto-cols-[42%] gap-4 overflow-hidden sm:auto-cols-[28%] md:auto-cols-[20%] lg:auto-cols-[15%]">
      {Array.from({ length: count }, (_, index) => (
        <AnimeCardSkeleton key={index} />
      ))}
    </div>
  )
}

export function GridSkeleton({ count = 12 }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: count }, (_, index) => (
        <AnimeCardSkeleton key={index} />
      ))}
    </div>
  )
}

export function HeroSkeleton() {
  return (
    <div className="relative min-h-[420px] animate-pulse overflow-hidden rounded-2xl bg-dark-800 sm:min-h-[520px]">
      <div className="absolute bottom-10 left-6 space-y-4 sm:left-12">
        <div className="h-8 w-64 rounded bg-dark-700 sm:w-96" />
        <div className="h-4 w-48 rounded bg-dark-700" />
        <div className="h-12 w-32 rounded-lg bg-dark-700" />
      </div>
    </div>
  )
}
