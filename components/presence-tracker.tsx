
"use client";

import { useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function PresenceTracker() {
  useEffect(() => {
    let active = true;
    let interval: ReturnType<typeof setInterval> | null = null;
    let heartbeatInProgress = false;

    function stopHeartbeat() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    }

    async function heartbeat() {
      if (
        !active ||
        document.visibilityState !== "visible" ||
        heartbeatInProgress
      ) {
        return;
      }

      heartbeatInProgress = true;

      try {
        const { data, error } = await supabase.auth.getUser();

        if (!active || error || !data.user) {
          return;
        }

        const { error: presenceError } = await supabase.rpc(
          "heartbeat_my_presence"
        );

        if (presenceError) {
          console.error(
            "Presence heartbeat error:",
            presenceError.message
          );
        }
      } catch (error) {
        console.error("Presence error:", error);
      } finally {
        heartbeatInProgress = false;
      }
    }

    function startHeartbeat() {
      if (!active) return;

      stopHeartbeat();

      heartbeat();

      interval = setInterval(() => {
        heartbeat();
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
        if (session?.user) {
          startHeartbeat();
        }
      }

      if (event === "SIGNED_OUT") {
        stopHeartbeat();
      }
    });

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        heartbeat();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    initialize();

    return () => {
      active = false;

      stopHeartbeat();
      subscription.unsubscribe();

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, []);

  return null;
}
