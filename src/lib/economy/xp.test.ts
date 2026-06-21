import { describe, it, expect } from "vitest";
import { calculateXpAward, getRecoveryMultiplier, XP_TABLE, type ActionKey } from "./xp";

describe("getRecoveryMultiplier", () => {
  it("returns 1.0 for null (no Whoop data)", () => {
    expect(getRecoveryMultiplier(null)).toBe(1.0);
  });

  it("returns 1.0 for green recovery (≥67)", () => {
    expect(getRecoveryMultiplier(67)).toBe(1.0);
    expect(getRecoveryMultiplier(100)).toBe(1.0);
    expect(getRecoveryMultiplier(80)).toBe(1.0);
  });

  it("returns 0.8 for yellow recovery (34–66)", () => {
    expect(getRecoveryMultiplier(34)).toBe(0.8);
    expect(getRecoveryMultiplier(50)).toBe(0.8);
    expect(getRecoveryMultiplier(66)).toBe(0.8);
  });

  it("returns 0.6 for red recovery (<34)", () => {
    expect(getRecoveryMultiplier(0)).toBe(0.6);
    expect(getRecoveryMultiplier(33)).toBe(0.6);
  });

  it("boundary: 67 is green, 66 is yellow", () => {
    expect(getRecoveryMultiplier(67)).toBe(1.0);
    expect(getRecoveryMultiplier(66)).toBe(0.8);
  });

  it("boundary: 34 is yellow, 33 is red", () => {
    expect(getRecoveryMultiplier(34)).toBe(0.8);
    expect(getRecoveryMultiplier(33)).toBe(0.6);
  });
});

describe("calculateXpAward", () => {
  describe("recovery multiplier application", () => {
    it("applies 1.0× for green recovery", () => {
      const result = calculateXpAward("workout_completed", 80, 0);
      expect(result.total).toBe(50);
      expect(result.multiplier).toBe(1.0);
    });

    it("applies 0.8× for yellow recovery", () => {
      const result = calculateXpAward("workout_completed", 50, 0);
      expect(result.total).toBe(40); // 50 * 0.8
      expect(result.multiplier).toBe(0.8);
    });

    it("applies 0.6× for red recovery", () => {
      const result = calculateXpAward("workout_completed", 20, 0);
      expect(result.total).toBe(30); // 50 * 0.6
      expect(result.multiplier).toBe(0.6);
    });
  });

  describe("streak bonus", () => {
    it("no bonus at 0 streak", () => {
      const result = calculateXpAward("workout_completed", null, 0);
      expect(result.streakBonus).toBe(0);
    });

    it("+5 bonus at 7-day streak", () => {
      const result = calculateXpAward("workout_completed", null, 7);
      expect(result.streakBonus).toBe(5);
    });

    it("+10 bonus at 14-day streak", () => {
      const result = calculateXpAward("workout_completed", null, 14);
      expect(result.streakBonus).toBe(10);
    });

    it("caps streak bonus at 50 (10 milestones)", () => {
      const at70 = calculateXpAward("workout_completed", null, 70);
      const atMax = calculateXpAward("workout_completed", null, 1000);
      expect(at70.streakBonus).toBe(50);
      expect(atMax.streakBonus).toBe(50);
    });

    it("bonus is additive on top of multiplied base", () => {
      // Yellow recovery (0.8×), 7-day streak: 40 + 5 = 45
      const result = calculateXpAward("workout_completed", 50, 7);
      expect(result.total).toBe(45);
    });
  });

  describe("pillar assignment", () => {
    it("assigns body pillar to workout_completed", () => {
      expect(calculateXpAward("workout_completed", null, 0).pillarSlug).toBe("body");
    });

    it("assigns mind pillar to meditation", () => {
      expect(calculateXpAward("meditation", null, 0).pillarSlug).toBe("mind");
    });

    it("assigns spirit pillar to journaling", () => {
      expect(calculateXpAward("journaling", null, 0).pillarSlug).toBe("spirit");
    });

    it("assigns structure pillar to daily_planning", () => {
      expect(calculateXpAward("daily_planning", null, 0).pillarSlug).toBe("structure");
    });
  });

  describe("XP_TABLE coverage", () => {
    it("all actions have positive base XP and a pillar slug", () => {
      const actions = Object.entries(XP_TABLE) as Array<[ActionKey, { base: number; pillarSlug: string }]>;
      for (const [, action] of actions) {
        expect(action.base).toBeGreaterThan(0);
        expect(action.pillarSlug).toBeTruthy();
      }
    });

    it("returns the raw base XP (pre-multiplier) in result.base", () => {
      const result = calculateXpAward("workout_completed", 20, 0); // red, 0.6×
      expect(result.base).toBe(50); // raw base, not multiplied
      expect(result.total).toBe(30); // multiplied
    });
  });
});
