
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type Game = {
  id: string;
  title: string;
  description: string;
  genre: string;
  price: number;
  image_url: string | null;
  is_published: boolean;
  created_at: string;
};

const defaultGradient = "linear-gradient(135deg, #312e81, #0891b2)";

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

  const categories = [
    "Все",
    ...Array.from(new Set(games.map((game) => game.genre))).sort(),
  ];

  const filteredGames = games.filter((game) => {
    const matchesSearch = game.title
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesCategory =
      activeCategory === "Все" || game.genre === activeCategory;

    return matchesSearch && matchesCategory;
  });

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
      const { data, error: userError } = await supabase.auth.getUser();

      if (userError || !data.user) {
        window.location.href = "/auth";
        return;
      }

      const { error } = await supabase.from("user_library").insert({
        user_id: data.user.id,
        game_title: game.title,
        genre: game.genre,
        image_url: game.image_url,
      });

      if (error) {
        setMessages((previous) => ({
          ...previous,
          [game.id]:
            error.code === "23505"
              ? "Эта игра уже есть в твоей библиотеке."
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

  return (
    <main className="min-h-screen bg-[#0b0d14] text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#10131d]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-6 py-5">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-600 text-2xl font-black shadow-lg shadow-violet-600/30">
              G
            </div>
            <span className="text-2xl font-black tracking-tight">
              Game<span className="text-violet-400">Platform</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-gray-400 md:flex">
            <a href="#store" className="text-white transition hover:text-violet-400">Магазин</a>
            <a href="#games" className="transition hover:text-violet-400">Каталог</a>
            <a href="#offers" className="transition hover:text-violet-400">Предложения</a>
            <Link href="/library" className="transition hover:text-violet-400">Библиотека</Link>
          </nav>

          <div className="flex flex-wrap items-center gap-3">
            {user ? (
              <>
                <div className="flex flex-col text-right">
                  <span className="text-xs text-gray-400">Вы вошли в аккаунт</span>
                  <span className="max-w-40 truncate text-sm font-bold text-violet-300">
                    {user.user_metadata?.full_name || user.email}
                  </span>
                </div>

                <Link href="/profile" className="rounded-xl border border-violet-500/40 px-4 py-2.5 text-sm font-semibold transition hover:bg-violet-500/10">
                  Мой профиль
                </Link>

                <button onClick={handleSignOut} disabled={signingOut} className="rounded-xl bg-red-600/90 px-4 py-2.5 text-sm font-semibold transition hover:bg-red-500 disabled:opacity-50">
                  {signingOut ? "Выход..." : "Выйти"}
                </button>
              </>
            ) : (
              <>
                <Link href="/auth" className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/10">
                  Войти
                </Link>
                <Link href="/auth" className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold transition hover:bg-violet-500">
                  Регистрация
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section id="store" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(124,58,237,0.22),_transparent_55%)]" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 md:grid-cols-2 md:py-28">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-4 py-2 text-sm text-violet-300">
              <span>✦</span> Твоя игровая вселенная
            </div>

            <h1 className="text-5xl font-black leading-tight tracking-tight md:text-7xl">
              Играй.<br />
              Открывай.<br />
              <span className="text-violet-400">Побеждай.</span>
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-8 text-gray-400">
              Открывай новые миры, находи любимые игры и собирай собственную
              игровую коллекцию в одном месте.
            </p>

            <a href="#games" className="mt-9 inline-flex rounded-xl bg-violet-600 px-7 py-4 font-bold shadow-xl shadow-violet-600/20 transition hover:-translate-y-1 hover:bg-violet-500">
              Смотреть каталог <span className="ml-3">→</span>
            </a>
          </div>

          <div className="relative">
            <div className="absolute -inset-5 rounded-[40px] bg-violet-600/20 blur-3xl" />
            <div className="relative flex min-h-80 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-950 via-violet-900 to-cyan-900 p-10 shadow-2xl">
              <div className="absolute -right-10 -top-10 h-52 w-52 rounded-full border border-white/10" />
              <div className="absolute -bottom-16 -left-10 h-64 w-64 rounded-full border border-white/10" />
              <div className="text-center">
                <div className="text-8xl drop-shadow-2xl md:text-9xl">🎮</div>
                <p className="mt-6 text-3xl font-black">Твоя игра начинается здесь</p>
                <p className="mt-2 text-sm text-violet-200">GAMEPLATFORM STORE</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-6 pb-16 md:grid-cols-3">
        {[
          ["🎯", "Большой выбор", "Игры разных жанров в одном магазине"],
          ["🔒", "Безопасность", "Защита аккаунта и игровой библиотеки"],
          ["⭐", "Выгодные цены", "Интересные предложения и скидки"],
        ].map(([icon, title, description]) => (
          <div key={title} className="rounded-2xl border border-white/10 bg-[#121622] p-6">
            <div className="text-3xl">{icon}</div>
            <h3 className="mt-4 text-lg font-bold">{title}</h3>
            <p className="mt-2 text-sm text-gray-400">{description}</p>
          </div>
        ))}
      </section>

      <section id="games" className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-violet-400">Выбирай и играй</p>
            <h2 className="text-3xl font-black md:text-4xl">Каталог игр</h2>
          </div>

          <input
            type="search"
            placeholder="Поиск игр..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#151925] px-5 py-3 text-sm outline-none transition placeholder:text-gray-500 focus:border-violet-500 md:max-w-xs"
          />
        </div>

        <div className="mb-8 flex flex-wrap gap-3">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                activeCategory === category
                  ? "bg-violet-600 text-white"
                  : "border border-white/10 bg-[#151925] text-gray-400 hover:border-violet-500/50 hover:text-white"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {loadingGames && (
          <div className="rounded-2xl border border-white/10 bg-[#121622] py-16 text-center">
            <div className="text-5xl">🎮</div>
            <p className="mt-4 text-lg font-bold">Загружаем каталог...</p>
            <p className="mt-2 text-sm text-gray-400">Подключаемся к GamePlatform</p>
          </div>
        )}

        {!loadingGames && gamesError && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 py-10 text-center">
            <p className="text-lg font-bold text-red-300">Ошибка загрузки каталога</p>
            <p className="mt-3 px-4 text-sm text-gray-300">{gamesError}</p>
          </div>
        )}

        {!loadingGames && !gamesError && (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                  className="group relative z-0 cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-[#121622] transition duration-300 hover:-translate-y-1 hover:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <div
                    className="relative flex h-52 items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-950 via-violet-900 to-cyan-900"
                    style={
                      game.image_url
                        ? {
                            backgroundImage: `url("${game.image_url}")`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }
                        : { background: defaultGradient }
                    }
                  >
                    {!game.image_url && (
                      <span className="text-8xl transition duration-300 group-hover:scale-110">🎮</span>
                    )}
                    <span className="absolute left-4 top-4 rounded-lg bg-black/50 px-3 py-1.5 text-xs font-bold backdrop-blur">
                      В КАТАЛОГЕ
                    </span>
                  </div>

                  <div className="p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-violet-400">
                      {game.genre}
                    </p>

                    <h3 className="mt-2 text-xl font-bold transition group-hover:text-violet-400">
                      {game.title}
                    </h3>

                    {game.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-gray-400">
                        {game.description}
                      </p>
                    )}

                    <div className="mt-5 flex items-center justify-between gap-3">
                      <p className="text-lg font-black">
                        {Number(game.price) === 0
                          ? "Бесплатно"
                          : `${Number(game.price).toLocaleString("ru-RU")} ₽`}
                      </p>

                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          addToLibrary(game);
                        }}
                        disabled={addingGame !== null}
                        className="relative z-20 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {addingGame === game.id ? "Добавление..." : "Добавить в библиотеку"}
                      </button>
                    </div>

                    {messages[game.id] && (
                      <p className="mt-4 rounded-lg bg-white/5 p-3 text-sm text-violet-300">
                        {messages[game.id]}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>

            {games.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-[#121622] py-16 text-center">
                <div className="text-5xl">🎮</div>
                <p className="mt-4 text-lg font-bold">Пока нет опубликованных игр</p>
                <p className="mt-2 text-sm text-gray-400">
                  Новые игры появятся здесь после публикации администратором.
                </p>
              </div>
            )}

            {games.length > 0 && filteredGames.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-[#121622] py-16 text-center">
                <div className="text-5xl">🔎</div>
                <p className="mt-4 text-lg font-bold">Игры не найдены</p>
                <p className="mt-2 text-sm text-gray-400">
                  Попробуй изменить поисковый запрос или категорию.
                </p>
              </div>
            )}
          </>
        )}
      </section>

      <section id="offers" className="mx-auto max-w-7xl px-6 py-16">
        <div className="overflow-hidden rounded-3xl border border-violet-400/20 bg-gradient-to-r from-violet-950 via-[#24164d] to-[#111827] p-8 md:p-12">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-violet-300">GamePlatform</p>
          <h2 className="mt-4 text-3xl font-black md:text-5xl">
            Твоя следующая игра<br />ждёт тебя
          </h2>
          <p className="mt-4 max-w-xl text-gray-300">
            Следи за каталогом GamePlatform и открывай для себя новые игровые миры.
          </p>
          <a href="#games" className="mt-7 inline-flex rounded-xl bg-white px-6 py-3 font-bold text-violet-950 transition hover:bg-violet-100">
            Перейти к играм →
          </a>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#080a10]">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-6 py-8 md:flex-row md:items-center">
          <div>
            <p className="text-xl font-black">
              Game<span className="text-violet-400">Platform</span>
            </p>
            <p className="mt-2 text-sm text-gray-500">Твоя игровая вселенная.</p>
          </div>
          <p className="text-sm text-gray-500">© 2026 GamePlatform. Все права защищены.</p>
        </div>
      </footer>
    </main>
  );
}
