"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Upload,
  FileText,
  FileDown,
  X,
  ImageIcon,
  LogOut,
  Sparkles,
  Trash2,
  Plus,
  ExternalLink,
  Pencil,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  hasAvatar: boolean;
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
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [domains, setDomains] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [introScript, setIntroScript] = useState("");
  const [services, setServices] = useState<ServiceItem[]>([]);

  const [editingDomains, setEditingDomains] = useState(false);
  const [savingDomains, setSavingDomains] = useState(false);

  const [editingIntro, setEditingIntro] = useState(false);
  const [savingIntro, setSavingIntro] = useState(false);

  const [editingServices, setEditingServices] = useState(false);
  const [savingServices, setSavingServices] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [improvingIntro, setImprovingIntro] = useState(false);
  const [improvingServices, setImprovingServices] = useState(false);

  const [regenerating, setRegenerating] = useState(false);
  const [showRegeneratePrompt, setShowRegeneratePrompt] = useState(false);
  const [publishing, setPublishing] = useState(false);

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

  const showMessage = (msg: string, duration = 3000) => {
    setSaveMessage(msg);
    setTimeout(() => setSaveMessage(null), duration);
  };

  const saveSection = async (data: Record<string, unknown>) => {
    const res = await fetch("/api/expert/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error ?? "Failed to save");
    }
    return res.json();
  };

  const handleSaveDomains = async () => {
    setSavingDomains(true);
    try {
      await saveSection({ domains });
      setEditingDomains(false);
      showMessage("Service domains saved!");
      setShowRegeneratePrompt(true);
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Save failed", 5000);
    } finally {
      setSavingDomains(false);
    }
  };

  const handleCancelDomains = () => {
    setDomains(profile?.domains ?? []);
    setEditingDomains(false);
  };

  const toggleDomain = (domain: string) => {
    setDomains((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]
    );
  };

  const handleSaveIntro = async () => {
    setSavingIntro(true);
    try {
      await saveSection({ avatarScript: introScript, bio });
      setEditingIntro(false);
      showMessage("Introduction saved!");
      setShowRegeneratePrompt(true);
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Save failed", 5000);
    } finally {
      setSavingIntro(false);
    }
  };

  const handleCancelIntro = () => {
    setIntroScript(profile?.avatarScript ?? "");
    setBio(profile?.bio ?? "");
    setEditingIntro(false);
  };

  const handleAddService = () => {
    setServices((prev) => [...prev, { title: "", description: "" }]);
    if (!editingServices) setEditingServices(true);
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

  const handleSaveServices = async () => {
    setSavingServices(true);
    try {
      const validServices = services.filter((s) => s.title.trim());
      await saveSection({ servicesOffered: validServices });
      setServices(validServices);
      setEditingServices(false);
      showMessage("Services saved!");
      setShowRegeneratePrompt(true);
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Save failed", 5000);
    } finally {
      setSavingServices(false);
    }
  };

  const handleCancelServices = () => {
    setServices((profile?.servicesOffered as ServiceItem[] | null) ?? []);
    setEditingServices(false);
  };

  const handleImproveIntro = async () => {
    if (!introScript.trim()) return;
    setImprovingIntro(true);
    try {
      const res = await fetch("/api/expert/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "intro", content: introScript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIntroScript(data.improved);
      showMessage("Introduction improved by AI!");
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "AI improvement failed", 5000);
    } finally {
      setImprovingIntro(false);
    }
  };

  const handleImproveServices = async () => {
    const valid = services.filter((s) => s.title.trim());
    if (valid.length === 0) return;
    setImprovingServices(true);
    try {
      const res = await fetch("/api/expert/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "services", content: valid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setServices(data.improved);
      showMessage("Services improved by AI!");
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "AI improvement failed", 5000);
    } finally {
      setImprovingServices(false);
    }
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
      showMessage("Document uploaded!");
      fetchProfile();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Upload failed", 5000);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const res = await fetch("/api/onboarding/publish", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to publish");
      }
      setProfile((prev) => (prev ? { ...prev, isPublished: true } : prev));
      showMessage("Profile published! It's now visible to founders.");
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Publish failed", 5000);
    } finally {
      setPublishing(false);
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
        prev ? { ...prev, hasAvatar: !!data.profileImage } : prev
      );
      showMessage("Profile image regenerated!");
    } catch (err) {
      showMessage(
        err instanceof Error ? err.message : "Failed to regenerate image",
        5000
      );
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
  const nickName =
    profile?.user?.nickName ??
    (session?.user as { nickName?: string })?.nickName ??
    session?.user?.name ??
    "User";
  const email = profile?.user?.email ?? session?.user?.email;

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-background pb-12">
      <header className="border-b px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold truncate">{nickName}</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="truncate">{email}</span>
              {isExpert && profile.isPublished && (
                <button
                  onClick={() => window.open(`/experts/${profile.id}`, "_blank")}
                  className="shrink-0 flex items-center gap-1 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-medium"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Public Profile
                </button>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="gap-2 text-muted-foreground shrink-0"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      <div className="space-y-6 p-4">
        {saveMessage && (
          <p
            className={`text-sm text-center rounded-lg px-4 py-2 ${
              saveMessage.includes("saved") || saveMessage.includes("uploaded") || saveMessage.includes("regenerated")
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
                Regenerate your profile image based on the updated profile?
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 gap-2"
                  onClick={handleRegenerateImage}
                  disabled={regenerating}
                >
                  {regenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
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

        {isExpert && !profile.isPublished && (
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-amber-100 dark:bg-amber-900/50 p-1.5 mt-0.5">
                  <ExternalLink className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    Profile not published
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                    Your profile is only visible to you. Publish it to appear in the expert directory and let founders book sessions.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                className="mt-3 w-full gap-2"
                onClick={handlePublish}
                disabled={publishing}
              >
                {publishing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Publish Profile
              </Button>
            </CardContent>
          </Card>
        )}

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
            {profile.hasAvatar && (
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
                      src={`/api/experts/${profile.id}/avatar`}
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

            {/* Service Domains */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Service Domains</CardTitle>
                  {!editingDomains ? (
                    <Button variant="ghost" size="sm" onClick={() => setEditingDomains(true)} className="gap-1">
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelDomains}
                        className="gap-1"
                      >
                        <X className="h-3.5 w-3.5" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveDomains}
                        disabled={savingDomains}
                        className="gap-1"
                      >
                        {savingDomains ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Save
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {DOMAINS.map((d) => (
                    <label
                      key={d}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                        editingDomains ? "cursor-pointer hover:bg-accent" : "cursor-default opacity-80"
                      } ${domains.includes(d) ? "border-primary bg-primary/5" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={domains.includes(d)}
                        onChange={() => editingDomains && toggleDomain(d)}
                        disabled={!editingDomains}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className={domains.includes(d) ? "font-medium" : ""}>{d}</span>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Introduction Script */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Introduction Script</CardTitle>
                  {!editingIntro ? (
                    <Button variant="ghost" size="sm" onClick={() => setEditingIntro(true)} className="gap-1">
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={handleCancelIntro} className="gap-1">
                        <X className="h-3.5 w-3.5" />
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSaveIntro} disabled={savingIntro} className="gap-1">
                        {savingIntro ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Save
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {editingIntro ? (
                  <>
                    <Textarea
                      value={introScript}
                      onChange={(e) => setIntroScript(e.target.value)}
                      rows={6}
                      placeholder="Write your introduction..."
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 gap-1.5"
                      onClick={handleImproveIntro}
                      disabled={improvingIntro || !introScript.trim()}
                    >
                      {improvingIntro ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      Improve with AI
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap min-h-[4rem]">
                    {introScript || "No introduction yet. Click Edit to add one."}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Services Offered */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Services Offered</CardTitle>
                  <div className="flex gap-1">
                    {!editingServices ? (
                      <Button variant="ghost" size="sm" onClick={() => setEditingServices(true)} className="gap-1">
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    ) : (
                      <>
                        <Button variant="ghost" size="sm" onClick={handleCancelServices} className="gap-1">
                          <X className="h-3.5 w-3.5" />
                          Cancel
                        </Button>
                        <Button size="sm" onClick={handleSaveServices} disabled={savingServices} className="gap-1">
                          {savingServices ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          Save
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="sm" onClick={handleAddService} className="gap-1">
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {services.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No services yet. Click Add to create one.
                  </p>
                )}
                {services.map((service, index) => (
                  <div key={index} className="rounded-lg border p-3">
                    {editingServices ? (
                      <div className="space-y-2">
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
                          onChange={(e) => handleServiceChange(index, "title", e.target.value)}
                          placeholder="Service title"
                          className="text-sm"
                        />
                        <Textarea
                          value={service.description}
                          onChange={(e) => handleServiceChange(index, "description", e.target.value)}
                          placeholder="Brief description..."
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                    ) : (
                      <div>
                        <h4 className="font-medium text-sm">{service.title}</h4>
                        {service.description && (
                          <p className="mt-1 text-sm text-muted-foreground">{service.description}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {editingServices && services.some((s) => s.title.trim()) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={handleImproveServices}
                    disabled={improvingServices}
                  >
                    {improvingServices ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Improve with AI
                  </Button>
                )}
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
                  <a
                    href={`/api/experts/${profile.id}/document`}
                    download
                    className="flex items-center gap-2 mb-3 text-sm text-muted-foreground rounded-lg border p-3 hover:bg-accent transition-colors"
                  >
                    <FileDown className="h-4 w-4 shrink-0" />
                    <span className="truncate flex-1">{uploadedFileName}</span>
                    <span className="text-xs shrink-0">Download</span>
                  </a>
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
          </>
        )}
      </div>
    </div>
  );
}
