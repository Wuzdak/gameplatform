"use client";

import { useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function PresenceTracker() {
  useEffect(() => {
    let active = true;
    let interval: ReturnType<typeof setInterval> | null = null;
    let heartbeatInProgress = false;
    let statusCheckInProgress = false;
    let blockedRedirecting = false;

    function stopHeartbeat() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    }

    async function checkAccountStatus() {
      if (!active || blockedRedirecting || statusCheckInProgress) return;

      statusCheckInProgress = true;
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token || !active) return;

        const response = await fetch("/api/account-status", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        if (response.status === 403) {
          const result = await response.json().catch(() => null);
          if (result?.code === "account_blocked") {
            blockedRedirecting = true;
            stopHeartbeat();
            await supabase.auth.signOut({ scope: "local" });
            if (active) window.location.replace("/auth?blocked=1");
          }
        }
      } catch (error) {
        console.error("Account status check error:", error);
      } finally {
        statusCheckInProgress = false;
      }
    }

    async function heartbeat() {
      if (
        !active ||
        document.visibilityState !== "visible" ||
        heartbeatInProgress ||
        blockedRedirecting
      ) {
        return;
      }

      heartbeatInProgress = true;
      try {
        // One account-status check per heartbeat; no separate 5-second poll.
        await checkAccountStatus();
        if (!active || blockedRedirecting) return;

        const { data, error } = await supabase.auth.getUser();
        if (!active || error || !data.user) return;

        const { error: presenceError } = await supabase.rpc(
          "heartbeat_my_presence"
        );

        if (presenceError) {
          console.error("Presence heartbeat error:", presenceError.message);
        }
      } catch (error) {
        console.error("Presence error:", error);
      } finally {
        heartbeatInProgress = false;
      }
    }

    function startHeartbeat() {
      if (!active || blockedRedirecting) return;
      stopHeartbeat();
      void heartbeat();
      interval = setInterval(() => {
        void heartbeat();
      }, 30000);
    }

    async function initialize() {
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      if (error || !data.user) {
        stopHeartbeat();
        return;
      }
      startHeartbeat();
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        if (session?.user) startHeartbeat();
      }
      if (event === "SIGNED_OUT") stopHeartbeat();
    });

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") void heartbeat();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    void initialize();

    return () => {
      active = false;
      stopHeartbeat();
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
