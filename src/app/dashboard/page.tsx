"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { getTelegramInitData } from "@/lib/telegram";
import {
  User,
  Calendar,
  Clock,
  Monitor,
  MapPin,
  ExternalLink,
  Loader2,
  ArrowLeft,
  Pencil,
} from "lucide-react";
import { UserMenu } from "@/components/user-menu";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface UserData {
  id: string;
  role: string;
  expert?: { id: string; isPublished: boolean } | null;
}

interface Booking {
  id: string;
  sessionType: string;
  startTime: string;
  endTime: string;
  status: string;
  meetingLink?: string | null;
  expert?: {
    id: string;
    user: { name: string | null; nickName: string | null };
  };
  founder?: {
    id: string;
    name: string | null;
    nickName: string | null;
  };
}

export default function DashboardPage() {
  const { status: sessionStatus, isTelegram } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!isTelegram && sessionStatus !== "authenticated") {
      setLoading(false);
      return;
    }

    const loadDashboard = async () => {
      const telegramInitData = isTelegram ? getTelegramInitData() : null;
      const tgHeaders = telegramInitData
        ? { "x-telegram-init-data": telegramInitData }
        : undefined;
      const fetchUser = () => fetch("/api/user", { headers: tgHeaders });
      let userRes = await fetchUser();

      // Telegram mini app can occasionally race before cookie is applied.
      // Retry once after re-auth to avoid blank dashboard.
      if (userRes.status === 401 && isTelegram) {
        const webApp = (window as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp;
        const initData = webApp?.initData;
        if (initData) {
          await fetch("/api/auth/telegram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initData }),
          }).catch(() => {});
          userRes = await fetchUser();
        }
      }

      const user = userRes.ok ? await userRes.json() : null;
      setUserData(user);

      if (!user) {
        setBookings([]);
        setLoading(false);
        return;
      }

      const role = user?.expert ? "expert" : "founder";
      const bookingsRes = await fetch(`/api/bookings?role=${role}`, { headers: tgHeaders }).catch(() => null);
      const bookingsData = bookingsRes?.ok ? await bookingsRes.json() : { bookings: [] };
      setBookings(bookingsData?.bookings ?? []);
      setLoading(false);
    };

    loadDashboard().catch(() => {
      setUserData(null);
      setBookings([]);
      setLoading(false);
    });
  }, [sessionStatus, isTelegram]);

  const isExpert = !!userData?.expert;
  const expertId = userData?.expert?.id;

  if (sessionStatus === "loading") {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center p-6">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isTelegram && sessionStatus === "unauthenticated") {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center p-6">
        <Link href="/auth/signin" className="text-sm text-muted-foreground underline">
          Please sign in to view your dashboard
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 p-6">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading dashboard…</p>
      </div>
    );
  }

  const statusVariant = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return "default";
      case "COMPLETED":
        return "secondary";
      case "CANCELLED":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-background">
      <header className="border-b px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <Link
              href="/"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Home
            </Link>
            <h1 className="text-xl font-bold">Dashboard</h1>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="space-y-6 p-4 pb-12">
        {isExpert && (
          <section>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">
              Your Profile
            </h2>
            <Card>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Expert Profile</p>
                    <p className="text-xs text-muted-foreground">
                      {userData?.expert?.isPublished
                        ? "Published"
                        : "Not yet published"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/profile">
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Edit
                    </Link>
                  </Button>
                  {expertId && userData?.expert?.isPublished && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/experts/${expertId}`} target="_blank" rel="noopener noreferrer">
                        Public
                        <ExternalLink className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {isExpert ? (
          <>
            <section>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">
                Upcoming Bookings
              </h2>
              {bookings.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    No upcoming bookings
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {bookings.map((b) => (
                    <BookingCard
                      key={b.id}
                      booking={b}
                      showFounder
                      statusVariant={statusVariant}
                    />
                  ))}
                </div>
              )}
            </section>
            <section>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">
                Manage Availability
              </h2>
              <Card>
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  Coming soon
                </CardContent>
              </Card>
            </section>
          </>
        ) : (
          <>
            <section>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">
                Your Bookings
              </h2>
              {bookings.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="mb-4 text-sm text-muted-foreground">
                      No bookings yet
                    </p>
                    <Button asChild>
                      <Link href="/discover">Find More Experts</Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {bookings.map((b) => (
                    <BookingCard
                      key={b.id}
                      booking={b}
                      statusVariant={statusVariant}
                      showLeaveReview={b.status === "COMPLETED"}
                    />
                  ))}
                </div>
              )}
            </section>
            <section>
              <Button asChild variant="outline" className="w-full" size="lg">
                <Link href="/discover">Find More Experts</Link>
              </Button>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function BookingCard({
  booking,
  showFounder,
  showLeaveReview,
  statusVariant,
}: {
  booking: Booking;
  showFounder?: boolean;
  showLeaveReview?: boolean;
  statusVariant: (s: string) => "default" | "secondary" | "destructive" | "outline";
}) {
  const name = showFounder
    ? booking.founder?.nickName || booking.founder?.name || "Founder"
    : booking.expert?.user?.nickName || booking.expert?.user?.name || "Expert";
  const isOnline = booking.sessionType === "ONLINE";
  const start = parseISO(booking.startTime);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {format(start, "MMM d, yyyy")}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {format(start, "h:mm a")}
              </span>
              <span className="flex items-center gap-1">
                {isOnline ? (
                  <Monitor className="h-3.5 w-3.5" />
                ) : (
                  <MapPin className="h-3.5 w-3.5" />
                )}
                {isOnline ? "Online" : "Offline"}
              </span>
            </div>
            {!isOnline && booking.meetingLink && (
              <p className="mt-1.5 text-xs text-muted-foreground flex items-start gap-1">
                <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                <span>{booking.meetingLink}</span>
              </p>
            )}
          </div>
          <Badge variant={statusVariant(booking.status)}>{booking.status}</Badge>
        </div>
        {showLeaveReview && (
          <>
            <Separator className="my-3" />
            <Button variant="outline" size="sm" asChild>
              <Link href={`/reviews/${booking.id}`}>Leave Review</Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
