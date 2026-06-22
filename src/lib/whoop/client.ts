const WHOOP_API = "https://api.prod.whoop.com/developer/v1";

async function whoopFetch<T>(
  accessToken: string,
  path: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${WHOOP_API}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Whoop API ${path} returned ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Type stubs for Whoop API responses (v1) ────────────────────────────────

interface WhoopRecoveryRecord {
  created_at: string;
  score_state: string;
  score: {
    recovery_score: number;
    hrv_rmssd_milli: number;
    resting_heart_rate: number;
  } | null;
}

interface WhoopSleepRecord {
  nap: boolean;
  start: string;
  end: string;
  score_state: string;
  score: {
    sleep_performance_percentage: number;
  } | null;
}

interface WhoopCycleRecord {
  start: string;
  score_state: string;
  score: {
    strain: number;
  } | null;
}

interface WhoopCollection<T> {
  records: T[];
  next_token?: string;
}

export interface WhoopUserProfile {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
}

export interface WhoopDaySnapshot {
  date: string; // YYYY-MM-DD
  recoveryScore: number | null;
  hrvRmssd: number | null;
  restingHr: number | null;
  sleepScore: number | null;
  sleepDurationMs: number | null;
  strainScore: number | null;
}

export async function fetchUserProfile(
  accessToken: string
): Promise<WhoopUserProfile> {
  return whoopFetch<WhoopUserProfile>(accessToken, "/user/profile/basic");
}

export async function fetchRecentSnapshots(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<WhoopDaySnapshot[]> {
  const params = {
    start: `${startDate}T00:00:00.000Z`,
    end: `${endDate}T23:59:59.999Z`,
    limit: "7",
  };

  const [recoveries, sleeps, cycles] = await Promise.all([
    whoopFetch<WhoopCollection<WhoopRecoveryRecord>>(
      accessToken,
      "/recovery",
      params
    ),
    whoopFetch<WhoopCollection<WhoopSleepRecord>>(
      accessToken,
      "/activity/sleep",
      params
    ),
    whoopFetch<WhoopCollection<WhoopCycleRecord>>(
      accessToken,
      "/cycle",
      params
    ),
  ]);

  const byDate = new Map<string, Partial<WhoopDaySnapshot>>();

  const ensureDate = (d: string) => {
    if (!byDate.has(d)) byDate.set(d, { date: d });
    return byDate.get(d)!;
  };

  for (const r of recoveries.records) {
    if (r.score_state !== "SCORED") continue;
    const date = r.created_at.split("T")[0]!;
    const slot = ensureDate(date);
    slot.recoveryScore = r.score?.recovery_score ?? null;
    slot.hrvRmssd = r.score?.hrv_rmssd_milli ?? null;
    slot.restingHr = r.score?.resting_heart_rate ?? null;
  }

  for (const s of sleeps.records) {
    if (s.nap || s.score_state !== "SCORED") continue;
    const date = s.start.split("T")[0]!;
    const slot = ensureDate(date);
    slot.sleepScore = s.score?.sleep_performance_percentage ?? null;
    // Duration = wall-clock time from start to end
    slot.sleepDurationMs =
      new Date(s.end).getTime() - new Date(s.start).getTime();
  }

  for (const c of cycles.records) {
    if (c.score_state !== "SCORED") continue;
    const date = c.start.split("T")[0]!;
    const slot = ensureDate(date);
    slot.strainScore = c.score?.strain ?? null;
  }

  return Array.from(byDate.values()).filter(
    (s): s is WhoopDaySnapshot => !!s.date
  );
}
