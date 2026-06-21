import { clamp } from "@/lib/utils";

export interface TrackSnapshot {
  slug: string;
  weight: number;
  floorValue: number | null;
  targetValue: number | null;
  currentValue: number | null;
  higherIsBetter: boolean;
}

export interface CompositeResult {
  score: number;
  floorBreaches: string[];
  trackScores: Record<string, number>;
  isFloorViolated: boolean;
}

// Floor breach hard-caps the composite below 80, preventing level-up.
// This is the "wreck yourself for the number" prevention — you cannot
// level up while any tracked metric is below its floor value.
const FLOOR_BREACH_CAP = 79;

export function calculateComposite(tracks: TrackSnapshot[]): CompositeResult {
  const floorBreaches: string[] = [];
  const trackScores: Record<string, number> = {};
  let weightedSum = 0;

  for (const track of tracks) {
    const { slug, weight, floorValue, targetValue, currentValue, higherIsBetter } =
      track;

    if (currentValue === null || targetValue === null || floorValue === null) {
      trackScores[slug] = 0;
      continue;
    }

    let rawScore: number;

    if (higherIsBetter) {
      const range = targetValue - floorValue;
      rawScore = range <= 0
        ? currentValue >= targetValue ? 100 : 0
        : ((currentValue - floorValue) / range) * 100;
      if (currentValue < floorValue) floorBreaches.push(slug);
    } else {
      // lower is better (e.g., body fat %)
      // floor = upper bound (worst tolerable), target = lower bound (goal)
      const range = floorValue - targetValue;
      rawScore = range <= 0
        ? currentValue <= targetValue ? 100 : 0
        : ((floorValue - currentValue) / range) * 100;
      if (currentValue > floorValue) floorBreaches.push(slug);
    }

    const normalized = clamp(rawScore, 0, 100);
    trackScores[slug] = normalized;
    weightedSum += normalized * weight;
  }

  const rawComposite = clamp(weightedSum, 0, 100);
  const isFloorViolated = floorBreaches.length > 0;
  const score = isFloorViolated
    ? Math.min(rawComposite, FLOOR_BREACH_CAP)
    : rawComposite;

  return { score, floorBreaches, trackScores, isFloorViolated };
}
