import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toISODate } from "@/lib/utils";
import { MorningClient } from "./_client";

export default async function MorningPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = toISODate(new Date());

  const [{ data: whoopData }, { data: campaigns }] = await Promise.all([
    supabase
      .from("whoop_data")
      .select("recovery_score, sleep_score")
      .eq("user_id", user.id)
      .eq("data_date", today)
      .maybeSingle(),
    supabase
      .from("campaigns")
      .select("id, title, composite_score, target_score, phase")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const campaign = campaigns?.[0] ?? null;

  let streakData = null;
  if (campaign) {
    const { data } = await supabase
      .from("streaks")
      .select("current_streak, longest_streak")
      .eq("user_id", user.id)
      .eq("campaign_id", campaign.id)
      .maybeSingle();
    streakData = data;
  }

  return (
    <MorningClient
      today={today}
      displayName={user.email?.split("@")[0] ?? "there"}
      whoopScore={whoopData?.recovery_score ?? null}
      whoopSleepScore={whoopData?.sleep_score ?? null}
      campaign={
        campaign
          ? {
              title: campaign.title,
              compositeScore: campaign.composite_score,
              targetScore: campaign.target_score,
              phase: campaign.phase,
            }
          : null
      }
      streak={
        streakData
          ? {
              current: streakData.current_streak,
              longest: streakData.longest_streak,
            }
          : null
      }
    />
  );
}
