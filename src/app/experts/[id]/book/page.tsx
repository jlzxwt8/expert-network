"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Monitor,
  MapPin,
  Loader2,
} from "lucide-react";
import { format, isSameDay, parseISO, setHours, setMinutes, addHours, startOfDay } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SessionType = "ONLINE" | "OFFLINE";

interface AvailableSlot {
  id: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
}

interface DefaultSlot {
  id: string;
  startTime: string;
  endTime: string;
}

function generateDefaultSlots(date: Date): DefaultSlot[] {
  const day = startOfDay(date);
  const slots: DefaultSlot[] = [];
  for (let hour = 10; hour < 18; hour++) {
    const start = setMinutes(setHours(day, hour), 0);
    const end = addHours(start, 1);
    slots.push({
      id: `default-${hour}`,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    });
  }
  return slots;
}

export default function BookSessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const expertId = params.id as string;

  const [sessionType, setSessionType] = useState<SessionType>("ONLINE");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedSlot, setSelectedSlot] = useState<DefaultSlot | AvailableSlot | null>(null);
  const [slots, setSlots] = useState<(DefaultSlot | AvailableSlot)[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offlineAddress, setOfflineAddress] = useState("");

  const timezone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC";

  const typeFromUrl = searchParams.get("type");
  const fromDiscover = searchParams.get("from");
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

        if (forDate.length > 0) {
          setSlots(forDate);
        } else {
          const now = new Date();
          const defaultSlots = generateDefaultSlots(selectedDate).filter(
            (s) => new Date(s.startTime) > now
          );
          setSlots(defaultSlots);
        }
      })
      .catch(() => {
        if (!cancelled) {
          const now = new Date();
          const defaultSlots = generateDefaultSlots(selectedDate).filter(
            (s) => new Date(s.startTime) > now
          );
          setSlots(defaultSlots);
        }
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
    if (sessionType === "OFFLINE" && !offlineAddress.trim()) {
      setError("Please enter a meeting address for offline sessions.");
      return;
    }
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
          ...(sessionType === "OFFLINE" && { meetingLink: offlineAddress.trim() }),
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

  const canConfirm =
    !!selectedDate &&
    !!selectedSlot &&
    !submitting &&
    (sessionType === "ONLINE" || offlineAddress.trim().length > 0);

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <button
          onClick={() => {
            if (fromDiscover) {
              router.back();
            } else {
              router.push(`/experts/${expertId}`);
            }
          }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
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

        {sessionType === "OFFLINE" && (
          <section>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">
              Meeting address
            </h2>
            <Input
              value={offlineAddress}
              onChange={(e) => setOfflineAddress(e.target.value)}
              placeholder="Enter the meeting location or address"
              className="min-h-[44px]"
            />
          </section>
        )}

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
            Times shown in {timezone} · 1 hour per session
          </p>
          {!selectedDate ? (
            <p className="rounded-lg border border-dashed border-muted-foreground/30 py-8 text-center text-sm text-muted-foreground">
              Select a date to see available slots
            </p>
          ) : slotsLoading ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Loading slots...
              </span>
            </div>
          ) : slots.length === 0 ? (
            <p className="rounded-lg border border-dashed border-muted-foreground/30 py-8 text-center text-sm text-muted-foreground">
              No available slots for this date
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
              Booking...
            </>
          ) : (
            "Confirm Booking"
          )}
        </Button>
      </main>
    </div>
  );
}
