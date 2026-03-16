"use client";

import { useCallback, useEffect, useMemo, useState, startTransition } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Monitor,
  MapPin,
  Loader2,
  ArrowLeft,
  Wallet,
  XCircle,
} from "lucide-react";
import { UserMenu } from "@/components/user-menu";
import { useTelegram } from "@/components/telegram-provider";
import { getTelegramInitData } from "@/lib/telegram";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { beginCell } from "@ton/core";
import { format, isSameDay, parseISO, setHours, setMinutes, startOfDay } from "date-fns";
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

interface BookedSlot {
  startTime: string;
  endTime: string;
}

type TimeRange = { start: string; end: string };
type WeeklySchedule = Record<string, TimeRange[]>;

function isSlotBooked(slot: { startTime: string; endTime: string }, bookedSlots: BookedSlot[]): boolean {
  const sStart = new Date(slot.startTime).getTime();
  const sEnd = new Date(slot.endTime).getTime();
  return bookedSlots.some((b) => {
    const bStart = new Date(b.startTime).getTime();
    const bEnd = new Date(b.endTime).getTime();
    return sStart < bEnd && sEnd > bStart;
  });
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function generateSlotsFromSchedule(date: Date, schedule: WeeklySchedule | null): DefaultSlot[] {
  if (!schedule) return [];

  const dayKey = DAY_KEYS[date.getDay()];
  const ranges = schedule?.[dayKey];
  if (!ranges || ranges.length === 0) return [];

  const day = startOfDay(date);
  const slots: DefaultSlot[] = [];
  let slotIdx = 0;

  for (const range of ranges) {
    const [sh, sm] = range.start.split(":").map(Number);
    const [eh, em] = range.end.split(":").map(Number);
    let h = sh;
    let m = sm || 0;

    while (h < eh || (h === eh && m < em)) {
      const start = setMinutes(setHours(day, h), m);
      const nextM = m + 30;
      const endH = h + Math.floor(nextM / 60);
      const endM = nextM % 60;
      const end = endH < eh || (endH === eh && endM <= em)
        ? setMinutes(setHours(day, endH), endM)
        : setMinutes(setHours(day, eh), em);

      if (end > start) {
        slots.push({
          id: `sched-${slotIdx++}`,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        });
      }

      h = endH;
      m = endM;
    }
  }

  return slots;
}

export default function BookSessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
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
  const [meetingLink, setMeetingLink] = useState("");
  const [expertPricing, setExpertPricing] = useState<{
    priceOnlineCents: number | null;
    priceOfflineCents: number | null;
    currency: string;
    expertName: string;
  } | null>(null);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule | null>(null);
  const [tonConnectUI] = useTonConnectUI();
  const tonWallet = useTonWallet();
  const [tonPending, setTonPending] = useState<{
    bookingId: string;
    depositTON: string;
    depositSGD: string;
  } | null>(null);

  const timezone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC";

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const isDateDisabled = useCallback(
    (date: Date) => date < todayStart,
    [todayStart]
  );

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
        if (data.weeklySchedule) {
          setWeeklySchedule(data.weeklySchedule as WeeklySchedule);
        }
      })
      .catch(() => {});
  }, [expertId]);

  const pricePerHour =
    sessionType === "OFFLINE"
      ? expertPricing?.priceOfflineCents
      : expertPricing?.priceOnlineCents;

  const slotDurationMinutes = selectedSlot
    ? Math.max(
        30,
        Math.round(
          (new Date(selectedSlot.endTime).getTime() -
            new Date(selectedSlot.startTime).getTime()) /
            (60 * 1000)
        )
      )
    : 30;

  const totalCents = pricePerHour ? Math.round(pricePerHour * slotDurationMinutes / 60) : 0;
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
        const booked: BookedSlot[] = data?.bookedSlots ?? [];
        const now = new Date();

        // Explicit AvailableSlot records for this date
        const explicitSlots = list.filter(
          (s: AvailableSlot) => isSameDay(parseISO(s.startTime), selectedDate) && !s.isBooked
        );

        if (explicitSlots.length > 0) {
          setSlots(explicitSlots.filter((s: AvailableSlot) => !isSlotBooked(s, booked)));
        } else {
          const schedSlots = generateSlotsFromSchedule(selectedDate, weeklySchedule).filter(
            (s) => new Date(s.startTime) > now && !isSlotBooked(s, booked)
          );
          setSlots(schedSlots);
        }
      })
      .catch(() => {
        if (!cancelled) {
          const now = new Date();
          const schedSlots = generateSlotsFromSchedule(selectedDate, weeklySchedule).filter(
            (s) => new Date(s.startTime) > now
          );
          setSlots(schedSlots);
        }
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [expertId, selectedDate, weeklySchedule]);

  const bookingPayload = () => ({
    expertId,
    sessionType,
    startTime: selectedSlot!.startTime,
    endTime: selectedSlot!.endTime,
    timezone,
    ...(sessionType === "ONLINE" && { meetingLink: meetingLink.trim() }),
    ...(sessionType === "OFFLINE" && { offlineAddress: offlineAddress.trim() }),
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

  const handleTONPayment = async () => {
    setSubmitting(true);
    setError(null);
    let createdBookingId: string | null = null;
    try {
      // Connect wallet if not already connected
      if (!tonWallet) {
        await tonConnectUI.openModal();
        setSubmitting(false);
        return;
      }

      const telegramInitData = getTelegramInitData();
      const res = await fetch("/api/bookings/ton-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(telegramInitData ? { "x-telegram-init-data": telegramInitData } : {}),
        },
        body: JSON.stringify(bookingPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Failed to create TON payment");

      createdBookingId = data.bookingId;
      setTonPending({
        bookingId: data.bookingId,
        depositTON: data.depositTON,
        depositSGD: data.depositSGD,
      });

      const commentCell = beginCell()
        .storeUint(0, 32)
        .storeStringTail(data.comment)
        .endCell();

      console.log("[TON] walletAddress from API:", JSON.stringify(data.walletAddress), "len:", data.walletAddress?.length);

      const payload = commentCell.toBoc().toString("base64");
      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [
          {
            address: data.walletAddress,
            amount: data.amountNanoTON,
            payload,
          },
        ],
      };
      console.log("[TON] transaction:", JSON.stringify(transaction));

      const result = await tonConnectUI.sendTransaction(transaction);

      // Transaction signed — confirm booking with BOC proof
      const confirmRes = await fetch("/api/bookings/ton-confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(telegramInitData ? { "x-telegram-init-data": telegramInitData } : {}),
        },
        body: JSON.stringify({
          bookingId: data.bookingId,
          boc: result.boc,
        }),
      });
      const confirmData = await confirmRes.json();
      if (!confirmRes.ok) throw new Error(confirmData.error ?? "Confirmation failed");

      router.push("/booking");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      if (msg.includes("declined") || msg.includes("cancel")) {
        if (createdBookingId) {
          const telegramInitData = getTelegramInitData();
          fetch(`/api/bookings/${createdBookingId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              ...(telegramInitData ? { "x-telegram-init-data": telegramInitData } : {}),
            },
            body: JSON.stringify({ action: "cancel", reason: "Wallet declined" }),
          }).catch(() => {});
        }
        setError("Payment was cancelled");
        setTonPending(null);
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleTonCancel = async () => {
    if (!tonPending) return;
    try {
      const telegramInitData = getTelegramInitData();
      await fetch(`/api/bookings/${tonPending.bookingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(telegramInitData ? { "x-telegram-init-data": telegramInitData } : {}),
        },
        body: JSON.stringify({ action: "cancel", reason: "Payment not completed" }),
      });
    } catch {
      // best-effort cancel
    }
    setTonPending(null);
  };

  const handleConfirm = () => {
    if (!selectedSlot || !expertId) return;
    if (sessionType === "ONLINE" && !meetingLink.trim()) {
      setError("Please enter a meeting link for online sessions.");
      return;
    }
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
    (sessionType === "ONLINE" ? meetingLink.trim().length > 0 : offlineAddress.trim().length > 0);

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
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

        {sessionType === "ONLINE" && (
          <section>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">
              Meeting link <span className="text-destructive">*</span>
            </h2>
            <Input
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              placeholder="https://zoom.us/j/... or https://meet.google.com/..."
              className="min-h-[44px]"
            />
          </section>
        )}

        {sessionType === "OFFLINE" && (
          <section>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">
              Meeting address <span className="text-destructive">*</span>
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
              onSelect={(d) => startTransition(() => setSelectedDate(d))}
              disabled={isDateDisabled}
            />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Available times
          </h2>
          <p className="mb-2 text-xs text-muted-foreground">
            Times shown in {timezone} · 30 min per session
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
              No available slots for this date. Try another date.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {slots.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => startTransition(() => setSelectedSlot(slot))}
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
                &times; {slotDurationMinutes} min
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

        {tonPending && !submitting ? (
          <div className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
            <div className="text-center space-y-1">
              <Loader2 className="h-8 w-8 mx-auto text-indigo-600 animate-spin" />
              <h3 className="font-semibold text-base">Waiting for payment</h3>
              <p className="text-sm text-muted-foreground">
                <span className="font-mono font-bold">{tonPending.depositTON} TON</span>{" "}
                (≈ SGD {tonPending.depositSGD})
              </p>
              <p className="text-xs text-muted-foreground">
                Approve the transaction in your wallet
              </p>
            </div>
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground gap-1" onClick={handleTonCancel}>
              <XCircle className="h-4 w-4" />
              Cancel
            </Button>
          </div>
        ) : isTelegram && totalCents > 0 ? (
          <div className="space-y-2">
            <Button
              size="lg"
              className="w-full min-h-[52px] text-base font-semibold gap-2"
              disabled={!canConfirm}
              onClick={handleTONPayment}
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : !tonWallet ? (
                <>
                  <Wallet className="h-5 w-5" />
                  Connect Wallet to Pay
                </>
              ) : (
                <>
                  <Wallet className="h-5 w-5" />
                  Pay with TON — {expertPricing?.currency || "SGD"}{" "}
                  {(depositCents / 100).toFixed(2)}
                </>
              )}
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
