import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toISODate } from "@/lib/utils";
import { EveningClient } from "./_client";

export default async function EveningPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = toISODate(new Date());

  const [{ data: campaigns }, { data: whoopData }] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, title, composite_score, target_score, phase")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("whoop_data")
      .select("recovery_score")
      .eq("user_id", user.id)
      .eq("data_date", today)
      .maybeSingle(),
  ]);

  const campaign = campaigns?.[0] ?? null;

  const [streakData, todayLogs] = await Promise.all([
    campaign
      ? supabase
          .from("streaks")
          .select("current_streak")
          .eq("user_id", user.id)
          .eq("campaign_id", campaign.id)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
    campaign
      ? supabase
          .from("daily_logs")
          .select("action_key")
          .eq("user_id", user.id)
          .eq("campaign_id", campaign.id)
          .eq("log_date", today)
          .then((r) => r.data)
      : Promise.resolve(null),
  ]);

  const alreadyLoggedActions = (todayLogs ?? [])
    .map((l) => l.action_key)
    .filter(Boolean) as string[];

  return (
    <EveningClient
      today={today}
      recoveryScore={whoopData?.recovery_score ?? null}
      currentStreak={streakData?.current_streak ?? 0}
      campaign={
        campaign
          ? {
              id: campaign.id,
              title: campaign.title,
              compositeScore: campaign.composite_score,
              targetScore: campaign.target_score,
              phase: campaign.phase,
            }
          : null
      }
      alreadyLoggedActions={alreadyLoggedActions}
    />
  );
}
