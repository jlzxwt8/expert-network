"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Monitor,
  MapPin,
  Loader2,
} from "lucide-react";
import { format, isSameDay, parseISO } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SessionType = "ONLINE" | "OFFLINE";

interface AvailableSlot {
  id: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
}

export default function BookSessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const expertId = params.id as string;

  const [sessionType, setSessionType] = useState<SessionType>("ONLINE");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timezone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC";

  const typeFromUrl = searchParams.get("type");
  useEffect(() => {
    if (typeFromUrl === "ONLINE" || typeFromUrl === "OFFLINE") {
      setSessionType(typeFromUrl);
    }
  }, [typeFromUrl]);

  const updateTypeParam = useCallback(
    (type: SessionType) => {
      const url = new URL(window.location.href);
      url.searchParams.set("type", type);
      window.history.replaceState({}, "", url.toString());
    },
    []
  );

  const handleSessionTypeChange = (type: SessionType) => {
    setSessionType(type);
    setSelectedSlot(null);
    updateTypeParam(type);
  };

  useEffect(() => {
    if (!expertId || !selectedDate) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    setSlots([]);
    setSelectedSlot(null);
    fetch(`/api/experts/${expertId}/slots`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : data?.slots ?? [];
        const forDate = list.filter((s: AvailableSlot) =>
          isSameDay(parseISO(s.startTime), selectedDate)
        );
        setSlots(forDate);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [expertId, selectedDate]);

  const handleConfirm = async () => {
    if (!selectedSlot || !expertId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expertId,
          sessionType,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
          timezone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to book");
      }
      router.push(`/bookings/${data.id}/success`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const canConfirm = !!selectedDate && !!selectedSlot && !submitting;

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Link
          href={`/experts/${expertId}`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Back to expert profile"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold">Book a Session</h1>
      </header>

      <main className="space-y-6 p-4 pb-8">
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Session type
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleSessionTypeChange("ONLINE")}
              className={cn(
                "flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors",
                sessionType === "ONLINE"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              <Monitor className="h-4 w-4" />
              Online
            </button>
            <button
              type="button"
              onClick={() => handleSessionTypeChange("OFFLINE")}
              className={cn(
                "flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors",
                sessionType === "OFFLINE"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              <MapPin className="h-4 w-4" />
              Offline
            </button>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Select date
          </h2>
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
            />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Available times
          </h2>
          <p className="mb-2 text-xs text-muted-foreground">
            Times shown in {timezone}
          </p>
          {!selectedDate ? (
            <p className="rounded-lg border border-dashed border-muted-foreground/30 py-8 text-center text-sm text-muted-foreground">
              Select a date to see available slots
            </p>
          ) : slotsLoading ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Loading slots…
              </span>
            </div>
          ) : slots.length === 0 ? (
            <p className="rounded-lg border border-dashed border-muted-foreground/30 py-8 text-center text-sm text-muted-foreground">
              No available slots for this date
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {slots.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  className={cn(
                    "min-h-[48px] rounded-lg border text-sm font-medium transition-colors",
                    selectedSlot?.id === slot.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-muted/50 hover:bg-muted"
                  )}
                >
                  {format(parseISO(slot.startTime), "h:mm a")}
                </button>
              ))}
            </div>
          )}
        </section>

        {error && (
          <p className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button
          size="lg"
          className="w-full min-h-[52px] text-base font-semibold"
          disabled={!canConfirm}
          onClick={handleConfirm}
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Booking…
            </>
          ) : (
            "Confirm Booking"
          )}
        </Button>
      </main>
    </div>
  );
}
