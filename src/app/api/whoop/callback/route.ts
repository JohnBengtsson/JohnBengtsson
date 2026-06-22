import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/whoop/oauth";
import { encryptToken } from "@/lib/whoop/encrypt";
import { fetchUserProfile } from "@/lib/whoop/client";

const VERIFIER_COOKIE = "whoop_pkce_verifier";
const STATE_COOKIE = "whoop_oauth_state";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const cookieStore = await cookies();

  const verifier = cookieStore.get(VERIFIER_COOKIE)?.value;
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;

  // Clear PKCE cookies immediately (one-use)
  cookieStore.delete(VERIFIER_COOKIE);
  cookieStore.delete(STATE_COOKIE);

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/profile?whoop_error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code || !verifier || !state || state !== expectedState) {
    return NextResponse.redirect(
      new URL("/profile?whoop_error=invalid_state", request.url)
    );
  }

  const anon = await createClient();
  const {
    data: { user },
  } = await anon.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(code, verifier);

    // Fetch WHOOP user profile to get their user_id
    const profile = await fetchUserProfile(tokens.accessToken);

    // Encrypt both tokens before storing
    const encryptedAccess = encryptToken(tokens.accessToken);
    const encryptedRefresh = encryptToken(tokens.refreshToken);

    const service = await createServiceClient();
    const { error: upsertError } = await service
      .from("whoop_connections")
      .upsert(
        {
          user_id: user.id,
          whoop_user_id: String(profile.user_id),
          access_token: encryptedAccess,
          refresh_token: encryptedRefresh,
          token_expires_at: tokens.expiresAt.toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      return NextResponse.redirect(
        new URL("/profile?whoop_error=db_error", request.url)
      );
    }

    return NextResponse.redirect(
      new URL("/profile?whoop_connected=1", request.url)
    );
  } catch {
    // Intentionally not logging error details — they could contain token fragments
    return NextResponse.redirect(
      new URL("/profile?whoop_error=token_exchange_failed", request.url)
    );
  }
}
