import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  buildAuthUrl,
} from "@/lib/whoop/oauth";

const VERIFIER_COOKIE = "whoop_pkce_verifier";
const STATE_COOKIE = "whoop_oauth_state";
const COOKIE_MAX_AGE = 600; // 10 minutes

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const verifier = generateCodeVerifier();
  const challenge = generateCodeChallenge(verifier);
  const state = randomBytes(16).toString("hex");

  const cookieStore = await cookies();
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };

  cookieStore.set(VERIFIER_COOKIE, verifier, cookieOpts);
  cookieStore.set(STATE_COOKIE, state, cookieOpts);

  const authUrl = buildAuthUrl(challenge, state);
  return NextResponse.redirect(authUrl);
}
