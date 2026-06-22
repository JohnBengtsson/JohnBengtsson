import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
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

  const parsed = SubscribeSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { endpoint, p256dh, auth } = parsed.data;
  const service = await createServiceClient();

  const { error: upsertError } = await service
    .from("push_subscriptions")
    .upsert(
      { user_id: user.id, endpoint, p256dh, auth_key: auth },
      { onConflict: "user_id,endpoint" }
    );

  if (upsertError) {
    return NextResponse.json(
      { error: "Failed to save subscription" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
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

  const parsed = z.object({ endpoint: z.string().url() }).safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  }

  const service = await createServiceClient();
  await service
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", parsed.data.endpoint);

  return NextResponse.json({ ok: true });
}
