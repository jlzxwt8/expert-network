"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Booking {
  id: string;
  status: string;
  expert: {
    user: {
      name: string | null;
      nickName: string | null;
    };
  };
}

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const { status: sessionStatus } = useSession();
  const bookingId = params.bookingId as string;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.replace(`/auth/signin?callbackUrl=${encodeURIComponent(`/reviews/${bookingId}`)}`);
      return;
    }
    if (sessionStatus !== "authenticated") return;

    fetch("/api/bookings")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((data) => {
        const list = data?.bookings ?? [];
        const found = list.find((b: { id: string }) => b.id === bookingId);
        setBooking(found ?? null);
      })
      .catch(() => setBooking(null))
      .finally(() => setLoading(false));
  }, [sessionStatus, bookingId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          rating,
          comment: comment.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 400 && data.error?.includes("already been reviewed")) {
          setAlreadyReviewed(true);
        } else {
          throw new Error(data.error ?? "Failed to submit review");
        }
        return;
      }
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (sessionStatus === "loading" || sessionStatus === "unauthenticated") {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center p-6">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 p-6">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 p-6">
        <p className="text-center text-muted-foreground">
          Booking not found or you don&apos;t have access to it.
        </p>
        <Button asChild>
          <Link href="/discover">Back to Discovery</Link>
        </Button>
      </div>
    );
  }

  const expertName =
    booking.expert?.user?.nickName || booking.expert?.user?.name || "Expert";

  if (submitted) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 p-6">
        <h1 className="text-2xl font-bold">Thank you!</h1>
        <p className="text-center text-muted-foreground">
          Your review has been submitted. We appreciate your feedback.
        </p>
        <Button asChild size="lg">
          <Link href="/discover">Back to Discovery</Link>
        </Button>
      </div>
    );
  }

  if (alreadyReviewed) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 p-6">
        <h1 className="text-xl font-semibold">
          You&apos;ve already reviewed this session
        </h1>
        <p className="text-center text-muted-foreground">
          Thank you for your feedback.
        </p>
        <Button asChild size="lg">
          <Link href="/discover">Back to Discovery</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-background">
      <main className="flex flex-col px-6 py-10">
        <h1 className="mb-2 text-2xl font-bold">How was your session?</h1>
        <p className="mb-8 text-muted-foreground">{expertName}</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <p className="mb-3 text-sm font-medium">Rating</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  onMouseEnter={() => setHoverRating(value)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-lg border border-input transition-colors hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label={`Rate ${value} star${value > 1 ? "s" : ""}`}
                >
                  <Star
                    className={cn(
                      "h-8 w-8 transition-colors",
                      (hoverRating || rating) >= value
                        ? "fill-amber-400 text-amber-500"
                        : "text-muted-foreground"
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="comment" className="mb-2 block text-sm font-medium">
              Share your experience (optional but encouraged)
            </label>
            <Textarea
              id="comment"
              placeholder="What did you find most valuable? Any suggestions?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[120px] resize-none"
              rows={4}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full min-h-[52px]"
            disabled={rating < 1 || submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Submitting…
              </>
            ) : (
              "Submit Review"
            )}
          </Button>
        </form>
      </main>
    </div>
  );
}
