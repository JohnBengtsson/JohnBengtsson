import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { calculateComposite } from "@/lib/economy/composite";
import { calculateXpAward, XP_TABLE } from "@/lib/economy/xp";
import { checkLevelUp } from "@/lib/economy/levels";
import { toISODate } from "@/lib/utils";
import type { ActionKey } from "@/lib/economy/xp";
import type { PillarSlug } from "@/types/database.types";

const LOGGABLE_ACTIONS = [
  "workout_completed",
  "calories_logged",
  "meditation",
  "journaling",
  "sleep_target_hit",
  "daily_planning",
] as const satisfies ActionKey[];

const EveningLogSchema = z.object({
  actions: z.array(z.enum(LOGGABLE_ACTIONS)).max(10),
  measurements: z
    .object({
      leanness: z.number().min(3).max(60).optional(),
      look: z.number().min(1).max(10).optional(),
      strength: z.number().min(0).max(3000).optional(),
    })
    .optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const anon = await createClient();
  const {
    data: { user },
    error: authError,
  } = await anon.auth.getUser();
  if (authError !== null || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = EveningLogSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { actions, measurements, notes } = parsed.data;
  const today = toISODate(new Date());
  const service = await createServiceClient();

  // Get active campaign
  const { data: campaigns } = await service
    .from("campaigns")
    .select("id, composite_score, target_score, phase")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);

  const campaign = campaigns?.[0] ?? null;
  if (!campaign) {
    return NextResponse.json({ error: "No active campaign" }, { status: 400 });
  }

  const [{ data: tracks }, { data: pillars }, { data: whoopData }, { data: streakRow }] =
    await Promise.all([
      service
        .from("tracks")
        .select("id, slug, weight, floor_value, target_value, current_value, higher_is_better")
        .eq("campaign_id", campaign.id),
      service.from("pillars").select("id, slug"),
      service
        .from("whoop_data")
        .select("recovery_score")
        .eq("user_id", user.id)
        .eq("data_date", today)
        .maybeSingle(),
      service
        .from("streaks")
        .select("current_streak")
        .eq("user_id", user.id)
        .eq("campaign_id", campaign.id)
        .maybeSingle(),
    ]);

  if (!tracks || tracks.length === 0) {
    return NextResponse.json({ error: "No tracks found" }, { status: 400 });
  }

  const pillarBySlug = Object.fromEntries((pillars ?? []).map((p) => [p.slug, p.id]));
  const recoveryScore = whoopData?.recovery_score ?? null;
  const currentStreak = streakRow?.current_streak ?? 0;

  // Determine which actions haven't been logged today (idempotency)
  const { data: existingLogs } = await service
    .from("daily_logs")
    .select("action_key")
    .eq("user_id", user.id)
    .eq("campaign_id", campaign.id)
    .eq("log_date", today);

  const alreadyLogged = new Set(existingLogs?.map((l) => l.action_key) ?? []);

  // Build full action list: user actions + auto-added measurement_logged
  const allActions: ActionKey[] = [...actions];
  const hasMeasurements =
    measurements && Object.values(measurements).some((v) => v !== undefined);
  if (hasMeasurements && !alreadyLogged.has("measurement_logged")) {
    allActions.push("measurement_logged");
  }

  const newActions = allActions.filter((a) => !alreadyLogged.has(a));

  // Insert new daily_logs
  if (newActions.length > 0) {
    const logRows = newActions.map((actionKey) => {
      const xpResult = calculateXpAward(actionKey, recoveryScore, currentStreak);
      const pillarSlug = (XP_TABLE[actionKey]?.pillarSlug ?? "body") as PillarSlug;
      return {
        user_id: user.id,
        campaign_id: campaign.id,
        log_date: today,
        log_type: "action" as const,
        pillar_slug: pillarSlug,
        action_key: actionKey,
        xp_awarded: xpResult.total,
        notes: notes ?? null,
      };
    });

    const { error: logError } = await service.from("daily_logs").insert(logRows);
    if (logError) {
      return NextResponse.json({ error: "Failed to log actions" }, { status: 500 });
    }
  }

  // Update track measurements
  let updatedTracks = tracks;
  if (hasMeasurements && measurements) {
    const trackUpdates = Object.entries(measurements)
      .filter(([, v]) => v !== undefined)
      .map(([slug, value]) => {
        const track = tracks.find((t) => t.slug === slug);
        if (!track) return Promise.resolve();
        return service
          .from("tracks")
          .update({ current_value: value as number })
          .eq("id", track.id);
      });

    await Promise.all(trackUpdates);

    const { data: freshTracks } = await service
      .from("tracks")
      .select("id, slug, weight, floor_value, target_value, current_value, higher_is_better")
      .eq("campaign_id", campaign.id);
    if (freshTracks) updatedTracks = freshTracks;
  }

  // Recalculate composite
  const compositeResult = calculateComposite(
    updatedTracks.map((t) => ({
      slug: t.slug,
      weight: t.weight,
      floorValue: t.floor_value,
      targetValue: t.target_value,
      currentValue: t.current_value,
      higherIsBetter: t.higher_is_better,
    }))
  );

  await service
    .from("campaigns")
    .update({ composite_score: compositeResult.score })
    .eq("id", campaign.id);

  // Tick streak
  const { data: streakResult } = await service.rpc("tick_streak", {
    p_user_id: user.id,
    p_campaign_id: campaign.id,
    p_log_date: today,
  });

  const tickedStreak = streakResult?.[0];
  const newStreak = tickedStreak?.streak ?? currentStreak;
  const streakIsRecord = tickedStreak?.is_new_record ?? false;

  // Award XP per pillar (only for newly inserted actions)
  const xpByPillar: Record<string, number> = {};
  for (const actionKey of newActions) {
    const xpResult = calculateXpAward(actionKey, recoveryScore, currentStreak);
    const slug = XP_TABLE[actionKey]?.pillarSlug ?? "body";
    xpByPillar[slug] = (xpByPillar[slug] ?? 0) + xpResult.total;
  }

  let totalXp = 0;
  const xpReturns: Record<number, { newXpTotal: number; currentLevel: number }> = {};

  for (const [pillarSlug, xpAmount] of Object.entries(xpByPillar)) {
    if (xpAmount <= 0) continue;
    const pillarId = pillarBySlug[pillarSlug];
    if (!pillarId) continue;

    const { data: awardData } = await service.rpc("award_xp", {
      p_user_id: user.id,
      p_pillar_id: pillarId,
      p_amount: xpAmount,
      p_source: "daily_log",
      p_campaign_id: campaign.id,
    });

    const awardResult = awardData?.[0];
    if (awardResult) {
      xpReturns[pillarId] = {
        newXpTotal: awardResult.new_xp_total,
        currentLevel: awardResult.new_level,
      };
    }
    totalXp += xpAmount;
  }

  // Anti-gaming level-up check (TypeScript, server-side only)
  let leveledUp = false;
  let finalLevel = 1;

  const bodyPillarId = pillarBySlug["body"];
  if (bodyPillarId) {
    const bodyXp = xpReturns[bodyPillarId];
    if (bodyXp) {
      const { data: lastRecord } = await service
        .from("level_records")
        .select("composite_at_levelup")
        .eq("user_id", user.id)
        .eq("pillar_id", bodyPillarId)
        .order("leveled_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const compositeAtLastLevelUp = lastRecord?.composite_at_levelup ?? 0;
      const levelCheck = checkLevelUp(
        bodyXp.currentLevel,
        bodyXp.newXpTotal,
        compositeResult.score,
        compositeAtLastLevelUp,
        compositeResult.isFloorViolated
      );

      if (levelCheck.canLevelUp) {
        const nextLevel = bodyXp.currentLevel + 1;

        await Promise.all([
          service.from("level_records").insert({
            user_id: user.id,
            pillar_id: bodyPillarId,
            level_reached: nextLevel,
            composite_at_levelup: compositeResult.score,
          }),
          service
            .from("user_pillars")
            .update({ level: nextLevel })
            .eq("user_id", user.id)
            .eq("pillar_id", bodyPillarId),
        ]);

        leveledUp = true;
        finalLevel = nextLevel;
      } else {
        finalLevel = bodyXp.currentLevel;
      }
    }
  }

  return NextResponse.json({
    totalXp,
    newStreak,
    streakIsRecord,
    leveledUp,
    newLevel: finalLevel,
    composite: compositeResult.score,
  });
}
