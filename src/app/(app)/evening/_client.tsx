"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, CheckCircle2, Circle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";
import { calculateXpAward, XP_TABLE } from "@/lib/economy/xp";
import { useAppStore } from "@/stores/useAppStore";
import type { ActionKey } from "@/lib/economy/xp";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EveningClientProps {
  today: string;
  recoveryScore: number | null;
  currentStreak: number;
  campaign: {
    id: string;
    title: string;
    compositeScore: number;
    targetScore: number;
    phase: "build" | "maintain";
  } | null;
  alreadyLoggedActions: string[];
}

interface EveningLogResult {
  totalXp: number;
  newStreak: number;
  streakIsRecord: boolean;
  leveledUp: boolean;
  newLevel: number;
  composite: number;
}

// ── Action Catalog ────────────────────────────────────────────────────────────

const LOGGABLE_ACTIONS: ActionKey[] = [
  "workout_completed",
  "calories_logged",
  "meditation",
  "journaling",
  "sleep_target_hit",
  "daily_planning",
];

const ACTION_LABELS: Record<ActionKey, string> = {
  workout_completed: "Workout Completed",
  calories_logged: "Calories Logged",
  meditation: "Meditation",
  journaling: "Journaling",
  sleep_target_hit: "Sleep Target Hit",
  daily_planning: "Daily Planning",
  measurement_logged: "Measurement Logged",
  photo_logged: "Photo Logged",
};

// Group actions by pillar for display
const PILLAR_GROUPS: { label: string; colorClass: string; actions: ActionKey[] }[] = [
  {
    label: "Body",
    colorClass: "text-strength",
    actions: ["workout_completed", "calories_logged", "sleep_target_hit"],
  },
  { label: "Mind", colorClass: "text-look", actions: ["meditation"] },
  { label: "Spirit", colorClass: "text-leanness", actions: ["journaling"] },
  { label: "Structure", colorClass: "text-muted-foreground", actions: ["daily_planning"] },
];

// ── XP Counter Animation ──────────────────────────────────────────────────────

