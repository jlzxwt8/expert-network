import Link from "next/link";
import {
  Shield,
  Sparkles,
  Calendar,
  ArrowRight,
  Users,
  MessageSquare,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";

export default function Home() {
  return (
    <div className="min-h-screen w-full max-w-lg mx-auto flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 px-6 pt-12 pb-16 md:pt-16 md:pb-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-slate-500/10 via-transparent to-transparent" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-400" />
              <span className="text-sm font-medium text-indigo-300 uppercase tracking-wider">
                Help&Grow Community
              </span>
            </div>
            <UserMenu variant="light" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-4">
            Connect with Singapore&apos;s Top Tech Experts
          </h1>
          <p className="text-lg text-slate-300 mb-8 max-w-md">
            Join our community of 1,000+ verified professionals. Get
            advisory sessions on AI, fintech, and business from experts who
            have been there.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              asChild
              size="lg"
              className="bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 font-semibold"
            >
              <Link href="/auth/signin?role=expert">I&apos;m an Expert</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-slate-500/50 bg-slate-800/50 text-white hover:bg-slate-700/50 hover:text-white font-semibold"
            >
              <Link href="/discover" className="flex items-center gap-2">
                Find an Expert
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-16 md:py-20 bg-slate-50 dark:bg-slate-900/50">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-8 text-center">
          Why Choose Help&Grow
        </h2>
        <div className="grid gap-6">
          <div className="rounded-xl bg-white dark:bg-slate-800/80 p-6 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-100 dark:border-slate-700/50">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-indigo-100 dark:bg-indigo-900/30 p-3">
                <Shield className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                  Verified Experts
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  Every expert is vetted and verified. Connect with professionals
                  who have real industry experience.
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
                  AI-Powered Matching
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  Our smart matching finds the right expert for your specific
                  questions and goals.
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-white dark:bg-slate-800/80 p-6 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-100 dark:border-slate-700/50">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/30 p-3">
                <Calendar className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                  Easy Booking
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  Book advisory sessions in seconds. Experts give back to the
                  community through their time.
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
                Browse Experts
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Explore our directory of verified experts across AI, fintech,
                and business.
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
                Pick a time that works for you. Sessions are quick and
                confidential.
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
                Get Advice
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Connect with your expert and get actionable insights to grow
                your venture.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-10 text-center">
          <Button asChild size="lg" className="font-semibold">
            <Link href="/discover" className="flex items-center gap-2">
              Find an Expert
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto px-6 py-8 bg-slate-100 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800">
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          Powered by{" "}
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Help&Grow
          </span>
        </p>
      </footer>
    </div>
  );
}
