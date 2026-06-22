import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { DashboardClient } from "./_client";
import type {
  DashboardCampaign,
  DashboardTrack,
  DashboardPillar,
  DashboardStreak,
} from "./_client";

// Snake-case shapes returned by the RPC's row_to_json
interface RpcCampaign {
  id: string;
  title: string;
  composite_score: number;
  target_score: number;
  phase: "build" | "maintain";
}

interface RpcTrack {
  slug: string;
  label: string;
  weight: number;
  floor_value: number;
  target_value: number;
  current_value: number;
  unit: string;
  higher_is_better: boolean;
  sort_order: number;
}

interface RpcStreak {
  current_streak: number;
  longest_streak: number;
}

interface DashboardRpc {
  campaign: RpcCampaign;
  tracks: RpcTrack[] | null;
  streak: RpcStreak | null;
}

const ACTIVE_PILLAR_SLUGS = ["body", "mind", "spirit", "structure"] as const;

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [rpcResult, userPillarsResult, pillarDefsResult] = await Promise.all([
    supabase.rpc("get_active_campaign_dashboard", { p_user_id: user.id }),
    supabase
      .from("user_pillars")
      .select("pillar_id, level, xp_total, xp_current")
      .eq("user_id", user.id),
    supabase
      .from("pillars")
      .select("id, slug")
      .in("slug", [...ACTIVE_PILLAR_SLUGS])
      .order("sort_order"),
  ]);

  const result = rpcResult.data as DashboardRpc | null;

  if (!result?.campaign) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Your active campaign</p>
        </div>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-muted-foreground text-sm">No active campaign yet.</p>
          <Button asChild>
            <Link href="/campaign/new">Start your first campaign</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { campaign, tracks, streak } = result;

  // Build pillar levels by joining user_pillars with pillar definitions
  const userPillarMap = new Map(
    (userPillarsResult.data ?? []).map((up) => [up.pillar_id, up])
  );
  const pillarLevels: DashboardPillar[] = (pillarDefsResult.data ?? []).flatMap(
    (def) => {
      const up = userPillarMap.get(def.id);
      if (!up) return [];
      return [
        {
          slug: def.slug as string,
          level: up.level,
          xpTotal: up.xp_total,
          xpCurrent: up.xp_current,
        },
      ];
    }
  );

  const mappedCampaign: DashboardCampaign = {
    id: campaign.id,
    title: campaign.title,
    compositeScore: campaign.composite_score,
    targetScore: campaign.target_score,
    phase: campaign.phase,
  };

  const mappedTracks: DashboardTrack[] = (tracks ?? []).map((t) => ({
    slug: t.slug,
    label: t.label,
    weight: t.weight,
    floorValue: t.floor_value,
    targetValue: t.target_value,
    currentValue: t.current_value,
    unit: t.unit,
    higherIsBetter: t.higher_is_better,
    sortOrder: t.sort_order,
  }));

  const mappedStreak: DashboardStreak | null = streak
    ? { currentStreak: streak.current_streak, longestStreak: streak.longest_streak }
    : null;

  return (
    <DashboardClient
      campaign={mappedCampaign}
      tracks={mappedTracks}
      streak={mappedStreak}
      pillarLevels={pillarLevels}
    />
  );
}
