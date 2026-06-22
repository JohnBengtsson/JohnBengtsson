import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileClient } from "./_client";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileResult, whoopResult, subResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, avatar_url, timezone")
      .eq("id", user.id)
      .single(),
    supabase
      .from("whoop_connections")
      .select("last_synced_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .limit(1),
  ]);

  const profile = profileResult.data ?? {
    display_name: null,
    avatar_url: null,
    timezone: "UTC",
  };

  return (
    <ProfileClient
      userId={user.id}
      email={user.email ?? ""}
      displayName={profile.display_name}
      avatarUrl={profile.avatar_url}
      timezone={profile.timezone}
      whoopStatus={
        whoopResult.data
          ? { state: "connected", lastSyncedAt: whoopResult.data.last_synced_at }
          : { state: "not_connected" }
      }
      hasPushSubscription={(subResult.data?.length ?? 0) > 0}
    />
  );
}
