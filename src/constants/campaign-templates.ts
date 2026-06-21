import type { TrackSlug } from "@/types/database.types";

export interface TrackTemplate {
  slug: TrackSlug;
  label: string;
  unit: string;
  higherIsBetter: boolean;
  defaultWeight: number;
  defaultFloor: number;
  defaultTarget: number;
  hintText: string;
}

export interface CampaignTemplate {
  id: string;
  title: string;
  description: string;
  pillarSlugs: string[];
  tracks: TrackTemplate[];
}

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: "get-ripped-maintain",
    title: "Get Ripped & Maintain",
    description:
      "Systematically reduce body fat, build look-score, and get stronger — then lock it in for life.",
    pillarSlugs: ["body"],
    tracks: [
      {
        slug: "leanness",
        label: "Leanness",
        unit: "% body fat",
        higherIsBetter: false,
        defaultWeight: 0.45,
        defaultFloor: 25,
        defaultTarget: 15,
        hintText: "Measure weekly with calipers or a DEXA scan",
      },
      {
        slug: "look",
        label: "Look Score",
        unit: "score /10",
        higherIsBetter: true,
        defaultWeight: 0.25,
        defaultFloor: 1,
        defaultTarget: 10,
        hintText: "Rate your physique in natural light, 1–10",
      },
      {
        slug: "strength",
        label: "Total Strength",
        unit: "lbs",
        higherIsBetter: true,
        defaultWeight: 0.3,
        defaultFloor: 0,
        defaultTarget: 600,
        hintText: "Sum of 1-rep max estimates: squat + bench + deadlift",
      },
    ],
  },
];

export function getTemplateById(id: string): CampaignTemplate | undefined {
  return CAMPAIGN_TEMPLATES.find((t) => t.id === id);
}
