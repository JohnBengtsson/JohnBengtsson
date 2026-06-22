import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendPush } from "@/lib/notifications/push";

// Validates Vercel's cron secret to prevent unauthorized calls
function isCronAuthorized(request: NextRequest): boolean {
  const secret = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  // Constant-time comparison to prevent timing attacks
  if (!secret || secret.length !== expected.length) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(expected);
  return a.equals(b);
}

const NOTIFICATIONS = {
  morning: {
    title: "Good morning 🌅",
    body: "Check your recovery score and plan your day.",
    url: "/morning",
    targetHour: 7,
  },
  evening: {
    title: "Time to close the day 🔥",
    body: "Log your actions and collect your XP.",
    url: "/evening",
    targetHour: 20,
  },
} as const;

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = request.nextUrl.searchParams.get("type");
  if (type !== "morning" && type !== "evening") {
    return NextResponse.json(
      { error: "type must be morning or evening" },
      { status: 400 }
    );
  }

  const notification = NOTIFICATIONS[type];
  const nowUtcHour = new Date().getUTCHours();

  const service = await createServiceClient();

  // Get all push subscriptions
  const { data: subscriptions } = await service
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth_key, user_id")
    .limit(500);

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  // Get timezones for all users with subscriptions
  const userIds = [...new Set(subscriptions.map((s) => s.user_id))];
  const { data: profiles } = await service
    .from("profiles")
    .select("id, timezone")
    .in("id", userIds);
  const timezoneByUser = new Map(
    (profiles ?? []).map((p) => [p.id, p.timezone])
  );

  let sent = 0;
  const errors: string[] = [];

  for (const sub of subscriptions) {
    const timezone = timezoneByUser.get(sub.user_id) ?? "UTC";

    // Check if it's the right local hour for this user's timezone
    try {
      const localHour = new Date().toLocaleString("en-US", {
        timeZone: timezone,
        hour: "numeric",
        hour12: false,
      });
      const hour = parseInt(localHour, 10);
      if (hour !== notification.targetHour) continue;
    } catch {
      // Fall back to UTC comparison if timezone is invalid
      if (nowUtcHour !== notification.targetHour) continue;
    }

    try {
      await sendPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth_key: sub.auth_key },
        { title: notification.title, body: notification.body, url: notification.url }
      );
      sent++;
    } catch {
      errors.push(sub.endpoint.slice(0, 50));
    }
  }

  return NextResponse.json({ sent, errors: errors.length });
}
