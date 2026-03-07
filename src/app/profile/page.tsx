"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Save,
  Upload,
  FileText,
  X,
  ImageIcon,
  LogOut,
  Sparkles,
  Trash2,
  Plus,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { DOMAINS } from "@/lib/constants";

interface ServiceItem {
  title: string;
  description: string;
}

interface ExpertProfile {
  id: string;
  domains: string[];
  bio: string | null;
  avatarScript: string | null;
  servicesOffered: ServiceItem[] | null;
  avatarVideoUrl: string | null;
  documentName: string | null;
  isPublished: boolean;
  user: {
    id: string;
    name: string | null;
    nickName: string | null;
    email: string | null;
    image: string | null;
  };
}

export default function ProfilePage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [profile, setProfile] = useState<ExpertProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [domains, setDomains] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [introScript, setIntroScript] = useState("");
  const [services, setServices] = useState<ServiceItem[]>([]);

  const [uploading, setUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [regenerating, setRegenerating] = useState(false);
  const [showRegeneratePrompt, setShowRegeneratePrompt] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/expert/profile");
      if (res.status === 404) {
        setProfile(null);
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch profile");
      const data: ExpertProfile = await res.json();
      setProfile(data);
      setDomains(data.domains);
      setBio(data.bio ?? "");
      setIntroScript(data.avatarScript ?? "");
      setServices(
        (data.servicesOffered as ServiceItem[] | null) ?? []
      );
      setUploadedFileName(data.documentName ?? null);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      fetchProfile();
    } else if (sessionStatus === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [sessionStatus, fetchProfile, router]);

  const toggleDomain = (domain: string) => {
    setDomains((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]
    );
  };

  const handleAddService = () => {
    setServices((prev) => [...prev, { title: "", description: "" }]);
  };

  const handleServiceChange = (index: number, field: "title" | "description", value: string) => {
    setServices((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleRemoveService = (index: number) => {
    setServices((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/onboarding/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUploadedFileName(file.name);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setSaveMessage(null);

    try {
      const validServices = services.filter((s) => s.title.trim());
      const res = await fetch("/api/expert/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domains,
          bio,
          avatarScript: introScript,
          servicesOffered: validServices,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }

      setSaveMessage("Profile saved successfully!");
      setShowRegeneratePrompt(true);

      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateImage = async () => {
    setRegenerating(true);
    setShowRegeneratePrompt(false);
    try {
      const res = await fetch("/api/expert/regenerate-image", {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to regenerate");
      }
      const data = await res.json();
      setProfile((prev) =>
        prev ? { ...prev, avatarVideoUrl: data.profileImage } : prev
      );
      setSaveMessage("Profile image regenerated!");
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setSaveMessage(
        err instanceof Error ? err.message : "Failed to regenerate image"
      );
      setTimeout(() => setSaveMessage(null), 5000);
    } finally {
      setRegenerating(false);
    }
  };

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isExpert = !!profile;
  const displayName =
    session?.user?.name ??
    (session?.user as { nickName?: string })?.nickName ??
    session?.user?.email ??
    "User";

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-background pb-12">
      <header className="border-b px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">My Profile</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="gap-2 text-muted-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {displayName} &middot; {session?.user?.email}
        </p>
      </header>

      <div className="space-y-6 p-4">
        {!isExpert ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                You don&apos;t have an expert profile yet.
              </p>
              <Button onClick={() => router.push("/onboarding")}>
                Complete Onboarding
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Profile Image */}
            {profile.avatarVideoUrl && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Profile Image
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="aspect-square rounded-xl overflow-hidden bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={profile.avatarVideoUrl}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <Button
                    variant="outline"
                    className="mt-3 w-full gap-2"
                    onClick={handleRegenerateImage}
                    disabled={regenerating}
                  >
                    {regenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Regenerate Image
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* View Public Profile */}
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() =>
                window.open(`/experts/${profile.id}`, "_blank")
              }
            >
              <ExternalLink className="h-4 w-4" />
              View Public Profile
            </Button>

            {/* Service Domains */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Service Domains</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {DOMAINS.map((d) => (
                    <Badge
                      key={d}
                      variant={domains.includes(d) ? "default" : "outline"}
                      className="cursor-pointer transition-colors"
                      onClick={() => toggleDomain(d)}
                    >
                      {d}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Introduction Script */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Introduction Script</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={introScript}
                  onChange={(e) => setIntroScript(e.target.value)}
                  rows={6}
                  placeholder="Write your introduction..."
                />
              </CardContent>
            </Card>

            {/* Services Offered */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Services Offered</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAddService}
                    className="gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {services.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No services added yet. Click &quot;Add&quot; to create one.
                  </p>
                )}
                {services.map((service, index) => (
                  <div key={index} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-medium">
                        Service {index + 1}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleRemoveService(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                    <Input
                      value={service.title}
                      onChange={(e) =>
                        handleServiceChange(index, "title", e.target.value)
                      }
                      placeholder="Service title"
                      className="text-sm"
                    />
                    <Textarea
                      value={service.description}
                      onChange={(e) =>
                        handleServiceChange(index, "description", e.target.value)
                      }
                      placeholder="Brief description..."
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Document Upload */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Service Document
                </CardTitle>
              </CardHeader>
              <CardContent>
                {uploadedFileName && (
                  <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground rounded-lg border p-3">
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate flex-1">{uploadedFileName}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => setUploadedFileName(null)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      {uploadedFileName ? "Replace Document" : "Upload Document"}
                    </>
                  )}
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  PDF, DOCX, TXT, or MD up to 5MB
                </p>
              </CardContent>
            </Card>

            <Separator />

            {/* Save Button */}
            <div className="space-y-3">
              {saveMessage && (
                <p
                  className={`text-sm text-center rounded-lg px-4 py-2 ${
                    saveMessage.includes("success") || saveMessage.includes("regenerated")
                      ? "bg-emerald-500/10 text-emerald-700"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {saveMessage}
                </p>
              )}

              {showRegeneratePrompt && (
                <Card className="border-indigo-200 dark:border-indigo-800">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground mb-3">
                      Would you like to regenerate your profile image based on the updated profile?
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 gap-2"
                        onClick={handleRegenerateImage}
                        disabled={regenerating}
                      >
                        <Sparkles className="h-4 w-4" />
                        Regenerate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setShowRegeneratePrompt(false)}
                      >
                        Skip
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Button
                size="lg"
                className="w-full gap-2 text-base font-semibold"
                onClick={handleSave}
                disabled={saving || regenerating}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
