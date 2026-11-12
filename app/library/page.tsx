
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

type Game = {
  id: string;
  user_id: string;
  game_title: string;
  genre: string;
  image_url: string | null;
  launch_url: string | null;
  acquired_at: string;
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

export default function LibraryPage() {
  const [user, setUser] = useState<User | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Все");
  const [menuOpen, setMenuOpen] = useState(false);
  const [deletingGameId, setDeletingGameId] = useState<string | null>(null);

  // Загрузка библиотеки
  useEffect(() => {
    let mounted = true;

    async function loadLibrary() {
      setLoading(true);
      setMessage("");

      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (!mounted) return;

      if (userError || !userData.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      setUser(userData.user);

      const { data, error } = await supabase
        .from("user_library")
        .select("*")
        .order("acquired_at", { ascending: false });

      if (!mounted) return;

      if (error) {
        setMessage(
          "Не удалось загрузить библиотеку: " + error.message
        );
      } else {
        const libraryGames = (data ?? []) as Game[];
        const gameTitles = Array.from(
          new Set(libraryGames.map((game) => game.game_title).filter(Boolean))
        );

        // Старые записи библиотеки могли быть созданы до появления launch_url.
        // Подтягиваем ссылку из каталога, чтобы кнопка появилась и у них.
        if (gameTitles.length > 0) {
          const { data: catalogGames } = await supabase
            .from("games")
            .select("title, launch_url")
            .in("title", gameTitles);

          if (!mounted) return;

          const launchUrls = new Map<string, string | null>(
            (catalogGames ?? []).map(
              (game) => [game.title, game.launch_url] as [string, string | null]
            )
          );

          setGames(
            libraryGames.map((game) => ({
              ...game,
              launch_url: game.launch_url || launchUrls.get(game.game_title) || null,
            }))
          );
        } else {
          setGames(libraryGames);
        }
      }

      setLoading(false);
    }

    loadLibrary();

    return () => {
      mounted = false;
    };
  }, []);

  // Закрытие меню клавишей Escape
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

  // Блокировка прокрутки при открытом меню
  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  async function removeFromLibrary(game: Game) {
    if (!user || deletingGameId) return;

    const confirmed = window.confirm(
      `Удалить «${game.game_title}» из библиотеки?`
    );
    if (!confirmed) return;

    setDeletingGameId(game.id);
    setMessage("");

    const { data: deletedRows, error } = await supabase
      .from("user_library")
      .delete()
      .eq("id", game.id)
      .eq("user_id", user.id)
      .select("id");

    if (error) {
      setMessage("Не удалось удалить игру: " + error.message);
    } else if (!deletedRows || deletedRows.length === 0) {
      // Supabase can return no error when RLS hides the row from DELETE.
      // Do not remove the card from local state unless the database confirms it.
      setMessage(
        "Игра не была удалена из базы данных. Проверьте RLS-политику DELETE для таблицы user_library в Supabase."
      );
    } else {
      setGames((previous) => previous.filter((item) => item.id !== game.id));
    }

    setDeletingGameId(null);
  }

  const displayName =
    user?.user_metadata?.full_name || user?.email || "Пользователь";

  const categories = [
    "Все",
    ...Array.from(new Set(games.map((game) => game.genre))).sort(),
  ];

  const filteredGames = games.filter((game) => {
    const query = search.trim().toLowerCase();

    const matchesSearch =
      game.game_title.toLowerCase().includes(query) ||
      game.genre.toLowerCase().includes(query);

    const matchesCategory =
      activeCategory === "Все" || game.genre === activeCategory;

    return matchesSearch && matchesCategory;
  });

  const sortedGames = [...filteredGames].sort(
    (a, b) =>
      new Date(b.acquired_at).getTime() -
      new Date(a.acquired_at).getTime()
  );

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
        <div className="mx-auto max-w-7xl px-5 py-3 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            {/* MENU AND LOGO */}
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMenuOpen((previous) => !previous)}
                aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
                aria-expanded={menuOpen}
                aria-controls="library-sidebar"
                className="flex h-10 w-10 items-center justify-center rounded-xl border text-xl transition hover:bg-white/10"
                style={{
                  borderColor: C.border,
                  color: C.text,
                }}
              >
                {menuOpen ? "×" : "☰"}
              </button>

              <Link href="/" className="flex items-center gap-2">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-lg font-black text-black"
                  style={{
                    background: C.orange,
                    boxShadow: "0 5px 25px rgba(240,120,50,0.2)",
                  }}
                >
                  V
                </div>

                <span className="hidden text-lg font-black tracking-wide sm:block">
                  VEX<span style={{ color: C.orange }}>ORA</span>
                </span>
              </Link>
            </div>

            {/* SEARCH */}
            <div className="relative mx-auto hidden w-full max-w-xl md:block">
              <span
                className="absolute left-4 top-1/2 -translate-y-1/2 text-xl"
                style={{ color: C.orange }}
              >
                ⌕
              </span>

              <input
                type="search"
                placeholder="Поиск в библиотеке..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-xl border py-3 pl-11 pr-11 text-sm text-white outline-none transition focus:border-orange-500"
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1"
                  style={{ color: C.muted }}
                >
                  ×
                </button>
              )}
            </div>

            {/* USER */}
            <div className="flex shrink-0 items-center gap-2">
              {user && (
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
              )}
            </div>
          </div>

          {/* MOBILE SEARCH */}
          <div className="relative mt-3 md:hidden">
            <span
              className="absolute left-4 top-1/2 -translate-y-1/2 text-xl"
              style={{ color: C.orange }}
            >
              ⌕
            </span>

            <input
              type="search"
              placeholder="Поиск в библиотеке..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-xl border py-3 pl-11 pr-4 text-sm text-white outline-none focus:border-orange-500"
              style={{
                background: C.surface,
                borderColor: C.border,
              }}
            />
          </div>
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
        id="library-sidebar"
        aria-label="Главная навигация"
        aria-hidden={!menuOpen}
        className={`fixed left-0 top-0 z-[70] flex h-[100dvh] w-[280px] max-w-[85vw] flex-col border-r transition-transform duration-300 ease-in-out ${
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
          <Link
            href="/"
            onClick={() => setMenuOpen(false)}
            className="text-lg font-black tracking-wide"
          >
            VEX<span style={{ color: C.orange }}>ORA</span>
          </Link>

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
            { icon: "⌂", title: "Главная", href: "/" },
            { icon: "▣", title: "Магазин", href: "/#store" },
            { icon: "▦", title: "Каталог игр", href: "/#games" },
            { icon: "✦", title: "Предложения", href: "/#offers" },
          ].map((item) => (
            <Link
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
            </Link>
          ))}

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

          <Link
            href="/library"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-white/5"
            style={{
              color: C.orange,
              background: "rgba(240,120,50,0.08)",
            }}
          >
            <span className="w-5 text-center text-lg">▤</span>
            Библиотека
          </Link>

          <Link
            href="/profile"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-white/5"
            style={{ color: C.text }}
          >
            <span
              className="w-5 text-center text-lg"
              style={{ color: C.orange }}
            >
              ♙
            </span>
            Профиль
          </Link>
        </nav>

        <div
          className="border-t p-5"
          style={{ borderColor: C.border }}
        >
          <p
            className="text-center text-[10px] font-semibold tracking-widest"
            style={{ color: "#66686D" }}
          >
            VEXORA © 2026
          </p>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
        {/* PAGE TITLE */}
        <section>
          <p
            className="mb-3 text-xs font-black uppercase tracking-[0.25em]"
            style={{ color: C.orange }}
          >
            YOUR COLLECTION
          </p>

          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
                Библиотека игр
              </h1>

              <p className="mt-4 text-sm sm:text-base" style={{ color: C.muted }}>
                Добро пожаловать, {displayName}.
                Все твои игры в одном месте.
              </p>
            </div>

            <Link
              href="/"
              className="inline-flex w-fit items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-black transition hover:-translate-y-0.5 hover:brightness-110"
              style={{ background: C.orange }}
            >
              Найти новые игры →
            </Link>
          </div>
        </section>

        {/* STATISTICS */}
        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          <div
            className="rounded-2xl border p-6"
            style={{
              background: C.surface,
              borderColor: C.border,
            }}
          >
            <p className="text-sm" style={{ color: C.muted }}>
              Всего игр
            </p>

            <p className="mt-3 text-4xl font-black">
              {games.length}
            </p>

            <p className="mt-2 text-xs" style={{ color: C.orange }}>
              Твоя коллекция
            </p>
          </div>

          <div
            className="rounded-2xl border p-6"
            style={{
              background: C.surface,
              borderColor: C.border,
            }}
          >
            <p className="text-sm" style={{ color: C.muted }}>
              Жанров
            </p>

            <p className="mt-3 text-4xl font-black">
              {new Set(games.map((game) => game.genre)).size}
            </p>

            <p className="mt-2 text-xs" style={{ color: C.orange }}>
              Разнообразие игр
            </p>
          </div>

          <div
            className="rounded-2xl border p-6"
            style={{
              background: C.surface,
              borderColor: C.border,
            }}
          >
            <p className="text-sm" style={{ color: C.muted }}>
              Недавно добавлено
            </p>

            <p className="mt-3 text-4xl font-black">
              {games.length > 0 ? "1" : "0"}
            </p>

            <p className="mt-2 text-xs" style={{ color: C.orange }}>
              Последнее пополнение
            </p>
          </div>
        </section>

        {/* ERROR */}
        {message && (
          <div className="mt-8 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {message}
          </div>
        )}

        {/* LOADING */}
        {loading && (
          <div
            className="mt-10 rounded-2xl border py-20 text-center"
            style={{
              background: C.surface,
              borderColor: C.border,
            }}
          >
            <div
              className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
              style={{
                borderColor: `${C.orange} transparent ${C.orange} ${C.orange}`,
              }}
            />

            <p className="mt-5 font-bold">
              Загружаем твою библиотеку...
            </p>

            <p className="mt-2 text-sm" style={{ color: C.muted }}>
              Получаем список игр
            </p>
          </div>
        )}

        {/* NOT AUTHORIZED */}
        {!loading && !user && (
          <div
            className="mt-10 rounded-2xl border p-10 text-center"
            style={{
              background: C.surface,
              borderColor: C.border,
            }}
          >
            <div className="text-5xl">♙</div>

            <h2 className="mt-5 text-2xl font-black">
              Войди в аккаунт
            </h2>

            <p className="mt-3 text-sm" style={{ color: C.muted }}>
              Авторизуйся, чтобы просматривать свою библиотеку игр.
            </p>

            <Link
              href="/auth"
              className="mt-7 inline-block rounded-xl px-7 py-3 font-bold text-black transition hover:brightness-110"
              style={{ background: C.orange }}
            >
              Перейти ко входу
            </Link>
          </div>
        )}

        {/* LIBRARY */}
        {!loading && user && !message && (
          <section className="mt-12">
            {/* SECTION HEADER */}
            <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">
                  Мои игры
                </h2>

                <p className="mt-2 text-sm" style={{ color: C.muted }}>
                  Найдено игр: {filteredGames.length}
                </p>
              </div>

              <div className="text-xs" style={{ color: C.muted }}>
                Сначала новые
              </div>
            </div>

            {/* CATEGORIES */}
            {games.length > 0 && (
              <div className="mb-8 flex gap-2 overflow-x-auto pb-3">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className="shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold transition"
                    style={
                      activeCategory === category
                        ? {
                            background: C.orange,
                            color: "#171717",
                          }
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
            )}

            {/* EMPTY LIBRARY */}
            {games.length === 0 && (
              <div
                className="rounded-2xl border px-6 py-16 text-center"
                style={{
                  background: C.surface,
                  borderColor: C.border,
                }}
              >
                <div
                  className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl text-4xl"
                  style={{
                    background: C.surface2,
                    color: C.orange,
                  }}
                >
                  🎮
                </div>

                <h2 className="mt-6 text-2xl font-black">
                  Библиотека пока пуста
                </h2>

                <p className="mx-auto mt-3 max-w-md text-sm leading-6" style={{ color: C.muted }}>
                  Здесь появятся игры после их добавления в аккаунт.
                  Отправляйся в магазин и собери свою коллекцию.
                </p>

                <Link
                  href="/"
                  className="mt-7 inline-flex rounded-xl px-7 py-3 font-bold text-black transition hover:brightness-110"
                  style={{ background: C.orange }}
                >
                  Перейти в магазин →
                </Link>
              </div>
            )}

            {/* GAME CARDS */}
            {games.length > 0 && sortedGames.length > 0 && (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {sortedGames.map((game) => (
                  <article
                    key={game.id}
                    className="group overflow-hidden rounded-2xl border transition duration-300 hover:-translate-y-1 hover:border-orange-500/50"
                    style={{
                      background: C.surface,
                      borderColor: C.border,
                    }}
                  >
                    {/* GAME IMAGE */}
                    <div
                      className="relative h-52 overflow-hidden"
                      style={{
                        background: game.image_url
                          ? `url("${game.image_url}") center/cover`
                          : "linear-gradient(135deg,#39302A,#1B1D20)",
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
                          background: "rgba(17,18,20,0.8)",
                          borderColor: "rgba(255,255,255,0.15)",
                        }}
                      >
                        В библиотеке
                      </span>

                      <span
                        className="absolute bottom-4 left-4 text-xs font-bold"
                        style={{ color: "#FFD0AE" }}
                      >
                        {game.genre}
                      </span>
                    </div>

                    {/* GAME INFO */}
                    <div className="p-5">
                      <h3 className="truncate text-xl font-bold transition group-hover:text-orange-400">
                        {game.game_title}
                      </h3>

                      {game.launch_url && game.launch_url.startsWith("https://") ? (
                        <a
                          href={game.launch_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:brightness-110"
                          style={{ background: C.orange }}
                        >
                          <span>▶</span> Играть
                          <span aria-hidden="true">↗</span>
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          title="Ссылка запуска ещё не добавлена администратором"
                          className="mt-5 w-full cursor-not-allowed rounded-xl border px-4 py-3 text-sm font-bold"
                          style={{ borderColor: C.border, color: C.muted }}
                        >
                          Скоро будет доступно
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => removeFromLibrary(game)}
                        disabled={deletingGameId === game.id || deletingGameId !== null}
                        className="mt-3 w-full rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ borderColor: C.border, color: "#F08A8A" }}
                      >
                        {deletingGameId === game.id ? "Удаление..." : "Удалить из библиотеки"}
                      </button>

                      <div
                        className="mt-5 flex items-center justify-between border-t pt-4"
                        style={{ borderColor: C.border }}
                      >
                        <div>
                          <p className="text-[10px] uppercase tracking-wider" style={{ color: C.muted }}>
                            Добавлена
                          </p>

                          <p className="mt-1 text-sm font-semibold" style={{ color: "#FFB98F" }}>
                            {new Date(game.acquired_at).toLocaleDateString("ru-RU")}
                          </p>
                        </div>

                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-lg"
                          style={{
                            background: "rgba(240,120,50,0.1)",
                            color: C.orange,
                          }}
                        >
                          ✓
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {/* NO SEARCH RESULTS */}
            {games.length > 0 && sortedGames.length === 0 && (
              <div
                className="rounded-2xl border py-16 text-center"
                style={{
                  background: C.surface,
                  borderColor: C.border,
                }}
              >
                <div className="text-4xl">⌕</div>

                <h2 className="mt-5 text-xl font-black">
                  Ничего не найдено
                </h2>

                <p className="mt-2 text-sm" style={{ color: C.muted }}>
                  Попробуй изменить поисковый запрос или категорию.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setActiveCategory("Все");
                  }}
                  className="mt-6 rounded-xl px-6 py-3 text-sm font-bold text-black transition hover:brightness-110"
                  style={{ background: C.orange }}
                >
                  Сбросить фильтры
                </button>
              </div>
            )}
          </section>
        )}
      </div>

      {/* FOOTER */}
      <footer
        className="mt-10 border-t"
        style={{
          background: "#0D0E10",
          borderColor: C.border,
        }}
      >
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-7 px-5 py-10 sm:flex-row sm:items-center lg:px-8">
          <div>
            <Link href="/" className="text-xl font-black tracking-wide">
              VEX<span style={{ color: C.orange }}>ORA</span>
            </Link>

            <p
              className="mt-2 text-xs font-bold tracking-[0.2em]"
              style={{ color: C.muted }}
            >
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
