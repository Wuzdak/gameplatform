
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import NotificationBell from "../components/notification-bell";

type PlayerProgress = {
  xp: number;
  level: number;
};

type RecentAchievement = {
  achievement_id: string;
  earned_at: string;
  achievement: {
    title: string;
    icon: string;
  } | null;
};

type Game = {
  id: string;
  title: string;
  description: string;
  genre: string;
  price: number;
  image_url: string | null;
  launch_url: string | null;
  is_published: boolean;
  created_at: string;
};

const C = {
  bg: "#0A0E18",
  surface: "#121A2A",
  surface2: "#19243A",
  border: "#293650",
  orange: "#3978FF",
  text: "#EDF3FF",
  muted: "#9AA8BD",
};

const money = (price: number) =>
  Number(price) === 0
    ? "Бесплатно"
    : `${Number(price).toLocaleString("ru-RU")} ₽`;

function Logo({ size = "normal" }: { size?: "normal" | "large" }) {
  const large = size === "large";

  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5">
      <div
        className={`flex items-center justify-center rounded-xl font-black text-white ${
          large ? "h-12 w-12 text-2xl" : "h-9 w-9 text-xl"
        }`}
        style={{
          background: "linear-gradient(135deg, #3978FF 0%, #83B2FF 100%)",
          boxShadow: "0 5px 25px rgba(57,120,255,0.22)",
        }}
      >
        V
      </div>

      <span
        className={`font-black tracking-tight ${
          large ? "text-2xl" : "text-lg"
        }`}
      >
        VEX<span style={{ color: C.orange }}>ORA</span>
      </span>
    </Link>
  );
}

