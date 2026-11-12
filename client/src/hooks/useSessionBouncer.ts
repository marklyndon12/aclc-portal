import { useEffect } from "react";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import type { SessionResponse } from "../types";

const POLL_INTERVAL_MS = 10_000;

export function useSessionBouncer(): void {
  const { token, user, expireSession, updateUser } = useAuth();

  useEffect(() => {
    if (!token || !user) {
      return;
    }

    let stopped = false;

    const checkSession = async () => {
      try {
        const result = await api.get<SessionResponse>("/api/auth/session");
        if (!stopped) updateUser(result.user);
      } catch (error) {
        if (stopped) {
          return;
        }
        if (error instanceof ApiError && error.status === 401) {
          stopped = true;
          expireSession();
        }
      }
    };

    void checkSession();
    const timer = window.setInterval(checkSession, POLL_INTERVAL_MS);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [token, user, expireSession, updateUser]);
}
