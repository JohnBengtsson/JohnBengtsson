import { calculateComposite } from "@/lib/economy/composite";
import { getTemplateById } from "@/constants/campaign-templates";
import type { TrackSlug } from "@/types/database.types";

export interface TrackCalibration {
  floorValue: number;
  currentValue: number;
  targetValue: number;
}

export interface WizardState {
  templateId: string;
  calibrations: Record<TrackSlug, TrackCalibration>;
  weights: Record<TrackSlug, number>;
  deadline: string | null;
}

export interface CampaignDraftTrack {
  slug: TrackSlug;
  label: string;
  weight: number;
  floorValue: number;
  currentValue: number;
  targetValue: number;
  unit: string;
  higherIsBetter: boolean;
  sortOrder: number;
}

export interface CampaignDraft {
  title: string;
  templateId: string;
  currentCompositeScore: number;
  targetScore: number;
  deadline: string | null;
  tracks: CampaignDraftTrack[];
}

export type CompileError =
  | "unknown_template"
  | "invalid_weights"
  | "missing_calibration";

export type CompileResult =
  | { ok: true; draft: CampaignDraft }
  | { ok: false; error: CompileError };

const WEIGHT_TOLERANCE = 0.001;

export function validateWeightsSum(weights: number[]): boolean {
  if (weights.length === 0) return false;
  const sum = weights.reduce((acc, w) => acc + w, 0);
  return Math.abs(sum - 1.0) <= WEIGHT_TOLERANCE;
}

export function compileCampaign(state: WizardState): CompileResult {
  const template = getTemplateById(state.templateId);
  if (!template) return { ok: false, error: "unknown_template" };

  const slugs = template.tracks.map((t) => t.slug);
  const weights = slugs.map((s) => {
    const w = state.weights[s];
    return w !== undefined
      ? w
      : (template.tracks.find((t) => t.slug === s)?.defaultWeight ?? 0);
  });

  if (!validateWeightsSum(weights)) {
    return { ok: false, error: "invalid_weights" };
  }

  const tracks: CampaignDraftTrack[] = [];

  for (let i = 0; i < template.tracks.length; i++) {
    const t = template.tracks[i];
    if (!t) continue;
    const calibration = state.calibrations[t.slug];
    if (!calibration) return { ok: false, error: "missing_calibration" };
    const weight = weights[i] ?? t.defaultWeight;

    tracks.push({
      slug: t.slug,
      label: t.label,
      weight,
      floorValue: calibration.floorValue,
      currentValue: calibration.currentValue,
      targetValue: calibration.targetValue,
      unit: t.unit,
      higherIsBetter: t.higherIsBetter,
      sortOrder: i,
    });
  }

  const toSnapshot = (currentOverride?: number) =>
    tracks.map((t) => ({
      slug: t.slug,
      weight: t.weight,
      floorValue: t.floorValue,
      targetValue: t.targetValue,
      currentValue: currentOverride !== undefined ? currentOverride : t.currentValue,
      higherIsBetter: t.higherIsBetter,
    }));

  const { score: currentCompositeScore } = calculateComposite(toSnapshot());

  // Target score = composite when every track is exactly at its target value.
  // Produces 100 for valid calibrations (all tracks at target = full score).
  const { score: targetScore } = calculateComposite(
    tracks.map((t) => ({
      slug: t.slug,
      weight: t.weight,
      floorValue: t.floorValue,
      targetValue: t.targetValue,
      currentValue: t.targetValue,
      higherIsBetter: t.higherIsBetter,
    }))
  );

  return {
    ok: true,
    draft: {
      title: template.title,
      templateId: state.templateId,
      currentCompositeScore,
      targetScore,
      deadline: state.deadline,
      tracks,
    },
  };
}
