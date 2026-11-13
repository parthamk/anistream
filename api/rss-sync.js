import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const FEED_URL = process.env.NYAA_RSS_URL || 'https://nyaa.si/?page=rss';
const MAX_ITEMS = 100;

function send(res, status, body) {
  res.status(status).json(body);
}

function decodeXml(value = '') {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .trim();
}

function tag(item, name) {
  const expression = new RegExp(
    '<(?:[\\w.-]+:)?' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?' + name + '>',
    'i',
  );
  return decodeXml(item.match(expression)?.[1] || '');
}

function numberOrNull(value) {
  const parsed = Number(String(value || '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseReleaseTitle(title) {
  let cleaned = title.replace(/^\[[^\]]+\]\s*/, '').trim();
  const episodeMatch =
    cleaned.match(/\b(?:episode|ep)\s*[-._ ]?\s*(\d{1,4}(?:\.\d+)?)/i) ||
    cleaned.match(/\s-\s(\d{1,4})(?=\s|\[|\(|$)/);

  const episodeNumber = episodeMatch ? Number(episodeMatch[1]) : null;
  if (episodeMatch?.index !== undefined) cleaned = cleaned.slice(0, episodeMatch.index);
  cleaned = cleaned
    .replace(/\.(mkv|mp4|webm|avi)$/i, '')
    .replace(/[._]+/g, ' ')
    .replace(/\s*[-–|]+\s*$/, '')
    .trim();

  const quality = title.match(/\b(2160p|1440p|1080p|720p|480p|360p)\b/i)?.[1]?.toLowerCase() || null;
  const language = /\b(dub|dual[ ._-]?audio)\b/i.test(title)
    ? 'dub'
    : /\b(sub|multi[ ._-]?sub)\b/i.test(title)
      ? 'sub'
      : 'unknown';

  return {
    anime_title_guess: cleaned || title,
    episode_number: Number.isFinite(episodeNumber) ? episodeNumber : null,
    language,
    quality,
  };
}

function safeNyaaUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'nyaa.si' || !/^\/view\/\d+\/?$/.test(url.pathname)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function parseFeed(xml) {
  const items = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].slice(0, MAX_ITEMS);
  return items.map((match) => {
    const item = match[1];
    const title = tag(item, 'title');
    const guid = tag(item, 'guid');
    const detailUrl = safeNyaaUrl(tag(item, 'link'));
    const publishedRaw = tag(item, 'pubDate');
    const publishedAt = publishedRaw && Number.isFinite(Date.parse(publishedRaw))
      ? new Date(publishedRaw).toISOString()
      : null;
    const parsed = parseReleaseTitle(title);
    const stableSource = guid && !/^magnet:/i.test(guid) ? guid : (detailUrl || title + publishedRaw);
    const itemKey = createHash('sha256').update(stableSource).digest('hex');

    return {
      item_key: itemKey,
      title: title.slice(0, 500),
      anime_title_guess: parsed.anime_title_guess.slice(0, 250),
      episode_number: parsed.episode_number,
      language: parsed.language,
      quality: parsed.quality,
      category: tag(item, 'category').slice(0, 120) || null,
      published_at: publishedAt,
      detail_url: detailUrl,
      seeders: numberOrNull(tag(item, 'seeders')),
      leechers: numberOrNull(tag(item, 'leechers')),
      size_label: tag(item, 'size').slice(0, 40) || null,
      source_name: 'Nyaa RSS',
    };
  }).filter((item) => item.title && item.item_key);
}

function equalSecret(a, b) {
  if (!a || !b) return false;
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && createHash('sha256').update(left).digest('hex') === createHash('sha256').update(right).digest('hex');
}

async function authorizeAdmin(req, supabaseUrl, anonKey, serviceClient) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return false;

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user?.id) return false;

  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('is_admin')
    .eq('id', data.user.id)
    .maybeSingle();

  return !profileError && profile?.is_admin === true;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { error: 'Method not allowed.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const cronSecret = process.env.CRON_SECRET;

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return send(res, 500, { error: 'Server Supabase environment variables are not configured.' });
  }

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (req.method === 'GET') {
    const authorization = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!cronSecret || !equalSecret(authorization, cronSecret)) {
      return send(res, 401, { error: 'Unauthorized cron request.' });
    }
  } else if (!(await authorizeAdmin(req, supabaseUrl, anonKey, serviceClient))) {
    return send(res, 403, { error: 'Administrator access required.' });
  }

  let feedUrl;
  try {
    feedUrl = new URL(FEED_URL);
  } catch {
    return send(res, 500, { error: 'NYAA_RSS_URL must be a valid HTTPS URL.' });
  }

  if (feedUrl.protocol !== 'https:' || feedUrl.hostname !== 'nyaa.si') {
    return send(res, 400, { error: 'Only an HTTPS Nyaa RSS URL is allowed.' });
  }

  try {
    const response = await fetch(feedUrl, {
      headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error('RSS request failed with HTTP ' + response.status);

    const xml = await response.text();
    if (!/<rss\b|<feed\b/i.test(xml)) throw new Error('The configured URL did not return an RSS/XML feed.');

    const items = parseFeed(xml);
    if (!items.length) {
      return send(res, 200, { ok: true, fetched: 0, inserted: 0, message: 'No RSS items were found.' });
    }

    const { data, error } = await serviceClient
      .from('rss_release_catalog')
      .upsert(items, { onConflict: 'item_key', ignoreDuplicates: true })
      .select('id');

    if (error) throw error;

    return send(res, 200, {
      ok: true,
      fetched: items.length,
      inserted: data?.length || 0,
      message: 'RSS metadata synchronized. Magnet URIs and info hashes are not collected.',
    });
  } catch (error) {
    console.error('RSS sync failed:', error);
    return send(res, 502, { error: error.message || 'RSS synchronization failed.' });
  }
}
