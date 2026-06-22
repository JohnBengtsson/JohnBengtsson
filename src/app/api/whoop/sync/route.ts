import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/whoop/encrypt";
import { refreshAccessToken } from "@/lib/whoop/oauth";
import { encryptToken } from "@/lib/whoop/encrypt";
import { fetchRecentSnapshots } from "@/lib/whoop/client";
import { toISODate } from "@/lib/utils";

const SYNC_DAYS = 7;

export async function POST(): Promise<NextResponse> {
  const anon = await createClient();
  const {
    data: { user },
    error: authError,
  } = await anon.auth.getUser();
  if (authError !== null || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = await createServiceClient();

  const { data: connection } = await service
    .from("whoop_connections")
    .select(
      "id, access_token, refresh_token, token_expires_at"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (!connection) {
    return NextResponse.json({ error: "No Whoop connection found" }, { status: 404 });
  }

  let accessToken: string;
  try {
    // Refresh token if expired or expiring within 5 minutes
    const expiresAt = new Date(connection.token_expires_at);
    const fiveMinutes = 5 * 60 * 1000;
    if (Date.now() + fiveMinutes >= expiresAt.getTime()) {
      const refreshToken = decryptToken(connection.refresh_token);
      const newTokens = await refreshAccessToken(refreshToken);

      const encryptedAccess = encryptToken(newTokens.accessToken);
      const encryptedRefresh = encryptToken(newTokens.refreshToken);

      await service
        .from("whoop_connections")
        .update({
          access_token: encryptedAccess,
          refresh_token: encryptedRefresh,
          token_expires_at: newTokens.expiresAt.toISOString(),
        })
        .eq("id", connection.id);

      accessToken = newTokens.accessToken;
    } else {
      accessToken = decryptToken(connection.access_token);
    }
  } catch {
    return NextResponse.json(
      { error: "Token decryption or refresh failed" },
      { status: 502 }
    );
  }

  const endDate = toISODate(new Date());
  const startDate = toISODate(
    new Date(Date.now() - (SYNC_DAYS - 1) * 24 * 60 * 60 * 1000)
  );

  let snapshots;
  try {
    snapshots = await fetchRecentSnapshots(accessToken, startDate, endDate);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch Whoop data" },
      { status: 502 }
    );
  }

  if (snapshots.length > 0) {
    const rows = snapshots.map((s) => ({
      user_id: user.id,
      data_date: s.date,
      recovery_score: s.recoveryScore,
      hrv_rmssd: s.hrvRmssd,
      resting_hr: s.restingHr,
      sleep_score: s.sleepScore,
      sleep_duration_ms: s.sleepDurationMs,
      strain_score: s.strainScore,
      raw_payload: null,
    }));

    const { error: upsertError } = await service
      .from("whoop_data")
      .upsert(rows, { onConflict: "user_id,data_date" });

    if (upsertError) {
      return NextResponse.json(
        { error: "Failed to save Whoop data" },
        { status: 500 }
      );
    }
  }

  // Update last synced timestamp
  await service
    .from("whoop_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", connection.id);

  return NextResponse.json({
    synced: snapshots.length,
    startDate,
    endDate,
  });
}
