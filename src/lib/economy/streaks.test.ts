import { describe, it, expect } from "vitest";
import { isStreakAlive } from "./streaks";

describe("isStreakAlive", () => {
  it("returns false when lastLoggedDate is null (never logged)", () => {
    expect(isStreakAlive(null, "2026-06-21")).toBe(false);
  });

  it("returns true for same day (idempotent re-check)", () => {
    expect(isStreakAlive("2026-06-21", "2026-06-21")).toBe(true);
  });

  it("returns true for consecutive day (diff = 1)", () => {
    expect(isStreakAlive("2026-06-20", "2026-06-21")).toBe(true);
  });

  it("returns false for a gap of 2 days (streak broken)", () => {
    expect(isStreakAlive("2026-06-19", "2026-06-21")).toBe(false);
  });

  it("returns false for a gap larger than 2 days", () => {
    expect(isStreakAlive("2026-06-01", "2026-06-21")).toBe(false);
  });

  it("works across month boundaries", () => {
    expect(isStreakAlive("2026-05-31", "2026-06-01")).toBe(true);
    expect(isStreakAlive("2026-05-30", "2026-06-01")).toBe(false);
  });

  it("works across year boundaries", () => {
    expect(isStreakAlive("2025-12-31", "2026-01-01")).toBe(true);
    expect(isStreakAlive("2025-12-30", "2026-01-01")).toBe(false);
  });
});
