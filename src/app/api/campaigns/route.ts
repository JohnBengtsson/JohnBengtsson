import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { validateWeightsSum } from "@/lib/campaign/compiler";

const TrackSchema = z.object({
  slug: z.enum(["leanness", "look", "strength"]),
  label: z.string().min(1).max(50),
  weight: z.number().min(0).max(1),
  floorValue: z.number(),
  currentValue: z.number(),
  targetValue: z.number(),
  unit: z.string().max(30),
  higherIsBetter: z.boolean(),
  sortOrder: z.number().int().min(0),
});

const CreateCampaignSchema = z.object({
  title: z.string().min(1).max(100),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/),
  targetScore: z.number().min(0).max(100),
  deadline: z.string().nullable().optional(),
  tracks: z.array(TrackSchema).min(1).max(5),
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

  const parsed = CreateCampaignSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { title, slug, targetScore, deadline, tracks } = parsed.data;

  // Server-side weight guard — prevents XP exploits via crafted payloads
  if (!validateWeightsSum(tracks.map((t) => t.weight))) {
    return NextResponse.json(
      { error: "Track weights must sum to 1.0 (±0.001)" },
      { status: 400 }
    );
  }

  const service = await createServiceClient();

  // Look up the body pillar to associate with this campaign
  const { data: bodyPillar } = await service
    .from("pillars")
    .select("id")
    .eq("slug", "body")
    .single();

  const pillarIds = bodyPillar ? [bodyPillar.id] : [];

  const { data: campaign, error: campaignError } = await service
    .from("campaigns")
    .insert({
      user_id: user.id,
      title,
      slug,
      status: "active",
      phase: "build",
      composite_score: 0,
      target_score: targetScore,
      build_deadline: deadline ?? null,
      pillar_ids: pillarIds,
    })
    .select("id")
    .single();

  if (campaignError || !campaign) {
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }

  const { error: tracksError } = await service.from("tracks").insert(
    tracks.map((t) => ({
      campaign_id: campaign.id,
      slug: t.slug,
      label: t.label,
      weight: t.weight,
      floor_value: t.floorValue,
      current_value: t.currentValue,
      target_value: t.targetValue,
      unit: t.unit,
      higher_is_better: t.higherIsBetter,
      sort_order: t.sortOrder,
    }))
  );

  if (tracksError) {
    // Best-effort rollback of orphaned campaign
    await service.from("campaigns").delete().eq("id", campaign.id);
    return NextResponse.json({ error: "Failed to create tracks" }, { status: 500 });
  }

  return NextResponse.json({ campaignId: campaign.id }, { status: 201 });
}
