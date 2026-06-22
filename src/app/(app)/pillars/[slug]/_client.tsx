"use client";

import { useRef, useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import { ArrowLeft, ChevronDown } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/lib/supabase/client";
import { clamp, formatRelativeDate } from "@/lib/utils";
import { getXpThresholdForLevel } from "@/lib/economy/levels";
import type { XpSource } from "@/types/database.types";

const XP_PAGE_SIZE = 20;

interface TrackSnapshot {
  slug: string;
  label: string;
  currentValue: number;
  targetValue: number;
  floorValue: number;
  unit: string;
  higherIsBetter: boolean;
}

interface LevelRecord {
  levelReached: number;
  compositeAtLevelup: number | null;
  leveledAt: string;
}

interface XpTransaction {
  id: string;
  amount: number;
  source: XpSource;
  description: string | null;
  created_at: string;
}

interface PillarClientProps {
  pillarId: number;
  slug: string;
  label: string;
  level: number;
  xpTotal: number;
  xpCurrent: number;
  tracks: TrackSnapshot[];
  levelRecords: LevelRecord[];
}

function computeTrackScore(track: TrackSnapshot): number {
  const { currentValue, floorValue, targetValue, higherIsBetter } = track;
  if (higherIsBetter) {
    return clamp(
      ((currentValue - floorValue) / (targetValue - floorValue)) * 100,
      0,
      100
    );
  }
  return clamp(
    ((floorValue - currentValue) / (floorValue - targetValue)) * 100,
    0,
    100
  );
}

const SOURCE_LABELS: Partial<Record<XpSource, string>> = {
  daily_log: "Daily log",
  streak_bonus: "Streak bonus",
  level_up: "Level up",
  manual: "Manual",
  whoop_bonus: "Whoop bonus",
};

export function PillarClient({
  pillarId,
  slug,
  label,
  level,
  xpCurrent,
  tracks,
  levelRecords,
}: PillarClientProps) {
  const supabase = createClient();
  const xpForNext = getXpThresholdForLevel(level);
  const xpPct = clamp((xpCurrent / xpForNext) * 100, 0, 100);

  const loadMoreRef = useRef<HTMLDivElement>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["xp-transactions", pillarId],
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      let query = supabase
        .from("xp_transactions")
        .select("id, amount, source, description, created_at")
        .eq("pillar_id", pillarId)
        .order("created_at", { ascending: false })
        .limit(XP_PAGE_SIZE);

      if (pageParam) {
        query = query.lt("created_at", pageParam);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as XpTransaction[];
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < XP_PAGE_SIZE) return undefined;
      return lastPage[lastPage.length - 1].created_at;
    },
  });

  // Intersection observer for infinite scroll
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const allTransactions = data?.pages.flat() ?? [];

  // Radar chart data
  const radarData =
    tracks.length > 0
      ? tracks.map((t) => ({
          subject: t.label,
          score: computeTrackScore(t),
          fullMark: 100,
        }))
      : null;

  return (
    <div className="p-6 space-y-6 max-w-lg mx-auto pb-28">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild aria-label="Back to pillars">
          <Link href="/pillars">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{label}</h1>
          <Badge variant="secondary" className="mt-0.5">
            Level {level}
          </Badge>
        </div>
      </div>

      {/* XP Progress */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">XP this level</span>
            <span className="font-medium tabular-nums">
              {xpCurrent} / {xpForNext}
            </span>
          </div>
          <div
            className="h-3 w-full rounded-full bg-secondary overflow-hidden"
            role="progressbar"
            aria-valuenow={xpCurrent}
            aria-valuemax={xpForNext}
            aria-label={`Level ${level} XP progress`}
          >
            <div
              className="h-full rounded-full bg-xp transition-all duration-700"
              style={{ width: `${xpPct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {xpForNext - xpCurrent} XP to Level {level + 1}
          </p>
        </CardContent>
      </Card>

      {/* Attribute Radar (only if track data exists) */}
      {radarData && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Attribute Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="h-52"
              aria-label={`Radar chart of ${label} track scores`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  />
                  <Radar
                    name={label}
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Level History */}
      {levelRecords.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Level History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {levelRecords.map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs tabular-nums">
                    Lv {r.levelReached}
                  </Badge>
                  {r.compositeAtLevelup !== null && (
                    <span className="text-xs text-muted-foreground">
                      Composite {Math.round(r.compositeAtLevelup)}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeDate(r.leveledAt)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* XP Transaction History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">XP History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-96">
            <div className="px-6 pb-4 space-y-0 divide-y divide-border">
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                ))}

              {!isLoading && allTransactions.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No XP earned yet
                </p>
              )}

              {allTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-start justify-between py-3 gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {tx.description ?? SOURCE_LABELS[tx.source] ?? tx.source}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeDate(tx.created_at)}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-xp tabular-nums shrink-0">
                    +{tx.amount} XP
                  </span>
                </div>
              ))}

              {/* Infinite scroll sentinel */}
              <div ref={loadMoreRef} className="pt-2 pb-1">
                {isFetchingNextPage && (
                  <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
                    <ChevronDown className="h-3.5 w-3.5 animate-bounce" />
                    Loading more…
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
