
-- ============================================================
-- AniStream - Initial Supabase Database Schema
-- ============================================================
-- Run this entire script in:
-- Supabase Dashboard -> SQL Editor -> New Query
-- ============================================================


-- ============================================================
-- 1. PROFILES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    username TEXT,

    is_admin BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


ALTER TABLE public.profiles
ENABLE ROW LEVEL SECURITY;


-- Users can only read their own profile.
-- No client INSERT, UPDATE, or DELETE policies are created.

DROP POLICY IF EXISTS "Users can read their own profile"
ON public.profiles;

CREATE POLICY "Users can read their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    auth.uid() = id
);


-- Automatically create a profile when a user signs up.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        username
    )
    VALUES (
        NEW.id,
        COALESCE(
            NEW.raw_user_meta_data ->> 'username',
            SPLIT_PART(NEW.email, '@', 1)
        )
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;


-- Prevent direct invocation by application roles.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;


DROP TRIGGER IF EXISTS on_auth_user_created
ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- 2. LIBRARY ENTRIES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.library_entries (
    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    anime_id INTEGER NOT NULL,

    title TEXT NOT NULL,

    cover_url TEXT,

    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,

    in_watchlist BOOLEAN NOT NULL DEFAULT FALSE,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (user_id, anime_id)
);


ALTER TABLE public.library_entries
ENABLE ROW LEVEL SECURITY;


-- SELECT

DROP POLICY IF EXISTS "Users can read their own library"
ON public.library_entries;

CREATE POLICY "Users can read their own library"
ON public.library_entries
FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id
);


-- INSERT

DROP POLICY IF EXISTS "Users can insert into their own library"
ON public.library_entries;

CREATE POLICY "Users can insert into their own library"
ON public.library_entries
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
);


-- UPDATE

DROP POLICY IF EXISTS "Users can update their own library"
ON public.library_entries;

CREATE POLICY "Users can update their own library"
ON public.library_entries
FOR UPDATE
TO authenticated
USING (
    auth.uid() = user_id
)
WITH CHECK (
    auth.uid() = user_id
);


-- DELETE

DROP POLICY IF EXISTS "Users can delete from their own library"
ON public.library_entries;

CREATE POLICY "Users can delete from their own library"
ON public.library_entries
FOR DELETE
TO authenticated
USING (
    auth.uid() = user_id
);


-- ============================================================
-- 3. WATCHED EPISODES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.watched_episodes (
    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    anime_id INTEGER NOT NULL,

    episode_number INTEGER NOT NULL,

    watched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (
        user_id,
        anime_id,
        episode_number
    )
);


ALTER TABLE public.watched_episodes
ENABLE ROW LEVEL SECURITY;


-- SELECT

DROP POLICY IF EXISTS "Users can read their own watched episodes"
ON public.watched_episodes;

CREATE POLICY "Users can read their own watched episodes"
ON public.watched_episodes
FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id
);


-- INSERT

DROP POLICY IF EXISTS "Users can insert their own watched episodes"
ON public.watched_episodes;

CREATE POLICY "Users can insert their own watched episodes"
ON public.watched_episodes
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
);


-- UPDATE

DROP POLICY IF EXISTS "Users can update their own watched episodes"
ON public.watched_episodes;

CREATE POLICY "Users can update their own watched episodes"
ON public.watched_episodes
FOR UPDATE
TO authenticated
USING (
    auth.uid() = user_id
)
WITH CHECK (
    auth.uid() = user_id
);


-- DELETE

DROP POLICY IF EXISTS "Users can delete their own watched episodes"
ON public.watched_episodes;

CREATE POLICY "Users can delete their own watched episodes"
ON public.watched_episodes
FOR DELETE
TO authenticated
USING (
    auth.uid() = user_id
);


