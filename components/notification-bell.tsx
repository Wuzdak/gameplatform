"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

type Notification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  title: string;
  body: string;
  href: string;
  is_read: boolean;
  created_at: string;
};

function safeHref(href: string) {
  return href.startsWith("/") && !href.startsWith("//") ? href : "/";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function notificationIcon(type: string) {
  switch (type) {
    case "message":
      return "✉";
    case "friend_request":
      return "♙";
    case "friend_accepted":
      return "✓";
    case "developer_application":
      return "◆";
    default:
      return "•";
  }
}

export default function NotificationBell() {
  const [userId, setUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  const unreadCount = notifications.filter((item) => !item.is_read).length;

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data, error }) => {
      if (active) setUserId(error ? null : data.user?.id ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUserId(session?.user?.id ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    let active = true;

    async function loadNotifications() {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, user_id, actor_id, type, title, body, href, is_read, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!active) return;

      if (error) {
        console.error("Notifications error:", error.message);
      } else {
        setNotifications((data ?? []) as Notification[]);
      }

      setLoading(false);
    }

    setLoading(true);
    loadNotifications();

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void loadNotifications();
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  async function markAsRead(id: string) {
    if (!userId) return;

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("Mark notification error:", error.message);
      return;
    }

    setNotifications((previous) =>
      previous.map((item) => item.id === id ? { ...item, is_read: true } : item)
    );
  }

  async function markAllAsRead() {
    if (!userId || unreadCount === 0 || updating) return;

    setUpdating(true);

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) {
      console.error("Mark all notifications error:", error.message);
    } else {
      setNotifications((previous) =>
        previous.map((item) => ({ ...item, is_read: true }))
      );
    }

    setUpdating(false);
  }

  if (!userId) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-label="Уведомления"
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border text-lg transition hover:bg-white/10"
        style={{
          background: "#121A2A",
          borderColor: "#293650",
          color: "#EDF3FF",
        }}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>

        {unreadCount > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black text-black"
            style={{ background: "#3978FF" }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Закрыть уведомления"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[80] cursor-default"
          />

          <section
            className="absolute right-0 top-14 z-[90] w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-2xl border shadow-2xl"
            style={{ background: "#121A2A", borderColor: "#293650" }}
          >
            <div
              className="flex items-center justify-between border-b px-4 py-4"
              style={{ borderColor: "#293650" }}
            >
              <div>
                <h2 className="font-bold text-white">Уведомления</h2>
                <p className="mt-1 text-xs text-[#9AA8BD]">
                  {unreadCount > 0 ? `${unreadCount} непрочитанных` : "Всё просмотрено"}
                </p>
              </div>

              <button
                type="button"
                onClick={markAllAsRead}
                disabled={unreadCount === 0 || updating}
                className="text-xs font-semibold transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                style={{ color: "#3978FF" }}
              >
                {updating ? "Обработка..." : "Прочитать все"}
              </button>
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              {loading ? (
                <div className="px-4 py-10 text-center text-sm text-[#9AA8BD]">
                  Загрузка уведомлений...
                </div>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <div className="mb-3 text-3xl">♧</div>
                  <p className="font-semibold text-white">Пока нет уведомлений</p>
                  <p className="mt-1 text-xs text-[#9AA8BD]">
                    Здесь будут появляться важные события VEXORA
                  </p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <Link
                    key={notification.id}
                    href={safeHref(notification.href)}
                    onClick={() => {
                      if (!notification.is_read) void markAsRead(notification.id);
                      setOpen(false);
                    }}
                    className="flex gap-3 border-b px-4 py-4 transition hover:bg-white/[0.04]"
                    style={{
                      borderColor: "#293650",
                      background: notification.is_read
                        ? "transparent"
                        : "rgba(57,120,255,0.06)",
                    }}
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                      style={{ background: "#292B2F", color: "#3978FF" }}
                    >
                      {notificationIcon(notification.type)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-white">
                          {notification.title}
                        </p>
                        {!notification.is_read && (
                          <span
                            className="mt-1 h-2 w-2 shrink-0 rounded-full"
                            style={{ background: "#3978FF" }}
                          />
                        )}
                      </div>

                      <p className="mt-1 text-xs leading-5 text-[#B0B2B7]">
                        {notification.body}
                      </p>
                      <p className="mt-2 text-[10px] text-[#777A80]">
                        {formatDate(notification.created_at)}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>

            <div
              className="flex items-center justify-between border-t px-4 py-3"
              style={{ borderColor: "#293650" }}
            >
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="text-xs font-bold transition hover:text-white"
                style={{ color: "#3978FF" }}
              >
                Все уведомления →
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs font-semibold text-[#9AA8BD] transition hover:text-white"
              >
                Закрыть
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
