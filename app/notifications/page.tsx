"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

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

type Filter = "all" | "unread" | "read";

const C = {
  bg: "#111214",
  surface: "#1B1D20",
  surface2: "#242629",
  border: "#303236",
  orange: "#F07832",
  text: "#E7E7E7",
  muted: "#92949A",
};

function safeHref(href: string) {
  return href.startsWith("/") && !href.startsWith("//") ? href : "/";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function iconFor(type: string) {
  switch (type) {
    case "message": return "✉";
    case "friend_request": return "♙";
    case "friend_accepted": return "✓";
    case "developer_application": return "◆";
    default: return "•";
  }
}

export default function NotificationsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const loadNotifications = useCallback(async (currentUserId: string) => {
    const { data, error } = await supabase
      .from("notifications")
      .select("id, user_id, actor_id, type, title, body, href, is_read, created_at")
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      setMessage("Не удалось загрузить уведомления: " + error.message);
    } else {
      setItems((data ?? []) as Notification[]);
      setMessage("");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function initialize() {
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;

      if (error || !data.user) {
        setUserId(null);
        setLoading(false);
        return;
      }

      const id = data.user.id;
      setUserId(id);
      await loadNotifications(id);
      if (!active) return;

      channel = supabase
        .channel(`notifications-page-${id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${id}`,
          },
          () => {
            if (active) void loadNotifications(id);
          }
        )
        .subscribe();
    }

    initialize();

    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [loadNotifications]);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.is_read).length,
    [items]
  );

  const filteredItems = useMemo(() => {
    if (filter === "unread") return items.filter((item) => !item.is_read);
    if (filter === "read") return items.filter((item) => item.is_read);
    return items;
  }, [items, filter]);

  async function markRead(id: string) {
    if (!userId) return;
    setBusyId(id);
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      setMessage("Не удалось отметить уведомление: " + error.message);
    } else {
      setItems((current) => current.map((item) =>
        item.id === id ? { ...item, is_read: true } : item
      ));
    }
    setBusyId(null);
  }

  async function markAllRead() {
    if (!userId || unreadCount === 0) return;
    setBusyId("all-read");
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) {
      setMessage("Не удалось отметить уведомления: " + error.message);
    } else {
      setItems((current) => current.map((item) => ({ ...item, is_read: true })));
      setMessage("Все уведомления отмечены как прочитанные.");
    }
    setBusyId(null);
  }

  async function deleteOne(id: string) {
    if (!userId || busyId) return;
    if (!window.confirm("Удалить это уведомление?")) return;

    setBusyId(id);
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      setMessage("Не удалось удалить уведомление. Проверь SQL-политику DELETE: " + error.message);
    } else {
      setItems((current) => current.filter((item) => item.id !== id));
    }
    setBusyId(null);
  }

  async function deleteAll() {
    if (!userId || items.length === 0 || busyId) return;
    if (!window.confirm("Удалить всю историю уведомлений? Это действие нельзя отменить.")) return;

    setBusyId("all-delete");
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", userId);

    if (error) {
      setMessage("Не удалось удалить историю. Проверь SQL-политику DELETE: " + error.message);
    } else {
      setItems([]);
      setMessage("История уведомлений очищена.");
    }
    setBusyId(null);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-white" style={{ background: C.bg }}>
        <p>Загружаем уведомления VEXORA...</p>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5 text-white" style={{ background: C.bg }}>
        <div className="text-center">
          <div className="text-5xl">🔔</div>
          <h1 className="mt-5 text-2xl font-black">Войди в аккаунт</h1>
          <p className="mt-2 text-sm" style={{ color: C.muted }}>История уведомлений доступна после авторизации.</p>
          <Link href="/auth" className="mt-5 inline-block rounded-xl px-5 py-3 font-bold text-black" style={{ background: C.orange }}>Перейти ко входу</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 py-8 text-white sm:py-12" style={{ background: C.bg }}>
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/" className="text-sm font-bold" style={{ color: C.orange }}>← На главную</Link>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.25em]" style={{ color: C.orange }}>VEXORA / ACTIVITY</p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">Уведомления</h1>
            <p className="mt-2 text-sm" style={{ color: C.muted }}>
              Всего: {items.length} · Непрочитанных: {unreadCount}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={markAllRead} disabled={unreadCount === 0 || !!busyId}
              className="rounded-xl border px-4 py-3 text-xs font-bold transition hover:bg-white/5 disabled:opacity-40"
              style={{ borderColor: C.border, color: C.orange }}>
              {busyId === "all-read" ? "Обработка..." : "Прочитать все"}
            </button>
            <button type="button" onClick={deleteAll} disabled={items.length === 0 || !!busyId}
              className="rounded-xl border px-4 py-3 text-xs font-bold transition hover:bg-red-500/10 disabled:opacity-40"
              style={{ borderColor: C.border, color: "#F87171" }}>
              {busyId === "all-delete" ? "Удаление..." : "Очистить историю"}
            </button>
          </div>
        </header>

        <div className="mb-5 flex flex-wrap gap-2">
          {([
            ["all", "Все"],
            ["unread", `Непрочитанные ${unreadCount}`],
            ["read", "Прочитанные"],
          ] as [Filter, string][]).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setFilter(value)}
              className="rounded-xl px-4 py-2.5 text-sm font-bold transition"
              style={filter === value
                ? { background: C.orange, color: "#171717" }
                : { background: C.surface, border: `1px solid ${C.border}`, color: C.muted }}>
              {label}
            </button>
          ))}
        </div>

        {message && (
          <div className="mb-5 rounded-xl border px-4 py-3 text-sm"
            style={{ borderColor: "rgba(240,120,50,0.3)", background: "rgba(240,120,50,0.08)", color: "#FFB98F" }}>
            {message}
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border" style={{ background: C.surface, borderColor: C.border }}>
          {filteredItems.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="text-4xl">🔔</div>
              <h2 className="mt-4 text-lg font-bold">
                {filter === "unread" ? "Нет непрочитанных уведомлений" : filter === "read" ? "Нет прочитанных уведомлений" : "История пока пуста"}
              </h2>
              <p className="mt-2 text-sm" style={{ color: C.muted }}>Здесь будут отображаться события твоего аккаунта VEXORA.</p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <article key={item.id} className="flex gap-3 border-b p-4 sm:gap-4 sm:p-5"
                style={{ borderColor: C.border, background: item.is_read ? "transparent" : "rgba(240,120,50,0.055)" }}>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
                  style={{ background: C.surface2, color: C.orange }}>{iconFor(item.type)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold">{item.title}</h2>
                    {!item.is_read && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "rgba(240,120,50,0.15)", color: C.orange }}>НОВОЕ</span>}
                  </div>
                  <p className="mt-1 text-sm leading-6" style={{ color: "#B0B2B7" }}>{item.body}</p>
                  <p className="mt-2 text-[11px]" style={{ color: "#777A80" }}>{formatDate(item.created_at)}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold">
                    <Link href={safeHref(item.href)} onClick={() => { if (!item.is_read) void markRead(item.id); }}
                      className="transition hover:underline" style={{ color: C.orange }}>Открыть</Link>
                    {!item.is_read && (
                      <button type="button" disabled={!!busyId} onClick={() => void markRead(item.id)}
                        className="transition hover:underline disabled:opacity-40" style={{ color: C.muted }}>
                        {busyId === item.id ? "Сохранение..." : "Отметить прочитанным"}
                      </button>
                    )}
                    <button type="button" disabled={!!busyId} onClick={() => void deleteOne(item.id)}
                      className="transition hover:underline disabled:opacity-40" style={{ color: "#F87171" }}>
                      Удалить
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
