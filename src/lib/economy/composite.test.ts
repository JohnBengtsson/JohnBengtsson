import { describe, it, expect } from "vitest";
import { calculateComposite, type TrackSnapshot } from "./composite";

function makeTrack(overrides: Partial<TrackSnapshot> = {}): TrackSnapshot {
  return {
    slug: "strength",
    weight: 1.0,
    floorValue: 0,
    targetValue: 100,
    currentValue: 50,
    higherIsBetter: true,
    ...overrides,
  };
}

describe("calculateComposite — higher_is_better", () => {
  it("scores 50 when halfway between floor and target", () => {
    const result = calculateComposite([makeTrack({ currentValue: 50 })]);
    expect(result.score).toBeCloseTo(50);
    expect(result.isFloorViolated).toBe(false);
    expect(result.floorBreaches).toHaveLength(0);
  });

  it("scores 100 at target", () => {
    const result = calculateComposite([makeTrack({ currentValue: 100 })]);
    expect(result.score).toBeCloseTo(100);
  });

  it("scores 0 at floor", () => {
    const result = calculateComposite([makeTrack({ currentValue: 0 })]);
    expect(result.score).toBeCloseTo(0);
  });

  it("clamps to 100 when above target", () => {
    const result = calculateComposite([makeTrack({ currentValue: 150 })]);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("floor breach caps composite at 79", () => {
    const result = calculateComposite([
      makeTrack({ currentValue: -10, floorValue: 0, targetValue: 100 }),
    ]);
    expect(result.score).toBeLessThanOrEqual(79);
    expect(result.isFloorViolated).toBe(true);
    expect(result.floorBreaches).toContain("strength");
  });

  it("floor breach cap of 79 applies even when raw composite would be higher", () => {
    // All three tracks at perfect score but one breaches floor
    const tracks: TrackSnapshot[] = [
      makeTrack({ slug: "strength", weight: 0.5, currentValue: 100 }),
      makeTrack({ slug: "look", weight: 0.5, currentValue: -5, floorValue: 0 }),
    ];
    const result = calculateComposite(tracks);
    expect(result.score).toBeLessThanOrEqual(79);
    expect(result.isFloorViolated).toBe(true);
  });
});

describe("calculateComposite — lower_is_better (leanness)", () => {
  function leannessTrack(current: number): TrackSnapshot {
    return {
      slug: "leanness",
      weight: 1.0,
      floorValue: 25,
      targetValue: 15,
      currentValue: current,
      higherIsBetter: false,
    };
  }

  it("scores 100 at target (15%)", () => {
    const result = calculateComposite([leannessTrack(15)]);
    expect(result.score).toBeCloseTo(100);
  });

  it("scores 0 at floor (25%)", () => {
    const result = calculateComposite([leannessTrack(25)]);
    expect(result.score).toBeCloseTo(0);
  });

  it("scores ~50 halfway (20%)", () => {
    const result = calculateComposite([leannessTrack(20)]);
    expect(result.score).toBeCloseTo(50);
  });

  it("detects floor breach when current > floor", () => {
    const result = calculateComposite([leannessTrack(30)]);
    expect(result.isFloorViolated).toBe(true);
    expect(result.floorBreaches).toContain("leanness");
    expect(result.score).toBeLessThanOrEqual(79);
  });
});

describe("calculateComposite — weighted blend", () => {
  it("weights 50/50 blends correctly", () => {
    const tracks: TrackSnapshot[] = [
      makeTrack({ slug: "a", weight: 0.5, currentValue: 100 }),
      makeTrack({ slug: "b", weight: 0.5, currentValue: 0 }),
    ];
    const result = calculateComposite(tracks);
    expect(result.score).toBeCloseTo(50);
  });

  it("stores individual track scores in trackScores map", () => {
    const tracks: TrackSnapshot[] = [
      makeTrack({ slug: "strength", weight: 0.3, currentValue: 30 }),
      makeTrack({ slug: "look", weight: 0.7, currentValue: 70 }),
    ];
    const result = calculateComposite(tracks);
    expect(result.trackScores["strength"]).toBeCloseTo(30);
    expect(result.trackScores["look"]).toBeCloseTo(70);
  });
});

describe("calculateComposite — edge cases", () => {
  it("handles null currentValue (treats as 0 score)", () => {
    const result = calculateComposite([makeTrack({ currentValue: null })]);
    expect(result.score).toBe(0);
    expect(result.isFloorViolated).toBe(false);
  });

  it("handles null floorValue gracefully (treats as 0 score)", () => {
    const result = calculateComposite([makeTrack({ floorValue: null })]);
    expect(result.score).toBe(0);
  });

  it("handles empty tracks array (returns 0)", () => {
    const result = calculateComposite([]);
    expect(result.score).toBe(0);
    expect(result.isFloorViolated).toBe(false);
  });

  it("score is never negative", () => {
    const result = calculateComposite([makeTrack({ currentValue: -999 })]);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
