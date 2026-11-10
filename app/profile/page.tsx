
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

type MenuItem = {
  title: string;
  description: string;
  icon: string;
  href: string;
};

const C = {
  bg: "#111214",
  surface: "#1B1D20",
  surface2: "#242629",
  border: "#303236",
  orange: "#F07832",
  text: "#E7E7E7",
  muted: "#92949A",
};

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2">
      <div
        className={`flex items-center justify-center rounded-xl font-black text-black ${
          compact ? "h-9 w-9 text-lg" : "h-10 w-10 text-xl"
        }`}
        style={{
          background: C.orange,
          boxShadow: "0 5px 25px rgba(240,120,50,0.2)",
        }}
      >
        V
      </div>

      <span className="text-lg font-black tracking-tight">
        VEX<span style={{ color: C.orange }}>ORA</span>
      </span>
    </Link>
  );
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      const { data, error: userError } = await supabase.auth.getUser();

      if (!mounted) return;

      if (userError || !data.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      setUser(data.user);

      const { data: adminData, error: adminError } = await supabase
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (!mounted) return;

      setIsAdmin(!adminError && !!adminData);
      setLoading(false);
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  async function logout() {
    if (logoutLoading) return;

    setLogoutLoading(true);
    setError("");

    const { error } = await supabase.auth.signOut();

    if (error) {
      setError("Не удалось выйти из аккаунта: " + error.message);
      setLogoutLoading(false);
      return;
    }

    window.location.href = "/auth";
  }

  const displayName =
    user?.user_metadata?.full_name || "Пользователь";

  const menuItems: MenuItem[] = [
    {
      title: "Мой профиль",
      description: "Информация об аккаунте",
      icon: "♙",
      href: "/profile",
    },
    {
      title: "Мои друзья",
      description: "Список твоих друзей",
      icon: "♧",
      href: "/friends",
    },
    {
      title: "Добавить друзей",
      description: "Найти новых игроков",
      icon: "+",
      href: "/friends",
    },
    {
      title: "Личные сообщения",
      description: "Твои переписки",
      icon: "✉",
      href: "/messages",
    },
    {
      title: "Моя библиотека",
      description: "Твои игры",
      icon: "▤",
      href: "/library",
    },
  ];

  if (loading) {
    return (
      <main
        className="flex min-h-screen items-center justify-center text-white"
        style={{ background: C.bg }}
      >
        <div className="text-center">
          <div
            className="mx-auto h-11 w-11 animate-spin rounded-full border-4 border-t-transparent"
            style={{
              borderColor: `${C.orange} transparent ${C.orange} ${C.orange}`,
            }}
          />

          <p className="mt-5 font-semibold">
            Загружаем профиль VEXORA...
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main
        className="flex min-h-screen items-center justify-center px-5 text-white"
        style={{ background: C.bg }}
      >
        <div
          className="w-full max-w-md rounded-2xl border p-10 text-center"
          style={{
            background: C.surface,
            borderColor: C.border,
          }}
        >
          <div className="text-5xl">♙</div>

          <h1 className="mt-5 text-2xl font-black">
            Ты не авторизован
          </h1>

          <p className="mt-3 text-sm" style={{ color: C.muted }}>
            Войди в аккаунт, чтобы открыть свой профиль VEXORA.
          </p>

          <Link
            href="/auth"
            className="mt-7 inline-block rounded-xl px-7 py-3 font-bold text-black transition hover:brightness-110"
            style={{ background: C.orange }}
          >
            Перейти ко входу
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen text-white"
      style={{ background: C.bg }}
    >
      {/* HEADER */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-2xl"
        style={{
          background: "rgba(17,18,20,0.96)",
          borderColor: C.border,
        }}
      >
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen((previous) => !previous)}
              aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
              aria-expanded={menuOpen}
              aria-controls="profile-sidebar"
              className="flex h-10 w-10 items-center justify-center rounded-xl border text-xl transition hover:bg-white/10"
              style={{ borderColor: C.border }}
            >
              {menuOpen ? "×" : "☰"}
            </button>

            <Logo compact />
          </div>

          <div className="hidden items-center gap-3 sm:flex">
            <Link
              href="/library"
              className="rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:bg-white/5"
              style={{
                borderColor: C.border,
                color: C.muted,
              }}
            >
              Библиотека
            </Link>

            <Link
              href="/"
              className="rounded-xl px-5 py-2.5 text-sm font-bold text-black transition hover:brightness-110"
              style={{ background: C.orange }}
            >
              Магазин
            </Link>
          </div>

          <Link
            href="/"
            className="rounded-xl px-4 py-2 text-sm font-bold text-black sm:hidden"
            style={{ background: C.orange }}
          >
            Магазин
          </Link>
        </div>
      </header>

      {/* OVERLAY */}
      <button
        type="button"
        aria-label="Закрыть меню"
        tabIndex={menuOpen ? 0 : -1}
        onClick={() => setMenuOpen(false)}
        className={`fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
          menuOpen
            ? "visible opacity-100"
            : "invisible pointer-events-none opacity-0"
        }`}
      />

      {/* SIDEBAR */}
      <aside
        id="profile-sidebar"
        aria-label="Главная навигация"
        aria-hidden={!menuOpen}
        className={`fixed left-0 top-0 z-[70] flex h-[100dvh] w-[290px] max-w-[85vw] flex-col border-r transition-transform duration-300 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background: "#17181A",
          borderColor: C.border,
        }}
      >
        <div
          className="flex items-center justify-between border-b p-5"
          style={{ borderColor: C.border }}
        >
          <div onClick={() => setMenuOpen(false)}>
            <Logo />
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Закрыть меню"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-2xl transition hover:bg-white/10"
            style={{ color: C.muted }}
          >
            ×
          </button>
        </div>

        {/* USER INFO */}
        <div
          className="border-b p-5"
          style={{ borderColor: C.border }}
        >
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl border text-2xl font-black"
            style={{
              background: "rgba(240,120,50,0.12)",
              borderColor: "rgba(240,120,50,0.25)",
              color: C.orange,
            }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>

          <p className="mt-3 font-bold">
            {displayName}
          </p>

          <p className="mt-1 truncate text-xs" style={{ color: C.muted }}>
            {user.email}
          </p>

          {isAdmin && (
            <span
              className="mt-3 inline-block rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-wider"
              style={{
                background: "rgba(240,120,50,0.12)",
                color: C.orange,
              }}
            >
              Администратор
            </span>
          )}
        </div>

        {/* NAVIGATION */}
        <nav className="flex-1 space-y-2 overflow-y-auto p-4">
          <p
            className="mb-4 px-3 text-[10px] font-black uppercase tracking-[0.25em]"
            style={{ color: C.muted }}
          >
            Основное меню
          </p>

          <Link
            href="/"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-white/5"
            style={{ color: C.text }}
          >
            <span className="w-5 text-center text-lg" style={{ color: C.orange }}>
              ⌂
            </span>
            Главная
          </Link>

          <Link
            href="/#store"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-white/5"
            style={{ color: C.text }}
          >
            <span className="w-5 text-center text-lg" style={{ color: C.orange }}>
              ▣
            </span>
            Магазин
          </Link>

          <Link
            href="/#games"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-white/5"
            style={{ color: C.text }}
          >
            <span className="w-5 text-center text-lg" style={{ color: C.orange }}>
              ▦
            </span>
            Каталог игр
          </Link>

          <div
            className="my-5 border-t"
            style={{ borderColor: C.border }}
          />

          <p
            className="mb-4 px-3 text-[10px] font-black uppercase tracking-[0.25em]"
            style={{ color: C.muted }}
          >
            Личный кабинет
          </p>

          {menuItems.map((item, index) => (
            <Link
              key={`${item.title}-${index}`}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 rounded-xl p-3 transition"
              style={
                index === 0
                  ? {
                      background: "rgba(240,120,50,0.1)",
                      color: C.orange,
                    }
                  : {
                      color: C.text,
                    }
              }
            >
              <span className="w-6 text-center text-xl">
                {item.icon}
              </span>

              <span>
                <span className="block text-sm font-bold">
                  {item.title}
                </span>

                <span
                  className="mt-1 block text-xs"
                  style={{ color: C.muted }}
                >
                  {item.description}
                </span>
              </span>
            </Link>
          ))}

          {isAdmin && (
            <>
              <div
                className="my-5 border-t"
                style={{ borderColor: C.border }}
              />

              <p
                className="mb-3 px-3 text-[10px] font-black uppercase tracking-[0.25em]"
                style={{ color: C.muted }}
              >
                Управление
              </p>

              <Link
                href="/admin"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl p-3 font-bold transition hover:bg-white/5"
                style={{ color: C.orange }}
              >
                <span className="text-xl">⚙</span>
                <span className="text-sm">
                  Панель администратора
                </span>
              </Link>
            </>
          )}
        </nav>

        {/* LOGOUT */}
        <div
          className="border-t p-4"
          style={{ borderColor: C.border }}
        >
          <button
            type="button"
            onClick={logout}
            disabled={logoutLoading}
            className="w-full rounded-xl px-4 py-3 text-left text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: "rgba(239,68,68,0.1)",
              color: "#F87171",
            }}
          >
            {logoutLoading ? "Выходим..." : "↪ Выйти из аккаунта"}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
        <section>
          <p
            className="text-xs font-black uppercase tracking-[0.25em]"
            style={{ color: C.orange }}
          >
            VEXORA ACCOUNT
          </p>

          <div className="mt-3 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
                Мой профиль
              </h1>

              <p className="mt-4 max-w-xl text-sm sm:text-base" style={{ color: C.muted }}>
                Управляй своим аккаунтом, находи друзей и следи за своей игровой коллекцией.
              </p>
            </div>

            <Link
              href="/library"
              className="inline-flex w-fit items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-black transition hover:-translate-y-0.5 hover:brightness-110"
              style={{ background: C.orange }}
            >
              Моя библиотека →
            </Link>
          </div>
        </section>

        {error && (
          <div className="mt-7 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* PROFILE GRID */}
        <section className="mt-10 grid gap-5 lg:grid-cols-[340px_1fr]">
          <div
            className="relative overflow-hidden rounded-2xl border p-7"
            style={{
              background: C.surface,
              borderColor: C.border,
            }}
          >
            <div
              className="absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl"
              style={{ background: "rgba(240,120,50,0.12)" }}
            />

            <div className="relative">
              <div
                className="flex h-24 w-24 items-center justify-center rounded-3xl border text-4xl font-black"
                style={{
                  background: "rgba(240,120,50,0.12)",
                  borderColor: "rgba(240,120,50,0.3)",
                  color: C.orange,
                }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>

              <h2 className="mt-6 break-words text-2xl font-black">
                {displayName}
              </h2>

              <p className="mt-2 break-all text-sm" style={{ color: C.muted }}>
                {user.email}
              </p>

              <div
                className="mt-5 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold"
                style={{
                  background: "rgba(240,120,50,0.08)",
                  borderColor: "rgba(240,120,50,0.2)",
                  color: C.orange,
                }}
              >
                <span className="h-2 w-2 rounded-full bg-green-500" />
                {isAdmin ? "Администратор" : "Игрок VEXORA"}
              </div>

              <div
                className="mt-8 border-t pt-6"
                style={{ borderColor: C.border }}
              >
                <p className="text-xs" style={{ color: C.muted }}>
                  Аккаунт VEXORA
                </p>

                <p className="mt-2 text-sm font-semibold">
                  Участник платформы
                </p>
              </div>
            </div>
          </div>

          {/* ACCOUNT INFO */}
          <div
            className="rounded-2xl border p-6 sm:p-8"
            style={{
              background: C.surface,
              borderColor: C.border,
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">
                  Информация об аккаунте
                </h2>

                <p className="mt-2 text-sm" style={{ color: C.muted }}>
                  Основные сведения о твоём профиле.
                </p>
              </div>

              <div
                className="hidden h-11 w-11 items-center justify-center rounded-xl text-xl sm:flex"
                style={{
                  background: "rgba(240,120,50,0.1)",
                  color: C.orange,
                }}
              >
                ♙
              </div>
            </div>

            <div className="mt-8 space-y-5">
              <div
                className="rounded-xl border p-4"
                style={{
                  background: C.surface2,
                  borderColor: C.border,
                }}
              >
                <p className="text-xs" style={{ color: C.muted }}>
                  Имя пользователя
                </p>

                <p className="mt-2 break-words font-bold">
                  {displayName}
                </p>
              </div>

              <div
                className="rounded-xl border p-4"
                style={{
                  background: C.surface2,
                  borderColor: C.border,
                }}
              >
                <p className="text-xs" style={{ color: C.muted }}>
                  Электронная почта
                </p>

                <p className="mt-2 break-all font-semibold">
                  {user.email || "Не указана"}
                </p>
              </div>

              <div
                className="rounded-xl border p-4"
                style={{
                  background: C.surface2,
                  borderColor: C.border,
                }}
              >
                <p className="text-xs" style={{ color: C.muted }}>
                  ID аккаунта
                </p>

                <p className="mt-2 break-all font-mono text-xs sm:text-sm">
                  {user.id}
                </p>
              </div>

              <div
                className="rounded-xl border p-4"
                style={{
                  background: C.surface2,
                  borderColor: C.border,
                }}
              >
                <p className="text-xs" style={{ color: C.muted }}>
                  Дата регистрации
                </p>

                <p className="mt-2 font-semibold">
                  {new Date(user.created_at).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* QUICK ACCESS */}
        <section className="mt-12">
          <div className="mb-6">
            <p
              className="text-xs font-black uppercase tracking-[0.25em]"
              style={{ color: C.orange }}
            >
              NAVIGATION
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Быстрый доступ
            </h2>

            <p className="mt-2 text-sm" style={{ color: C.muted }}>
              Все необходимые разделы твоего аккаунта.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {menuItems.slice(1).map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="group rounded-2xl border p-6 transition duration-300 hover:-translate-y-1 hover:border-orange-500/50"
                style={{
                  background: C.surface,
                  borderColor: C.border,
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
                    style={{
                      background: "rgba(240,120,50,0.1)",
                      color: C.orange,
                    }}
                  >
                    {item.icon}
                  </span>

                  <span
                    className="text-xl transition group-hover:translate-x-1"
                    style={{ color: C.orange }}
                  >
                    →
                  </span>
                </div>

                <h3 className="mt-6 text-lg font-bold transition group-hover:text-orange-400">
                  {item.title}
                </h3>

                <p className="mt-2 text-sm" style={{ color: C.muted }}>
                  {item.description}
                </p>

                <p
                  className="mt-6 text-xs font-bold"
                  style={{ color: C.orange }}
                >
                  Открыть раздел
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* ADMIN PANEL LINK */}
        {isAdmin && (
          <section
            className="mt-8 rounded-2xl border p-6 sm:p-8"
            style={{
              background: "linear-gradient(110deg, #25201D, #1B1D20)",
              borderColor: "rgba(240,120,50,0.3)",
            }}
          >
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div>
                <p
                  className="text-xs font-black uppercase tracking-[0.2em]"
                  style={{ color: C.orange }}
                >
                  ADMINISTRATION
                </p>

                <h2 className="mt-2 text-xl font-black">
                  Панель администратора
                </h2>

                <p className="mt-2 text-sm" style={{ color: C.muted }}>
                  Управление платформой VEXORA.
                </p>
              </div>

              <Link
                href="/admin"
                className="inline-flex w-fit items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-black transition hover:brightness-110"
                style={{ background: C.orange }}
              >
                Открыть панель →
              </Link>
            </div>
          </section>
        )}

        {/* LOGOUT */}
        <section
          className="mt-8 flex flex-col justify-between gap-4 rounded-2xl border p-6 sm:flex-row sm:items-center"
          style={{
            background: C.surface,
            borderColor: C.border,
          }}
        >
          <div>
            <h3 className="font-bold">
              Выход из аккаунта
            </h3>

            <p className="mt-1 text-sm" style={{ color: C.muted }}>
              Завершить текущий сеанс VEXORA.
            </p>
          </div>

          <button
            type="button"
            onClick={logout}
            disabled={logoutLoading}
            className="rounded-xl border px-6 py-3 text-sm font-bold transition hover:bg-red-500/10 disabled:opacity-50"
            style={{
              borderColor: "rgba(239,68,68,0.3)",
              color: "#F87171",
            }}
          >
            {logoutLoading ? "Выходим..." : "↪ Выйти"}
          </button>
        </section>
      </div>

      {/* FOOTER */}
      <footer
        className="mt-12 border-t"
        style={{
          background: "#0D0E10",
          borderColor: C.border,
        }}
      >
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-5 py-9 sm:flex-row sm:items-center lg:px-8">
          <div>
            <Logo />

            <p className="mt-2 text-sm" style={{ color: C.muted }}>
              ENTER THE GAME.
            </p>
          </div>

          <div
            className="flex flex-wrap gap-6 text-sm"
            style={{ color: C.muted }}
          >
            <Link href="/" className="transition hover:text-white">
              Магазин
            </Link>

            <Link href="/library" className="transition hover:text-white">
              Библиотека
            </Link>

            <Link href="/profile" className="transition hover:text-white">
              Профиль
            </Link>
          </div>

          <p className="text-xs" style={{ color: "#66686D" }}>
            © 2026 VEXORA
          </p>
        </div>
      </footer>
    </main>
  );
}
