-- Phase 2: Postgres economy functions
-- SECURITY DEFINER so they run as the function owner (superuser),
-- bypassing RLS and allowing cross-table writes atomically.
-- Callers must be authenticated; user_id is always passed explicitly.

-- ── award_xp ──────────────────────────────────────────────────────────────
-- Upserts user_pillars XP, inserts immutable xp_transactions row.
-- Returns updated xp_total and level (level-up decision is made in TypeScript).
CREATE OR REPLACE FUNCTION public.award_xp(
  p_user_id     UUID,
  p_pillar_id   INT,
  p_amount      INT,
  p_source      xp_source,
  p_campaign_id UUID    DEFAULT NULL,
  p_description TEXT    DEFAULT NULL,
  p_metadata    JSONB   DEFAULT '{}'
)
RETURNS TABLE (new_xp_total INT, new_level INT, leveled_up BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_xp_total INT;
  v_level    INT;
BEGIN
  INSERT INTO public.user_pillars (user_id, pillar_id, xp_total, xp_current)
  VALUES (p_user_id, p_pillar_id, p_amount, p_amount)
  ON CONFLICT (user_id, pillar_id) DO UPDATE
    SET xp_total   = user_pillars.xp_total + p_amount,
        xp_current = user_pillars.xp_current + p_amount,
        updated_at = NOW()
  RETURNING xp_total, level INTO v_xp_total, v_level;

  INSERT INTO public.xp_transactions
    (user_id, pillar_id, campaign_id, amount, source, description, metadata)
  VALUES
    (p_user_id, p_pillar_id, p_campaign_id, p_amount, p_source,
     p_description, COALESCE(p_metadata, '{}'));

  -- leveled_up is always FALSE here; level-up logic lives in TypeScript
  RETURN QUERY SELECT v_xp_total, v_level, FALSE::BOOLEAN;
END;
$$;

-- ── tick_streak ───────────────────────────────────────────────────────────
-- Increments or resets the streak for a campaign on a given date.
-- Same-day calls are idempotent.
CREATE OR REPLACE FUNCTION public.tick_streak(
  p_user_id     UUID,
  p_campaign_id UUID,
  p_log_date    DATE
)
RETURNS TABLE (streak INT, is_new_record BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_date      DATE;
  v_current_streak INT;
  v_longest_streak INT;
  v_new_record     BOOLEAN := FALSE;
BEGIN
  SELECT last_logged_date, current_streak, longest_streak
  INTO   v_last_date, v_current_streak, v_longest_streak
  FROM   public.streaks
  WHERE  user_id = p_user_id AND campaign_id = p_campaign_id;

  -- First log for this campaign
  IF NOT FOUND THEN
    INSERT INTO public.streaks
      (user_id, campaign_id, current_streak, longest_streak, last_logged_date)
    VALUES (p_user_id, p_campaign_id, 1, 1, p_log_date);
    RETURN QUERY SELECT 1, TRUE;
    RETURN;
  END IF;

  -- Idempotent: same-day call returns current state unchanged
  IF v_last_date = p_log_date THEN
    RETURN QUERY SELECT v_current_streak, FALSE;
    RETURN;
  END IF;

  IF v_last_date = p_log_date - INTERVAL '1 day' THEN
    v_current_streak := v_current_streak + 1;
  ELSE
    v_current_streak := 1;
  END IF;

  IF v_current_streak > v_longest_streak THEN
    v_longest_streak := v_current_streak;
    v_new_record := TRUE;
  END IF;

  UPDATE public.streaks
  SET    current_streak   = v_current_streak,
         longest_streak   = v_longest_streak,
         last_logged_date = p_log_date,
         updated_at       = NOW()
  WHERE  user_id = p_user_id AND campaign_id = p_campaign_id;

  RETURN QUERY SELECT v_current_streak, v_new_record;
END;
$$;

-- ── get_active_campaign_dashboard ─────────────────────────────────────────
-- Single RPC joining campaign + tracks + streak + pillar levels.
-- Returns NULL if the user has no active campaign.
CREATE OR REPLACE FUNCTION public.get_active_campaign_dashboard(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'campaign', row_to_json(c),
    'tracks', (
      SELECT json_agg(row_to_json(t) ORDER BY t.sort_order)
      FROM   public.tracks t
      WHERE  t.campaign_id = c.id
    ),
    'streak', row_to_json(s),
    'pillar_levels', (
      SELECT json_agg(json_build_object(
        'pillar_id',  up.pillar_id,
        'slug',       p.slug,
        'level',      up.level,
        'xp_total',   up.xp_total,
        'xp_current', up.xp_current
      ) ORDER BY p.sort_order)
      FROM   public.user_pillars up
      JOIN   public.pillars p ON p.id = up.pillar_id
      WHERE  up.user_id   = p_user_id
        AND  up.pillar_id = ANY(c.pillar_ids)
    )
  )
  INTO v_result
  FROM  public.campaigns c
  LEFT  JOIN public.streaks s
        ON s.campaign_id = c.id AND s.user_id = c.user_id
  WHERE c.user_id = p_user_id
    AND c.status  = 'active'
  LIMIT 1;

  RETURN v_result;
END;
$$;
