"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type PlayerStats = {
  user_id: string;
  xp: number;
  level: number;
  messages_sent: number;
  friends_count: number;
};

type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: string;
  xp_reward: number;
  sort_order: number;
};

type EarnedAchievement = {
  achievement_id: string;
  earned_at: string;
};

const C = {
  bg: "#0A0E18",
  surface: "#121A2A",
  surface2: "#19243A",
  border: "#293650",
  orange: "#3978FF",
  muted: "#9AA8BD",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export default function AchievementsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [catalog, setCatalog] = useState<Achievement[]>([]);
  const [earned, setEarned] = useState<EarnedAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async (id: string) => {
    const [statsResult, catalogResult, earnedResult] = await Promise.all([
      supabase
        .from("player_stats")
        .select("user_id, xp, level, messages_sent, friends_count")
        .eq("user_id", id)
        .maybeSingle(),
      supabase
        .from("achievements")
        .select("id, title, description, icon, xp_reward, sort_order")
        .order("sort_order", { ascending: true }),
      supabase
        .from("user_achievements")
        .select("achievement_id, earned_at")
        .eq("user_id", id)
        .order("earned_at", { ascending: false }),
    ]);

    const firstError = statsResult.error || catalogResult.error || earnedResult.error;
    if (firstError) {
      setError("Не удалось загрузить прогресс: " + firstError.message);
    } else {
      setStats((statsResult.data as PlayerStats | null) ?? null);
      setCatalog((catalogResult.data ?? []) as Achievement[]);
      setEarned((earnedResult.data ?? []) as EarnedAchievement[]);
      setError("");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function initialize() {
      const { data, error: authError } = await supabase.auth.getUser();
      if (!active) return;

      if (authError || !data.user) {
        setLoading(false);
        return;
      }

      const id = data.user.id;
      setUserId(id);
      await loadData(id);
      if (!active) return;

      channel = supabase
        .channel(`gamification-${id}`)
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "player_stats",
          filter: `user_id=eq.${id}`,
        }, () => {
          if (active) void loadData(id);
        })
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "user_achievements",
          filter: `user_id=eq.${id}`,
        }, () => {
          if (active) void loadData(id);
        })
        .subscribe();
    }

    initialize();

    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [loadData]);

  const earnedMap = useMemo(
    () => new Map(earned.map((item) => [item.achievement_id, item.earned_at])),
    [earned]
  );

  const xp = stats?.xp ?? 0;
  const level = stats?.level ?? 1;
  const xpInLevel = xp % 100;
  const xpToNext = 100 - xpInLevel;
  const progress = xpInLevel;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-white" style={{ background: C.bg }}>
        Загружаем достижения VEXORA...
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5 text-white" style={{ background: C.bg }}>
        <div className="text-center">
          <div className="text-5xl">🏆</div>
          <h1 className="mt-5 text-2xl font-black">Войди в аккаунт</h1>
          <p className="mt-2 text-sm" style={{ color: C.muted }}>Достижения и опыт сохраняются в твоём профиле.</p>
          <Link href="/auth" className="mt-5 inline-block rounded-xl px-5 py-3 font-bold text-black" style={{ background: C.orange }}>Перейти ко входу</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 py-8 text-white sm:py-12" style={{ background: C.bg }}>
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <Link href="/" className="text-sm font-bold" style={{ color: C.orange }}>← На главную</Link>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.25em]" style={{ color: C.orange }}>VEXORA / PLAYER PROGRESSION</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Достижения</h1>
          <p className="mt-2 text-sm" style={{ color: C.muted }}>Получай опыт, повышай уровень и открывай награды за активность.</p>
        </header>

        {error && (
          <div className="mb-5 rounded-xl border p-4 text-sm" style={{ borderColor: "#7F1D1D", background: "rgba(127,29,29,0.15)", color: "#FCA5A5" }}>
            {error}
          </div>
        )}

        <section className="mb-8 grid gap-4 md:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl border p-6 sm:p-7" style={{ background: C.surface, borderColor: C.border }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: C.muted }}>Текущий уровень</p>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="text-5xl font-black" style={{ color: C.orange }}>{level}</span>
                  <span className="text-lg font-bold">Уровень игрока</span>
                </div>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl" style={{ background: "rgba(57,120,255,0.12)" }}>⭐</div>
            </div>
            <div className="mt-7 flex items-center justify-between text-sm">
              <span className="font-bold">{xp} XP</span>
              <span style={{ color: C.muted }}>{xpToNext} XP до уровня {level + 1}</span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full" style={{ background: C.surface2 }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: C.orange }} />
            </div>
            <p className="mt-3 text-xs" style={{ color: C.muted }}>Каждые 100 XP открывают следующий уровень.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border p-5" style={{ background: C.surface, borderColor: C.border }}>
              <p className="text-xs font-bold" style={{ color: C.muted }}>Сообщения</p>
              <p className="mt-3 text-3xl font-black">{stats?.messages_sent ?? 0}</p>
              <p className="mt-1 text-xs" style={{ color: C.muted }}>Отправлено</p>
            </div>
            <div className="rounded-2xl border p-5" style={{ background: C.surface, borderColor: C.border }}>
              <p className="text-xs font-bold" style={{ color: C.muted }}>Друзья</p>
              <p className="mt-3 text-3xl font-black">{stats?.friends_count ?? 0}</p>
              <p className="mt-1 text-xs" style={{ color: C.muted }}>Новые знакомства</p>
            </div>
            <div className="col-span-2 rounded-2xl border p-5" style={{ background: C.surface, borderColor: C.border }}>
              <p className="text-xs font-bold" style={{ color: C.muted }}>Открыто достижений</p>
              <p className="mt-2 text-3xl font-black">{earned.length}<span className="ml-2 text-base font-semibold" style={{ color: C.muted }}>/ {catalog.length}</span></p>
            </div>
          </div>
        </section>

        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black">Коллекция достижений</h2>
          <span className="text-xs" style={{ color: C.muted }}>{earned.length} из {catalog.length} открыто</span>
        </div>

        {catalog.length === 0 ? (
          <div className="rounded-2xl border p-10 text-center" style={{ background: C.surface, borderColor: C.border }}>
            <p className="font-bold">Список достижений пока пуст</p>
            <p className="mt-2 text-sm" style={{ color: C.muted }}>Проверь, что SQL-миграция выполнена в Supabase.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {catalog.map((item) => {
              const earnedAt = earnedMap.get(item.id);
              const unlocked = Boolean(earnedAt);
              return (
                <article key={item.id} className="flex gap-4 rounded-2xl border p-5"
                  style={{ background: C.surface, borderColor: unlocked ? "rgba(57,120,255,0.45)" : C.border, opacity: unlocked ? 1 : 0.68 }}>
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl"
                    style={{ background: unlocked ? "rgba(57,120,255,0.14)" : C.surface2, filter: unlocked ? "none" : "grayscale(1)" }}>
                    {item.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">{item.title}</h3>
                      {unlocked && <span className="rounded-full px-2 py-0.5 text-[9px] font-black" style={{ background: "rgba(57,120,255,0.15)", color: C.orange }}>ОТКРЫТО</span>}
                    </div>
                    <p className="mt-1 text-sm leading-5" style={{ color: C.muted }}>{item.description}</p>
                    <p className="mt-3 text-[11px] font-semibold" style={{ color: unlocked ? C.orange : "#777A80" }}>
                      {unlocked ? `Получено: ${formatDate(earnedAt!)}` : "Пока не получено"}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="mt-8 rounded-2xl border p-5" style={{ background: C.surface, borderColor: C.border }}>
          <h2 className="font-bold">Как получать опыт?</h2>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3" style={{ color: C.muted }}>
            <p><span className="font-bold" style={{ color: C.orange }}>+5 XP</span> за личное сообщение (до 10 сообщений в день).</p>
            <p><span className="font-bold" style={{ color: C.orange }}>+25 XP</span> каждому игроку за нового друга.</p>
            <p><span className="font-bold" style={{ color: C.orange }}>+100 XP</span> за одобрение заявки разработчика.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
