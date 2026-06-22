"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Dumbbell,
  Brain,
  Sparkles,
  LayoutGrid,
  Flame,
  Trophy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn, clamp } from "@/lib/utils";
import { getXpThresholdForLevel } from "@/lib/economy/levels";
import type { LucideIcon } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DashboardCampaign {
  id: string;
  title: string;
  compositeScore: number;
  targetScore: number;
  phase: "build" | "maintain";
}

export interface DashboardTrack {
  slug: string;
  label: string;
  weight: number;
  floorValue: number;
  targetValue: number;
  currentValue: number;
  unit: string;
  higherIsBetter: boolean;
  sortOrder: number;
}

export interface DashboardPillar {
  slug: string;
  level: number;
  xpTotal: number;
  xpCurrent: number;
}

export interface DashboardStreak {
  currentStreak: number;
  longestStreak: number;
}

export interface DashboardClientProps {
  campaign: DashboardCampaign;
  tracks: DashboardTrack[];
  streak: DashboardStreak | null;
  pillarLevels: DashboardPillar[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TRACK_BAR_COLOR: Record<string, string> = {
  leanness: "bg-leanness",
  look: "bg-look",
  strength: "bg-strength",
};

const TRACK_TEXT_COLOR: Record<string, string> = {
  leanness: "text-leanness",
  look: "text-look",
  strength: "text-strength",
};

const PILLAR_ICON: Record<string, LucideIcon> = {
  body: Dumbbell,
  mind: Brain,
  spirit: Sparkles,
  structure: LayoutGrid,
};

const PILLAR_LABEL: Record<string, string> = {
  body: "Body",
  mind: "Mind",
  spirit: "Spirit",
  structure: "Structure",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeTrackScore(track: DashboardTrack): number {
  if (track.higherIsBetter) {
    const range = track.targetValue - track.floorValue;
    return range <= 0
      ? track.currentValue >= track.targetValue
        ? 100
        : 0
      : clamp(((track.currentValue - track.floorValue) / range) * 100, 0, 100);
  }
  const range = track.floorValue - track.targetValue;
  return range <= 0
    ? track.currentValue <= track.targetValue
      ? 100
      : 0
    : clamp(((track.floorValue - track.currentValue) / range) * 100, 0, 100);
}

function isFloorBreached(track: DashboardTrack): boolean {
  return track.higherIsBetter
    ? track.currentValue < track.floorValue
    : track.currentValue > track.floorValue;
}

function formatValue(value: number, unit: string): string {
  if (unit.startsWith("%")) return `${value}${unit}`;
  return `${value} ${unit}`;
}

// ── Inline progress bar (allows custom indicator color) ───────────────────────

function ProgressBar({
  value,
  className,
  indicatorClass,
}: {
  value: number;
  className?: string;
  indicatorClass?: string;
}) {
  return (
    <div
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
        className
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500",
          indicatorClass ?? "bg-primary"
        )}
        style={{ width: `${clamp(value, 0, 100)}%` }}
      />
    </div>
  );
}

// ── Animation variant ─────────────────────────────────────────────────────────

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

// ── Main component ────────────────────────────────────────────────────────────

export function DashboardClient({
  campaign,
  tracks,
  streak,
  pillarLevels,
}: DashboardClientProps) {
  const sortedTracks = [...tracks].sort((a, b) => a.sortOrder - b.sortOrder);
  const anyFloorBreached = sortedTracks.some(isFloorBreached);

  return (
    <div className="p-4 space-y-5 pb-8">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="pt-2 space-y-1"
      >
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-xl font-bold truncate">{campaign.title}</h1>
          <Badge
            variant={campaign.phase === "build" ? "build" : "maintain"}
            className="shrink-0"
          >
            {campaign.phase.toUpperCase()}
          </Badge>
        </div>
        {anyFloorBreached && (
          <div className="flex items-center gap-1.5 text-xs text-recovery-medium">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Fix floor violations to unlock level-up
          </div>
        )}
      </motion.div>

      {/* ── Composite Score ── */}
      <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.05 }}>
        <Card>
          <CardContent className="pt-4 pb-4 space-y-2.5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Composite Score
              </span>
              <span className="text-3xl font-bold tabular-nums text-xp">
                {Math.round(campaign.compositeScore)}
              </span>
            </div>
            {/* Progress bar with target marker */}
            <div className="relative">
              <ProgressBar
                value={campaign.compositeScore}
                className="h-3"
                indicatorClass="bg-xp"
              />
              <div
                className="absolute top-0 h-3 w-px bg-foreground/50 rounded-full"
                style={{ left: `${campaign.targetScore}%` }}
                aria-label={`Target score: ${campaign.targetScore}`}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
              <span>0</span>
              <span>Target {Math.round(campaign.targetScore)}</span>
              <span>100</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Tracks ── */}
      {sortedTracks.length > 0 && (
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="space-y-3"
        >
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-0.5">
            Tracks
          </h2>
          {sortedTracks.map((track) => {
            const score = computeTrackScore(track);
            const breached = isFloorBreached(track);
            const barColor = TRACK_BAR_COLOR[track.slug] ?? "bg-primary";
            const textColor = TRACK_TEXT_COLOR[track.slug] ?? "text-foreground";

            return (
              <Card
                key={track.slug}
                className={cn(breached && "border-recovery-medium/40")}
              >
                <CardContent className="pt-3.5 pb-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("text-sm font-semibold", textColor)}>
                        {track.label}
                      </span>
                      {breached && (
                        <AlertTriangle className="h-3.5 w-3.5 text-recovery-medium" />
                      )}
                    </div>
                    <span className="text-sm font-bold tabular-nums">
                      {formatValue(track.currentValue, track.unit)}
                    </span>
                  </div>
                  <ProgressBar
                    value={score}
                    className="h-2"
                    indicatorClass={barColor}
                  />
                  {breached ? (
                    <p className="text-xs text-recovery-medium">
                      Below floor ({formatValue(track.floorValue, track.unit)}) —
                      fix before level-up
                    </p>
                  ) : (
                    <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                      <span>Floor {formatValue(track.floorValue, track.unit)}</span>
                      <span>Target {formatValue(track.targetValue, track.unit)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </motion.div>
      )}

      {/* ── Pillars ── */}
      {pillarLevels.length > 0 && (
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="space-y-3"
        >
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-0.5">
            Pillars
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {pillarLevels.map((pillar) => {
              const Icon = PILLAR_ICON[pillar.slug] ?? Dumbbell;
              const label = PILLAR_LABEL[pillar.slug] ?? pillar.slug;
              const xpForNext = getXpThresholdForLevel(pillar.level);
              const xpPct = Math.min(
                (pillar.xpCurrent / Math.max(xpForNext, 1)) * 100,
                100
              );

              return (
                <Link key={pillar.slug} href={`/pillars/${pillar.slug}`}>
                  <Card className="hover:bg-secondary/50 transition-colors cursor-pointer h-full">
                    <CardContent className="pt-3.5 pb-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="text-sm font-semibold truncate">
                            {label}
                          </span>
                        </div>
                        <Badge variant="level" className="text-xs shrink-0 ml-1">
                          Lv {pillar.level}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <ProgressBar
                          value={xpPct}
                          className="h-1.5"
                          indicatorClass="bg-xp"
                        />
                        <p className="text-xs text-muted-foreground text-right tabular-nums">
                          {pillar.xpCurrent} / {xpForNext} XP
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Streak ── */}
      {streak && (
        <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.2 }}>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Flame className="h-5 w-5 text-recovery-medium shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">
                      {streak.currentStreak}-day streak
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Best: {streak.longestStreak} days
                    </p>
                  </div>
                </div>
                {streak.currentStreak > 0 &&
                  streak.currentStreak >= streak.longestStreak && (
                    <div className="flex items-center gap-1 text-xs text-xp font-medium">
                      <Trophy className="h-3.5 w-3.5" />
                      Record
                    </div>
                  )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
