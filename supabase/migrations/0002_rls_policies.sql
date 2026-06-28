-- Phase 2: Row Level Security policies
-- Every user-owned table: USING (auth.uid() = user_id)
-- pillars: public read-only reference table

ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pillars           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_pillars      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.level_records     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whoop_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whoop_data        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ── profiles ──────────────────────────────────────────────────────────────────────────
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE USING (auth.uid() = id);

-- ── pillars (reference table — public read, no writes via anon) ───────────────
CREATE POLICY "pillars_public_read" ON public.pillars FOR SELECT USING (true);

-- ── user_pillars ──────────────────────────────────────────────────────────────────────────
CREATE POLICY "user_pillars_select_own" ON public.user_pillars FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_pillars_insert_own" ON public.user_pillars FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_pillars_update_own" ON public.user_pillars FOR UPDATE USING (auth.uid() = user_id);

-- ── campaigns ──────────────────────────────────────────────────────────────────────────
CREATE POLICY "campaigns_select_own" ON public.campaigns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "campaigns_insert_own" ON public.campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "campaigns_update_own" ON public.campaigns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "campaigns_delete_own" ON public.campaigns FOR DELETE USING (auth.uid() = user_id);

-- ── tracks (owned through campaign, not directly) ─────────────────────────────────
CREATE POLICY "tracks_select_own" ON public.tracks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE id = tracks.campaign_id AND user_id = auth.uid()
  ));

CREATE POLICY "tracks_insert_own" ON public.tracks FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE id = campaign_id AND user_id = auth.uid()
  ));

CREATE POLICY "tracks_update_own" ON public.tracks FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE id = tracks.campaign_id AND user_id = auth.uid()
  ));

-- ── daily_logs ──────────────────────────────────────────────────────────────────────────
CREATE POLICY "daily_logs_select_own" ON public.daily_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "daily_logs_insert_own" ON public.daily_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "daily_logs_update_own" ON public.daily_logs FOR UPDATE USING (auth.uid() = user_id);

-- ── xp_transactions (immutable — no UPDATE or DELETE) ─────────────────────────────
CREATE POLICY "xp_transactions_select_own" ON public.xp_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "xp_transactions_insert_own" ON public.xp_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── level_records (immutable) ──────────────────────────────────────────────────────────────────────────
CREATE POLICY "level_records_select_own" ON public.level_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "level_records_insert_own" ON public.level_records FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── streaks ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "streaks_select_own" ON public.streaks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "streaks_insert_own" ON public.streaks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "streaks_update_own" ON public.streaks FOR UPDATE USING (auth.uid() = user_id);

-- ── whoop_connections (read-only via anon; writes go through service role) ─────────────
CREATE POLICY "whoop_connections_select_own" ON public.whoop_connections
  FOR SELECT USING (auth.uid() = user_id);

-- ── whoop_data (written only by service role via sync route) ────────────────────────
CREATE POLICY "whoop_data_select_own" ON public.whoop_data FOR SELECT USING (auth.uid() = user_id);

-- ── push_subscriptions ──────────────────────────────────────────────────────────────────────────
CREATE POLICY "push_subscriptions_select_own" ON public.push_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "push_subscriptions_insert_own" ON public.push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_subscriptions_delete_own" ON public.push_subscriptions FOR DELETE USING (auth.uid() = user_id);
