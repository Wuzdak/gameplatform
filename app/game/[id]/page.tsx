
"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type Game = {
  id: string;
  title: string;
  description: string;
  genre: string;
  price: number;
  image_url: string | null;
  screenshots: string[];
  system_requirements: string;
};

type Review = {
  id: string;
  game_id: string;
  user_id: string;
  rating: number;
  comment: string;
  created_at: string;
};

function GamePageContent() {
  const params = useParams<{ id: string }>();
  const gameId = params.id;

  const [game, setGame] = useState<Game | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadPage() {
      setLoading(true);
      setError("");
      setReviewError("");

      const { data: userData } = await supabase.auth.getUser();
      setUserId(userData.user?.id ?? null);

      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("id, title, description, genre, price, image_url, screenshots, system_requirements")
        .eq("id", gameId)
        .eq("is_published", true)
        .maybeSingle();

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

      const { data: reviewData, error: reviewsLoadError } = await supabase
        .from("game_reviews")
        .select("*")
        .eq("game_id", gameId)
        .order("created_at", { ascending: false });

      if (reviewsLoadError) {
        setReviewError("Не удалось загрузить отзывы: " + reviewsLoadError.message);
      } else {
        const loadedReviews = reviewData ?? [];
        setReviews(loadedReviews);

        const ownReview = loadedReviews.find(
          (review) => review.user_id === userData.user?.id
        );

        if (ownReview) {
          setRating(String(ownReview.rating));
          setComment(ownReview.comment);
        }
      }

      setLoading(false);
    }

    if (gameId) loadPage();
  }, [gameId]);

  async function addToLibrary() {
    if (!game) return;

    setAdding(true);
    setMessage("");

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
        setMessage(
          error.code === "23505"
            ? "Эта игра уже есть в библиотеке."
            : "Ошибка: " + error.message
        );
      } else {
        setMessage("Игра успешно добавлена в библиотеку!");
      }
    } catch {
      setMessage("Не удалось выполнить запрос.");
    } finally {
      setAdding(false);
    }
  }

  async function saveReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!game) return;

    setReviewMessage("");

    if (!userId) {
      window.location.href = "/auth";
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
      setReviewMessage("Твой отзыв сохранён!");
    }

    setSavingReview(false);
  }

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) /
        reviews.length
      : 0;

  return (
    <main className="min-h-screen bg-[#0b0d14] text-white">
      <header className="border-b border-white/10 bg-[#10131d]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <a href="/" className="text-2xl font-black">
            Game<span className="text-violet-400">Platform</span>
          </a>

          <a
            href="/library"
            className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
          >
            Моя библиотека
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <a href="/" className="text-sm text-violet-400 hover:text-violet-300">
          ← Вернуться в каталог
        </a>

        {loading && (
          <p className="mt-12 text-center">Загружаем информацию об игре...</p>
        )}

        {!loading && error && (
          <p className="mt-12 rounded-xl bg-red-500/10 p-6 text-red-300">
            {error}
          </p>
        )}

        {!loading && game && (
          <>
            <section className="mt-8 grid gap-10 md:grid-cols-2">
              <div
                className="flex min-h-80 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-950 via-violet-900 to-cyan-900"
                style={
                  game.image_url
                    ? {
                        backgroundImage: `url("${game.image_url}")`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : undefined
                }
              >
                {!game.image_url && <span className="text-9xl">🎮</span>}
              </div>

              <div className="flex flex-col justify-center">
                <p className="font-bold uppercase tracking-widest text-violet-400">
                  {game.genre}
                </p>

                <h1 className="mt-4 text-4xl font-black md:text-5xl">
                  {game.title}
                </h1>

                <div className="mt-4 flex items-center gap-3">
                  <span className="text-2xl text-yellow-400">
                    {"★".repeat(Math.round(averageRating))}
                    {"☆".repeat(5 - Math.round(averageRating))}
                  </span>
                  <span className="text-sm text-gray-400">
                    {reviews.length > 0
                      ? `${averageRating.toFixed(1)} из 5 · ${reviews.length} отзывов`
                      : "Пока нет оценок"}
                  </span>
                </div>

                <p className="mt-6 whitespace-pre-wrap leading-8 text-gray-400">
                  {game.description || "Описание игры пока не добавлено."}
                </p>

                <div className="mt-8">
                  <p className="text-sm text-gray-400">Стоимость</p>
                  <p className="mt-1 text-3xl font-black">
                    {Number(game.price) === 0
                      ? "Бесплатно"
                      : `${Number(game.price).toLocaleString("ru-RU")} ₽`}
                  </p>
                </div>

                <button
                  onClick={addToLibrary}
                  disabled={adding}
                  className="mt-8 rounded-xl bg-violet-600 px-6 py-4 font-bold transition hover:bg-violet-500 disabled:opacity-50"
                >
                  {adding ? "Добавление..." : "Добавить в библиотеку"}
                </button>

                {message && (
                  <p className="mt-4 rounded-xl bg-white/5 p-4 text-sm text-violet-300">
                    {message}
                  </p>
                )}
              </div>
            </section>

            {game.screenshots?.length > 0 && (
              <section className="mt-16">
                <h2 className="mb-6 text-2xl font-black">Скриншоты игры</h2>

                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {game.screenshots.map((url, index) => (
                    <img
                      key={`${url}-${index}`}
                      src={url}
                      alt={`Скриншот ${index + 1} игры ${game.title}`}
                      className="h-52 w-full rounded-2xl border border-white/10 object-cover"
                    />
                  ))}
                </div>
              </section>
            )}

            <section className="mt-16">
              <h2 className="mb-6 text-2xl font-black">
                Системные требования
              </h2>

              <div className="rounded-2xl border border-white/10 bg-[#121622] p-6">
                <p className="whitespace-pre-wrap leading-8 text-gray-300">
                  {game.system_requirements ||
                    "Системные требования пока не добавлены."}
                </p>
              </div>
            </section>

            <section className="mt-16">
              <h2 className="mb-6 text-2xl font-black">
                Отзывы игроков ({reviews.length})
              </h2>

              <form
                onSubmit={saveReview}
                className="mb-8 rounded-2xl border border-white/10 bg-[#121622] p-6"
              >
                <h3 className="text-lg font-bold">
                  {reviews.some((review) => review.user_id === userId)
                    ? "Изменить свой отзыв"
                    : "Оставить отзыв"}
                </h3>

                <label className="mt-5 block text-sm text-gray-400">
                  Твоя оценка
                </label>

                <select
                  value={rating}
                  onChange={(event) => setRating(event.target.value)}
                  className="mt-2 rounded-xl border border-white/10 bg-[#1b2030] px-4 py-3 text-white"
                >
                  <option value="5">★★★★★ — Отлично</option>
                  <option value="4">★★★★☆ — Хорошо</option>
                  <option value="3">★★★☆☆ — Нормально</option>
                  <option value="2">★★☆☆☆ — Плохо</option>
                  <option value="1">★☆☆☆☆ — Очень плохо</option>
                </select>

                <label className="mt-5 block text-sm text-gray-400">
                  Комментарий
                </label>

                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  maxLength={1000}
                  rows={4}
                  placeholder="Поделись впечатлениями об игре..."
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#1b2030] p-4 text-white outline-none focus:border-violet-500"
                />

                <button
                  type="submit"
                  disabled={savingReview}
                  className="mt-5 rounded-xl bg-violet-600 px-6 py-3 font-bold hover:bg-violet-500 disabled:opacity-50"
                >
                  {savingReview ? "Сохранение..." : "Сохранить отзыв"}
                </button>

                {!userId && (
                  <p className="mt-3 text-sm text-gray-400">
                    Для публикации отзыва нужно войти в аккаунт.
                  </p>
                )}

                {reviewMessage && (
                  <p className="mt-4 text-sm text-violet-300">
                    {reviewMessage}
                  </p>
                )}
              </form>

              {reviewError && (
                <p className="mb-4 text-sm text-red-300">{reviewError}</p>
              )}

              {reviews.length === 0 && !reviewError && (
                <p className="rounded-2xl border border-white/10 bg-[#121622] p-8 text-center text-gray-400">
                  Пока никто не оставил отзыв. Будь первым!
                </p>
              )}

              <div className="space-y-4">
                {reviews.map((review) => (
                  <article
                    key={review.id}
                    className="rounded-2xl border border-white/10 bg-[#121622] p-6"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="font-bold">
                        {review.user_id === userId
                          ? "Твой отзыв"
                          : "Пользователь"}
                      </span>

                      <span className="text-yellow-400">
                        {"★".repeat(review.rating)}
                        {"☆".repeat(5 - review.rating)}
                      </span>
                    </div>

                    <p className="mt-3 whitespace-pre-wrap text-gray-300">
                      {review.comment || "Без комментария"}
                    </p>

                    <p className="mt-4 text-xs text-gray-500">
                      {new Date(review.created_at).toLocaleDateString("ru-RU")}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

export default function GamePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0b0d14] p-10 text-white">
          Загрузка страницы...
        </div>
      }
    >
      <GamePageContent />
    </Suspense>
  );
}
