import { redirect } from "next/navigation";
import Link from "next/link";
import { Dumbbell, Brain, Sparkles, LayoutGrid, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { clamp } from "@/lib/utils";
import { getXpThresholdForLevel } from "@/lib/economy/levels";
import type { PillarSlug } from "@/types/database.types";

const ACTIVE_PILLARS: Array<{
  slug: PillarSlug;
  label: string;
  icon: React.ElementType;
}> = [
  { slug: "body", label: "Body", icon: Dumbbell },
  { slug: "mind", label: "Mind", icon: Brain },
  { slug: "spirit", label: "Spirit", icon: Sparkles },
  { slug: "structure", label: "Structure", icon: LayoutGrid },
];

const LOCKED_PILLARS = [
  { label: "Leverage" },
  { label: "Agency" },
];

export default async function PillarsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: pillarDefs }, { data: userPillars }] = await Promise.all([
    supabase
      .from("pillars")
      .select("id, slug")
      .in(
        "slug",
        ACTIVE_PILLARS.map((p) => p.slug)
      ),
    supabase
      .from("user_pillars")
      .select("pillar_id, level, xp_total, xp_current")
      .eq("user_id", user.id),
  ]);

  const pillarIdBySlug = new Map(
    (pillarDefs ?? []).map((p) => [p.slug as string, p.id])
  );
  const xpByPillarId = new Map(
    (userPillars ?? []).map((p) => [p.pillar_id, p])
  );

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Pillars</h1>
      <div className="grid grid-cols-2 gap-3">
        {ACTIVE_PILLARS.map(({ slug, label, icon: Icon }) => {
          const pillarId = pillarIdBySlug.get(slug);
          const up = pillarId !== undefined ? xpByPillarId.get(pillarId) : undefined;
          const level = up?.level ?? 1;
          const xpCurrent = up?.xp_current ?? 0;
          const xpForNext = getXpThresholdForLevel(level);
          const xpPct = clamp((xpCurrent / xpForNext) * 100, 0, 100);

          return (
            <Link key={slug} href={`/pillars/${slug}`}>
              <Card className="hover:border-primary/50 transition-colors">
                <CardContent className="pt-5 pb-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
                    <Badge variant="secondary" className="text-xs">
                      Lv {level}
                    </Badge>
                  </div>
                  <p className="font-semibold text-sm">{label}</p>
                  <div className="space-y-1">
                    <div
                      className="h-1.5 w-full rounded-full bg-secondary overflow-hidden"
                      role="progressbar"
                      aria-valuenow={xpCurrent}
                      aria-valuemax={xpForNext}
                      aria-label={`${label} XP: ${xpCurrent} of ${xpForNext}`}
                    >
                      <div
                        className="h-full rounded-full bg-xp transition-all duration-500"
                        style={{ width: `${xpPct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {xpCurrent} / {xpForNext} XP
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}

        {LOCKED_PILLARS.map(({ label }) => (
          <div key={label} className="opacity-40">
            <Card className="cursor-not-allowed select-none">
              <CardContent className="pt-5 pb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Lock className="h-5 w-5 text-muted-foreground" aria-hidden />
                  <Badge variant="outline" className="text-xs">
                    Locked
                  </Badge>
                </div>
                <p className="font-semibold text-sm">{label}</p>
                <p className="text-[10px] text-muted-foreground">Coming soon</p>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
