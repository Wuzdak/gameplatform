"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

type WishlistGame = {
  id: string;
  title: string;
  genre: string;
  price: number;
  image_url: string | null;
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

function formatPrice(price: number) {
  return Number(price) === 0
    ? "Бесплатно"
    : `${Number(price).toLocaleString("ru-RU")} ₽`;
}

export default function WishlistPage() {
  const [user, setUser] = useState<User | null>(null);
  const [games, setGames] = useState<WishlistGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadWishlist() {
      setLoading(true);
      setMessage("");

      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (!mounted) return;

      if (authError || !authData.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      setUser(authData.user);

      const { data: wishlistRows, error: wishlistError } = await supabase
        .from("user_wishlist")
        .select("game_id, created_at")
        .eq("user_id", authData.user.id)
        .order("created_at", { ascending: false });

      if (!mounted) return;

      if (wishlistError) {
        setMessage("Не удалось загрузить избранное: " + wishlistError.message);
        setLoading(false);
        return;
      }

      const rows = wishlistRows ?? [];
      if (rows.length === 0) {
        setGames([]);
        setLoading(false);
        return;
      }

      const gameIds = rows.map((row) => row.game_id);
      const createdAtById = new Map(
        rows.map((row) => [row.game_id, row.created_at])
      );

      const { data: catalogGames, error: gamesError } = await supabase
        .from("games")
        .select("id, title, genre, price, image_url")
        .in("id", gameIds)
        .eq("is_published", true);

      if (!mounted) return;

      if (gamesError) {
        setMessage("Не удалось загрузить карточки игр: " + gamesError.message);
      } else {
        const loadedGames = (catalogGames ?? []).map((game) => ({
          ...game,
          created_at: createdAtById.get(game.id) ?? "",
        }));
        loadedGames.sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        );
        setGames(loadedGames);
      }

      setLoading(false);
    }

    loadWishlist();

    return () => {
      mounted = false;
    };
  }, []);

  async function removeGame(game: WishlistGame) {
    if (!user || removingId) return;

    setRemovingId(game.id);
    setMessage("");

    const { data: deletedRows, error } = await supabase
      .from("user_wishlist")
      .delete()
      .eq("user_id", user.id)
      .eq("game_id", game.id)
      .select("game_id");

    if (error) {
      setMessage("Не удалось удалить игру: " + error.message);
    } else if (!deletedRows || deletedRows.length === 0) {
      setMessage("База данных не подтвердила удаление. Проверь RLS-политику DELETE для user_wishlist.");
    } else {
      setGames((previous) => previous.filter((item) => item.id !== game.id));
    }

    setRemovingId(null);
  }

  const filteredGames = useMemo(() => {
    const query = search.trim().toLowerCase();
    return games.filter(
      (game) =>
        game.title.toLowerCase().includes(query) ||
        (game.genre || "").toLowerCase().includes(query)
    );
  }, [games, search]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-white" style={{ background: C.bg }}>
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#293650] border-t-[#3978FF]" />
          <p className="mt-4 text-sm" style={{ color: C.muted }}>Загружаем избранное...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5 text-white" style={{ background: C.bg }}>
        <div className="w-full max-w-md rounded-2xl border p-8 text-center" style={{ background: C.surface, borderColor: C.border }}>
          <div className="text-5xl">☆</div>
          <h1 className="mt-5 text-2xl font-black">Войди в VEXORA</h1>
          <p className="mt-3 text-sm" style={{ color: C.muted }}>Авторизуйся, чтобы просматривать список желаемого.</p>
          <Link href="/auth" className="mt-6 inline-flex rounded-xl px-6 py-3 font-bold text-black" style={{ background: C.orange }}>Войти в аккаунт</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-white" style={{ background: C.bg }}>
      <header className="sticky top-0 z-40 border-b backdrop-blur-xl" style={{ background: "rgba(17,18,20,0.96)", borderColor: C.border }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg text-lg font-black text-white" style={{ background: C.orange }}>V</span>
            <span className="text-xl font-black">VEXORA</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm" style={{ color: C.muted }}>
            <Link href="/" className="transition hover:text-white">Каталог</Link>
            <Link href="/library" className="transition hover:text-white">Библиотека</Link>
            <Link href="/profile" className="transition hover:text-white">Профиль</Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <Link href="/profile" className="text-sm transition hover:text-[#3978FF]" style={{ color: C.muted }}>← Назад в профиль</Link>

        <section className="mt-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em]" style={{ color: C.orange }}>YOUR WISHLIST</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Избранное</h1>
            <p className="mt-3 text-sm" style={{ color: C.muted }}>Игры, которые ты хочешь попробовать позже.</p>
          </div>
          <div className="rounded-xl border px-5 py-3" style={{ background: C.surface, borderColor: C.border }}>
            <p className="text-xs" style={{ color: C.muted }}>В списке желаемого</p>
            <p className="mt-1 text-2xl font-black">{games.length} <span className="text-sm font-medium" style={{ color: C.muted }}>игр</span></p>
          </div>
        </section>

        {message && (
          <div role="status" className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{message}</div>
        )}

        <div className="mt-8">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по избранному..."
            className="w-full max-w-md rounded-xl border px-4 py-3 text-sm text-white outline-none transition focus:border-[#3978FF]"
            style={{ background: C.surface, borderColor: C.border }}
          />
        </div>

        {filteredGames.length === 0 ? (
          <div className="mt-8 rounded-2xl border p-12 text-center" style={{ background: C.surface, borderColor: C.border }}>
            <div className="text-5xl">☆</div>
            <h2 className="mt-5 text-xl font-black">{games.length === 0 ? "Пока ничего нет" : "Ничего не найдено"}</h2>
            <p className="mt-2 text-sm" style={{ color: C.muted }}>
              {games.length === 0 ? "Открывай каталог и добавляй интересные игры в избранное." : "Попробуй изменить поисковый запрос."}
            </p>
            <Link href="/" className="mt-6 inline-flex rounded-xl px-6 py-3 font-bold text-black transition hover:brightness-110" style={{ background: C.orange }}>Перейти в каталог</Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredGames.map((game) => (
              <article key={game.id} className="overflow-hidden rounded-2xl border" style={{ background: C.surface, borderColor: C.border }}>
                <Link href={`/game/${game.id}`} className="group relative block aspect-[16/9] overflow-hidden bg-[#19243A]">
                  {game.image_url ? (
                    <img src={game.image_url} alt={game.title} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-5xl">🎮</div>
                  )}
                  <span className="absolute left-3 top-3 rounded-lg border border-white/10 bg-black/60 px-3 py-1 text-xs font-bold text-white backdrop-blur">{game.genre || "Игра"}</span>
                </Link>
                <div className="p-5">
                  <Link href={`/game/${game.id}`} className="line-clamp-1 text-lg font-black transition hover:text-[#3978FF]">{game.title}</Link>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="font-bold" style={{ color: C.orange }}>{formatPrice(game.price)}</span>
                    <span className="text-xs" style={{ color: C.muted }}>Добавлено {game.created_at ? new Date(game.created_at).toLocaleDateString("ru-RU") : ""}</span>
                  </div>
                  <div className="mt-5 flex gap-2">
                    <Link href={`/game/${game.id}`} className="flex-1 rounded-xl px-4 py-3 text-center text-sm font-bold text-black transition hover:brightness-110" style={{ background: C.orange }}>Открыть игру</Link>
                    <button type="button" onClick={() => removeGame(game)} disabled={removingId === game.id} className="rounded-xl border px-4 py-3 text-sm font-bold transition hover:border-red-500/50 hover:text-red-300 disabled:opacity-50" style={{ borderColor: C.border }}>
                      {removingId === game.id ? "..." : "Убрать"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
