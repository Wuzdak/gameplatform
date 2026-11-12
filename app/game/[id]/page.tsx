
"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type Game = {
  id: string;
  title: string;
  description: string;
  genre: string;
  price: number;
  image_url: string | null;
  screenshots: string[] | null;
  system_requirements: string | null;
  launch_url: string | null;
  developer: string | null;
  publisher: string | null;
  release_date: string | null;
  trailer_url: string | null;
};

type Review = {
  id: string;
  game_id: string;
  user_id: string;
  rating: number;
  comment: string;
  created_at: string;
};

function formatPrice(price: number) {
  return Number(price) === 0
    ? "Бесплатно"
    : `${Number(price).toLocaleString("ru-RU")} ₽`;
}

function getTrailerEmbedUrl(value: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = url.searchParams.get("v");
      if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
      const match = url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/);
      return match ? `https://www.youtube-nocookie.com/embed/${match[1]}` : null;
    }

    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const id = url.pathname.split("/").filter(Boolean).pop();
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }

  return null;
}

function GamePageContent() {
  const params = useParams<{ id: string }>();
  const gameId = params.id;

  const [game, setGame] = useState<Game | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [adding, setAdding] = useState(false);
  const [inLibrary, setInLibrary] = useState(false);
  const [inWishlist, setInWishlist] = useState(false);
  const [savingWishlist, setSavingWishlist] = useState(false);
  const [message, setMessage] = useState("");

  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewError, setReviewError] = useState("");

  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      setLoading(true);
      setError("");
      setReviewError("");
      setMessage("");
      setInLibrary(false);
      setInWishlist(false);

      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData.user?.id ?? null;

      if (cancelled) return;

      setUserId(currentUserId);

      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select(
          "id, title, description, genre, price, image_url, screenshots, system_requirements, launch_url, developer, publisher, release_date, trailer_url"
        )
        .eq("id", gameId)
        .eq("is_published", true)
        .maybeSingle();

      if (cancelled) return;

      if (gameError) {
        setError("Не удалось загрузить игру: " + gameError.message);
        setLoading(false);
        return;
      }

      if (!gameData) {
        setError("Игра не найдена или ещё не опубликована.");
        setLoading(false);
        return;
      }

      setGame(gameData);

      if (currentUserId) {
        const { data: libraryData } = await supabase
          .from("user_library")
          .select("game_title")
          .eq("user_id", currentUserId)
          .eq("game_title", gameData.title)
          .limit(1);

        if (cancelled) return;

        setInLibrary(Boolean(libraryData && libraryData.length > 0));

        const { data: wishlistData } = await supabase
          .from("user_wishlist")
          .select("id")
          .eq("user_id", currentUserId)
          .eq("game_id", gameData.id)
          .limit(1);

        if (cancelled) return;

        setInWishlist(Boolean(wishlistData && wishlistData.length > 0));
      }

      const { data: reviewData, error: reviewsLoadError } = await supabase
        .from("game_reviews")
        .select("*")
        .eq("game_id", gameId)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (reviewsLoadError) {
        setReviewError(
          "Не удалось загрузить отзывы: " + reviewsLoadError.message
        );
      } else {
        const loadedReviews = reviewData ?? [];
        setReviews(loadedReviews);

        const ownReview = loadedReviews.find(
          (review) => review.user_id === currentUserId
        );

        if (ownReview) {
          setRating(String(ownReview.rating));
          setComment(ownReview.comment ?? "");
        } else {
          setRating("5");
          setComment("");
        }
      }

      setLoading(false);
    }

    if (gameId) {
      loadPage();
    }

    return () => {
      cancelled = true;
    };
  }, [gameId]);

  async function addToLibrary() {
    if (!game || adding || inLibrary) return;

    setAdding(true);
    setMessage("");

    try {
      const { data, error: userError } = await supabase.auth.getUser();

      if (userError || !data.user) {
        window.location.href = "/auth";
        return;
      }

      const currentUserId = data.user.id;

      const { data: existingGame, error: checkError } = await supabase
        .from("user_library")
        .select("game_title")
        .eq("user_id", currentUserId)
        .eq("game_title", game.title)
        .limit(1);

      if (checkError) {
        setMessage("Не удалось проверить библиотеку: " + checkError.message);
        return;
      }

      if (existingGame && existingGame.length > 0) {
        setInLibrary(true);
        setMessage("Эта игра уже есть в твоей библиотеке.");
        return;
      }

      const { error } = await supabase.from("user_library").insert({
        user_id: currentUserId,
        game_title: game.title,
        genre: game.genre,
        image_url: game.image_url,
        launch_url: game.launch_url,
      });

      if (error) {
        if (error.code === "23505") {
          setInLibrary(true);
          setMessage("Эта игра уже есть в твоей библиотеке.");
        } else {
          setMessage("Не удалось добавить игру: " + error.message);
        }
      } else {
        setInLibrary(true);
        setMessage("Игра успешно добавлена в библиотеку!");
      }
    } catch {
      setMessage("Не удалось выполнить запрос. Попробуй ещё раз.");
    } finally {
      setAdding(false);
    }
  }

  async function toggleWishlist() {
    if (!game || savingWishlist) return;

    setSavingWishlist(true);
    setMessage("");

    try {
      const { data, error: userError } = await supabase.auth.getUser();

      if (userError || !data.user) {
        window.location.href = "/auth";
        return;
      }

      const currentUserId = data.user.id;

      if (inWishlist) {
        const { data: deletedRows, error } = await supabase
          .from("user_wishlist")
          .delete()
          .eq("user_id", currentUserId)
          .eq("game_id", game.id)
          .select("id");

        if (error) {
          setMessage("Не удалось убрать игру из избранного: " + error.message);
        } else if (!deletedRows || deletedRows.length === 0) {
          setMessage("Не удалось подтвердить удаление игры из избранного.");
        } else {
          setInWishlist(false);
          setMessage("Игра удалена из избранного.");
        }
      } else {
        const { error } = await supabase.from("user_wishlist").insert({
          user_id: currentUserId,
          game_id: game.id,
        });

        if (error) {
          if (error.code === "23505") {
            setInWishlist(true);
            setMessage("Эта игра уже есть в избранном.");
          } else {
            setMessage("Не удалось добавить игру в избранное: " + error.message);
          }
        } else {
          setInWishlist(true);
          setMessage("Игра добавлена в избранное!");
        }
      }
    } catch {
      setMessage("Не удалось выполнить запрос. Попробуй ещё раз.");
    } finally {
      setSavingWishlist(false);
    }
  }

  async function saveReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!game) return;

    setReviewMessage("");

    if (!userId) {
      window.location.href = "/auth";
      return;
    }

    if (!comment.trim()) {
      setReviewMessage("Напиши несколько слов о своих впечатлениях.");
      return;
    }

    setSavingReview(true);

    const { data, error } = await supabase
      .from("game_reviews")
      .upsert(
        {
          game_id: game.id,
          user_id: userId,
          rating: Number(rating),
          comment: comment.trim(),
        },
        { onConflict: "game_id,user_id" }
      )
      .select()
      .single();

    if (error) {
      setReviewMessage("Не удалось сохранить отзыв: " + error.message);
    } else {
      setReviews((previous) => [
        data,
        ...previous.filter((review) => review.user_id !== userId),
      ]);

      setReviewMessage("Твой отзыв успешно сохранён!");
    }

    setSavingReview(false);
  }

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) /
        reviews.length
      : 0;

  const roundedRating = Math.round(averageRating);
  const trailerEmbedUrl = getTrailerEmbedUrl(game?.trailer_url ?? null);
  const ratingDistribution = [5, 4, 3, 2, 1].map((value) => {
    const count = reviews.filter((review) => review.rating === value).length;
    return {
      value,
      count,
      percentage: reviews.length > 0 ? (count / reviews.length) * 100 : 0,
    };
  });

  return (
    <main className="min-h-screen bg-[#0A0E18] text-[#EDF3FF]">
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-[#293650] bg-[#0A0E18]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <a href="/" className="flex shrink-0 items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#3978FF] text-lg font-black text-white">
              V
            </span>
            <span className="text-2xl font-black tracking-tight">
              VEXORA
            </span>
          </a>

          <nav className="hidden items-center gap-7 text-sm text-[#9AA8BD] md:flex">
            <a href="/" className="transition hover:text-[#3978FF]">
              Главная
            </a>
            <a href="/library" className="transition hover:text-[#3978FF]">
              Библиотека
            </a>
            <a href="/profile" className="transition hover:text-[#3978FF]">
              Профиль
            </a>
          </nav>

          <a
            href="/library"
            className="rounded-lg border border-[#293650] bg-[#121A2A] px-4 py-2.5 text-sm font-semibold transition hover:border-[#3978FF]/50 hover:bg-[#19243A]"
          >
            Моя библиотека
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[#9AA8BD] transition hover:text-[#3978FF]"
        >
          <span>←</span>
          Вернуться в каталог
        </a>

        {loading && (
          <div className="flex min-h-[450px] flex-col items-center justify-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#293650] border-t-[#3978FF]" />
            <p className="text-sm text-[#9AA8BD]">
              Загружаем информацию об игре...
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="mt-10 rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
            <div className="mb-4 text-4xl">⚠️</div>
            <h2 className="text-xl font-bold">Не удалось открыть игру</h2>
            <p className="mt-3 text-sm text-red-300">{error}</p>
            <a
              href="/"
              className="mt-6 inline-flex rounded-lg bg-[#3978FF] px-6 py-3 font-bold text-white transition hover:bg-[#3978FF]"
            >
              Вернуться на главную
            </a>
          </div>
        )}

        {!loading && game && (
          <>
            {/* GAME HERO */}
            <section className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
              <div className="relative min-h-[280px] overflow-hidden rounded-2xl border border-[#293650] bg-gradient-to-br from-[#17233B] via-[#19243A] to-[#0A0E18] sm:min-h-[420px]">
                {game.image_url ? (
                  <img
                    src={game.image_url}
                    alt={game.title}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-8xl">🎮</span>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/10" />

                <div className="absolute bottom-5 left-5 right-5">
                  <span className="rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white backdrop-blur">
                    {game.genre || "Игра"}
                  </span>
                </div>
              </div>

              {/* GAME INFO */}
              <div className="flex flex-col justify-center">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-[#3978FF]/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[#3978FF]">
                    VEXORA GAME
                  </span>

                  {inLibrary && (
                    <span className="rounded-md bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400">
                      В библиотеке
                    </span>
                  )}
                </div>

                <h1 className="text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                  {game.title}
                </h1>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <span className="text-2xl tracking-wider text-[#3978FF]">
                    {"★".repeat(roundedRating)}
                    {"☆".repeat(5 - roundedRating)}
                  </span>

                  <span className="text-sm text-[#9AA8BD]">
                    {reviews.length > 0
                      ? `${averageRating.toFixed(1)} из 5 · ${reviews.length} отзывов`
                      : "Пока нет оценок"}
                  </span>

                  <a
                    href="#reviews"
                    className="rounded-lg border border-[#3978FF]/30 bg-[#3978FF]/10 px-3 py-2 text-xs font-bold text-[#3978FF] transition hover:border-[#3978FF] hover:bg-[#3978FF]/20"
                  >
                    Читать отзывы ↓
                  </a>
                </div>

                <div className="mt-7">
                  <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-[#9AA8BD]">
                    Об игре
                  </h2>

                  <p className="whitespace-pre-wrap text-sm leading-7 text-[#B8BAC0]">
                    {game.description || "Описание игры пока не добавлено."}
                  </p>
                </div>

                {/* LIBRARY PANEL */}
                <div className="mt-8 rounded-2xl border border-[#293650] bg-[#121A2A] p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-[#9AA8BD]">
                        Стоимость
                      </p>

                      <p className="mt-1 text-3xl font-black text-white">
                        {formatPrice(game.price)}
                      </p>
                    </div>

                    <span className="text-2xl">🎮</span>
                  </div>

                  <button
                    onClick={addToLibrary}
                    disabled={adding || inLibrary}
                    className={`mt-5 w-full rounded-xl px-6 py-4 font-bold transition ${
                      inLibrary
                        ? "cursor-default border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                        : "bg-[#3978FF] text-white shadow-lg shadow-[#3978FF]/10 hover:bg-[#3978FF] disabled:cursor-wait disabled:opacity-60"
                    }`}
                  >
                    {adding
                      ? "Добавление..."
                      : inLibrary
                        ? "✓ Уже в библиотеке"
                        : game.price === 0
                          ? "Получить бесплатно"
                          : "Добавить в библиотеку"}
                  </button>

                  <button
                    type="button"
                    onClick={toggleWishlist}
                    disabled={savingWishlist}
                    className={`mt-3 w-full rounded-xl border px-6 py-3 font-bold transition disabled:cursor-wait disabled:opacity-60 ${
                      inWishlist
                        ? "border-[#3978FF]/40 bg-[#3978FF]/10 text-[#9DBEFF] hover:bg-[#3978FF]/20"
                        : "border-[#45484D] bg-[#19243A] text-[#EDF3FF] hover:border-[#3978FF]/50 hover:text-[#9DBEFF]"
                    }`}
                  >
                    {savingWishlist
                      ? "Сохранение..."
                      : inWishlist
                        ? "★ Убрать из избранного"
                        : "☆ В избранное"}
                  </button>

                  {message && (
                    <p className="mt-4 rounded-lg border border-[#293650] bg-[#19243A] p-3 text-sm text-[#EDF3FF]">
                      {message}
                    </p>
                  )}

                  <p className="mt-4 text-center text-xs text-[#9AA8BD]">
                    {inLibrary
                      ? "Игра доступна в твоей библиотеке."
                      : "Добавь игру в свою библиотеку VEXORA."}
                  </p>
                </div>
              </div>
            </section>

            {/* GAME DETAILS */}
            {(game.developer || game.publisher || game.release_date) && (
              <section className="mt-12">
                <div className="mb-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#3978FF]">Карточка игры</p>
                  <h2 className="mt-2 text-2xl font-black">Подробнее об игре</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    { label: "Разработчик", value: game.developer },
                    { label: "Издатель", value: game.publisher },
                    { label: "Дата выхода", value: game.release_date ? new Date(`${game.release_date}T00:00:00`).toLocaleDateString("ru-RU") : null },
                  ].filter((item) => item.value).map((item) => (
                    <div key={item.label} className="rounded-xl border border-[#293650] bg-[#121A2A] p-5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#9AA8BD]">{item.label}</p>
                      <p className="mt-2 text-base font-bold text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* TRAILER */}
            {trailerEmbedUrl && (
              <section className="mt-16">
                <div className="mb-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#3978FF]">Видео</p>
                  <h2 className="mt-2 text-2xl font-black">Трейлер игры</h2>
                </div>
                <div className="overflow-hidden rounded-2xl border border-[#293650] bg-black shadow-xl shadow-black/20">
                  <div className="aspect-video">
                    <iframe
                      src={trailerEmbedUrl}
                      title={`Трейлер игры ${game.title}`}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                  </div>
                </div>
              </section>
            )}

            {/* SCREENSHOTS */}
            {game.screenshots && game.screenshots.length > 0 && (
              <section className="mt-16">
                <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#3978FF]">
                      Галерея
                    </p>
                    <h2 className="mt-2 text-2xl font-black">
                      Скриншоты игры
                    </h2>
                  </div>

                  <span className="text-sm text-[#9AA8BD]">
                    {game.screenshots.length} изображений
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {game.screenshots.map((url, index) => (
                    <button
                      key={`${url}-${index}`}
                      type="button"
                      onClick={() => setSelectedScreenshot(url)}
                      aria-label={`Открыть скриншот ${index + 1} игры ${game.title}`}
                      className="group relative aspect-video overflow-hidden rounded-xl border border-[#293650] bg-[#121A2A] text-left shadow-lg shadow-black/10 transition duration-300 hover:-translate-y-1 hover:border-[#3978FF]/60 hover:shadow-[#3978FF]/10"
                    >
                      <img
                        src={url}
                        alt={`Скриншот ${index + 1} игры ${game.title}`}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent opacity-70 transition group-hover:opacity-100" />
                      <span className="absolute left-3 top-3 rounded-md border border-white/15 bg-black/50 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="absolute bottom-3 left-3 translate-y-2 text-xs font-bold text-white opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                        Открыть изображение ↗
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* SYSTEM REQUIREMENTS */}
            <section className="mt-16">
              <div className="mb-6">
                <p className="text-xs font-bold uppercase tracking-widest text-[#3978FF]">
                  Информация
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  Системные требования
                </h2>
              </div>

              <div className="rounded-2xl border border-[#293650] bg-[#121A2A] p-6 sm:p-8">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#3978FF]/10 text-xl">
                    💻
                  </div>

                  <div>
                    <h3 className="font-bold">Конфигурация компьютера</h3>
                    <p className="mt-1 text-xs text-[#9AA8BD]">
                      Требования для запуска игры
                    </p>
                  </div>
                </div>

                <div className="border-t border-[#293650] pt-5">
                  <p className="whitespace-pre-wrap text-sm leading-8 text-[#B8BAC0]">
                    {game.system_requirements ||
                      "Системные требования пока не добавлены."}
                  </p>
                </div>
              </div>
            </section>

            {/* REVIEWS */}
            <section id="reviews" className="mt-16 scroll-mt-24">
              <div className="mb-6">
                <p className="text-xs font-bold uppercase tracking-widest text-[#3978FF]">
                  Сообщество
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  Отзывы игроков
                  <span className="ml-2 text-[#9AA8BD]">
                    ({reviews.length})
                  </span>
                </h2>
              </div>

              <div className="mb-8 grid gap-5 rounded-2xl border border-[#293650] bg-[#121A2A] p-5 sm:grid-cols-[220px_1fr] sm:p-7">
                <div className="flex flex-col justify-center border-b border-[#293650] pb-5 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-6">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#9AA8BD]">
                    Средняя оценка
                  </p>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="text-5xl font-black text-white">
                      {reviews.length > 0 ? averageRating.toFixed(1) : "—"}
                    </span>
                    <span className="pb-1 text-sm text-[#9AA8BD]">/ 5</span>
                  </div>
                  <div className="mt-2 text-lg tracking-wider text-[#3978FF]">
                    {"★".repeat(roundedRating)}{"☆".repeat(5 - roundedRating)}
                  </div>
                  <p className="mt-2 text-xs text-[#9AA8BD]">
                    На основе {reviews.length} {reviews.length % 10 === 1 && reviews.length % 100 !== 11 ? "отзыва" : reviews.length % 10 >= 2 && reviews.length % 10 <= 4 && (reviews.length % 100 < 12 || reviews.length % 100 > 14) ? "отзывов" : "отзывов"}
                  </p>
                </div>

                <div className="flex flex-col justify-center gap-3">
                  {ratingDistribution.map((item) => (
                    <div key={item.value} className="flex items-center gap-3">
                      <span className="w-8 shrink-0 text-sm font-semibold text-[#B8BAC0]">
                        {item.value} ★
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#293650]">
                        <div
                          className="h-full rounded-full bg-[#3978FF] transition-all duration-500"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right text-xs tabular-nums text-[#9AA8BD]">
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <form
                onSubmit={saveReview}
                className="mb-8 rounded-2xl border border-[#293650] bg-[#121A2A] p-5 sm:p-7"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-bold">
                    {reviews.some((review) => review.user_id === userId)
                      ? "Изменить свой отзыв"
                      : "Оставить отзыв"}
                  </h3>

                  <span className="rounded-md bg-[#3978FF]/10 px-3 py-1.5 text-xs font-bold text-[#3978FF]">
                    Ваше мнение важно
                  </span>
                </div>

                <label className="mt-6 block text-sm font-semibold text-[#B8BAC0]">
                  Твоя оценка
                </label>

                <select
                  value={rating}
                  onChange={(event) => setRating(event.target.value)}
                  className="mt-3 w-full max-w-xs rounded-xl border border-[#293650] bg-[#19243A] px-4 py-3 text-sm text-white outline-none transition focus:border-[#3978FF]"
                >
                  <option value="5">★★★★★ — Отлично</option>
                  <option value="4">★★★★☆ — Хорошо</option>
                  <option value="3">★★★☆☆ — Нормально</option>
                  <option value="2">★★☆☆☆ — Плохо</option>
                  <option value="1">★☆☆☆☆ — Очень плохо</option>
                </select>

                <label className="mt-6 block text-sm font-semibold text-[#B8BAC0]">
                  Комментарий
                </label>

                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  maxLength={1000}
                  rows={5}
                  placeholder="Поделись впечатлениями об игре..."
                  className="mt-3 w-full resize-y rounded-xl border border-[#293650] bg-[#19243A] p-4 text-sm text-white outline-none transition placeholder:text-[#777980] focus:border-[#3978FF]"
                />

                <div className="mt-2 text-right text-xs text-[#9AA8BD]">
                  {comment.length}/1000
                </div>

                <button
                  type="submit"
                  disabled={savingReview}
                  className="mt-5 rounded-xl bg-[#3978FF] px-7 py-3.5 font-bold text-white transition hover:bg-[#3978FF] disabled:cursor-wait disabled:opacity-50"
                >
                  {savingReview ? "Сохранение..." : "Опубликовать отзыв"}
                </button>

                {!userId && (
                  <p className="mt-4 text-sm text-[#9AA8BD]">
                    Для публикации отзыва необходимо{" "}
                    <a
                      href="/auth"
                      className="font-semibold text-[#3978FF] hover:underline"
                    >
                      войти в аккаунт
                    </a>
                    .
                  </p>
                )}

                {reviewMessage && (
                  <p className="mt-4 rounded-lg border border-[#293650] bg-[#19243A] p-3 text-sm text-[#EDF3FF]">
                    {reviewMessage}
                  </p>
                )}
              </form>

              {reviewError && (
                <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
                  {reviewError}
                </div>
              )}

              {reviews.length === 0 && !reviewError && (
                <div className="rounded-2xl border border-[#293650] bg-[#121A2A] px-6 py-12 text-center">
                  <div className="text-4xl">💬</div>
                  <h3 className="mt-4 text-lg font-bold">
                    Пока нет отзывов
                  </h3>
                  <p className="mt-2 text-sm text-[#9AA8BD]">
                    Стань первым, кто поделится впечатлениями об этой игре.
                  </p>
                </div>
              )}

              <div className="space-y-4">
                {reviews.map((review) => (
                  <article
                    key={review.id}
                    className="rounded-2xl border border-[#293650] bg-[#121A2A] p-5 sm:p-6"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3978FF]/10 font-bold text-[#3978FF]">
                          {review.user_id === userId ? "Я" : "G"}
                        </div>

                        <div>
                          <p className="font-bold">
                            {review.user_id === userId
                              ? "Твой отзыв"
                              : "Пользователь"}
                          </p>

                          <p className="mt-1 text-xs text-[#9AA8BD]">
                            {new Date(review.created_at).toLocaleDateString(
                              "ru-RU"
                            )}
                          </p>
                        </div>
                      </div>

                      <span className="text-lg tracking-wider text-[#3978FF]">
                        {"★".repeat(review.rating)}
                        {"☆".repeat(5 - review.rating)}
                      </span>
                    </div>

                    <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-[#B8BAC0]">
                      {review.comment || "Без комментария"}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      {/* FOOTER */}
      <footer className="mt-20 border-t border-[#293650] bg-[#0A0E18]">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-4 py-8 sm:flex-row sm:items-center sm:px-6">
          <a href="/" className="flex items-center gap-2 text-xl font-black">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3978FF] text-sm text-white">
              V
            </span>
            VEXORA
          </a>

          <p className="text-xs text-[#9AA8BD]">
            ENTER THE GAME. © {new Date().getFullYear()} VEXORA
          </p>
        </div>
      </footer>

      {/* SCREENSHOT MODAL */}
      {selectedScreenshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setSelectedScreenshot(null)}
        >
          <button
            type="button"
            onClick={() => setSelectedScreenshot(null)}
            className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-[#19243A] text-2xl text-white transition hover:bg-[#3978FF]"
            aria-label="Закрыть изображение"
          >
            ×
          </button>

          <img
            src={selectedScreenshot}
            alt={`Скриншот игры ${game?.title ?? ""}`}
            className="max-h-[85vh] max-w-full rounded-xl object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </main>
  );
}

export default function GamePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0A0E18] text-[#9AA8BD]">
          Загружаем страницу...
        </div>
      }
    >
      <GamePageContent />
    </Suspense>
  );
}
