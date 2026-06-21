const BASE_XP_THRESHOLD = 500;
const LEVEL_SCALE_FACTOR = 1.2;
const MIN_COMPOSITE_DELTA = 5;

// XP needed to advance from level N to level N+1
export function getXpThresholdForLevel(level: number): number {
  return Math.round(BASE_XP_THRESHOLD * Math.pow(LEVEL_SCALE_FACTOR, level - 1));
}

// Cumulative XP required to reach a given level
export function getTotalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += getXpThresholdForLevel(i);
  }
  return total;
}

export interface LevelUpCheck {
  canLevelUp: boolean;
  blockedBy: Array<"xp" | "composite_delta" | "floor_violation">;
  xpNeeded: number;
  compositeDelta: number;
}

// TWO-KEY LOCK: both XP threshold AND composite improvement must be met,
// AND no floor violation may be active. This prevents busywork farming.
// Anti-gaming: this function runs SERVER-SIDE ONLY in POST /api/evening-log.
export function checkLevelUp(
  currentLevel: number,
  xpTotal: number,
  compositeNow: number,
  compositeAtLastLevelUp: number,
  isFloorViolated: boolean
): LevelUpCheck {
  const xpNeeded = getTotalXpForLevel(currentLevel + 1);
  const compositeDelta = compositeNow - compositeAtLastLevelUp;
  const blockedBy: Array<"xp" | "composite_delta" | "floor_violation"> = [];

  if (xpTotal < xpNeeded) blockedBy.push("xp");
  if (compositeDelta < MIN_COMPOSITE_DELTA) blockedBy.push("composite_delta");
  if (isFloorViolated) blockedBy.push("floor_violation");

  return {
    canLevelUp: blockedBy.length === 0,
    blockedBy,
    xpNeeded,
    compositeDelta,
  };
}
