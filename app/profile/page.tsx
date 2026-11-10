
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type MenuItem = {
  title: string;
  description: string;
  icon: string;
  href: string;
};

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const { data } = await supabase.auth.getUser();

      if (data.user) {
        setUser(data.user);

        const { data: adminData, error } = await supabase
          .from("platform_admins")
          .select("user_id")
          .eq("user_id", data.user.id)
          .maybeSingle();

        setIsAdmin(!error && !!adminData);
      }

      setLoading(false);
    }

    loadProfile();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  const menuItems: MenuItem[] = [
    {
      title: "Мой профиль",
      description: "Информация об аккаунте",
      icon: "👤",
      href: "/profile",
    },
    {
      title: "Мои друзья",
      description: "Список твоих друзей",
      icon: "👥",
      href: "/friends",
    },
    {
      title: "Добавить друзей",
      description: "Найти новых игроков",
      icon: "➕",
      href: "/friends",
    },
    {
      title: "Личные сообщения",
      description: "Твои переписки",
      icon: "💬",
      href: "/messages",
    },
    {
      title: "Моя библиотека",
      description: "Твои игры",
      icon: "🎮",
      href: "/library",
    },
  ];

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0d14] text-white">
        Загрузка профиля...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0d14] text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Ты не авторизован</h1>
          <a href="/auth" className="mt-4 block text-violet-400">
            Перейти ко входу
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b0d14] text-white">
      {/* Верхняя панель */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-[#101522]/95 px-5 backdrop-blur">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Открыть меню"
            className="rounded-xl border border-white/10 px-3 py-2 text-xl transition hover:bg-white/10"
          >
            ☰
          </button>

          <a href="/" className="text-xl font-black">
            Game<span className="text-violet-400">Platform</span>
          </a>
        </div>

        <a
          href="/"
          className="rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-300 transition hover:bg-white/10"
        >
          Магазин
        </a>
      </header>

      {/* Затемнение фона */}
      <div
        onClick={() => setMenuOpen(false)}
        className={`fixed inset-0 z-40 bg-black/70 transition-opacity ${
          menuOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      />

      {/* Выдвижное меню */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-[290px] max-w-[85vw] flex-col border-r border-white/10 bg-[#121622] transition-transform duration-300 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 p-5">
          <span className="text-xl font-black">
            Game<span className="text-violet-400">Platform</span>
          </span>

          <button
            onClick={() => setMenuOpen(false)}
            aria-label="Закрыть меню"
            className="rounded-lg px-3 py-2 text-xl text-gray-400 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-white/10 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-600/20 text-2xl">
            👤
          </div>

          <p className="mt-3 font-bold">
            {user.user_metadata?.full_name || "Пользователь"}
          </p>

          <p className="mt-1 truncate text-xs text-gray-500">
            {user.email}
          </p>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto p-4">
          <p className="mb-3 px-3 text-xs font-bold uppercase tracking-wider text-gray-500">
            Личный кабинет
          </p>

          {menuItems.map((item, index) => (
            <a
              key={`${item.title}-${index}`}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-3 rounded-xl p-3 transition ${
                index === 0
                  ? "border border-violet-400/20 bg-violet-600/15 text-violet-300"
                  : "text-gray-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="text-xl">{item.icon}</span>

              <span>
                <span className="block text-sm font-bold">
                  {item.title}
                </span>
                <span className="mt-1 block text-xs text-gray-500">
                  {item.description}
                </span>
              </span>
            </a>
          ))}

          {isAdmin && (
            <>
              <p className="mb-3 mt-7 px-3 text-xs font-bold uppercase tracking-wider text-gray-500">
                Управление
              </p>

              <a
                href="/admin"
                className="flex items-center gap-3 rounded-xl p-3 text-violet-300 transition hover:bg-violet-500/10"
              >
                <span className="text-xl">⚙️</span>
                <span className="text-sm font-bold">
                  Панель администратора
                </span>
              </a>
            </>
          )}
        </nav>

        <div className="border-t border-white/10 p-4">
          <button
            onClick={logout}
            className="w-full rounded-xl bg-red-500/10 px-4 py-3 text-left font-bold text-red-300 transition hover:bg-red-500/20"
          >
            ↪ Выйти из аккаунта
          </button>
        </div>
      </aside>

      {/* Основное содержимое */}
      <div className="mx-auto max-w-5xl px-5 py-10">
        <div className="mb-8">
          <p className="text-sm text-violet-400">
            ЛИЧНЫЙ КАБИНЕТ
          </p>

          <h1 className="mt-2 text-3xl font-black">
            Мой профиль
          </h1>

          <p className="mt-2 text-gray-400">
            Управляй аккаунтом, друзьями и общением на GamePlatform.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-[220px_1fr]">
          {/* Карточка пользователя */}
          <section className="rounded-3xl border border-white/10 bg-[#121622] p-6 text-center">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-violet-400/20 bg-violet-600/15 text-5xl">
              👤
            </div>

            <h2 className="mt-4 break-words text-xl font-bold">
              {user.user_metadata?.full_name || "Пользователь"}
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              {isAdmin ? "Администратор" : "Игрок GamePlatform"}
            </p>
          </section>

          {/* Информация аккаунта */}
          <section className="rounded-3xl border border-white/10 bg-[#121622] p-6 sm:p-8">
            <h2 className="text-xl font-bold">
              Информация об аккаунте
            </h2>

            <div className="mt-7 space-y-6">
              <div>
                <p className="text-sm text-gray-400">
                  Имя пользователя
                </p>
                <p className="mt-1 break-words font-bold">
                  {user.user_metadata?.full_name || "Не указано"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-400">
                  Электронная почта
                </p>
                <p className="mt-1 break-all">
                  {user.email}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-400">
                  ID аккаунта
                </p>
                <p className="mt-1 break-all text-sm text-gray-300">
                  {user.id}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-400">
                  Дата регистрации
                </p>
                <p className="mt-1">
                  {new Date(user.created_at).toLocaleDateString("ru-RU")}
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Быстрые переходы */}
        <section className="mt-8">
          <h2 className="mb-4 text-xl font-bold">
            Быстрый доступ
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {menuItems.slice(1).map((item, index) => (
              <a
                key={`${item.title}-${index}`}
                href={item.href}
                className="rounded-2xl border border-white/10 bg-[#121622] p-5 transition hover:-translate-y-1 hover:border-violet-400/40 hover:bg-[#171d2b]"
              >
                <span className="text-3xl">{item.icon}</span>

                <h3 className="mt-4 font-bold">
                  {item.title}
                </h3>

                <p className="mt-2 text-sm text-gray-500">
                  {item.description}
                </p>

                <p className="mt-4 text-sm font-bold text-violet-400">
                  Перейти →
                </p>
              </a>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
