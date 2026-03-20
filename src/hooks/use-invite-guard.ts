"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export function useInviteGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  const [hasInvite, setHasInvite] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/invite/status")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.hasInvite) {
          setHasInvite(true);
        } else {
          router.replace(`/invite?redirect=${encodeURIComponent(pathname)}`);
        }
        setChecked(true);
      })
      .catch(() => {
        if (!cancelled) {
          setHasInvite(true);
          setChecked(true);
        }
      });

    return () => { cancelled = true; };
  }, [router, pathname]);

  return { checked, hasInvite };
}
