import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatDay,
  heatLevel,
  heatmapColumns,
  RANGES,
  type DayPoint,
  type RangeKey,
  type RangeStats,
} from "@/lib/contributions";
import { cn } from "@/lib/utils";
import { ChartTooltip, HEAT } from "./charts";

export type GraphKind = "github" | "local";

// Cells stretch to fill the card width (up to MAX_W) but keep a fixed height (CELL_H) so the section stays compact.
const MAX_W: Record<RangeKey, number> = { "30": 72, "90": 44, "365": 40 };
const CELL_H: Record<RangeKey, number> = { "30": 26, "90": 18, "365": 15 };
const MIN_CELL = 11;
const LABEL_COL = 34; // weekday labels + gap
const GAP = 3;

function Heatmap({
  stats,
  range,
  noun,
}: {
  stats: RangeStats;
  range: RangeKey;
  noun: string;
}) {
  const cols = useMemo(() => heatmapColumns(stats), [stats]);
  const max = Math.max(0, ...stats.days.map((d) => d.count));
  const [width, setWidth] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{
    day: DayPoint;
    x: number;
    y: number;
  } | null>(null);

  // Fit square cells to the available width; below MIN_CELL the grid scrolls instead.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const fit =
    width > 0
      ? Math.floor(
          (width - LABEL_COL - GAP * cols.length) / Math.max(1, cols.length),
        )
      : MIN_CELL;
  const size = Math.max(MIN_CELL, Math.min(MAX_W[range], fit)); // cell width
  const cellH = Math.min(size, CELL_H[range]);

  // Most recent weeks first on narrow screens
  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [cols, size]);

  const monthLabels = useMemo(() => {
    let last = "";
    return cols.map((col) => {
      const first = col.find(Boolean);
      const m = first ? formatDay(first.date, { month: "short" }) : "";
      if (m && m !== last) {
        last = m;
        return m;
      }
      return "";
    });
  }, [cols]);

  const showTip = (day: DayPoint, el: HTMLElement) => {
    const wrap = wrapRef.current?.getBoundingClientRect();
    const cell = el.getBoundingClientRect();
    if (wrap)
      setTip({
        day,
        x: cell.left - wrap.left + cell.width / 2,
        y: cell.top - wrap.top - 4,
      });
  };

  return (
    <div ref={wrapRef} className="relative min-w-0">
      <div
        ref={scrollRef}
        className="overflow-x-auto pb-1"
        onMouseLeave={() => setTip(null)}
      >
        <div className="flex w-max gap-2">
          <div
            className="text-muted-foreground grid pr-0.5 text-right text-[0.62rem]"
            style={{
              gridTemplateRows: `repeat(7, ${cellH}px)`,
              gap: GAP,
              paddingTop: 16,
              lineHeight: `${cellH}px`,
            }}
          >
            {["", "Mon", "", "Wed", "", "Fri", ""].map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <div>
            <div className="mb-1 flex h-3" style={{ gap: GAP }}>
              {monthLabels.map((label, i) => (
                <div
                  key={i}
                  className="text-muted-foreground shrink-0 overflow-visible text-[0.62rem] whitespace-nowrap"
                  style={{ width: size }}
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="flex" style={{ gap: GAP }}>
              {cols.map((col, c) => (
                <div
                  key={c}
                  className="grid"
                  style={{
                    gridTemplateRows: `repeat(7, ${cellH}px)`,
                    gap: GAP,
                  }}
                >
                  {col.map((day, r) =>
                    day ? (
                      <div
                        key={r}
                        onMouseEnter={(e) => showTip(day, e.currentTarget)}
                        className={cn(
                          "text-foreground/70 flex items-center justify-center rounded-[3px] text-[0.65rem] font-medium tabular-nums transition-transform hover:scale-110",
                          day.date === stats.end &&
                            "ring-foreground/40 ring-offset-card ring-1 ring-offset-1",
                        )}
                        style={{
                          width: size,
                          height: cellH,
                          backgroundColor: HEAT[heatLevel(day.count, max)],
                        }}
                      >
                        {range === "30" && day.count > 0 ? day.count : null}
                      </div>
                    ) : (
                      <div key={r} style={{ width: size, height: cellH }} />
                    ),
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {tip && (
        <ChartTooltip style={{ left: tip.x, top: tip.y }}>
          <span className="font-semibold tabular-nums">{tip.day.count}</span>{" "}
          {noun} ·{" "}
          {formatDay(tip.day.date, {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </ChartTooltip>
      )}
      <div className="text-muted-foreground mt-2 flex items-center gap-1 text-[0.62rem]">
        Less
        {HEAT.map((c) => (
          <span
            key={c}
            className="size-2.5 rounded-[2px]"
            style={{ backgroundColor: c }}
          />
        ))}
        More
      </div>
    </div>
  );
}

export default function ContributionCalendar({
  stats,
  loading,
  kind,
  range,
  username,
}: {
  stats: RangeStats | null;
  loading: boolean;
  kind: GraphKind;
  range: RangeKey;
  username?: string;
}) {
  const noun = kind === "github" ? "contributions" : "commits";

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="size-4" /> Contribution activity
        </CardTitle>
        <CardDescription>
          {loading || !stats ? (
            "Loading activity…"
          ) : (
            <>
              <strong className="text-foreground tabular-nums">
                {stats.total}
              </strong>{" "}
              {noun} in the {RANGES[range].long}
              {kind === "github" && username && <> · @{username}</>}
              {kind === "local" && <> · across your local repos</>}
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-36 w-full" />
        ) : !stats ? (
          <p className="text-muted-foreground py-2 text-sm">
            Contribution data unavailable. Ensure your git config is set or
            GitHub CLI is authenticated.
          </p>
        ) : (
          <Heatmap stats={stats} range={range} noun={noun} />
        )}
      </CardContent>
    </Card>
  );
}
