"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ChevronLeft, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { calculateComposite } from "@/lib/economy/composite";
import { CAMPAIGN_TEMPLATES } from "@/constants/campaign-templates";
import { compileCampaign } from "@/lib/campaign/compiler";

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3 | 4 | 5;

interface TrackCalibration {
  floorValue: number;
  currentValue: number;
  targetValue: number;
}

interface WizardData {
  templateId: string;
  calibrations: {
    leanness: TrackCalibration;
    look: TrackCalibration;
    strength: TrackCalibration;
  };
  weights: {
    leanness: number;
    look: number;
    strength: number;
  };
  deadline: string;
}

const DEFAULT_DATA: WizardData = {
  templateId: "get-ripped-maintain",
  calibrations: {
    leanness: { floorValue: 25, currentValue: 22, targetValue: 15 },
    look: { floorValue: 1, currentValue: 5, targetValue: 8 },
    strength: { floorValue: 0, currentValue: 300, targetValue: 600 },
  },
  weights: { leanness: 0.45, look: 0.25, strength: 0.3 },
  deadline: "",
};

const STEP_LABELS = [
  "Goal",
  "Calibrate",
  "Weights",
  "Deadline",
  "Confirm",
] as const;

type TrackKey = "leanness" | "look" | "strength";
const TRACK_KEYS: TrackKey[] = ["leanness", "look", "strength"];

// ─── Step 1: Goal Select ─────────────────────────────────────────────────────

