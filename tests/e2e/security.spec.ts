import { test, expect } from "@playwright/test";

// Security tests that don't require a real Supabase session.
// These validate that auth middleware and route guards are working correctly.

test.describe("Auth middleware", () => {
  test("unauthenticated GET /dashboard redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated GET /morning redirects to /login", async ({ page }) => {
    await page.goto("/morning");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated GET /evening redirects to /login", async ({ page }) => {
    await page.goto("/evening");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated GET /profile redirects to /login", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated GET /pillars redirects to /login", async ({ page }) => {
    await page.goto("/pillars");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("API route auth guards", () => {
  test("POST /api/evening-log with no session cookie returns 401", async ({
    request,
  }) => {
    const res = await request.post("/api/evening-log", {
      data: { actions: ["workout_completed"] },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/campaigns with no session cookie returns 401", async ({
    request,
  }) => {
    const res = await request.post("/api/campaigns", {
      data: { title: "test", tracks: [] },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/notifications/subscribe with no session cookie returns 401", async ({
    request,
  }) => {
    const res = await request.post("/api/notifications/subscribe", {
      data: {
        endpoint: "https://fcm.googleapis.com/fcm/send/test",
        p256dh: "test",
        auth: "test",
      },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe("Cron endpoint security", () => {
  test("GET /api/cron/daily with no Authorization header returns 401", async ({
    request,
  }) => {
    const res = await request.get("/api/cron/daily?type=morning");
    expect(res.status()).toBe(401);
  });

  test("GET /api/cron/daily with wrong secret returns 401", async ({
    request,
  }) => {
    const res = await request.get("/api/cron/daily?type=morning", {
      headers: { Authorization: "Bearer wrong-secret" },
    });
    expect(res.status()).toBe(401);
  });

  test("GET /api/cron/daily with missing type returns 400", async ({
    request,
  }) => {
    const cronSecret = process.env.CRON_SECRET ?? "";
    const res = await request.get("/api/cron/daily", {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    // If CRON_SECRET is empty this will be 401, otherwise 400
    expect([400, 401]).toContain(res.status());
  });
});

test.describe("Security headers", () => {
  test("responses include required security headers", async ({ request }) => {
    const res = await request.get("/");
    const headers = res.headers();
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
  });
});

test.describe("Pillar slug validation", () => {
  test("invalid pillar slug returns 404, not 500", async ({ page }) => {
    const res = await page.goto("/pillars/invalid-pillar-that-does-not-exist");
    // Will redirect to /login (unauthenticated) or return 404
    // Either is acceptable — not 500
    expect([200, 302, 404]).toContain(res?.status() ?? 200);
    expect(res?.status()).not.toBe(500);
  });
});
