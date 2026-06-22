import { randomBytes, createHash } from "crypto";

const WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
const WHOOP_SCOPES = "offline read:recovery read:cycles read:sleep read:profile";

export function generateCodeVerifier(): string {
  // 64 random bytes → 86-char base64url string, well within 43–128 spec range
  return randomBytes(64).toString("base64url");
}

export function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function buildAuthUrl(codeChallenge: string, state: string): string {
  const clientId = process.env.WHOOP_CLIENT_ID;
  const redirectUri = process.env.WHOOP_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    throw new Error("WHOOP_CLIENT_ID and WHOOP_REDIRECT_URI must be set");
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: WHOOP_SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
  });
  return `${WHOOP_AUTH_URL}?${params.toString()}`;
}

export interface WhoopTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

async function fetchTokens(body: URLSearchParams): Promise<WhoopTokens> {
  const clientId = process.env.WHOOP_CLIENT_ID;
  const clientSecret = process.env.WHOOP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET must be set");
  }
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);

  const res = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    // Deliberately avoid logging the response body to keep token secrets out of logs
    throw new Error(`Whoop token request failed with status ${res.status}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

export function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<WhoopTokens> {
  const redirectUri = process.env.WHOOP_REDIRECT_URI;
  if (!redirectUri) throw new Error("WHOOP_REDIRECT_URI must be set");
  return fetchTokens(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    })
  );
}

export function refreshAccessToken(refreshToken: string): Promise<WhoopTokens> {
  return fetchTokens(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
  );
}