export default function Home() {
  const [games, setGames] = useState<Game[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [gamesError, setGamesError] = useState("");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Все");
  const [addingGame, setAddingGame] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [user, setUser] = useState<User | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [playerProgress, setPlayerProgress] = useState<PlayerProgress | null>(null);
  const [recentAchievements, setRecentAchievements] = useState<RecentAchievement[]>([]);

  useEffect(() => {
    async function loadGames() {
      setLoadingGames(true);
      setGamesError("");

      const { data, error } = await supabase
        .from("games")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (error) {
        setGamesError("Не удалось загрузить игры: " + error.message);
      } else {
        setGames(data ?? []);
      }

      setLoadingGames(false);
    }

    loadGames();
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setUser(data.session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setUnreadMessages(0);
      return;
    }

    const currentUserId = user.id;
    let active = true;

    async function loadUnreadMessages() {
      const { data, error } = await supabase
        .from("messages")
        .select("id")
        .eq("receiver_id", currentUserId)
        .eq("is_read", false);

      if (!active) return;

      if (error) {
        console.error("VEXORA unread messages query failed:", error);
        return;
      }

      setUnreadMessages(data?.length ?? 0);
    }

    const refreshUnreadMessages = () => {
      void loadUnreadMessages();
    };

    refreshUnreadMessages();

    // Обновляем счётчик при возврате на вкладку и при открытии меню,
    // а также периодически, чтобы не зависеть от Realtime.
    const refreshTimer = setInterval(refreshUnreadMessages, 5000);
    window.addEventListener("focus", refreshUnreadMessages);
    document.addEventListener("visibilitychange", refreshUnreadMessages);

    return () => {
      active = false;
      clearInterval(refreshTimer);
      window.removeEventListener("focus", refreshUnreadMessages);
      document.removeEventListener("visibilitychange", refreshUnreadMessages);
    };
  }, [user]);

  useEffect(() => {
    let active = true;

    async function loadPlayerProgress() {
      if (!user) {
        setPlayerProgress(null);
        setRecentAchievements([]);
        return;
      }

      const [statsResult, earnedResult] = await Promise.all([
        supabase
          .from("player_stats")
          .select("xp, level")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("user_achievements")
          .select("achievement_id, earned_at, achievement:achievements(title, icon)")
          .eq("user_id", user.id)
          .order("earned_at", { ascending: false })
          .limit(3),
      ]);

      if (!active) return;
      setPlayerProgress((statsResult.data as PlayerProgress | null) ?? { xp: 0, level: 1 });
      if (!earnedResult.error) {
        setRecentAchievements((earnedResult.data ?? []) as unknown as RecentAchievement[]);
      }
    }

    void loadPlayerProgress();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!menuOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  const categories = [
    "Все",
    ...Array.from(new Set(games.map((game) => game.genre))).sort(),
  ];

  const filteredGames = games.filter((game) => {
    const query = search.trim().toLowerCase();

    const matchesSearch =
      game.title.toLowerCase().includes(query) ||
      game.genre.toLowerCase().includes(query) ||
      (game.description ?? "").toLowerCase().includes(query);

    const matchesCategory =
      activeCategory === "Все" || game.genre === activeCategory;

    return matchesSearch && matchesCategory;
  });

  function goToCatalog() {
    setMenuOpen(false);

    document.getElementById("games")?.scrollIntoView({
      behavior: "smooth",
    });
  }

  async function handleSignOut() {
    setSigningOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      window.alert("Не удалось выйти: " + error.message);
    }

    setSigningOut(false);
  }

  async function addToLibrary(game: Game) {
    setMessages((previous) => ({
      ...previous,
      [game.id]: "",
    }));

    setAddingGame(game.id);

    try {
      const { data, error: userError } =
        await supabase.auth.getUser();

      if (userError || !data.user) {
        window.location.href = "/auth";
        return;
      }

      const { error } = await supabase.from("user_library").insert({
        user_id: data.user.id,
        game_title: game.title,
        genre: game.genre,
        image_url: game.image_url,
        launch_url: game.launch_url,
      });

      if (error) {
        setMessages((previous) => ({
          ...previous,
          [game.id]:
            error.code === "23505"
              ? "Эта игра уже есть в библиотеке."
              : "Ошибка: " + error.message,
        }));
      } else {
        setMessages((previous) => ({
          ...previous,
          [game.id]: "Игра успешно добавлена!",
        }));
      }
    } catch {
      setMessages((previous) => ({
        ...previous,
        [game.id]: "Не удалось выполнить запрос. Попробуй ещё раз.",
      }));
    } finally {
      setAddingGame(null);
    }
  }

  function openGame(gameId: string) {
    window.location.href = `/game/${gameId}`;
  }

  const displayName =
    user?.user_metadata?.full_name || user?.email || "Пользователь";

  return (
    <main className="min-h-screen text-white" style={{ background: C.bg }}>
      {/* HEADER */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-2xl"
        style={{
          background: "rgba(17,18,20,0.96)",
          borderColor: C.border,
        }}
      >
        <div className="mx-auto max-w-7xl px-5 py-3 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMenuOpen((previous) => !previous)}
                aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
                aria-expanded={menuOpen}
                aria-controls="vexora-sidebar"
                className="flex h-10 w-10 items-center justify-center rounded-xl border text-xl transition hover:bg-white/10"
                style={{
                  borderColor: C.border,
                  color: C.text,
                }}
              >
                {menuOpen ? "×" : "☰"}
              </button>

              <Logo />
            </div>

            <div className="relative mx-auto hidden w-full max-w-xl md:block">
              <span
                className="absolute left-4 top-1/2 -translate-y-1/2 text-xl"
                style={{ color: C.orange }}
              >
                ⌕
              </span>

              <input
                type="search"
                placeholder="Поиск игр, жанров и описаний..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") goToCatalog();
                }}
                className="w-full rounded-xl border py-3 pl-11 pr-11 text-sm text-white outline-none transition focus:border-blue-500"
                style={{
                  background: C.surface,
                  borderColor: C.border,
                }}
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Очистить поиск"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-sm hover:bg-white/10"
                  style={{ color: C.muted }}
                >
                  ×
                </button>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <NotificationBell />
              {user ? (
                <>
                  <Link
                    href="/profile"
                    className="hidden max-w-40 truncate rounded-xl border px-3 py-2.5 text-sm font-semibold transition hover:bg-white/5 sm:block"
                    style={{
                      borderColor: C.border,
                      background: C.surface,
                    }}
                  >
                    {displayName}
                  </Link>

                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="rounded-xl px-3 py-2.5 text-xs font-semibold transition hover:bg-white/10 disabled:opacity-50 sm:text-sm"
                    style={{ color: C.muted }}
                  >
                    {signingOut ? "Выход..." : "Выйти"}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/auth"
                    className="hidden rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:bg-white/5 sm:block"
                    style={{ borderColor: C.border }}
                  >
                    Войти
                  </Link>

                  <Link
                    href="/auth"
                    className="rounded-xl px-3 py-2.5 text-xs font-bold text-black transition hover:brightness-110 sm:px-4 sm:text-sm"
                    style={{ background: C.orange }}
                  >
                    Регистрация
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="relative mt-3 md:hidden">
            <span
              className="absolute left-4 top-1/2 -translate-y-1/2 text-xl"
              style={{ color: C.orange }}
            >
              ⌕
            </span>

            <input
              type="search"
              placeholder="Поиск игр..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") goToCatalog();
              }}
              className="w-full rounded-xl border py-3 pl-11 pr-11 text-sm text-white outline-none"
              style={{
                background: C.surface,
                borderColor: C.border,
              }}
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Очистить поиск"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-sm"
                style={{ color: C.muted }}
              >
                ×
              </button>
            )}
          </div>
        </div>
      </header>

      {/* OVERLAY */}
      <button
        type="button"
        aria-label="Закрыть меню"
        tabIndex={menuOpen ? 0 : -1}
        onClick={() => setMenuOpen(false)}
        className={`fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm transition-opacity ${
          menuOpen
            ? "visible opacity-100"
            : "invisible pointer-events-none opacity-0"
        }`}
      />

      {/* SIDEBAR */}
      <aside
        id="vexora-sidebar"
        aria-label="Главная навигация"
        aria-hidden={!menuOpen}
        className={`fixed left-0 top-0 z-[70] flex h-[100dvh] w-[280px] max-w-[85vw] flex-col border-r transition-transform duration-300 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background: "#101827",
          borderColor: C.border,
        }}
      >
        <div
          className="flex items-center justify-between border-b p-5"
          style={{ borderColor: C.border }}
        >
          <Logo />

          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Закрыть меню"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-2xl hover:bg-white/10"
            style={{ color: C.muted }}
          >
            ×
          </button>
        </div>

        {user && (
          <Link
            href="/profile"
            onClick={() => setMenuOpen(false)}
            className="mx-4 mt-5 rounded-xl border p-4 transition hover:bg-white/5"
            style={{ borderColor: C.border }}
          >
            <p className="text-xs" style={{ color: C.muted }}>
              Ваш аккаунт
            </p>
            <p className="mt-1 truncate text-sm font-bold">
              {displayName}
            </p>
            <p
              className="mt-2 text-xs font-semibold"
              style={{ color: C.orange }}
            >
              Открыть профиль →
            </p>
          </Link>
        )}

        <nav className="flex-1 space-y-2 overflow-y-auto p-4">
          <p
            className="mb-4 px-3 text-[10px] font-black uppercase tracking-[0.25em]"
            style={{ color: C.muted }}
          >
            Основное меню
          </p>

          {[
            { icon: "⌂", title: "Главная", href: "#store" },
            { icon: "▣", title: "Магазин", href: "#store" },
            { icon: "▦", title: "Каталог игр", href: "#games" },
            { icon: "✦", title: "Предложения", href: "#offers" },
          ].map((item) => (
            <a
              key={item.title}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-white/5"
              style={{ color: C.text }}
            >
              <span
                className="w-5 text-center text-lg"
                style={{ color: C.orange }}
              >
                {item.icon}
              </span>
              {item.title}
            </a>
          ))}

          <div className="my-5 border-t" style={{ borderColor: C.border }} />

          <p
            className="mb-4 px-3 text-[10px] font-black uppercase tracking-[0.25em]"
            style={{ color: C.muted }}
          >
            Личный кабинет
          </p>

          <Link
            href="/library"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-white/5"
            style={{ color: C.text }}
          >
            <span className="w-5 text-center text-lg" style={{ color: C.orange }}>▤</span>
            Библиотека
          </Link>

          <Link
            href="/messages"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-white/5"
            style={{ color: C.text }}
          >
            <span className="w-5 text-center text-lg" style={{ color: C.orange }}>✉</span>
            <span className="min-w-0 flex-1">Личные сообщения</span>
            {unreadMessages > 0 && (
              <span
                aria-label={`${unreadMessages} непрочитанных сообщений`}
                className="flex min-w-6 items-center justify-center rounded-full px-2 py-1 text-[10px] font-black text-black"
                style={{ background: C.orange }}
              >
                {unreadMessages > 99 ? "99+" : unreadMessages}
              </span>
            )}
          </Link>

          <Link
            href="/profile"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-white/5"
            style={{ color: C.text }}
          >
            <span className="w-5 text-center text-lg" style={{ color: C.orange }}>♙</span>
            Профиль
          </Link>
          <Link
            href="/achievements"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-white/5"
            style={{ color: C.text }}
          >
            <span className="w-5 text-center text-lg" style={{ color: C.orange }}>🏆</span>
            Достижения
          </Link>
        </nav>

        <div className="border-t p-5" style={{ borderColor: C.border }}>
          {user ? (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                handleSignOut();
              }}
              disabled={signingOut}
              className="w-full rounded-xl border px-4 py-3 text-sm font-semibold transition hover:bg-white/5 disabled:opacity-50"
              style={{
                borderColor: C.border,
                color: C.muted,
              }}
            >
              {signingOut ? "Выход..." : "Выйти из аккаунта"}
            </button>
          ) : (
            <Link
              href="/auth"
              onClick={() => setMenuOpen(false)}
              className="block rounded-xl py-3 text-center text-sm font-bold text-black transition hover:brightness-110"
              style={{ background: C.orange }}
            >
              Войти в аккаунт
            </Link>
          )}

          <p
            className="mt-4 text-center text-[10px]"
            style={{ color: "#66686D" }}
          >
            VEXORA © 2026
          </p>
        </div>
      </aside>

      {/* HERO */}
      <section id="store" className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute -right-40 -top-32 h-[550px] w-[550px] rounded-full blur-[140px]"
          style={{ background: "rgba(57,120,255,0.10)" }}
        />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 lg:grid-cols-2 lg:px-8 lg:py-28">
          <div className="relative z-10">
            <div
              className="mb-7 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-widest"
              style={{
                background: "rgba(57,120,255,0.08)",
                borderColor: "rgba(57,120,255,0.25)",
                color: C.orange,
              }}
            >
              <span>✦</span>
              Добро пожаловать в VEXORA
            </div>

            <h1 className="text-5xl font-black leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
              Больше игр.
              <br />
              Больше
              <br />
              <span style={{ color: C.orange }}>впечатлений.</span>
            </h1>

            <p
              className="mt-7 max-w-lg text-base leading-8 sm:text-lg"
              style={{ color: C.muted }}
            >
              Открывай новые игровые миры, находи любимые проекты
              и собирай собственную коллекцию в едином пространстве VEXORA.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <a
                href="#games"
                className="rounded-xl px-7 py-4 text-sm font-black text-black transition hover:-translate-y-1 hover:brightness-110"
                style={{
                  background: C.orange,
                  boxShadow: "0 10px 35px rgba(57,120,255,0.18)",
                }}
              >
                Исследовать каталог →
              </a>

              <Link
                href="/library"
                className="rounded-xl border px-7 py-4 text-sm font-bold transition hover:bg-white/5"
                style={{
                  borderColor: C.border,
                  background: C.surface,
                }}
              >
                Моя библиотека
              </Link>
            </div>

            <div className="mt-12 flex flex-wrap gap-8">
              <div>
                <p className="text-2xl font-black">{games.length}+</p>
                <p className="mt-1 text-xs" style={{ color: C.muted }}>
                  Игр в каталоге
                </p>
              </div>

              <div>
                <p className="text-2xl font-black">24/7</p>
                <p className="mt-1 text-xs" style={{ color: C.muted }}>
                  Доступ к коллекции
                </p>
              </div>

              <div>
                <p className="text-2xl font-black">V</p>
                <p className="mt-1 text-xs" style={{ color: C.muted }}>
                  Enter the Game
                </p>
              </div>
            </div>
          </div>

          {/* HERO ART */}
          <div className="relative mx-auto w-full max-w-xl">
            <div
              className="absolute inset-8 rounded-full blur-[90px]"
              style={{ background: "rgba(57,120,255,0.16)" }}
            />

            <div
              className="relative flex aspect-[5/4] items-center justify-center overflow-hidden rounded-3xl border"
              style={{
                borderColor: "#38332F",
                background:
                  "radial-gradient(ellipse at 65% 35%, #63402C 0%, #30251F 35%, #19191A 75%, #0A0E18 100%)",
                boxShadow: "0 30px 100px rgba(0,0,0,0.45)",
              }}
            >
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, transparent 45%, rgba(57,120,255,0.15) 45.2%, transparent 45.5%)",
                  backgroundSize: "45px 45px",
                }}
              />

              <div
                className="absolute -right-10 -top-10 h-64 w-64 rounded-full border"
                style={{ borderColor: "rgba(57,120,255,0.25)" }}
              />

              <div
                className="absolute -right-1 -top-1 h-48 w-48 rounded-full border"
                style={{ borderColor: "rgba(57,120,255,0.2)" }}
              />

              <div
                className="absolute -bottom-20 -left-10 h-72 w-72 rounded-full border"
                style={{ borderColor: "rgba(255,255,255,0.08)" }}
              />

              <div className="relative z-10 text-center">
                <div
                  className="mx-auto flex h-28 w-28 items-center justify-center rounded-3xl border text-6xl font-black sm:h-36 sm:w-36 sm:text-7xl"
                  style={{
                    color: C.orange,
                    borderColor: "rgba(57,120,255,0.35)",
                    background: "rgba(17,18,20,0.65)",
                    boxShadow: "0 0 65px rgba(57,120,255,0.18)",
                  }}
                >
                  V
                </div>

                <p className="mt-7 text-2xl font-black sm:text-3xl">
                  ENTER THE GAME
                </p>

                <p
                  className="mt-3 text-xs font-bold tracking-[0.35em]"
                  style={{ color: C.orange }}
                >
                  VEXORA GAMING STORE
                </p>
              </div>

              <div
                className="absolute bottom-5 left-5 rounded-xl border px-4 py-3 backdrop-blur-xl"
                style={{
                  borderColor: "rgba(255,255,255,0.1)",
                  background: "rgba(17,18,20,0.75)",
                }}
              >
                <p className="text-xs font-bold">ТВОЯ КОЛЛЕКЦИЯ</p>
                <p className="mt-1 text-[10px]" style={{ color: C.muted }}>
                  Всё любимое в одном месте
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PLAYER ACHIEVEMENTS */}
      {user && (
        <section className="mx-auto max-w-7xl px-5 pt-8 lg:px-8">
          <div
            className="relative overflow-hidden rounded-3xl border p-6 sm:p-8"
            style={{
              background: "linear-gradient(115deg, rgba(57,120,255,0.13), rgba(27,29,32,0.98) 55%)",
              borderColor: "rgba(57,120,255,0.28)",
            }}
          >
            <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full blur-3xl" style={{ background: "rgba(57,120,255,0.12)" }} />
            <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: C.orange }}>VEXORA PLAYER CLUB</p>
                <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
                  <h2 className="text-2xl font-black sm:text-3xl">Твой игровой прогресс</h2>
                  <span className="rounded-full px-3 py-1 text-xs font-black" style={{ color: C.orange, background: "rgba(57,120,255,0.13)" }}>
                    УРОВЕНЬ {playerProgress?.level ?? 1}
                  </span>
                </div>
                <p className="mt-2 text-sm" style={{ color: C.muted }}>Зарабатывай опыт за активность на VEXORA и собирай уникальные достижения.</p>
                <div className="mt-5 max-w-xl">
                  <div className="mb-2 flex items-center justify-between text-xs font-bold">
                    <span>{playerProgress?.xp ?? 0} XP всего</span>
                    <span style={{ color: C.muted }}>{(playerProgress?.xp ?? 0) % 100}/100 XP до следующего уровня</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full" style={{ background: C.surface2 }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${(playerProgress?.xp ?? 0) % 100}%`, background: C.orange }} />
                  </div>
                </div>
              </div>
              <div className="flex w-full flex-col gap-3 lg:w-72">
                <div className="rounded-2xl border p-4" style={{ borderColor: C.border, background: "rgba(17,18,20,0.55)" }}>
                  <p className="text-xs font-bold" style={{ color: C.muted }}>Последние достижения</p>
                  {recentAchievements.length ? (
                    <div className="mt-3 space-y-3">
                      {recentAchievements.map((item) => (
                        <div key={item.achievement_id} className="flex items-center gap-3 text-sm">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "rgba(57,120,255,0.12)" }}>{item.achievement?.icon ?? "🏆"}</span>
                          <span className="truncate font-semibold">{item.achievement?.title ?? "Достижение открыто"}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm" style={{ color: C.muted }}>Пока нет открытых наград. Всё впереди!</p>
                  )}
                </div>
                <Link href="/achievements" className="rounded-xl px-5 py-3 text-center text-sm font-black text-black transition hover:brightness-110" style={{ background: C.orange }}>
                  Смотреть достижения →
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* BENEFITS */}
      <section className="mx-auto grid max-w-7xl gap-4 px-5 pb-16 sm:grid-cols-3 lg:px-8">
        {[
          ["01", "Большой выбор", "Игры разных жанров в одном магазине."],
          ["02", "Твоя коллекция", "Собирай любимые игры в библиотеке."],
          ["03", "Игровое сообщество", "Находи друзей и общайся."],
        ].map(([number, title, description]) => (
          <div
            key={number}
            className="group rounded-2xl border p-6 transition duration-300 hover:-translate-y-1"
            style={{
              background: C.surface,
              borderColor: C.border,
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-3xl font-black" style={{ color: C.orange }}>
                {number}
              </span>
              <span className="h-2 w-2 rounded-full" style={{ background: C.orange }} />
            </div>

            <h3 className="mt-5 text-lg font-bold">{title}</h3>
            <p className="mt-2 text-sm leading-6" style={{ color: C.muted }}>
              {description}
            </p>
          </div>
        ))}
      </section>

      {/* GAMES */}
      <section id="games" className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <div className="mb-9">
          <p
            className="mb-3 text-xs font-black uppercase tracking-[0.25em]"
            style={{ color: C.orange }}
          >
            GAME DISCOVERY
          </p>

          <h2 className="text-3xl font-black sm:text-4xl">Каталог игр</h2>

          <p className="mt-3 text-sm" style={{ color: C.muted }}>
            Найди игру, которая станет твоей следующей любимой.
          </p>

          {search && (
            <p className="mt-3 text-xs" style={{ color: C.muted }}>
              Результаты поиска: {filteredGames.length}
            </p>
          )}
        </div>

        <div className="mb-9 flex gap-2 overflow-x-auto pb-3">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className="shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold transition"
              style={
                activeCategory === category
                  ? { background: C.orange, color: "#171717" }
                  : {
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                      color: C.muted,
                    }
              }
            >
              {category}
            </button>
          ))}
        </div>

        {loadingGames && (
          <div
            className="rounded-2xl border py-20 text-center"
            style={{ background: C.surface, borderColor: C.border }}
          >
            <div
              className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
              style={{ borderColor: `${C.orange} transparent ${C.orange} ${C.orange}` }}
            />
            <p className="mt-5 font-bold">Загружаем каталог...</p>
            <p className="mt-2 text-sm" style={{ color: C.muted }}>
              Подключаемся к VEXORA
            </p>
          </div>
        )}

        {!loadingGames && gamesError && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 py-12 text-center">
            <p className="font-bold text-red-300">Ошибка загрузки каталога</p>
            <p className="mt-3 px-4 text-sm text-gray-300">{gamesError}</p>
          </div>
        )}

        {!loadingGames && !gamesError && (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredGames.map((game) => (
                <article
                  key={game.id}
                  onClick={() => openGame(game.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openGame(game.id);
                    }
                  }}
                  role="link"
                  tabIndex={0}
                  aria-label={`Открыть страницу игры ${game.title}`}
                  className="group cursor-pointer overflow-hidden rounded-2xl border transition duration-300 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    background: C.surface,
                    borderColor: C.border,
                  }}
                >
                  <div
                    className="relative h-52 overflow-hidden"
                    style={{
                      background: game.image_url
                        ? `url("${game.image_url}") center/cover`
                        : "linear-gradient(135deg,#252F3D,#121A2A)",
                    }}
                  >
                    {!game.image_url && (
                      <div
                        className="flex h-full items-center justify-center text-6xl font-black"
                        style={{ color: C.orange }}
                      >
                        V
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                    <span
                      className="absolute left-4 top-4 rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md"
                      style={{
                        color: C.text,
                        background: "rgba(17,18,20,0.75)",
                        borderColor: "rgba(255,255,255,0.15)",
                      }}
                    >
                      В каталоге
                    </span>

                    <span
                      className="absolute bottom-4 left-4 text-xs font-bold"
                      style={{ color: "#C9D8FF" }}
                    >
                      {game.genre}
                    </span>
                  </div>

                  <div className="p-5">
                    <h3 className="text-lg font-bold transition group-hover:text-blue-400">
                      {game.title}
                    </h3>

                    {game.description && (
                      <p
                        className="mt-2 min-h-10 line-clamp-2 text-sm leading-5"
                        style={{ color: C.muted }}
                      >
                        {game.description}
                      </p>
                    )}

                    <div
                      className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4"
                      style={{ borderColor: C.border }}
                    >
                      <p className="text-lg font-black">{money(game.price)}</p>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          addToLibrary(game);
                        }}
                        disabled={addingGame !== null}
                        className="relative z-10 rounded-xl px-4 py-2.5 text-xs font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ background: C.orange }}
                      >
                        {addingGame === game.id ? "Добавление..." : "В библиотеку"}
                      </button>
                    </div>

                    {messages[game.id] && (
                      <p
                        className="mt-3 rounded-lg p-3 text-xs"
                        style={{
                          background: "rgba(57,120,255,0.08)",
                          color: "#B8CEFF",
                        }}
                      >
                        {messages[game.id]}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>

            {games.length === 0 && (
              <div
                className="rounded-2xl border py-16 text-center"
                style={{ background: C.surface, borderColor: C.border }}
              >
                <p className="text-2xl font-black">Пока нет игр</p>
                <p className="mt-3 text-sm" style={{ color: C.muted }}>
                  Новые игры появятся здесь после публикации администратором.
                </p>
              </div>
            )}

            {games.length > 0 && filteredGames.length === 0 && (
              <div
                className="rounded-2xl border py-16 text-center"
                style={{ background: C.surface, borderColor: C.border }}
              >
                <p className="text-2xl font-black">Ничего не найдено</p>
                <p className="mt-3 text-sm" style={{ color: C.muted }}>
                  Измени поисковый запрос или категорию.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setActiveCategory("Все");
                  }}
                  className="mt-5 rounded-xl px-5 py-3 text-sm font-bold text-black transition hover:brightness-110"
                  style={{ background: C.orange }}
                >
                  Сбросить фильтры
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* OFFERS */}
      <section id="offers" className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <div
          className="relative overflow-hidden rounded-3xl border p-8 sm:p-12 lg:p-16"
          style={{
            background:
              "radial-gradient(ellipse at 90% 20%, rgba(57,120,255,0.20), transparent 45%), #121A2A",
            borderColor: "rgba(57,120,255,0.25)",
          }}
        >
          <div className="absolute -right-10 -top-20 text-[250px] font-black leading-none opacity-[0.04]">
            V
          </div>

          <div className="relative z-10 max-w-2xl">
            <p
              className="text-xs font-black uppercase tracking-[0.3em]"
              style={{ color: C.orange }}
            >
              YOUR NEXT ADVENTURE
            </p>

            <h2 className="mt-5 text-3xl font-black leading-tight sm:text-5xl">
              Твоя следующая
              <br />
              игра уже здесь.
            </h2>

            <p
              className="mt-5 max-w-lg text-sm leading-7 sm:text-base"
              style={{ color: C.muted }}
            >
              Исследуй каталог, собирай собственную коллекцию
              и открывай новые возможности вместе с VEXORA.
            </p>

            <a
              href="#games"
              className="mt-8 inline-flex rounded-xl px-7 py-4 text-sm font-black text-black transition hover:-translate-y-1 hover:brightness-110"
              style={{ background: C.orange }}
            >
              Открыть каталог →
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        className="mt-10 border-t"
        style={{
          background: "#080C14",
          borderColor: C.border,
        }}
      >
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-7 px-5 py-10 sm:flex-row sm:items-center lg:px-8">
          <div>
            <Logo />
            <p className="mt-2 text-sm" style={{ color: C.muted }}>
              ENTER THE GAME.
            </p>
          </div>

          <div className="flex flex-wrap gap-6 text-sm" style={{ color: C.muted }}>
            <a href="#store" className="transition hover:text-white">Магазин</a>
            <a href="#games" className="transition hover:text-white">Каталог</a>
            <Link href="/library" className="transition hover:text-white">Библиотека</Link>
            <Link href="/profile" className="transition hover:text-white">Профиль</Link>
          </div>

          <p className="text-xs" style={{ color: "#66686D" }}>
            © 2026 VEXORA
          </p>
        </div>
      </footer>
    </main>
  );
}
