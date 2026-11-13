
const ANILIST_URL = 'https://graphql.anilist.co'
const CACHE_TTL = 10 * 60 * 1000
const cache = new Map()

const MEDIA_FIELDS = `
  id
  title {
    romaji
    english
  }
  coverImage {
    large
    extraLarge
  }
  bannerImage
  description(asHtml: true)
  episodes
  status
  format
  season
  seasonYear
  genres
  averageScore
  nextAiringEpisode {
    episode
  }
`

export function getTitle(anime) {
  return (
    anime?.title?.english ||
    anime?.title?.romaji ||
    'Untitled Anime'
  )
}

export function getEpisodeCount(anime) {
  if (Number.isInteger(anime?.episodes) && anime.episodes > 0) {
    return anime.episodes
  }

  const nextEpisode = anime?.nextAiringEpisode?.episode

  if (Number.isInteger(nextEpisode) && nextEpisode > 1) {
    return nextEpisode - 1
  }

  return 1
}

function getCacheKey(query, variables) {
  return JSON.stringify({
    query,
    variables
  })
}

function getCached(key) {
  const entry = cache.get(key)

  if (!entry) return null

  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key)
    return null
  }

  return entry.data
}

function setCached(key, data) {
  cache.set(key, {
    timestamp: Date.now(),
    data
  })
}

async function requestAniList(query, variables = {}) {
  const cacheKey = getCacheKey(query, variables)
  const cached = getCached(cacheKey)

  if (cached !== null) {
    return cached
  }

  let response

  try {
    response = await fetch(ANILIST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        query,
        variables
      })
    })
  } catch {
    throw new Error(
      'Unable to connect to AniList. Please check your internet connection and try again.'
    )
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After')

    throw new Error(
      retryAfter
        ? `AniList is receiving too many requests. Please try again in ${retryAfter} seconds.`
        : 'AniList is temporarily rate-limiting requests. Please wait a moment and try again.'
    )
  }

  if (response.status >= 500) {
    throw new Error(
      'AniList is temporarily unavailable. Please try again later.'
    )
  }

  if (!response.ok) {
    throw new Error(
      `AniList request failed (${response.status}). Please try again.`
    )
  }

  let result

  try {
    result = await response.json()
  } catch {
    throw new Error(
      'AniList returned an invalid response. Please try again.'
    )
  }

  if (result.errors?.length) {
    const message = result.errors[0]?.message

    throw new Error(
      message || 'AniList could not process your request.'
    )
  }

  if (!result.data) {
    throw new Error(
      'No anime data was returned. Please try again.'
    )
  }

  setCached(cacheKey, result.data)

  return result.data
}

const PAGE_QUERY = `
  query (
    $page: Int
    $sort: [MediaSort]
    $search: String
  ) {
    Page(page: $page, perPage: 20) {
      pageInfo {
        currentPage
        hasNextPage
        total
      }
      media(
        type: ANIME
        isAdult: false
        sort: $sort
        search: $search
      ) {
        ${MEDIA_FIELDS}
      }
    }
  }
`

export async function getTrending(page = 1) {
  const data = await requestAniList(PAGE_QUERY, {
    page,
    sort: ['TRENDING_DESC']
  })

  return data.Page
}

export async function getPopular(page = 1) {
  const data = await requestAniList(PAGE_QUERY, {
    page,
    sort: ['POPULARITY_DESC']
  })

  return data.Page
}

export async function searchAnime(query, page = 1) {
  const normalizedQuery = query.trim()

  if (!normalizedQuery) {
    return {
      media: [],
      pageInfo: {
        currentPage: page,
        hasNextPage: false,
        total: 0
      }
    }
  }

  const data = await requestAniList(PAGE_QUERY, {
    page,
    search: normalizedQuery,
    sort: ['SEARCH_MATCH']
  })

  return data.Page
}

export async function getAnimeById(id) {
  const animeId = Number(id)

  if (!Number.isInteger(animeId) || animeId <= 0) {
    throw new Error('Invalid anime ID.')
  }

  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        ${MEDIA_FIELDS}
      }
    }
  `

  const data = await requestAniList(query, {
    id: animeId
  })

  if (!data.Media) {
    throw new Error('Anime not found.')
  }

  return data.Media
}

// Useful when refreshing discovery data manually.
export function clearAniListCache() {
  cache.clear()
}
