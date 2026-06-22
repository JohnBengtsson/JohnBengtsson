"use client";

import { useState } from "react";
import Link from "next/link";
import { Flame, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn, clamp, formatDate } from "@/lib/utils";
import { getRecoveryMultiplier } from "@/lib/economy/xp";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MorningClientProps {
  today: string;
  displayName: string;
  whoopScore: number | null;
  whoopSleepScore: number | null;
  campaign: {
    title: string;
    compositeScore: number;
    targetScore: number;
    phase: "build" | "maintain";
  } | null;
  streak: {
    current: number;
    longest: number;
  } | null;
}

// ── Recovery Ring ─────────────────────────────────────────────────────────────

const RING_SIZE = 160;
const RING_STROKE = 12;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ringColorClass(score: number): string {
  if (score >= 67) return "text-recovery-high";
  if (score >= 34) return "text-recovery-medium";
  return "text-recovery-low";
}

function RecoveryRing({ score }: { score: number }) {
  const pct = clamp(score, 0, 100);
  const dashOffset = RING_CIRCUMFERENCE * (1 - pct / 100);
  const colorClass = ringColorClass(score);

  return (
    <div
      className="relative flex items-center justify-center"
      role="img"
      aria-label={`Recovery score: ${Math.round(score)}`}
    >
      <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={RING_STROKE}
          className="text-border"
        />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={RING_STROKE}
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          className={colorClass}
        />
      </svg>
      <div className="pointer-events-none absolute flex flex-col items-center">
        <span className="text-3xl font-bold tabular-nums leading-none">
          {Math.round(pct)}
        </span>
        <span className="mt-1 text-xs text-muted-foreground">recovery</span>
      </div>
    </div>
  );
}

// ── Intensity Tiers ───────────────────────────────────────────────────────────

type Intensity = "heavy" | "moderate" | "light" | "rest";

function getIntensity(score: number): Intensity {
  if (score >= 67) return "heavy";
  if (score >= 50) return "moderate";
  if (score >= 34) return "light";
  return "rest";
}

const INTENSITY_CONFIG: Record<
  Intensity,
  {
    label: string;
    colorClass: string;
    description: string;
    calories: string;
    sleep: string;
    xpLabel: string;
  }
> = {
  heavy: {
    label: "Heavy Day",
    colorClass: "text-recovery-high",
    description: "Train hard. Push compound lifts at full intensity.",
    calories: "Eat at or above maintenance (+200–400 kcal)",
    sleep: "Target 8+ hrs sleep tonight",
    xpLabel: "1.0× XP",
  },
  moderate: {
    label: "Moderate Day",
    colorClass: "text-recovery-medium",
    description: "Solid effort. Avoid PRs. Keep rest periods generous.",
    calories: "Eat at maintenance",
    sleep: "Target 7.5–8 hrs sleep tonight",
    xpLabel: "0.8× XP",
  },
  light: {
    label: "Light Day",
    colorClass: "text-recovery-medium",
    description: "Active recovery. Mobility, walking, or light sets only.",
    calories: "Slight calorie deficit is fine",
    sleep: "Prioritise 8+ hrs sleep — your body needs it",
    xpLabel: "0.8× XP",
  },
  rest: {
    label: "Rest Day",
    colorClass: "text-recovery-low",
    description: "Your body is stressed. Skip the gym. Walk and eat clean.",
    calories: "Light eating — no deficit pressure",
    sleep: "Target 9+ hrs sleep tonight",
    xpLabel: "0.6× XP",
  },
};

// ── Main ──────────────────────────────────────────────────────────────────────

