"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { LogOut, User } from "lucide-react";

interface UserMenuProps {
  variant?: "light" | "dark";
}

export function UserMenu({ variant = "dark" }: UserMenuProps) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (status === "loading") return null;

  if (!session) {
    return (
      <Link
        href="/auth/signin"
        className={`text-sm font-medium transition-colors ${
          variant === "light"
            ? "text-slate-300 hover:text-white"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Sign In
      </Link>
    );
  }

  const initial = (
    session.user?.name ??
    (session.user as { nickName?: string })?.nickName ??
    session.user?.email ??
    "U"
  )
    .charAt(0)
    .toUpperCase();

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-sm font-medium hover:opacity-90 transition-opacity"
      >
        {initial}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-40 rounded-lg border bg-popover shadow-lg py-1 z-50"
          onMouseLeave={() => setOpen(false)}
        >
          <Link
            href="/profile"
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
            onClick={() => setOpen(false)}
          >
            <User className="h-4 w-4" />
            My Profile
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