function StepGoalSelect({
  data,
  onNext,
}: {
  data: WizardData;
  onNext: (templateId: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Choose Your Goal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What are you working toward?
        </p>
      </div>

      <div className="space-y-3">
        {CAMPAIGN_TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => onNext(t.id)}
            className={cn(
              "w-full rounded-xl border p-4 text-left transition-all",
              "active:scale-[0.99]",
              data.templateId === t.id
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-border/80"
            )}
          >
            <div className="flex gap-3">
              <div className="mt-0.5 shrink-0 rounded-lg bg-strength/20 p-2">
                <Flame className="h-4 w-4 text-strength" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{t.title}</div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.tracks.map((track) => (
                    <Badge key={track.slug} variant="secondary" className="text-xs">
                      {track.label}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 2: Track Calibrate ─────────────────────────────────────────────────

const calibrateSchema = z.object({
  leanness: z
    .object({
      floorValue: z.coerce.number().min(3, "Min 3").max(50, "Max 50"),
      currentValue: z.coerce.number().min(3, "Min 3").max(60, "Max 60"),
      targetValue: z.coerce.number().min(3, "Min 3").max(50, "Max 50"),
    })
    .refine((d) => d.targetValue < d.floorValue, {
      message: "Target must be lower than floor (lower body fat is better)",
      path: ["targetValue"],
    }),
  look: z
    .object({
      floorValue: z.coerce.number().min(1, "Min 1").max(9, "Max 9"),
      currentValue: z.coerce.number().min(1, "Min 1").max(10, "Max 10"),
      targetValue: z.coerce.number().min(2, "Min 2").max(10, "Max 10"),
    })
    .refine((d) => d.targetValue > d.floorValue, {
      message: "Target must be higher than floor",
      path: ["targetValue"],
    }),
  strength: z
    .object({
      floorValue: z.coerce.number().min(0, "Min 0").max(2000, "Max 2000"),
      currentValue: z.coerce.number().min(0, "Min 0").max(3000, "Max 3000"),
      targetValue: z.coerce.number().min(1, "Min 1").max(3000, "Max 3000"),
    })
    .refine((d) => d.targetValue > d.floorValue, {
      message: "Target must be higher than floor",
      path: ["targetValue"],
    }),
});

type CalibrateForm = z.infer<typeof calibrateSchema>;

const CALIBRATE_FIELDS = [
  { key: "floorValue" as const, label: "Floor" },
  { key: "currentValue" as const, label: "Current" },
  { key: "targetValue" as const, label: "Target" },
];

function StepTrackCalibrate({
  data,
  onNext,
  onBack,
}: {
  data: WizardData;
  onNext: (calibrations: WizardData["calibrations"]) => void;
  onBack: () => void;
}) {
  const template =
    CAMPAIGN_TEMPLATES.find((t) => t.id === data.templateId) ??
    CAMPAIGN_TEMPLATES[0];

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CalibrateForm>({
    resolver: zodResolver(calibrateSchema),
    defaultValues: data.calibrations,
  });

  const onSubmit = (values: CalibrateForm) => onNext(values);

  if (!template) return null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Calibrate Tracks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set floor, current, and target values for each metric.
        </p>
      </div>

      <div className="space-y-4">
        {template.tracks.map((track) => {
          const slug = track.slug as TrackKey;
          const trackErrors = errors[slug];

          return (
            <Card key={track.slug} className="border-border/60">
              <CardHeader className="px-4 pb-2 pt-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">
                    {track.label}
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs font-normal">
                    {track.unit}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  {track.hintText}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 px-4 pb-4">
                <div className="grid grid-cols-3 gap-2">
                  {CALIBRATE_FIELDS.map(({ key, label }) => {
                    const fieldError = trackErrors?.[key];
                    return (
                      <div key={key} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          {label}
                        </Label>
                        <Input
                          type="number"
                          step={slug === "leanness" ? "0.1" : "1"}
                          placeholder="—"
                          {...register(`${slug}.${key}`)}
                          className={cn(
                            "text-sm",
                            fieldError && "border-destructive focus-visible:ring-destructive"
                          )}
                        />
                        {fieldError?.message && (
                          <p className="text-[10px] leading-tight text-destructive">
                            {fieldError.message}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button type="submit" className="flex-1">
          Next
        </Button>
      </div>
    </form>
  );
}

// ─── Step 3: Weight Adjust ────────────────────────────────────────────────────

function adjustWeightsProportionally(
  current: WizardData["weights"],
  changedKey: TrackKey,
  rawPct: number
): WizardData["weights"] {
  const newFraction = Math.max(0.05, Math.min(0.9, rawPct / 100));
  const remaining = 1 - newFraction;
  const others = TRACK_KEYS.filter((k) => k !== changedKey);
  const othersTotal = others.reduce((sum, k) => sum + current[k], 0);

  const next = { ...current, [changedKey]: newFraction } as WizardData["weights"];

  if (othersTotal < 0.001) {
    const share = remaining / others.length;
    for (const k of others) {
      next[k] = Math.max(0.05, share);
    }
  } else {
    for (const k of others) {
      next[k] = Math.max(0.05, (current[k] / othersTotal) * remaining);
    }
  }

  // Renormalise to guarantee sum = 1 (absorbs floating-point drift)
  const total = TRACK_KEYS.reduce((sum, k) => sum + next[k], 0);
  for (const k of TRACK_KEYS) {
    next[k] = next[k] / total;
  }

  return next;
}

const TRACK_COLOR_CLASSES: Record<TrackKey, string> = {
  leanness: "text-leanness",
  look: "text-look",
  strength: "text-strength",
};

function StepWeightAdjust({
  data,
  onNext,
  onBack,
}: {
  data: WizardData;
  onNext: (weights: WizardData["weights"]) => void;
  onBack: () => void;
}) {
  const template =
    CAMPAIGN_TEMPLATES.find((t) => t.id === data.templateId) ??
    CAMPAIGN_TEMPLATES[0];

  const [weights, setWeights] = useState<WizardData["weights"]>(data.weights);

  const handleSlider = useCallback(
    (key: TrackKey, pct: number) => {
      setWeights((prev) => adjustWeightsProportionally(prev, key, pct));
    },
    []
  );

  const currentComposite = useMemo(
    () =>
      calculateComposite(
        (template?.tracks ?? []).map((t) => {
          const slug = t.slug as TrackKey;
          return {
            slug: t.slug,
            weight: weights[slug],
            floorValue: data.calibrations[slug].floorValue,
            targetValue: data.calibrations[slug].targetValue,
            currentValue: data.calibrations[slug].currentValue,
            higherIsBetter: t.higherIsBetter,
          };
        })
      ),
    [template, weights, data.calibrations]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Adjust Weights</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Decide how much each track counts toward your composite score.
        </p>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="px-4 py-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Starting composite</span>
            <span className="text-lg font-bold">
              {currentComposite.score.toFixed(1)}
            </span>
          </div>
          <Progress value={currentComposite.score} className="h-2" />
          {currentComposite.isFloorViolated && (
            <p className="mt-2 text-xs text-amber-500">
              Floor breach detected — composite capped at 79
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-5">
        {(template?.tracks ?? []).map((track) => {
          const key = track.slug as TrackKey;
          const pct = Math.round(weights[key] * 100);
          return (
            <div key={track.slug} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label
                  className={cn("text-sm font-medium", TRACK_COLOR_CLASSES[key])}
                >
                  {track.label}
                </Label>
                <span className="text-sm font-semibold tabular-nums">{pct}%</span>
              </div>
              <Slider
                value={[pct]}
                min={5}
                max={90}
                step={1}
                onValueChange={([v]) => {
                  if (v !== undefined) handleSlider(key, v);
                }}
                aria-label={`${track.label} weight`}
              />
            </div>
          );
        })}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button onClick={() => onNext(weights)} className="flex-1">
          Next
        </Button>
      </div>
    </div>
  );
}

// ─── Step 4: Deadline ─────────────────────────────────────────────────────────

function StepDeadline({
  data,
  onNext,
  onBack,
}: {
  data: WizardData;
  onNext: (deadline: string) => void;
  onBack: () => void;
}) {
  const [deadline, setDeadline] = useState(data.deadline);
  const today = new Date().toISOString().split("T")[0] ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Set a Deadline</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Optional. A build-phase deadline creates urgency.
        </p>
      </div>

      <Card className="border-border/60">
        <CardContent className="space-y-3 px-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="deadline">Build deadline</Label>
            <Input
              id="deadline"
              type="date"
              min={today}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Leave blank for an open-ended campaign.
          </p>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button onClick={() => onNext(deadline)} className="flex-1">
          {deadline ? "Next" : "Skip"}
        </Button>
      </div>
    </div>
  );
}

// ─── Step 5: Confirm ─────────────────────────────────────────────────────────

function StepConfirm({
  data,
  onBack,
}: {
  data: WizardData;
  onBack: () => void;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const template =
    CAMPAIGN_TEMPLATES.find((t) => t.id === data.templateId) ??
    CAMPAIGN_TEMPLATES[0];

  const compileResult = useMemo(
    () =>
      compileCampaign({
        templateId: data.templateId,
        calibrations: data.calibrations,
        weights: data.weights,
        deadline: data.deadline || null,
      }),
    [data]
  );

  const handleLaunch = async () => {
    if (!compileResult.ok) {
      toast.error("Campaign data is invalid — please go back and check your inputs.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { draft } = compileResult;
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          slug: draft.templateId,
          targetScore: draft.targetScore,
          deadline: draft.deadline,
          tracks: draft.tracks.map((t) => ({
            slug: t.slug,
            label: t.label,
            weight: t.weight,
            floorValue: t.floorValue,
            currentValue: t.currentValue,
            targetValue: t.targetValue,
            unit: t.unit,
            higherIsBetter: t.higherIsBetter,
            sortOrder: t.sortOrder,
          })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to create campaign");
      }

      toast.success("Campaign launched! Time to get to work.");
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!compileResult.ok) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Something looks off</h1>
        <p className="text-muted-foreground">Please go back and fix the errors.</p>
        <Button variant="outline" onClick={onBack} className="w-full">
          Back
        </Button>
      </div>
    );
  }

  const { draft } = compileResult;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Review & Launch</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your campaign is ready to go.
        </p>
      </div>

      <Card className="border-border/60">
        <CardHeader className="px-4 pb-2 pt-4">
          <CardTitle className="text-base">{draft.title}</CardTitle>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="build">BUILD</Badge>
            {draft.deadline && (
              <span className="text-xs text-muted-foreground">
                Deadline:{" "}
                {new Date(draft.deadline).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Starting composite</span>
              <span className="font-semibold">
                {draft.currentCompositeScore.toFixed(1)}
              </span>
            </div>
            <Progress value={draft.currentCompositeScore} className="h-2" />
          </div>

          <div className="space-y-2 pt-1">
            {draft.tracks.map((track) => {
              const tpl = template?.tracks.find((t) => t.slug === track.slug);
              return (
                <div
                  key={track.slug}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-muted-foreground">{track.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-foreground">
                      {track.currentValue} → {track.targetValue}
                      {tpl ? ` ${tpl.unit}` : ""}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {Math.round(track.weight * 100)}%
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isSubmitting}
          className="flex-1"
        >
          Back
        </Button>
        <Button
          onClick={handleLaunch}
          disabled={isSubmitting}
          className="flex-1 bg-strength text-white hover:bg-strength/90"
        >
          {isSubmitting ? "Launching…" : "Launch Campaign"}
        </Button>
      </div>
    </div>
  );
}

// ─── Wizard shell ─────────────────────────────────────────────────────────────

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(1);
  const [data, setData] = useState<WizardData>(DEFAULT_DATA);

  const goBack = () => {
    if (step === 1) {
      router.push("/dashboard");
    } else {
      setStep((s) => (s - 1) as WizardStep);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Sticky header with progress dots */}
      <div className="sticky top-0 z-10 border-b border-border/40 bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={goBack}
            className="rounded-lg p-1.5 transition-colors hover:bg-muted"
            aria-label="Go back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="flex flex-1 items-center justify-center gap-1.5">
            {STEP_LABELS.map((label, i) => (
              <div
                key={label}
                className={cn(
                  "rounded-full transition-all duration-200",
                  i + 1 === step
                    ? "h-1.5 w-6 bg-primary"
                    : i + 1 < step
                    ? "h-1.5 w-1.5 bg-primary/50"
                    : "h-1.5 w-1.5 bg-border"
                )}
                aria-label={`Step ${i + 1}: ${label}`}
              />
            ))}
          </div>

          {/* Spacer to centre the dots */}
          <div className="w-8" />
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {step === 1 && (
          <StepGoalSelect
            data={data}
            onNext={(templateId) => {
              setData((d) => ({ ...d, templateId }));
              setStep(2);
            }}
          />
        )}

        {step === 2 && (
          <StepTrackCalibrate
            data={data}
            onNext={(calibrations) => {
              setData((d) => ({ ...d, calibrations }));
              setStep(3);
            }}
            onBack={goBack}
          />
        )}

        {step === 3 && (
          <StepWeightAdjust
            data={data}
            onNext={(weights) => {
              setData((d) => ({ ...d, weights }));
              setStep(4);
            }}
            onBack={goBack}
          />
        )}

        {step === 4 && (
          <StepDeadline
            data={data}
            onNext={(deadline) => {
              setData((d) => ({ ...d, deadline }));
              setStep(5);
            }}
            onBack={goBack}
          />
        )}

        {step === 5 && <StepConfirm data={data} onBack={goBack} />}
      </div>
    </div>
  );
}
