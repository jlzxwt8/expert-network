"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Monitor,
  MapPin,
  Loader2,
  ArrowLeft,
  CreditCard,
  Wallet,
} from "lucide-react";
import { UserMenu } from "@/components/user-menu";
import { useTelegram } from "@/components/telegram-provider";
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
  const { isTelegram } = useTelegram();
  const expertId = params.id as string;

  const [sessionType, setSessionType] = useState<SessionType>("ONLINE");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedSlot, setSelectedSlot] = useState<DefaultSlot | AvailableSlot | null>(null);
  const [slots, setSlots] = useState<(DefaultSlot | AvailableSlot)[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offlineAddress, setOfflineAddress] = useState("");
  const [expertPricing, setExpertPricing] = useState<{
    priceOnlineCents: number | null;
    priceOfflineCents: number | null;
    currency: string;
    expertName: string;
  } | null>(null);

  const timezone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC";

  useEffect(() => {
    if (!expertId) return;
    fetch(`/api/experts/${expertId}`)
      .then((r) => r.json())
      .then((data) => {
        setExpertPricing({
          priceOnlineCents: data.priceOnlineCents ?? null,
          priceOfflineCents: data.priceOfflineCents ?? null,
          currency: data.currency ?? "SGD",
          expertName: data.user?.nickName || data.user?.name || "Expert",
        });
      })
      .catch(() => {});
  }, [expertId]);

  const pricePerHour =
    sessionType === "OFFLINE"
      ? expertPricing?.priceOfflineCents
      : expertPricing?.priceOnlineCents;

  const slotDurationHours = selectedSlot
    ? Math.max(
        1,
        Math.ceil(
          (new Date(selectedSlot.endTime).getTime() -
            new Date(selectedSlot.startTime).getTime()) /
            (60 * 60 * 1000)
        )
      )
    : 1;

  const totalCents = pricePerHour ? pricePerHour * slotDurationHours : 0;
  const depositCents = Math.ceil(totalCents / 2);
  const remainderCents = totalCents - depositCents;

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

  const bookingPayload = () => ({
    expertId,
    sessionType,
    startTime: selectedSlot!.startTime,
    endTime: selectedSlot!.endTime,
    timezone,
    ...(sessionType === "OFFLINE" && { meetingLink: offlineAddress.trim() }),
  });

  const handleStripeCheckout = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Failed to create checkout");
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  const handleTelegramCardPayment = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings/telegram-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create invoice");
      if (data.invoiceUrl) {
        window.location.href = data.invoiceUrl;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  const handleTONPayment = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings/ton-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create TON payment");
      if (data.tonLink) {
        window.location.href = data.tonLink;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  const handleConfirm = () => {
    if (!selectedSlot || !expertId) return;
    if (sessionType === "OFFLINE" && !offlineAddress.trim()) {
      setError("Please enter a meeting address for offline sessions.");
      return;
    }
    if (!pricePerHour || pricePerHour <= 0) {
      setError("Expert has not set pricing for this session type.");
      return;
    }
    // On web: use Stripe; in Telegram: handled by separate buttons
    if (!isTelegram) {
      handleStripeCheckout();
    }
  };

  const canConfirm =
    !!selectedDate &&
    !!selectedSlot &&
    !submitting &&
    (sessionType === "ONLINE" || offlineAddress.trim().length > 0);

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between">
          <div>
            <Link
              href="/"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Home
            </Link>
            <h1 className="text-lg font-semibold">Book a Session</h1>
          </div>
          <UserMenu />
        </div>
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

        {selectedSlot && totalCents > 0 && (
          <section className="rounded-xl border-2 border-indigo-100 bg-indigo-50/50 p-4 space-y-2">
            <h3 className="font-semibold text-sm">Payment Summary</h3>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {expertPricing?.currency || "SGD"} {((pricePerHour || 0) / 100).toFixed(2)}/hr
                &times; {slotDurationHours}h
              </span>
              <span className="font-medium">
                {expertPricing?.currency || "SGD"} {(totalCents / 100).toFixed(2)}
              </span>
            </div>
            <hr className="border-indigo-200" />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Deposit (50%) — due now</span>
              <span className="font-bold text-indigo-700">
                {expertPricing?.currency || "SGD"} {(depositCents / 100).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Remainder — charged 24h after session</span>
              <span className="text-muted-foreground">
                {expertPricing?.currency || "SGD"} {(remainderCents / 100).toFixed(2)}
              </span>
            </div>
          </section>
        )}

        {error && (
          <p className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {isTelegram && totalCents > 0 ? (
          <div className="space-y-2">
            <Button
              size="lg"
              className="w-full min-h-[52px] text-base font-semibold gap-2"
              disabled={!canConfirm}
              onClick={handleTelegramCardPayment}
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <CreditCard className="h-5 w-5" />
                  Pay with Card — {expertPricing?.currency || "SGD"}{" "}
                  {(depositCents / 100).toFixed(2)}
                </>
              )}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full min-h-[52px] text-base font-semibold gap-2"
              disabled={!canConfirm}
              onClick={handleTONPayment}
            >
              <Wallet className="h-5 w-5" />
              Pay with TON
            </Button>
          </div>
        ) : (
          <Button
            size="lg"
            className="w-full min-h-[52px] text-base font-semibold"
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Redirecting to payment...
              </>
            ) : totalCents > 0 ? (
              `Pay Deposit — ${expertPricing?.currency || "SGD"} ${(depositCents / 100).toFixed(2)}`
            ) : (
              "Confirm Booking"
            )}
          </Button>
        )}
      </main>
    </div>
  );
}
