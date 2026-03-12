"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type TimeRange = { start: string; end: string };
export type WeeklySchedule = Record<string, TimeRange[]>;

const DAYS = [
  { key: "sun", label: "Su" },
  { key: "mon", label: "Mo" },
  { key: "tue", label: "Tu" },
  { key: "wed", label: "We" },
  { key: "thu", label: "Th" },
  { key: "fri", label: "Fr" },
  { key: "sat", label: "Sa" },
];

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    const hh = h.toString().padStart(2, "0");
    const mm = m.toString().padStart(2, "0");
    TIME_OPTIONS.push(`${hh}:${mm}`);
  }
}

function formatTime12(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr || "00";
  if (h === 0) return `12:${m} AM`;
  if (h < 12) return `${h}:${m} AM`;
  if (h === 12) return `12:${m} PM`;
  return `${h - 12}:${m} PM`;
}

interface Props {
  schedule: WeeklySchedule;
  onSave: (s: WeeklySchedule) => Promise<void>;
  compact?: boolean;
  showHeader?: boolean;
  showHint?: boolean;
}

export function WeeklyScheduleEditor({
  schedule,
  onSave,
  compact = false,
  showHeader = true,
  showHint = true,
}: Props) {
  const [local, setLocal] = useState<WeeklySchedule>(schedule);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setLocal(schedule);
  }, [schedule]);

  const update = (day: string, ranges: TimeRange[]) => {
    const next = { ...local, [day]: ranges };
    if (ranges.length === 0) delete next[day];
    setLocal(next);
    setDirty(true);
  };

  const addRange = (day: string) => {
    const existing = local[day] || [];
    const lastEnd = existing.length > 0 ? existing[existing.length - 1].end : "09:00";
    const [h] = lastEnd.split(":");
    const startH = Math.min(parseInt(h, 10) + 1, 23);
    const newStart = `${startH.toString().padStart(2, "0")}:00`;
    const endH = Math.min(startH + 1, 23);
    const newEnd = `${endH.toString().padStart(2, "0")}:00`;
    update(day, [...existing, { start: newStart, end: newEnd }]);
  };

  const removeRange = (day: string, idx: number) => {
    const ranges = [...(local[day] || [])];
    ranges.splice(idx, 1);
    update(day, ranges);
  };

  const updateRange = (day: string, idx: number, field: "start" | "end", value: string) => {
    const ranges = [...(local[day] || [])];
    ranges[idx] = { ...ranges[idx], [field]: value };
    update(day, ranges);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(local);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {showHeader && (
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Weekly Availability</h2>
          {dirty && (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Save
            </Button>
          )}
        </div>
      )}

      <Card>
        <CardContent className="p-0 divide-y">
          {DAYS.map(({ key, label }) => {
            const ranges = local[key] || [];
            return (
              <div key={key} className={`flex items-start gap-3 px-4 ${compact ? "py-2" : "py-3"}`}>
                <div
                  className={`flex ${compact ? "h-8 w-8 text-xs" : "h-9 w-9 text-sm"} shrink-0 items-center justify-center rounded-full font-semibold ${
                    ranges.length > 0
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {label}
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  {ranges.length === 0 ? (
                    <div className={`flex ${compact ? "h-8" : "h-9"} items-center`}>
                      <span className="text-sm text-muted-foreground/60">Unavailable</span>
                    </div>
                  ) : (
                    ranges.map((r, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <select
                          className={`${compact ? "h-8 text-xs" : "h-9 text-sm"} rounded-md border bg-background px-2 min-w-[80px]`}
                          value={r.start}
                          onChange={(e) => updateRange(key, i, "start", e.target.value)}
                        >
                          {TIME_OPTIONS.map((t) => (
                            <option key={t} value={t}>{formatTime12(t)}</option>
                          ))}
                        </select>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <select
                          className={`${compact ? "h-8 text-xs" : "h-9 text-sm"} rounded-md border bg-background px-2 min-w-[80px]`}
                          value={r.end}
                          onChange={(e) => updateRange(key, i, "end", e.target.value)}
                        >
                          {TIME_OPTIONS.map((t) => (
                            <option key={t} value={t}>{formatTime12(t)}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => removeRange(key, i)}
                          className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <button
                  onClick={() => addRange(key)}
                  className={`flex ${compact ? "h-8 w-8" : "h-9 w-9"} shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors`}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {showHint && (
        <p className="mt-2 text-xs text-muted-foreground">
          Set your recurring weekly availability. Founders will see these times when booking.
        </p>
      )}

      {!showHeader && dirty && (
        <Button onClick={handleSave} disabled={saving} className="mt-3 w-full min-h-[44px] bg-indigo-600 hover:bg-indigo-700">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save Availability
        </Button>
      )}
    </div>
  );
}
