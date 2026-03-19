"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Rocket,
  Sparkles,
  TrendingUp,
  ArrowRight,
  Users,
  MessageSquare,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";
import { useTelegram } from "@/components/telegram-provider";
import { useAuth } from "@/hooks/use-auth";
import { getTelegramInitData } from "@/lib/telegram";

export function HomeContent() {
  const { isTelegram } = useTelegram();
  const { status, user } = useAuth();
  const [hasExpert, setHasExpert] = useState<boolean | null>(null);
  const [expertLoading, setExpertLoading] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (status !== "authenticated" && !isTelegram) return;

    setExpertLoading(true);
    const headers: Record<string, string> = {};
    const initData = getTelegramInitData();
    if (initData) headers["x-telegram-init-data"] = initData;

    fetch("/api/user", { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setHasExpert(!!data?.expert))
      .catch(() => setHasExpert(false))
      .finally(() => setExpertLoading(false));
  }, [status, isTelegram, user?.id]);

  const isLoggedIn = status === "authenticated" || isTelegram;
  const showExpertLoading = expertLoading || (isLoggedIn && hasExpert === null);

  return (
    <div className="min-h-screen w-full max-w-lg mx-auto flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 px-6 pt-12 pb-16 md:pt-16 md:pb-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-slate-500/10 via-transparent to-transparent" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-indigo-400" />
              <span className="text-sm font-medium text-indigo-300 uppercase tracking-wider">
                Help&amp;Grow
              </span>
            </div>
            <UserMenu variant="light" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-4">
            Grow Your AI Startup in Singapore &amp; Southeast Asia
          </h1>
          <p className="text-lg text-slate-300 mb-8 max-w-md">
            The platform where AI startup founders, industry experts, and
            investors connect. Get advice on localisation, talent, BD, and
            investment — or share your own expertise.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            {isTelegram || isLoggedIn ? (
              <>
                <Button
                  asChild
                  size="lg"
                  className="bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 font-semibold"
                >
                  <Link href="/discover" className="flex items-center gap-2">
                    Explore &amp; Learn
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                {showExpertLoading ? (
                  <Button
                    variant="outline"
                    size="lg"
                    disabled
                    className="border-slate-500/50 bg-slate-800/50 text-white font-semibold"
                  >
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading...
                  </Button>
                ) : (
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="border-slate-500/50 bg-slate-800/50 text-white hover:bg-slate-700/50 hover:text-white font-semibold"
                  >
                    <Link href="/booking">My Bookings</Link>
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button
                  asChild
                  size="lg"
                  className="bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 font-semibold"
                >
                  <Link href="/auth/signin" className="flex items-center gap-2">
                    Get Started
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="border-slate-500/50 bg-slate-800/50 text-white hover:bg-slate-700/50 hover:text-white font-semibold"
                >
                  <Link href="/discover" className="flex items-center gap-2">
                    Explore Community
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="px-6 py-16 md:py-20 bg-slate-50 dark:bg-slate-900/50">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 text-center">
          Three Ways to Grow
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 text-center">
          Whether you&apos;re building, advising, or investing in AI
        </p>
        <div className="grid gap-6">
          <div className="rounded-xl bg-white dark:bg-slate-800/80 p-6 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-100 dark:border-slate-700/50">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-indigo-100 dark:bg-indigo-900/30 p-3">
                <Rocket className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                  For AI Startup Founders
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  Get tailored advice on localisation, talent acquisition,
                  business development, and go-to-market strategy from experts
                  who know Singapore &amp; SEA.
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-white dark:bg-slate-800/80 p-6 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-100 dark:border-slate-700/50">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-amber-100 dark:bg-amber-900/30 p-3">
                <Sparkles className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                  For Industry Experts
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  Discover promising AI startups, learn evaluation frameworks,
                  share your domain expertise, and explore opportunities in the
                  fast-growing AI ecosystem.
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-white dark:bg-slate-800/80 p-6 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-100 dark:border-slate-700/50">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/30 p-3">
                <TrendingUp className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                  For Investors
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  Book sessions with AI founders and domain experts to
                  accelerate due diligence, understand emerging technologies,
                  and make better investment decisions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 py-16 md:py-20 bg-white dark:bg-slate-900">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-8 text-center">
          How It Works
        </h2>
        <div className="space-y-8">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold">
              1
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-500" />
                Explore the Community
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Browse AI startup founders, industry advisors, and investors
                across Singapore and Southeast Asia.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold">
              2
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-indigo-500" />
                Book a Session
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Pick a time for an online or in-person meeting. Flexible 30-min
                slots, from free to paid.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold">
              3
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-indigo-500" />
                Grow Together
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Get actionable insights, explore collaborations, and expand
                your footprint in the AI ecosystem.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-10 text-center">
          <Button asChild size="lg" className="font-semibold">
            <Link href="/discover" className="flex items-center gap-2">
              Explore Now
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto px-6 py-8 bg-slate-100 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800">
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Help&amp;Grow
          </span>{" "}
          — Powering AI startups in Singapore &amp; Southeast Asia
        </p>
      </footer>
    </div>
  );
}
