-- Phase 2: Core schema
-- Run order: 1 of 4

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Enums ──────────────────────────────────────────────────────────────────
CREATE TYPE pillar_slug AS ENUM ('body', 'mind', 'spirit', 'structure', 'leverage', 'agency');
CREATE TYPE pillar_domain AS ENUM ('health', 'wealth');
CREATE TYPE campaign_status AS ENUM ('active', 'paused', 'completed', 'archived');
CREATE TYPE campaign_phase AS ENUM ('build', 'maintain');
CREATE TYPE track_slug AS ENUM ('leanness', 'look', 'strength');
CREATE TYPE log_type AS ENUM ('action', 'measurement', 'photo');
CREATE TYPE xp_source AS ENUM ('daily_log', 'streak_bonus', 'level_up', 'manual', 'whoop_bonus');

-- ── tables ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT,
  avatar_url    TEXT,
  timezone      TEXT        NOT NULL DEFAULT 'UTC',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reference table — seeded once, never user-owned
CREATE TABLE IF NOT EXISTS public.pillars (
  id          SERIAL      PRIMARY KEY,
  slug        pillar_slug NOT NULL UNIQUE,
  domain      pillar_domain NOT NULL,
  label       TEXT        NOT NULL,
  description TEXT,
  sort_order  INT         NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.user_pillars (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pillar_id  INT  NOT NULL REFERENCES public.pillars(id) ON DELETE CASCADE,
  level      INT  NOT NULL DEFAULT 1,
  xp_total   INT  NOT NULL DEFAULT 0,
  xp_current INT  NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, pillar_id)
);

CREATE TABLE IF NOT EXISTS public.campaigns (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID           NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT           NOT NULL,
  slug            TEXT           NOT NULL,
  status          campaign_status NOT NULL DEFAULT 'active',
  phase           campaign_phase  NOT NULL DEFAULT 'build',
  composite_score NUMERIC(5,2)   NOT NULL DEFAULT 0,
  target_score    NUMERIC(5,2)   NOT NULL DEFAULT 80,
  build_deadline  DATE,
  pillar_ids      INT[]          NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, slug)
);

CREATE TABLE IF NOT EXISTS public.tracks (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      UUID        NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  slug             track_slug  NOT NULL,
  label            TEXT        NOT NULL,
  weight           NUMERIC(4,3) NOT NULL DEFAULT 0.333
                                CHECK (weight > 0 AND weight <= 1),
  floor_value      NUMERIC(10,3),
  target_value     NUMERIC(10,3),
  current_value    NUMERIC(10,3),
  unit             TEXT,
  higher_is_better BOOLEAN     NOT NULL DEFAULT true,
  sort_order       INT         NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, slug)
);

-- Idempotent: unique constraint on (user_id, campaign_id, log_date, action_key)
-- prevents double-logging the same action on the same day
CREATE TABLE IF NOT EXISTS public.daily_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID        NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  log_date    DATE        NOT NULL,
  log_type    log_type    NOT NULL DEFAULT 'action',
  pillar_slug pillar_slug,
  track_slug  track_slug,
  action_key  TEXT,
  value       NUMERIC(10,3),
  notes       TEXT,
  media_url   TEXT,
  xp_awarded  INT         NOT NULL DEFAULT 0,
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, campaign_id, log_date, action_key)
);

-- Immutable XP ledger — no UPDATE or DELETE policies
CREATE TABLE IF NOT EXISTS public.xp_transactions (
  id          UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID     NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pillar_id   INT      REFERENCES public.pillars(id) ON DELETE SET NULL,
  campaign_id UUID     REFERENCES public.campaigns(id) ON DELETE SET NULL,
  amount      INT      NOT NULL,
  source      xp_source NOT NULL,
  description TEXT,
  metadata    JSONB    NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Immutable level-up audit trail — no UPDATE or DELETE policies
CREATE TABLE IF NOT EXISTS public.level_records (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pillar_id            INT         NOT NULL REFERENCES public.pillars(id) ON DELETE CASCADE,
  level_reached        INT         NOT NULL,
  composite_at_levelup NUMERIC(5,2),
  evidence_log_ids     UUID[]      NOT NULL DEFAULT '{}',
  leveled_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.streaks (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id      UUID        NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  current_streak   INT         NOT NULL DEFAULT 0,
  longest_streak   INT         NOT NULL DEFAULT 0,
  last_logged_date DATE,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, campaign_id)
);

-- Whoop tokens stored encrypted — see Phase 8 for AES-256-GCM encryption
CREATE TABLE IF NOT EXISTS public.whoop_connections (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  whoop_user_id    TEXT        NOT NULL,
  access_token     TEXT        NOT NULL,
  refresh_token    TEXT        NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  connected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.whoop_data (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_date          DATE        NOT NULL,
  recovery_score     NUMERIC(5,2),
  hrv_rmssd          NUMERIC(6,2),
  resting_hr         NUMERIC(5,2),
  sleep_score        NUMERIC(5,2),
  sleep_duration_ms  BIGINT,
  strain_score       NUMERIC(5,2),
  raw_payload        JSONB,
  synced_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, data_date)
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT        NOT NULL UNIQUE,
  p256dh     TEXT        NOT NULL,
  auth_key   TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_user_pillars_user_id      ON public.user_pillars(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id         ON public.campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_status     ON public.campaigns(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tracks_campaign_id        ON public.tracks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_id        ON public.daily_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date      ON public.daily_logs(user_id, campaign_id, log_date);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_user_id   ON public.xp_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_user_date ON public.xp_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_level_records_user_id     ON public.level_records(user_id);
CREATE INDEX IF NOT EXISTS idx_streaks_user_id           ON public.streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_whoop_data_user_id        ON public.whoop_data(user_id);
CREATE INDEX IF NOT EXISTS idx_whoop_data_user_date      ON public.whoop_data(user_id, data_date DESC);
CREATE INDEX IF NOT EXISTS idx_push_subs_user_id         ON public.push_subscriptions(user_id);

-- ── Triggers ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at     BEFORE UPDATE ON public.profiles     FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_user_pillars_updated_at BEFORE UPDATE ON public.user_pillars FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_campaigns_updated_at    BEFORE UPDATE ON public.campaigns    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_tracks_updated_at       BEFORE UPDATE ON public.tracks       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_streaks_updated_at      BEFORE UPDATE ON public.streaks      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, timezone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'timezone', 'UTC')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