-- ============================================================
-- 4. WATCH PROGRESS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.watch_progress (
    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    anime_id INTEGER NOT NULL,

    episode_number INTEGER NOT NULL,

    language TEXT NOT NULL
        CHECK (language IN ('sub', 'dub')),

    position_seconds INTEGER NOT NULL DEFAULT 0
        CHECK (position_seconds >= 0),

    duration_seconds INTEGER NOT NULL DEFAULT 0
        CHECK (duration_seconds >= 0),

    title TEXT NOT NULL,

    cover_url TEXT,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (
        user_id,
        anime_id,
        episode_number
    )
);


ALTER TABLE public.watch_progress
ENABLE ROW LEVEL SECURITY;


-- Index for Continue Watching queries.

CREATE INDEX IF NOT EXISTS idx_watch_progress_user_updated
ON public.watch_progress (
    user_id,
    updated_at DESC
);


-- SELECT

DROP POLICY IF EXISTS "Users can read their own watch progress"
ON public.watch_progress;

CREATE POLICY "Users can read their own watch progress"
ON public.watch_progress
FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id
);


-- INSERT

DROP POLICY IF EXISTS "Users can insert their own watch progress"
ON public.watch_progress;

CREATE POLICY "Users can insert their own watch progress"
ON public.watch_progress
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
);


-- UPDATE

DROP POLICY IF EXISTS "Users can update their own watch progress"
ON public.watch_progress;

CREATE POLICY "Users can update their own watch progress"
ON public.watch_progress
FOR UPDATE
TO authenticated
USING (
    auth.uid() = user_id
)
WITH CHECK (
    auth.uid() = user_id
);


-- DELETE

DROP POLICY IF EXISTS "Users can delete their own watch progress"
ON public.watch_progress;

CREATE POLICY "Users can delete their own watch progress"
ON public.watch_progress
FOR DELETE
TO authenticated
USING (
    auth.uid() = user_id
);


-- ============================================================
-- 5. SOURCES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    anime_id INTEGER NOT NULL,

    episode_number INTEGER NOT NULL,

    language TEXT NOT NULL
        CHECK (language IN ('sub', 'dub')),

    magnet_uri TEXT NOT NULL,

    file_index INTEGER,

    quality TEXT,

    created_by UUID
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT sources_anime_episode_language_unique
        UNIQUE (
            anime_id,
            episode_number,
            language
        )
);


ALTER TABLE public.sources
ENABLE ROW LEVEL SECURITY;


-- Anyone can read available streaming sources.
-- This includes unauthenticated visitors.

DROP POLICY IF EXISTS "Anyone can read sources"
ON public.sources;

CREATE POLICY "Anyone can read sources"
ON public.sources
FOR SELECT
TO anon, authenticated
USING (TRUE);


-- Only administrators can insert sources.

DROP POLICY IF EXISTS "Admins can insert sources"
ON public.sources;

CREATE POLICY "Admins can insert sources"
ON public.sources
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = (SELECT auth.uid())
        AND profiles.is_admin = TRUE
    )
);


-- Only administrators can update sources.

DROP POLICY IF EXISTS "Admins can update sources"
ON public.sources;

CREATE POLICY "Admins can update sources"
ON public.sources
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = (SELECT auth.uid())
        AND profiles.is_admin = TRUE
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = (SELECT auth.uid())
        AND profiles.is_admin = TRUE
    )
);


-- Only administrators can delete sources.

DROP POLICY IF EXISTS "Admins can delete sources"
ON public.sources;

CREATE POLICY "Admins can delete sources"
ON public.sources
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = (SELECT auth.uid())
        AND profiles.is_admin = TRUE
    )
);


-- ============================================================
-- 6. TABLE PRIVILEGES
-- ============================================================

-- Profiles: users can only SELECT their own rows.
-- There are deliberately no client-side write privileges.

GRANT SELECT ON public.profiles TO authenticated;


-- Library entries.

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.library_entries
TO authenticated;


-- Watched episodes.

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.watched_episodes
TO authenticated;


-- Watch progress.

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.watch_progress
TO authenticated;


-- Sources: publicly readable, administrator-write protected
-- through RLS policies.

GRANT SELECT
ON public.sources
TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE
ON public.sources
TO authenticated;


-- ============================================================
-- END OF ANISTREAM INITIAL SCHEMA
-- ============================================================
