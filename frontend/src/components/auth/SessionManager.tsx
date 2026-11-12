import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { useLocation } from "react-router-dom";
import axios from "axios";

import api from "../../services/api";
import { clearSession } from "../../utils/auth";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const WARNING_SECONDS = 10;
const ACCESS_REFRESH_INTERVAL_MS = 25 * 60 * 1000;
const ACTIVITY_KEY = "hrms:last-activity";
const CHANNEL_NAME = "hrms-session";

const baseURL =
  import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

function isPublicPath(pathname: string): boolean {
  return pathname === "/login" || pathname === "/";
}

export default function SessionManager() {
  const location = useLocation();
  const [warningOpen, setWarningOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(WARNING_SECONDS);
  const lastActivityRef = useRef(Date.now());
  const lastRefreshRef = useRef(Date.now());
  const warningTimerRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const loggingOutRef = useRef(false);
  const warningOpenRef = useRef(false);
  const lastBroadcastRef = useRef(0);

  const stopWarning = useCallback(() => {
    if (countdownRef.current !== null) {
      window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    warningOpenRef.current = false;
    setWarningOpen(false);
    setSecondsLeft(WARNING_SECONDS);
  }, []);

  const logout = useCallback(async () => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    stopWarning();

    try {
      await api.post("/auth/logout");
    } catch {
      // Clear the browser session locally even if the network is unavailable.
    } finally {
      clearSession();
      channelRef.current?.postMessage({ type: "logout" });
      window.location.replace("/login");
    }
  }, [stopWarning]);

  const recordActivity = useCallback((broadcast = true) => {
    if (isPublicPath(window.location.pathname) || loggingOutRef.current) return;
    const now = Date.now();
    lastActivityRef.current = now;
    // Avoid writing to storage/broadcasting on every mousemove event.
    if (broadcast && now - lastBroadcastRef.current >= 1000) {
      lastBroadcastRef.current = now;
      try {
        localStorage.setItem(ACTIVITY_KEY, String(now));
      } catch {
        // Session tracking still works in this tab if storage is unavailable.
      }
      channelRef.current?.postMessage({ type: "activity", at: now });
    }
    if (warningOpenRef.current) stopWarning();
  }, [stopWarning]);

  const continueSession = useCallback(async () => {
    stopWarning();
    recordActivity();
    // Ensure the session is valid after the employee explicitly resumes.
    try {
      await api.post("/auth/refresh");
      lastRefreshRef.current = Date.now();
    } catch {
      await logout();
    }
  }, [logout, recordActivity, stopWarning]);

  useEffect(() => {
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channelRef.current = channel;
      channel.onmessage = (event) => {
        if (event.data?.type === "activity" && typeof event.data.at === "number") {
          lastActivityRef.current = Math.max(lastActivityRef.current, event.data.at);
          if (warningOpenRef.current) stopWarning();
        }
        if (event.data?.type === "logout") {
          clearSession();
          window.location.replace("/login");
        }
      };
      return () => {
        channel.close();
        channelRef.current = null;
      };
    }
    return undefined;
  }, [stopWarning]);

  useEffect(() => {
    if (isPublicPath(location.pathname)) return;

    const events: (keyof WindowEventMap)[] = [
      "mousemove", "mousedown", "keydown", "scroll", "touchstart", "click",
    ];
    const onActivity = () => recordActivity();
    events.forEach((eventName) =>
      window.addEventListener(eventName, onActivity, { passive: true })
    );

    const storageListener = (event: StorageEvent) => {
      if (event.key === ACTIVITY_KEY && event.newValue) {
        const timestamp = Number(event.newValue);
        if (Number.isFinite(timestamp)) {
          lastActivityRef.current = Math.max(lastActivityRef.current, timestamp);
          if (warningOpenRef.current) stopWarning();
        }
      }
    };
    window.addEventListener("storage", storageListener);

    // On entering an authenticated route, start a fresh local activity window.
    recordActivity(false);

    return () => {
      events.forEach((eventName) =>
        window.removeEventListener(eventName, onActivity)
      );
      window.removeEventListener("storage", storageListener);
    };
  }, [location.pathname, recordActivity, stopWarning]);

  useEffect(() => {
    if (isPublicPath(location.pathname)) return;

    warningTimerRef.current = window.setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current;
      if (idleFor >= IDLE_TIMEOUT_MS && !warningOpen) {
        warningOpenRef.current = true;
        setWarningOpen(true);
        setSecondsLeft(WARNING_SECONDS);
      }
    }, 500);

    return () => {
      if (warningTimerRef.current !== null) {
        window.clearInterval(warningTimerRef.current);
        warningTimerRef.current = null;
      }
    };
  }, [location.pathname, warningOpen]);

  useEffect(() => {
    if (!warningOpen) return;
    let remaining = WARNING_SECONDS;
    setSecondsLeft(remaining);
    countdownRef.current = window.setInterval(() => {
      // Activity from another tab also cancels the countdown.
      const idleFor = Date.now() - lastActivityRef.current;
      if (idleFor < IDLE_TIMEOUT_MS) {
        stopWarning();
        return;
      }
      remaining -= 1;
      setSecondsLeft(remaining);
      if (remaining <= 0) void logout();
    }, 1000);

    return () => {
      if (countdownRef.current !== null) {
        window.clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [warningOpen, logout, stopWarning]);

  useEffect(() => {
    if (isPublicPath(location.pathname)) return;
    const refreshTimer = window.setInterval(async () => {
      const activeWithinThreshold =
        Date.now() - lastActivityRef.current < IDLE_TIMEOUT_MS;
      const refreshDue =
        Date.now() - lastRefreshRef.current >= ACCESS_REFRESH_INTERVAL_MS;

      if (!activeWithinThreshold || !refreshDue || loggingOutRef.current) return;

      try {
        await axios.post(`${baseURL}/auth/refresh`, null, { withCredentials: true });
        lastRefreshRef.current = Date.now();
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          await logout();
        }
        // A transient network/server failure is retried on the next interval.
      }
    }, 30_000);

    return () => window.clearInterval(refreshTimer);
  }, [location.pathname, logout]);

  useEffect(() => {
    return () => {
      if (warningTimerRef.current !== null) window.clearInterval(warningTimerRef.current);
      if (countdownRef.current !== null) window.clearInterval(countdownRef.current);
    };
  }, []);

  return (
    <Dialog
      open={warningOpen}
      onClose={() => undefined}
      aria-labelledby="session-expiry-title"
    >
      <DialogTitle id="session-expiry-title">Are you still there?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          You've been inactive for a while. For your security, you'll be logged
          out in {secondsLeft} seconds. Would you like to continue your session?
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={() => void logout()}>
          Log out
        </Button>
        <Button variant="contained" onClick={() => void continueSession()} autoFocus>
          Continue session ({secondsLeft}s)
        </Button>
      </DialogActions>
    </Dialog>
  );
}