function XpCounter({ target }: { target: number }) {
  const [displayed, setDisplayed] = useState(0);
  const startTime = useRef<number | null>(null);
  const duration = 1400;

  useEffect(() => {
    let frame: number;
    const tick = (now: number) => {
      if (!startTime.current) startTime.current = now;
      const elapsed = now - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return <span>{displayed}</span>;
}

// ── Payout Screen ─────────────────────────────────────────────────────────────

function PayoutScreen({ result, streak }: { result: EveningLogResult; streak: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="space-y-5 px-4 py-6"
    >
      <div className="flex flex-col items-center gap-1 py-4 text-center">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.35, ease: "backOut" }}
        >
          <CheckCircle2 className="h-14 w-14 text-recovery-high" />
        </motion.div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">Day Closed</h1>
        <p className="text-sm text-muted-foreground">Great work — keep the streak alive.</p>
      </div>

      {/* XP earned */}
      <Card className="border-border/60 bg-xp/5">
        <CardContent className="px-4 py-4 text-center">
          <p className="text-xs text-muted-foreground">XP Earned</p>
          <p className="mt-1 text-4xl font-bold tabular-nums text-xp">
            +<XpCounter target={result.totalXp} />
          </p>
        </CardContent>
      </Card>

      {/* Streak */}
      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
        <Flame className="h-5 w-5 shrink-0 text-orange-500" />
        <div className="flex-1">
          <p className="text-sm font-semibold">{result.newStreak}-day streak</p>
          {result.streakIsRecord && (
            <p className="text-xs text-recovery-high">New personal record!</p>
          )}
        </div>
        {result.newStreak !== streak && (
          <Badge variant="secondary">
            {result.newStreak > streak ? "+" : ""}
            {result.newStreak - streak}
          </Badge>
        )}
      </div>

      {/* Composite */}
      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-3">
        <p className="text-sm text-muted-foreground">Composite score</p>
        <p className="font-bold tabular-nums">{result.composite.toFixed(1)}</p>
      </div>

      {/* Level-up */}
      {result.leveledUp && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4, ease: "backOut" }}
          className="rounded-xl border border-level/40 bg-level/10 px-4 py-4 text-center"
        >
          <p className="text-lg font-bold text-level">Level Up!</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Body pillar reached Level {result.newLevel}
          </p>
        </motion.div>
      )}

      <div className="pt-2">
        <Button asChild className="w-full" size="lg">
          <Link href="/dashboard">
            View Dashboard
            <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function EveningClient({
  today,
  recoveryScore,
  currentStreak,
  campaign,
  alreadyLoggedActions,
}: EveningClientProps) {
  const alreadyLogged = new Set(alreadyLoggedActions);

  const [checked, setChecked] = useState<Set<ActionKey>>(
    () => new Set(alreadyLoggedActions.filter((a) => LOGGABLE_ACTIONS.includes(a as ActionKey)) as ActionKey[])
  );
  const [measurements, setMeasurements] = useState({
    leanness: "",
    look: "",
    strength: "",
  });
  const [phase, setPhase] = useState<"log" | "submitting" | "done">("log");
  const [result, setResult] = useState<EveningLogResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = (action: ActionKey) => {
    if (alreadyLogged.has(action)) return;
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(action) ? next.delete(action) : next.add(action);
      return next;
    });
  };

  const hasMeasurements = Object.values(measurements).some((v) => v !== "");

  const liveXp = useMemo(() => {
    const newActions = [...checked].filter((a) => !alreadyLogged.has(a));
    if (hasMeasurements && !alreadyLogged.has("measurement_logged")) {
      newActions.push("measurement_logged");
    }
    return newActions.reduce((sum, action) => {
      const result = calculateXpAward(action, recoveryScore, currentStreak);
      return sum + result.total;
    }, 0);
  }, [checked, hasMeasurements, alreadyLogged, recoveryScore, currentStreak]);

  const multiplier = useMemo(() => {
    if (recoveryScore === null) return 1.0;
    if (recoveryScore >= 67) return 1.0;
    if (recoveryScore >= 34) return 0.8;
    return 0.6;
  }, [recoveryScore]);

  const multiplierClass =
    multiplier === 1.0
      ? "text-recovery-high"
      : multiplier === 0.8
      ? "text-recovery-medium"
      : "text-recovery-low";

  const handleSubmit = async () => {
    if (!campaign) return;
    setPhase("submitting");
    setError(null);

    const newActions = [...checked].filter((a) => !alreadyLogged.has(a));
    const parsedMeasurements: Record<string, number> = {};
    if (measurements.leanness) parsedMeasurements.leanness = parseFloat(measurements.leanness);
    if (measurements.look) parsedMeasurements.look = parseFloat(measurements.look);
    if (measurements.strength) parsedMeasurements.strength = parseFloat(measurements.strength);

    try {
      const res = await fetch("/api/evening-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actions: newActions,
          measurements: Object.keys(parsedMeasurements).length > 0 ? parsedMeasurements : undefined,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to close day");
      }

      const data = (await res.json()) as EveningLogResult;
      setResult(data);
      setPhase("done");
    } catch (err) {
      // Network failure (offline) — persist to IndexedDB queue, flush on reconnect
      if (!navigator.onLine || err instanceof TypeError) {
        await useAppStore.getState().enqueueLog({
          actions: newActions,
          measurements:
            Object.keys(parsedMeasurements).length > 0 ? parsedMeasurements : undefined,
        });
        toast.info("Saved offline — will sync when you reconnect");
        setPhase("log");
        return;
      }
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("log");
    }
  };

  if (phase === "done" && result) {
    return <PayoutScreen result={result} streak={currentStreak} />;
  }

  return (
    <div className="space-y-4 px-4 py-6">
      {/* Header */}
      <div>
        <p className="text-sm text-muted-foreground">
          {formatDate(today + "T12:00:00Z")}
        </p>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight">Evening Log</h1>
      </div>

      {!campaign && (
        <Card className="border-dashed border-border/60">
          <CardContent className="px-4 py-6 text-center">
            <p className="mb-3 text-sm text-muted-foreground">No active campaign.</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/campaign/new">Start a campaign</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {campaign && (
        <>
          {/* Action Checklist */}
          <div className="space-y-4">
            {PILLAR_GROUPS.map((group) => (
              <div key={group.label}>
                <p className={cn("mb-2 text-xs font-semibold uppercase tracking-widest", group.colorClass)}>
                  {group.label}
                </p>
                <Card className="border-border/60">
                  <CardContent className="divide-y divide-border/40 px-0 py-0">
                    {group.actions.map((action) => {
                      const isChecked = checked.has(action);
                      const wasLogged = alreadyLogged.has(action);
                      const xp = calculateXpAward(action, recoveryScore, currentStreak).total;
                      return (
                        <button
                          key={action}
                          onClick={() => toggle(action)}
                          disabled={wasLogged}
                          className={cn(
                            "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                            !wasLogged && "active:bg-muted/50",
                            wasLogged && "opacity-60"
                          )}
                        >
                          {isChecked ? (
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-recovery-high" />
                          ) : (
                            <Circle className="h-5 w-5 shrink-0 text-border" />
                          )}
                          <span className="flex-1 text-sm font-medium">
                            {ACTION_LABELS[action]}
                            {wasLogged && (
                              <span className="ml-2 text-xs text-muted-foreground">logged</span>
                            )}
                          </span>
                          <span className={cn("text-xs tabular-nums", isChecked ? "text-xp" : "text-muted-foreground")}>
                            +{xp} XP
                          </span>
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>

          {/* Measurements */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Measurements (optional)
            </p>
            <Card className="border-border/60">
              <CardContent className="space-y-3 px-4 py-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Body fat %</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="3"
                      max="60"
                      placeholder="—"
                      value={measurements.leanness}
                      onChange={(e) =>
                        setMeasurements((m) => ({ ...m, leanness: e.target.value }))
                      }
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Look /10</Label>
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      max="10"
                      placeholder="—"
                      value={measurements.look}
                      onChange={(e) =>
                        setMeasurements((m) => ({ ...m, look: e.target.value }))
                      }
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Strength lbs</Label>
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      max="3000"
                      placeholder="—"
                      value={measurements.strength}
                      onChange={(e) =>
                        setMeasurements((m) => ({ ...m, strength: e.target.value }))
                      }
                      className="text-sm"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  +{XP_TABLE["measurement_logged"]?.base ?? 15} XP for logging measurements
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Live XP Preview */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">XP to earn tonight</p>
                  <p className="mt-0.5 text-2xl font-bold tabular-nums text-xp">
                    +{liveXp}
                  </p>
                </div>
                <div className="text-right">
                  <span className={cn("text-sm font-semibold", multiplierClass)}>
                    {multiplier.toFixed(1)}× multiplier
                  </span>
                  {currentStreak >= 7 && (
                    <p className="mt-0.5 flex items-center justify-end gap-1 text-xs text-muted-foreground">
                      <Flame className="h-3 w-3 text-orange-500" />
                      {currentStreak}-day streak
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-sm text-destructive"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Submit */}
          <div className="pt-2">
            <Button
              onClick={handleSubmit}
              disabled={phase === "submitting" || (checked.size === 0 && !hasMeasurements)}
              size="lg"
              className="w-full"
            >
              {phase === "submitting" ? "Closing day…" : "Close the Day"}
            </Button>
            {checked.size === 0 && !hasMeasurements && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Check at least one action or log a measurement to continue.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
