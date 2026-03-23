"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { 
  Sparkles, 
  Search, 
  ArrowRight, 
  CheckCircle2, 
  Building2, 
  Users, 
  Loader2,
  Send
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { UserMenu } from "@/components/user-menu";
import Link from "next/link";

interface MatchRecommendation {
  expertId: string;
  name: string;
  reason: string;
  sessionTypes: string[];
}

export default function MatchmakingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<MatchRecommendation[]>([]);
  const [noMatchMessage, setNoMatchMessage] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin?callbackUrl=/match");
    }
  }, [status, router]);

  const handleNext = () => {
    if (step < 2) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const findMatches = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const res = await fetch("/api/matchmaking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      
      if (!res.ok) throw new Error("Matchmaking failed");
      
      const data = await res.json();
      setRecommendations(data.recommendations || []);
      setNoMatchMessage(data.noMatchMessage || "");
      setStep(3);
    } catch (error) {
      console.error(error);
      setNoMatchMessage("Something went wrong. Please try again.");
      setStep(3);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const progress = (step / 3) * 100;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <nav className="sticky top-0 z-50 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="p-1.5 rounded-lg bg-indigo-500 group-hover:bg-indigo-400 transition-colors">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">Help&Grow</span>
          </Link>
          <div className="flex items-center gap-4">
            <UserMenu />
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-12 md:py-20">
        <div className="mb-10 text-center">
          <Badge variant="outline" className="mb-4 bg-indigo-500/10 text-indigo-400 border-indigo-500/20 px-3 py-1">
            NGO & Bootcamp Initiative
          </Badge>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
            Find Your Mentor
          </h1>
          <p className="text-slate-400 max-w-lg mx-auto">
            Connect with top-tier experts for pro-bono guidance on your social impact projects.
          </p>
        </div>

        <div className="max-w-xl mx-auto">
          <div className="mb-8 overflow-hidden rounded-full bg-slate-800 h-1.5">
            <div 
              className="h-full bg-indigo-500 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {step === 1 && (
            <Card className="bg-slate-900 border-slate-800 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-full bg-emerald-500/20 text-emerald-400">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  Verify Your Role
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Are you an NGO representative or a Bootcamp student?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div 
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-4 ${
                    session?.user?.role === 'NGO' || session?.user?.role === 'BOOTCAMP' 
                    ? 'border-emerald-500 bg-emerald-500/5' 
                    : 'border-slate-800 hover:border-slate-700 bg-slate-800/50'
                  }`}
                >
                  {session?.user?.role === 'NGO' ? (
                    <Building2 className="h-6 w-6 text-emerald-400" />
                  ) : (
                    <Users className="h-6 w-6 text-indigo-400" />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold text-slate-100">
                      Current Role: {session?.user?.role || 'FOUNDER'}
                    </p>
                    <p className="text-sm text-slate-400">
                      {session?.user?.role === 'NGO' || session?.user?.role === 'BOOTCAMP' 
                        ? 'Great! You have access to pro-bono matchmaking.' 
                        : 'You need an NGO or Bootcamp student account to continue.'}
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full bg-indigo-600 hover:bg-indigo-500 h-12 text-base font-semibold"
                  disabled={!(session?.user?.role === 'NGO' || session?.user?.role === 'BOOTCAMP' || session?.user?.role === 'ADMIN')}
                  onClick={handleNext}
                >
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          )}

          {step === 2 && (
            <Card className="bg-slate-900 border-slate-800 shadow-2xl animate-in fade-in slide-in-from-right-4 duration-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-indigo-400">
                  <Sparkles className="h-6 w-6" />
                  Describe Your Challenge
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Tell our AI what kind of expertise you need for your initiative.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea 
                  placeholder="e.g. We are a youth-focused NGO in Singapore looking for help with digital marketing strategy and AI implementation for our community portal..."
                  className="min-h-[160px] bg-slate-950 border-slate-800 focus:border-indigo-500 text-slate-100 placeholder:text-slate-600 resize-none rounded-xl"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </CardContent>
              <CardFooter className="flex gap-3">
                <Button variant="outline" onClick={handleBack} className="border-slate-700 hover:bg-slate-800 text-slate-300">
                  Back
                </Button>
                <Button 
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 h-12 text-base font-semibold"
                  disabled={!query.trim() || loading}
                  onClick={findMatches}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Matching...
                    </>
                  ) : (
                    <>
                      Find Mentors <Send className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-400" />
                  AI Matches for You
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setStep(2)} className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10">
                  Refine Search
                </Button>
              </div>

              {recommendations.length > 0 ? (
                <div className="grid gap-4">
                  {recommendations.map((rec) => (
                    <Card key={rec.expertId} className="bg-slate-900 border-slate-800 hover:border-indigo-500/50 transition-colors">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center justify-between">
                          <span className="text-slate-100">{rec.name}</span>
                          <div className="flex gap-1">
                            {rec.sessionTypes.map(t => (
                              <Badge key={t} variant="secondary" className="text-[10px] uppercase bg-slate-800 text-slate-400">
                                {t}
                              </Badge>
                            ))}
                          </div>
                        </CardTitle>
                        <CardDescription className="text-indigo-400 font-medium">
                          Match Reason:
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-slate-300 text-sm leading-relaxed">
                          {rec.reason}
                        </p>
                      </CardContent>
                      <CardFooter className="pt-0 flex gap-2">
                        <Button asChild size="sm" className="flex-1 bg-indigo-600 hover:bg-indigo-500">
                          <Link href={`/experts/${rec.expertId}/book?price=0`}>
                            Book Pro-Bono
                          </Link>
                        </Button>
                        <Button asChild variant="outline" size="sm" className="flex-1 border-slate-700 hover:bg-slate-800 text-slate-300">
                          <Link href={`/experts/${rec.expertId}`}>
                            View Profile
                          </Link>
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="bg-slate-900 border-slate-800 text-center py-12">
                  <CardContent>
                    <div className="h-16 w-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search className="h-8 w-8 text-slate-600" />
                    </div>
                    <p className="text-slate-400 max-w-xs mx-auto">
                      {noMatchMessage || "No matches found. Try describing your needs differently."}
                    </p>
                    <Button variant="link" onClick={() => setStep(2)} className="mt-4 text-indigo-400">
                      Try again
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 blur-[120px] rounded-full" />
      </div>

      <style jsx global>{`
        @keyframes typing {
          from { width: 0 }
          to { width: 100% }
        }
        .typing-dots::after {
          content: '...';
          display: inline-block;
          width: 0;
          overflow: hidden;
          vertical-align: bottom;
          animation: typing 1.5s steps(4, end) infinite;
        }
      `}</style>
    </div>
  );
}
