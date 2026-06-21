import { describe, it, expect } from "vitest";
import { validateWeightsSum, compileCampaign } from "./compiler";
import type { WizardState } from "./compiler";

const VALID_STATE: WizardState = {
  templateId: "get-ripped-maintain",
  calibrations: {
    leanness: { floorValue: 25, currentValue: 20, targetValue: 15 },
    look: { floorValue: 1, currentValue: 5, targetValue: 8 },
    strength: { floorValue: 0, currentValue: 300, targetValue: 600 },
  },
  weights: { leanness: 0.45, look: 0.25, strength: 0.3 },
  deadline: null,
};

// ─── validateWeightsSum ───────────────────────────────────────────────────────

describe("validateWeightsSum", () => {
  it("accepts weights that sum exactly to 1.0", () => {
    expect(validateWeightsSum([0.45, 0.25, 0.3])).toBe(true);
  });

  it("accepts equal thirds (floating-point near 1)", () => {
    const third = 1 / 3;
    expect(validateWeightsSum([third, third, third])).toBe(true);
  });

  it("accepts weights within ±0.001 tolerance", () => {
    expect(validateWeightsSum([0.4505, 0.25, 0.3])).toBe(true);
    expect(validateWeightsSum([0.449, 0.25, 0.3])).toBe(true);
  });

  it("rejects weights clearly under 1", () => {
    expect(validateWeightsSum([0.3, 0.2, 0.2])).toBe(false);
  });

  it("rejects weights clearly over 1", () => {
    expect(validateWeightsSum([0.5, 0.4, 0.3])).toBe(false);
  });

  it("accepts a single weight of exactly 1.0", () => {
    expect(validateWeightsSum([1.0])).toBe(true);
  });

  it("rejects an empty array (sum = 0)", () => {
    expect(validateWeightsSum([])).toBe(false);
  });
});

// ─── compileCampaign ─────────────────────────────────────────────────────────

describe("compileCampaign — success path", () => {
  it("returns ok=true for a fully valid state", () => {
    const result = compileCampaign(VALID_STATE);
    expect(result.ok).toBe(true);
  });

  it("produces a draft with all 3 tracks", () => {
    const result = compileCampaign(VALID_STATE);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.draft.tracks).toHaveLength(3);
  });

  it("carries the correct title from the template", () => {
    const result = compileCampaign(VALID_STATE);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.draft.title).toBe("Get Ripped & Maintain");
  });

  it("target score is 100 when all tracks calibrated correctly", () => {
    const result = compileCampaign(VALID_STATE);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.draft.targetScore).toBeCloseTo(100);
  });

  it("current composite score reflects calibration currentValues", () => {
    // All tracks at their floor → composite = 0
    const atFloor: WizardState = {
      ...VALID_STATE,
      calibrations: {
        leanness: { floorValue: 25, currentValue: 25, targetValue: 15 },
        look: { floorValue: 1, currentValue: 1, targetValue: 8 },
        strength: { floorValue: 0, currentValue: 0, targetValue: 600 },
      },
    };
    const result = compileCampaign(atFloor);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.draft.currentCompositeScore).toBeCloseTo(0);
  });

  it("tracks carry the custom weights from wizard state", () => {
    const state: WizardState = {
      ...VALID_STATE,
      weights: { leanness: 0.6, look: 0.2, strength: 0.2 },
    };
    const result = compileCampaign(state);
    if (!result.ok) throw new Error("Expected ok");
    const leanness = result.draft.tracks.find((t) => t.slug === "leanness");
    expect(leanness?.weight).toBeCloseTo(0.6);
  });

  it("sort order is preserved from template order", () => {
    const result = compileCampaign(VALID_STATE);
    if (!result.ok) throw new Error("Expected ok");
    const orders = result.draft.tracks.map((t) => t.sortOrder);
    expect(orders).toEqual([0, 1, 2]);
  });

  it("passes through a non-null deadline", () => {
    const result = compileCampaign({ ...VALID_STATE, deadline: "2026-12-31" });
    if (!result.ok) throw new Error("Expected ok");
    expect(result.draft.deadline).toBe("2026-12-31");
  });

  it("passes through a null deadline", () => {
    const result = compileCampaign({ ...VALID_STATE, deadline: null });
    if (!result.ok) throw new Error("Expected ok");
    expect(result.draft.deadline).toBeNull();
  });
});

describe("compileCampaign — error paths", () => {
  it("returns unknown_template for unrecognized templateId", () => {
    const result = compileCampaign({ ...VALID_STATE, templateId: "nonexistent" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("unknown_template");
  });

  it("returns invalid_weights when weights sum to > 1 + tolerance", () => {
    const result = compileCampaign({
      ...VALID_STATE,
      weights: { leanness: 0.5, look: 0.5, strength: 0.5 },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("invalid_weights");
  });

  it("returns invalid_weights when weights sum to < 1 - tolerance", () => {
    const result = compileCampaign({
      ...VALID_STATE,
      weights: { leanness: 0.1, look: 0.1, strength: 0.1 },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("invalid_weights");
  });

  it("returns missing_calibration when a track calibration is absent", () => {
    const result = compileCampaign({
      ...VALID_STATE,
      calibrations: {
        leanness: { floorValue: 25, currentValue: 20, targetValue: 15 },
        look: { floorValue: 1, currentValue: 5, targetValue: 8 },
        // @ts-expect-error — intentionally testing absent calibration
        strength: undefined,
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("missing_calibration");
  });
});
