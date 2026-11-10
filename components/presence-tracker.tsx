
"use client";

import { useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function PresenceTracker() {
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    let active = true;

    async function heartbeat() {
      if (!active || document.visibilityState !== "visible") return;

      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) return;

      await supabase.rpc("heartbeat_my_presence");
    }

    async function start() {
      await heartbeat();

      if (!interval) {
        interval = setInterval(heartbeat, 30000);
      }
    }

    start();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          heartbeat();
        }
      }
    );

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        heartbeat();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;

      if (interval) {
        clearInterval(interval);
      }

      authListener.subscription.unsubscribe();
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, []);

  return null;
}
