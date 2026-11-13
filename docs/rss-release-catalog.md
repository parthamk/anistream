# RSS release catalog (metadata-only)

AniStream can poll the public Nyaa RSS feed to demonstrate scheduled RSS ingestion, XML parsing, deduplication, title normalization, and manual AniList matching.

This feature intentionally stores release metadata only. It does not collect magnet URIs, info hashes, download torrent data, or create playable sources.

## 1. Apply the database migration

Run the SQL in `supabase/migrations/20261113000000_rss_release_catalog.sql` in the Supabase SQL editor, or apply it with the Supabase CLI.

The table is protected by RLS. Only authenticated users whose `profiles.is_admin` value is true can read, update, or delete catalog rows. Inserts are performed by the server-side function using the service-role key.

## 2. Configure Vercel environment variables

Set these for Production (and Preview if you want to test there):

- `SUPABASE_URL`: your Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service-role key. Server-side only; never prefix it with `VITE_`.
- `VITE_SUPABASE_URL`: existing browser Supabase URL.
- `VITE_SUPABASE_ANON_KEY`: existing browser anon/publishable key.
- `CRON_SECRET`: a long random secret used to authenticate scheduled requests.
- `NYAA_RSS_URL` (optional): defaults to `https://nyaa.si/?page=rss`. Only HTTPS URLs on `nyaa.si` are accepted.

Redeploy after adding variables.

## 3. Scheduling

Vercel Cron invokes `/api/rss-sync` daily at 03:00 UTC (the Hobby-compatible schedule). Vercel Hobby may run a daily cron at any point within the scheduled hour; schedules more frequent than once per day require a plan that supports sub-daily cron. The endpoint accepts GET only with `Authorization: Bearer <CRON_SECRET>`. The admin page can also trigger a POST using the current Supabase session; the server verifies the user and their `profiles.is_admin` flag before syncing.

For local manual testing, run `vercel dev` with the server environment variables configured, then visit the admin page at `/admin/feed` and select **Sync RSS now**. Vite's regular dev server does not execute Vercel Functions.

## 4. Review the catalog

Open `/admin/feed` as an administrator. Review detected episode, language, and quality hints, search AniList, and explicitly associate each feed item with an anime. Episode/language parsing is heuristic and should be reviewed.

## 5. Data retained

The importer stores title, normalized title guess, episode/language/quality hints, category, publication date, Nyaa detail-page URL, seed/leech counts, and a deduplication hash. It deliberately discards magnet links and info hashes.

## Troubleshooting

- **401 on scheduled sync:** verify `CRON_SECRET` is set in Vercel and redeploy.
- **500 environment error:** verify server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` exist.
- **RLS error in admin UI:** apply the migration and confirm the user's `profiles.is_admin` is true.
- **No entries:** check the RSS URL and Vercel Function logs. The feed may not have new entries.
- **Local /api 404:** use `vercel dev`, not only `npm run dev`.
