import { useState, useCallback } from "react";
import { getUser, getToken, clearAuth, wxLogin } from "./auth";
import type { AuthUser } from "./types";

let globalUser: AuthUser | null = null;
let globalToken: string | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function initStore() {
  globalUser = getUser();
  globalToken = getToken();
}

export function useAuth() {
  const [, setTick] = useState(0);

  const subscribe = useCallback(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // Subscribe on mount
  useState(() => {
    const unsub = subscribe();
    return unsub;
  });

  const login = useCallback(async () => {
    const result = await wxLogin();
    globalUser = result.user;
    globalToken = result.token;
    notify();
    return result;
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    globalUser = null;
    globalToken = null;
    notify();
  }, []);

  return {
    user: globalUser,
    token: globalToken,
    isLoggedIn: !!globalToken,
    login,
    logout,
  };
}
