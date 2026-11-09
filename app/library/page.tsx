
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Game = {
  id: string;
  game_title: string;
  genre: string;
  image_url: string | null;
  acquired_at: string;
};

export default function LibraryPage() {
  const [user, setUser] = useState<any>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadLibrary() {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

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

      if (error) {
        setMessage("Не удалось загрузить библиотеку: " + error.message);
      } else {
        setGames(data ?? []);
      }

      setLoading(false);
    }

    loadLibrary();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0b0d14] p-10 text-white">
        Загрузка библиотеки...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0d14] text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Войди в аккаунт</h1>
          <a href="/auth" className="mt-4 block text-violet-400">
            Перейти ко входу
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b0d14] px-5 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <a href="/" className="text-2xl font-black">
            Game<span className="text-violet-400">Platform</span>
          </a>

          <nav className="flex gap-5 text-sm text-gray-300">
            <a href="/">Магазин</a>
            <a href="/profile">Профиль</a>
          </nav>
        </header>

        <section className="mt-14">
          <p className="text-sm font-bold uppercase tracking-widest text-violet-400">
            Твоя коллекция
          </p>

          <h1 className="mt-3 text-4xl font-black">
            Библиотека игр
          </h1>

          <p className="mt-3 text-gray-400">
            Привет, {user.user_metadata?.full_name || user.email}!
          </p>

          <div className="mt-8 rounded-2xl border border-white/10 bg-[#121622] p-5">
            <p className="text-sm text-gray-400">Всего игр</p>
            <p className="mt-1 text-3xl font-black">{games.length}</p>
          </div>
        </section>

        {message && (
          <p className="mt-6 rounded-xl bg-red-500/10 p-4 text-red-300">
            {message}
          </p>
        )}

        {games.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-white/10 bg-[#121622] p-10 text-center">
            <div className="text-5xl">🎮</div>
            <h2 className="mt-5 text-xl font-bold">
              Библиотека пока пуста
            </h2>
            <p className="mt-2 text-gray-400">
              Здесь появятся игры после их добавления в аккаунт.
            </p>
            <a
              href="/"
              className="mt-6 inline-block rounded-xl bg-violet-600 px-6 py-3 font-bold"
            >
              Перейти в магазин
            </a>
          </div>
        ) : (
          <section className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((game) => (
              <article
                key={game.id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-[#121622]"
              >
                {game.image_url ? (
                  <img
                    src={game.image_url}
                    alt={game.game_title}
                    className="h-48 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center bg-[#202638] text-5xl">
                    🎮
                  </div>
                )}

                <div className="p-5">
                  <h2 className="text-xl font-bold">{game.game_title}</h2>
                  <p className="mt-2 text-sm text-gray-400">{game.genre}</p>
                  <p className="mt-5 text-sm text-violet-300">
                    Добавлена:{" "}
                    {new Date(game.acquired_at).toLocaleDateString("ru-RU")}
                  </p>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