export function MorningClient({
  today,
  displayName,
  whoopScore,
  campaign,
  streak,
}: MorningClientProps) {
  const [manualFeel, setManualFeel] = useState<number | null>(null);

  const hasWhoop = whoopScore !== null;
  const effectiveScore = hasWhoop
    ? whoopScore
    : manualFeel !== null
    ? manualFeel * 10
    : null;

  const intensity = effectiveScore !== null ? getIntensity(effectiveScore) : null;
  const intensityConfig = intensity ? INTENSITY_CONFIG[intensity] : null;
  const multiplier = getRecoveryMultiplier(effectiveScore);
  const multiplierClass =
    multiplier === 1.0
      ? "text-recovery-high"
      : multiplier === 0.8
      ? "text-recovery-medium"
      : "text-recovery-low";

  const streakBonus =
    streak ? Math.min(Math.floor(streak.current / 7) * 5, 50) : 0;

  return (
    <div className="space-y-4 px-4 py-6">
      {/* Date + Greeting */}
      <div>
        <p className="text-sm text-muted-foreground">
          {formatDate(today + "T12:00:00Z")}
        </p>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight">
          Good morning, {displayName}
        </h1>
      </div>

      {/* Recovery Ring */}
      <Card className="border-border/60">
        <CardContent className="px-4 py-5">
          {hasWhoop ? (
            <div className="flex flex-col items-center gap-3">
              <RecoveryRing score={whoopScore!} />
              <div className="text-center">
                <p className="text-sm font-medium">WHOOP Recovery</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Tonight&apos;s XP multiplier:{" "}
                  <span className={cn("font-semibold", multiplierClass)}>
                    {multiplier.toFixed(1)}×
                  </span>
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              {effectiveScore !== null ? (
                <RecoveryRing score={effectiveScore} />
              ) : (
                <div
                  className="flex h-40 w-40 items-center justify-center rounded-full border-4 border-border"
                  role="img"
                  aria-label="Rate your readiness"
                >
                  <span className="px-4 text-center text-sm text-muted-foreground">
                    How do you feel?
                  </span>
                </div>
              )}

              <div className="w-full space-y-2">
                <p className="text-center text-xs text-muted-foreground">
                  No WHOOP connected — rate your readiness (1–10)
                </p>
                <div className="grid grid-cols-10 gap-1">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      onClick={() => setManualFeel(n)}
                      className={cn(
                        "rounded py-2 text-xs font-semibold transition-colors",
                        manualFeel === n
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/70"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between px-0.5 text-[10px] text-muted-foreground">
                  <span>Terrible</span>
                  <span>Amazing</span>
                </div>
                {manualFeel !== null && (
                  <p className="pt-1 text-center text-xs text-muted-foreground">
                    Tonight&apos;s XP multiplier:{" "}
                    <span className={cn("font-semibold", multiplierClass)}>
                      {multiplier.toFixed(1)}×
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Composite Progress */}
      {campaign && (
        <Card className="border-border/60">
          <CardContent className="space-y-2 px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs leading-none text-muted-foreground">
                  {campaign.title}
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums leading-none">
                  {campaign.compositeScore.toFixed(1)}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}/ {campaign.targetScore}
                  </span>
                </p>
              </div>
              <Badge variant={campaign.phase === "build" ? "build" : "maintain"}>
                {campaign.phase.toUpperCase()}
              </Badge>
            </div>
            <Progress
              value={
                (campaign.compositeScore / Math.max(campaign.targetScore, 1)) *
                100
              }
              className="h-2"
            />
          </CardContent>
        </Card>
      )}

      {/* Day Target Card */}
      {intensityConfig && (
        <Card className="border-border/60">
          <CardContent className="space-y-3 px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame
                  className={cn("h-4 w-4", intensityConfig.colorClass)}
                />
                <span
                  className={cn(
                    "text-sm font-semibold",
                    intensityConfig.colorClass
                  )}
                >
                  {intensityConfig.label}
                </span>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                {intensityConfig.xpLabel}
              </Badge>
            </div>
            <p className="text-sm">{intensityConfig.description}</p>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                🍽 {intensityConfig.calories}
              </p>
              <p className="text-xs text-muted-foreground">
                🌙 {intensityConfig.sleep}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Streak */}
      {streak && streak.current > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
          <Flame className="h-5 w-5 shrink-0 text-orange-500" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{streak.current}-day streak</p>
            <p className="text-xs text-muted-foreground">
              Personal best: {streak.longest} days
            </p>
          </div>
          {streakBonus > 0 && (
            <Badge variant="xp" className="shrink-0">
              +{streakBonus} XP bonus
            </Badge>
          )}
        </div>
      )}

      {/* No Campaign CTA */}
      {!campaign && (
        <Card className="border-dashed border-border/60">
          <CardContent className="px-4 py-6 text-center">
            <p className="mb-3 text-sm text-muted-foreground">
              No active campaign yet.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/campaign/new">Start a campaign</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Primary CTA */}
      <div className="pt-2">
        <Button asChild size="lg" className="w-full">
          <Link href="/evening">
            Go to Evening Log
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
