import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PillarClient } from "./_client";
import type { PillarSlug } from "@/types/database.types";

const VALID_SLUGS: PillarSlug[] = ["body", "mind", "spirit", "structure"];

const PILLAR_LABELS: Record<string, string> = {
  body: "Body",
  mind: "Mind",
  spirit: "Spirit",
  structure: "Structure",
};

export default async function PillarSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!(VALID_SLUGS as string[]).includes(slug)) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch pillar definition
  const { data: pillarDef } = await supabase
    .from("pillars")
    .select("id, slug, label")
    .eq("slug", slug as PillarSlug)
    .single();

  if (!pillarDef) notFound();

  // Parallel: user pillar data + level records + active campaign tracks
  const [userPillarResult, levelRecordsResult, campaignResult] =
    await Promise.all([
      supabase
        .from("user_pillars")
        .select("level, xp_total, xp_current")
        .eq("user_id", user.id)
        .eq("pillar_id", pillarDef.id)
        .maybeSingle(),
      supabase
        .from("level_records")
        .select("level_reached, composite_at_levelup, leveled_at")
        .eq("user_id", user.id)
        .eq("pillar_id", pillarDef.id)
        .order("leveled_at", { ascending: false })
        .limit(20),
      supabase
        .from("campaigns")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

  const activeCampaignId = campaignResult.data?.[0]?.id ?? null;

  // Fetch tracks for this campaign (used for RadarChart on body pillar)
  let trackData: Array<{
    slug: string;
    label: string;
    currentValue: number;
    targetValue: number;
    floorValue: number;
    unit: string;
    higherIsBetter: boolean;
  }> = [];

  if (activeCampaignId && slug === "body") {
    const { data: tracks } = await supabase
      .from("tracks")
      .select(
        "slug, label, current_value, target_value, floor_value, unit, higher_is_better"
      )
      .eq("campaign_id", activeCampaignId);

    trackData = (tracks ?? []).flatMap((t) => {
      if (
        t.current_value === null ||
        t.target_value === null ||
        t.floor_value === null ||
        t.unit === null
      ) {
        return [];
      }
      return [
        {
          slug: t.slug as string,
          label: t.label,
          currentValue: t.current_value,
          targetValue: t.target_value,
          floorValue: t.floor_value,
          unit: t.unit,
          higherIsBetter: t.higher_is_better,
        },
      ];
    });
  }

  const up = userPillarResult.data;
  const levelRecords = (levelRecordsResult.data ?? []).map((r) => ({
    levelReached: r.level_reached,
    compositeAtLevelup: r.composite_at_levelup,
    leveledAt: r.leveled_at,
  }));

  return (
    <PillarClient
      pillarId={pillarDef.id}
      slug={slug}
      label={PILLAR_LABELS[slug] ?? pillarDef.label}
      level={up?.level ?? 1}
      xpTotal={up?.xp_total ?? 0}
      xpCurrent={up?.xp_current ?? 0}
      tracks={trackData}
      levelRecords={levelRecords}
    />
  );
}
