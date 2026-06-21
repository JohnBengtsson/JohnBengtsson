import { describe, it, expect } from "vitest";
import { checkLevelUp, getXpThresholdForLevel, getTotalXpForLevel } from "./levels";

describe("getXpThresholdForLevel", () => {
  it("returns 500 for level 1 → 2", () => {
    expect(getXpThresholdForLevel(1)).toBe(500);
  });

  it("each subsequent level requires ~20% more XP", () => {
    const l1 = getXpThresholdForLevel(1);
    const l2 = getXpThresholdForLevel(2);
    const l3 = getXpThresholdForLevel(3);
    expect(l2 / l1).toBeCloseTo(1.2, 1);
    expect(l3 / l2).toBeCloseTo(1.2, 1);
  });

  it("thresholds are always positive", () => {
    for (let lvl = 1; lvl <= 20; lvl++) {
      expect(getXpThresholdForLevel(lvl)).toBeGreaterThan(0);
    }
  });
});

describe("getTotalXpForLevel", () => {
  it("returns 0 for level 1 (no XP needed to start)", () => {
    expect(getTotalXpForLevel(1)).toBe(0);
  });

  it("returns 500 for level 2", () => {
    expect(getTotalXpForLevel(2)).toBe(500);
  });

  it("returns 500+600 for level 3", () => {
    expect(getTotalXpForLevel(3)).toBe(500 + 600);
  });

  it("cumulative totals are strictly increasing", () => {
    let prev = 0;
    for (let lvl = 2; lvl <= 10; lvl++) {
      const total = getTotalXpForLevel(lvl);
      expect(total).toBeGreaterThan(prev);
      prev = total;
    }
  });
});

describe("checkLevelUp — can level up", () => {
  it("returns canLevelUp=true when all gates pass", () => {
    // Level 1→2: need 500 XP, have 600; composite delta = 60-50 = 10 ≥ 5; no floor violation
    const result = checkLevelUp(1, 600, 60, 50, false);
    expect(result.canLevelUp).toBe(true);
    expect(result.blockedBy).toHaveLength(0);
  });

  it("passes with composite delta exactly at minimum (5 points)", () => {
    const result = checkLevelUp(1, 600, 55, 50, false);
    expect(result.canLevelUp).toBe(true);
  });
});

describe("checkLevelUp — XP gate", () => {
  it("blocks when XP total is below threshold", () => {
    const result = checkLevelUp(1, 400, 60, 50, false);
    expect(result.canLevelUp).toBe(false);
    expect(result.blockedBy).toContain("xp");
  });

  it("exposes the xpNeeded amount in the result", () => {
    const result = checkLevelUp(1, 400, 60, 50, false);
    expect(result.xpNeeded).toBe(500);
  });
});

describe("checkLevelUp — composite delta gate (anti-gaming)", () => {
  it("blocks when composite delta is 0 (XP farming, no real progress)", () => {
    const result = checkLevelUp(1, 600, 50, 50, false);
    expect(result.canLevelUp).toBe(false);
    expect(result.blockedBy).toContain("composite_delta");
  });

  it("blocks when composite delta is below minimum (4 points)", () => {
    const result = checkLevelUp(1, 600, 54, 50, false);
    expect(result.canLevelUp).toBe(false);
    expect(result.blockedBy).toContain("composite_delta");
  });

  it("exposes the compositeDelta in the result", () => {
    const result = checkLevelUp(1, 600, 53, 50, false);
    expect(result.compositeDelta).toBeCloseTo(3);
  });
});

describe("checkLevelUp — floor violation gate", () => {
  it("blocks when any track is below its floor", () => {
    const result = checkLevelUp(1, 600, 60, 50, true);
    expect(result.canLevelUp).toBe(false);
    expect(result.blockedBy).toContain("floor_violation");
  });

  it("blocks with floor violation even when XP and composite gates pass", () => {
    const result = checkLevelUp(1, 600, 60, 50, true);
    expect(result.blockedBy).toContain("floor_violation");
    expect(result.canLevelUp).toBe(false);
  });
});

describe("checkLevelUp — multiple gates blocked", () => {
  it("reports all three blockers when all gates fail", () => {
    const result = checkLevelUp(1, 100, 50, 50, true);
    expect(result.canLevelUp).toBe(false);
    expect(result.blockedBy).toHaveLength(3);
    expect(result.blockedBy).toContain("xp");
    expect(result.blockedBy).toContain("composite_delta");
    expect(result.blockedBy).toContain("floor_violation");
  });

  it("reports two blockers (XP + composite) when floor is clean", () => {
    const result = checkLevelUp(1, 100, 50, 50, false);
    expect(result.blockedBy).toHaveLength(2);
  });
});
