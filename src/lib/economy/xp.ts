export type ActionKey =
  | "workout_completed"
  | "calories_logged"
  | "meditation"
  | "journaling"
  | "sleep_target_hit"
  | "daily_planning"
  | "measurement_logged"
  | "photo_logged";

export interface XpAction {
  base: number;
  pillarSlug: string;
}

export const XP_TABLE: Record<ActionKey, XpAction> = {
  workout_completed: { base: 50, pillarSlug: "body" },
  calories_logged:   { base: 20, pillarSlug: "body" },
  meditation:        { base: 40, pillarSlug: "mind" },
  journaling:        { base: 30, pillarSlug: "spirit" },
  sleep_target_hit:  { base: 25, pillarSlug: "body" },
  daily_planning:    { base: 35, pillarSlug: "structure" },
  measurement_logged:{ base: 15, pillarSlug: "body" },
  photo_logged:      { base: 10, pillarSlug: "body" },
};

export function getRecoveryMultiplier(score: number | null): 1.0 | 0.8 | 0.6 {
  if (score === null) return 1.0;
  if (score >= 67) return 1.0;
  if (score >= 34) return 0.8;
  return 0.6;
}

const MAX_STREAK_BONUS = 50;
const STREAK_MILESTONE = 7;
const BONUS_PER_MILESTONE = 5;

export interface XpAwardResult {
  base: number;
  multiplier: number;
  streakBonus: number;
  total: number;
  pillarSlug: string;
}

export function calculateXpAward(
  actionKey: ActionKey,
  recoveryScore: number | null,
  currentStreak: number
): XpAwardResult {
  const action = XP_TABLE[actionKey];
  const multiplier = getRecoveryMultiplier(recoveryScore);
  const base = Math.round(action.base * multiplier);
  const milestones = Math.floor(currentStreak / STREAK_MILESTONE);
  const streakBonus = Math.min(milestones * BONUS_PER_MILESTONE, MAX_STREAK_BONUS);

  return {
    base: action.base,
    multiplier,
    streakBonus,
    total: base + streakBonus,
    pillarSlug: action.pillarSlug,
  };
}
