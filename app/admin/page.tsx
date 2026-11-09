
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Application = {
  id: string;
  user_id: string;
  studio_name: string;
  description: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
};

type ManagedUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  is_admin: boolean;
};

type Game = {
  id: string;
  title: string;
  description: string;
  genre: string;
  price: number;
  image_url: string | null;
  screenshots: string[] | null;
  system_requirements: string | null;
  is_published: boolean;
  created_at: string;
};

type GameForm = {
  title: string;
  description: string;
  genre: string;
  price: string;
  image_url: string;
  screenshots: string;
  system_requirements: string;
  is_published: boolean;
};

const emptyGame: GameForm = {
  title: "",
  description: "",
  genre: "",
  price: "0",
  image_url: "",
  screenshots: "",
  system_requirements: "",
  is_published: false,
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

function isValidImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function getGameImagePath(imageUrl: string): string | null {
  try {
    const url = new URL(imageUrl);
    const marker = "/storage/v1/object/public/game-images/";
    const markerIndex = url.pathname.indexOf(marker);

    if (markerIndex === -1) return null;

    const encodedPath = url.pathname.slice(
      markerIndex + marker.length
    );

    const path = decodeURIComponent(encodedPath);

    if (
      !path.startsWith("covers/") &&
      !path.startsWith("screenshots/")
    ) {
      return null;
    }

    if (path.split("/").some((part) => part === "..")) {
      return null;
    }

    return path;
  } catch {
    return null;
  }
}

export default function AdminPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [applications, setApplications] = useState<Application[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [games, setGames] = useState<Game[]>([]);

  const [userSearch, setUserSearch] = useState("");
  const [usersLoading, setUsersLoading] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const [message, setMessage] = useState("");

  const [gameForm, setGameForm] = useState<GameForm>(emptyGame);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingGame, setSavingGame] = useState(false);

  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingScreenshots, setUploadingScreenshots] = useState(false);

  // Загрузка пользователей через защищённый серверный API.

  async function loadManagedUsers() {
    setUsersLoading(true);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        throw new Error("Не удалось получить сессию пользователя.");
      }

      const response = await fetch("/api/admin/users", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Не удалось загрузить пользователей."
        );
      }

      setManagedUsers(result.users || []);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Ошибка загрузки пользователей."
      );
    } finally {
      setUsersLoading(false);
    }
  }

  // Выдача прав, блокировка и разблокировка аккаунтов.

  async function updateManagedUser(
    userId: string,
    action: "ban" | "unban" | "make_admin" | "remove_admin",
    duration?: "24h" | "7d" | "30d"
  ) {
    const target = managedUsers.find((user) => user.id === userId);

    if (!target) return;

    if (userId === currentUserId && action !== "make_admin") {
      setMessage("Нельзя изменять собственный аккаунт этим действием.");
      return;
    }

    const actionNames = {
      ban: "заблокировать аккаунт",
      unban: "разблокировать аккаунт",
      make_admin: "выдать права администратора",
      remove_admin: "снять права администратора",
    };

    const confirmed = window.confirm(
      `Вы уверены, что хотите ${actionNames[action]} для ${
        target.email || target.full_name || userId
      }?`
    );

    if (!confirmed) return;

    setUpdatingUserId(userId);
    setMessage("");

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        throw new Error("Не удалось получить сессию пользователя.");
      }

      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          userId,
          action,
          ...(duration ? { duration } : {}),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Не удалось выполнить действие."
        );
      }

      setMessage(result.message || "Изменения сохранены.");
      await loadManagedUsers();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Произошла ошибка."
      );
    } finally {
      setUpdatingUserId(null);
    }
  }

  // Загрузка основной информации админ-панели.

  async function loadData() {
    setLoading(true);
    setMessage("");

    const { data: userData, error: userError } =
      await supabase.auth.getUser();

    if (userError || !userData.user) {
      router.replace("/auth");
      return;
    }

    setCurrentUserId(userData.user.id);

    const { data: adminData, error: adminError } = await supabase
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (adminError || !adminData) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setIsAdmin(true);

    const [
      applicationsResult,
      profilesResult,
      gamesResult,
    ] = await Promise.all([
      supabase
        .from("developer_applications")
        .select("*")
        .order("created_at", { ascending: false }),

      supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false }),

      supabase
        .from("games")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    if (applicationsResult.error) {
      setMessage(
        "Ошибка загрузки заявок: " +
          applicationsResult.error.message
      );
    } else {
      setApplications(applicationsResult.data || []);
    }

    if (profilesResult.error) {
      setMessage(
        "Ошибка загрузки пользователей: " +
          profilesResult.error.message
      );
    } else {
      setProfiles(profilesResult.data || []);
    }

    if (gamesResult.error) {
      setMessage(
        "Ошибка загрузки игр: " + gamesResult.error.message
      );
    } else {
      setGames(gamesResult.data || []);
    }

    await loadManagedUsers();

    setLoading(false);
  }

  // Загрузка изображения в Supabase Storage.

  async function uploadImage(file: File, folder: string) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      throw new Error(
        `Файл ${file.name}: неподдерживаемый формат изображения.`
      );
    }

    if (file.size > MAX_IMAGE_SIZE) {
      throw new Error(
        `Файл ${file.name} превышает допустимый размер 5 МБ.`
      );
    }

    const safeName = file.name
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]/g, "_");

    const filePath =
      `${folder}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;

    const { error } = await supabase.storage
      .from("game-images")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (error) {
      throw new Error(
        `Не удалось загрузить ${file.name}: ${error.message}`
      );
    }

    const { data } = supabase.storage
      .from("game-images")
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  // Удаление файлов из нашего Storage.

  async function deleteStorageImages(imageUrls: string[]) {
    const paths = Array.from(
      new Set(
        imageUrls
          .map((url) => getGameImagePath(url))
          .filter((path): path is string => Boolean(path))
      )
    );

    if (paths.length === 0) {
      return { success: true, error: null };
    }

    const { error } = await supabase.storage
      .from("game-images")
      .remove(paths);

    return {
      success: !error,
      error: error?.message || null,
    };
  }

  // Загрузка обложки.

  async function handleCoverUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    setMessage("");
    setUploadingCover(true);

    try {
      const publicUrl = await uploadImage(file, "covers");

      updateGameForm("image_url", publicUrl);
      setMessage("Обложка успешно загружена!");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Ошибка загрузки обложки."
      );
    } finally {
      setUploadingCover(false);
      event.target.value = "";
    }
  }

  // Загрузка нескольких скриншотов.

  async function handleScreenshotsUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) return;

    setMessage("");
    setUploadingScreenshots(true);

    const uploadedUrls: string[] = [];
    const errors: string[] = [];

    try {
      for (const file of files) {
        try {
          const publicUrl = await uploadImage(file, "screenshots");
          uploadedUrls.push(publicUrl);
        } catch (error) {
          errors.push(
            error instanceof Error
              ? error.message
              : `Ошибка загрузки ${file.name}`
          );
        }
      }

      if (uploadedUrls.length > 0) {
        setGameForm((previous) => ({
          ...previous,
          screenshots: [
            ...previous.screenshots
              .split("\n")
              .map((url) => url.trim())
              .filter(Boolean),
            ...uploadedUrls,
          ].join("\n"),
        }));
      }

      if (errors.length > 0) {
        setMessage(
          `Загружено скриншотов: ${uploadedUrls.length} из ${files.length}. ${errors.join(" ")}`
        );
      } else {
        setMessage(
          `Успешно загружено скриншотов: ${uploadedUrls.length}.`
        );
      }
    } finally {
      setUploadingScreenshots(false);
      event.target.value = "";
    }
  }

  function removeScreenshot(urlToRemove: string) {
    const updatedScreenshots = gameForm.screenshots
      .split("\n")
      .map((url) => url.trim())
      .filter(Boolean)
      .filter((url) => url !== urlToRemove);

    updateGameForm("screenshots", updatedScreenshots.join("\n"));
  }

  async function changeStatus(
    id: string,
    status: "approved" | "rejected"
  ) {
    setMessage("");

    const { error } = await supabase
      .from("developer_applications")
      .update({ status })
      .eq("id", id);

    if (error) {
      setMessage("Ошибка: " + error.message);
      return;
    }

    setMessage("Статус заявки обновлён.");
    await loadData();
  }

  function updateGameForm(
    field: keyof GameForm,
    value: string | boolean
  ) {
    setGameForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function startEditing(game: Game) {
    setEditingId(game.id);

    setGameForm({
      title: game.title,
      description: game.description,
      genre: game.genre,
      price: String(game.price),
      image_url: game.image_url || "",
      screenshots: (game.screenshots || []).join("\n"),
      system_requirements: game.system_requirements || "",
      is_published: game.is_published,
    });

    document
      .getElementById("game-form")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  function cancelEditing() {
    setEditingId(null);
    setGameForm(emptyGame);
    setMessage("");
  }

  // Сохранение игры и очистка старых изображений.

  async function saveGame(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (uploadingCover || uploadingScreenshots) {
      setMessage("Дождись окончания загрузки изображений.");
      return;
    }

    const price = Number(gameForm.price);

    if (!Number.isFinite(price) || price < 0) {
      setMessage("Укажи корректную цену, не меньше 0.");
      return;
    }

    if (
      gameForm.image_url.trim() &&
      !isValidImageUrl(gameForm.image_url.trim())
    ) {
      setMessage("Укажи корректную ссылку на обложку.");
      return;
    }

    const screenshots = gameForm.screenshots
      .split("\n")
      .map((url) => url.trim())
      .filter(Boolean);

    const invalidScreenshot = screenshots.find(
      (url) => !isValidImageUrl(url)
    );

    if (invalidScreenshot) {
      setMessage(
        "Одна из ссылок на скриншоты некорректна. Проверь все ссылки."
      );
      return;
    }

    setSavingGame(true);

    const gameData = {
      title: gameForm.title.trim(),
      description: gameForm.description.trim(),
      genre: gameForm.genre.trim(),
      price,
      image_url: gameForm.image_url.trim() || null,
      screenshots,
      system_requirements: gameForm.system_requirements.trim(),
      is_published: gameForm.is_published,
    };

    const oldGame = editingId
      ? games.find((game) => game.id === editingId)
      : null;

    const oldImages = oldGame
      ? [
          oldGame.image_url,
          ...(oldGame.screenshots || []),
        ].filter((url): url is string => Boolean(url))
      : [];

    const newImages = [
      gameData.image_url,
      ...gameData.screenshots,
    ].filter((url): url is string => Boolean(url));

    const result = editingId
      ? await supabase
          .from("games")
          .update(gameData)
          .eq("id", editingId)
      : await supabase
          .from("games")
          .insert(gameData);

    if (result.error) {
      setSavingGame(false);
      setMessage(
        "Ошибка сохранения игры: " + result.error.message
      );
      return;
    }

    let successMessage = editingId
      ? "Игра успешно обновлена."
      : "Новая игра успешно добавлена.";

    if (editingId && oldGame) {
      const imagesToDelete = oldImages.filter(
        (url) => !newImages.includes(url)
      );

      const cleanup = await deleteStorageImages(imagesToDelete);

      if (!cleanup.success) {
        successMessage +=
          ` Не удалось удалить некоторые старые изображения из Storage: ${cleanup.error}`;
      }
    }

    setSavingGame(false);
    setMessage(successMessage);

    setGameForm(emptyGame);
    setEditingId(null);

    await loadData();
  }

  async function togglePublication(game: Game) {
    setMessage("");

    const { error } = await supabase
      .from("games")
      .update({ is_published: !game.is_published })
      .eq("id", game.id);

    if (error) {
      setMessage("Ошибка изменения публикации: " + error.message);
      return;
    }

    setMessage(
      game.is_published
        ? "Игра снята с публикации."
        : "Игра опубликована."
    );

    await loadData();
  }

  // Удаление игры и связанных изображений.

  async function deleteGame(game: Game) {
    const confirmed = window.confirm(
      `Удалить игру «${game.title}»? Это действие нельзя отменить.`
    );

    if (!confirmed) return;

    setMessage("");

    const imagesToDelete = [
      game.image_url,
      ...(game.screenshots || []),
    ].filter((url): url is string => Boolean(url));

    const { error } = await supabase
      .from("games")
      .delete()
      .eq("id", game.id);

    if (error) {
      setMessage("Ошибка удаления игры: " + error.message);
      return;
    }

    const cleanup = await deleteStorageImages(imagesToDelete);

    if (editingId === game.id) {
      cancelEditing();
    }

    if (!cleanup.success) {
      setMessage(
        `Игра удалена, но некоторые изображения остались в Storage. Ошибка: ${cleanup.error}`
      );
    } else {
      setMessage("Игра и её изображения успешно удалены.");
    }

    await loadData();
  }

  useEffect(() => {
    loadData();
    // Первичная загрузка данных при открытии панели.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#090914] p-8 text-white">
        Загрузка...
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-[#090914] p-8 text-white">
        <h1 className="text-3xl font-bold">Доступ запрещён</h1>

        <p className="mt-3 text-gray-400">
          У этого аккаунта нет прав администратора.
        </p>

        <button
          onClick={() => router.push("/")}
          className="mt-6 rounded-xl bg-purple-600 px-5 py-3"
        >
          На главную
        </button>
      </main>
    );
  }

  const previewScreenshots = gameForm.screenshots
    .split("\n")
    .map((url) => url.trim())
    .filter((url) => isValidImageUrl(url));

  const filteredUsers = managedUsers.filter((user) => {
    const search = userSearch.trim().toLowerCase();

    if (!search) return true;

    return (
      (user.full_name || "").toLowerCase().includes(search) ||
      (user.email || "").toLowerCase().includes(search)
    );
  });

  return (
    <main className="min-h-screen bg-[#090914] p-6 text-white md:p-10">
      <div className="mx-auto max-w-6xl">

        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-purple-400">GAMEPLATFORM</p>

            <h1 className="text-3xl font-bold">
              Панель администратора
            </h1>
          </div>

          <div className="flex gap-3">
            <button
              onClick={loadData}
              className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/10"
            >
              Обновить
            </button>

            <button
              onClick={() => router.push("/")}
              className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/10"
            >
              На главную
            </button>
          </div>
        </div>

        {message && (
          <p className="mb-5 whitespace-pre-wrap rounded-xl bg-white/10 p-4">
            {message}
          </p>
        )}

        {/* Статистика */}

        <h2 className="mb-4 text-xl font-semibold">
          Статистика платформы
        </h2>

        <div className="mb-10 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-gray-400">Всего пользователей</p>

            <p className="mt-2 text-4xl font-bold text-purple-400">
              {profiles.length}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-gray-400">Заявок разработчиков</p>

            <p className="mt-2 text-4xl font-bold text-purple-400">
              {applications.length}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-gray-400">Всего игр</p>

            <p className="mt-2 text-4xl font-bold text-purple-400">
              {games.length}
            </p>
          </div>
        </div>

        {/* Управление играми */}

        <section className="mb-12">
          <h2 className="mb-5 text-2xl font-bold">
            Управление играми
          </h2>

          <form
            id="game-form"
            onSubmit={saveGame}
            className="mb-8 rounded-2xl border border-purple-500/30 bg-white/5 p-6"
          >
            <h3 className="mb-5 text-xl font-semibold">
              {editingId
                ? "Редактирование игры"
                : "Добавление новой игры"}
            </h3>

            <div className="grid gap-4 md:grid-cols-2">

              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Название игры *
                </label>

                <input
                  required
                  maxLength={100}
                  value={gameForm.title}
                  onChange={(e) =>
                    updateGameForm("title", e.target.value)
                  }
                  placeholder="Например, Cyber World"
                  className="w-full rounded-xl border border-white/10 bg-[#111120] p-3 outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Жанр *
                </label>

                <input
                  required
                  maxLength={50}
                  value={gameForm.genre}
                  onChange={(e) =>
                    updateGameForm("genre", e.target.value)
                  }
                  placeholder="Например, Экшен"
                  className="w-full rounded-xl border border-white/10 bg-[#111120] p-3 outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Цена (условная, без оплаты)
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={gameForm.price}
                  onChange={(e) =>
                    updateGameForm("price", e.target.value)
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#111120] p-3 outline-none focus:border-purple-500"
                />
              </div>

              {/* Обложка */}

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-purple-300">
                  Обложка игры
                </label>

                <p className="mb-3 text-xs text-gray-400">
                  Выбери изображение с компьютера. Допустимые форматы:
                  JPG, PNG, WEBP, GIF. Максимальный размер — 5 МБ.
                </p>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleCoverUpload}
                  disabled={uploadingCover}
                  className="block w-full cursor-pointer rounded-xl border border-white/10 bg-[#111120] p-3 text-sm text-gray-300 file:mr-4 file:rounded-lg file:border-0 file:bg-purple-600 file:px-4 file:py-2 file:text-white hover:file:bg-purple-500 disabled:opacity-50"
                />

                {uploadingCover && (
                  <p className="mt-2 text-sm text-purple-300">
                    Загружаем обложку...
                  </p>
                )}

                <div className="mt-4">
                  <label className="mb-2 block text-sm text-gray-400">
                    Или вставь ссылку на обложку
                  </label>

                  <input
                    type="url"
                    value={gameForm.image_url}
                    onChange={(e) =>
                      updateGameForm("image_url", e.target.value)
                    }
                    placeholder="https://example.com/image.jpg"
                    className="w-full rounded-xl border border-white/10 bg-[#111120] p-3 outline-none focus:border-purple-500"
                  />
                </div>

                {gameForm.image_url.trim() &&
                  isValidImageUrl(gameForm.image_url.trim()) && (
                    <div className="mt-4">
                      <p className="mb-2 text-sm text-gray-400">
                        Предпросмотр обложки
                      </p>

                      <div className="relative inline-block">
                        <img
                          src={gameForm.image_url.trim()}
                          alt="Предпросмотр обложки"
                          className="h-48 max-w-full rounded-xl object-cover"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            updateGameForm("image_url", "")
                          }
                          className="absolute right-2 top-2 rounded-lg bg-red-700 px-3 py-2 text-sm hover:bg-red-600"
                        >
                          Убрать обложку
                        </button>
                      </div>
                    </div>
                  )}
              </div>

              {/* Описание */}

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm text-gray-400">
                  Описание игры
                </label>

                <textarea
                  rows={4}
                  maxLength={3000}
                  value={gameForm.description}
                  onChange={(e) =>
                    updateGameForm("description", e.target.value)
                  }
                  placeholder="Расскажи об игре..."
                  className="w-full resize-y rounded-xl border border-white/10 bg-[#111120] p-3 outline-none focus:border-purple-500"
                />
              </div>

              {/* Скриншоты */}

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-purple-300">
                  Скриншоты игры
                </label>

                <p className="mb-3 text-xs text-gray-400">
                  Можно выбрать сразу несколько изображений.
                  Каждое изображение загрузится в Supabase Storage.
                  Максимальный размер одного файла — 5 МБ.
                </p>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  onChange={handleScreenshotsUpload}
                  disabled={uploadingScreenshots}
                  className="block w-full cursor-pointer rounded-xl border border-white/10 bg-[#111120] p-3 text-sm text-gray-300 file:mr-4 file:rounded-lg file:border-0 file:bg-purple-600 file:px-4 file:py-2 file:text-white hover:file:bg-purple-500 disabled:opacity-50"
                />

                {uploadingScreenshots && (
                  <p className="mt-2 text-sm text-purple-300">
                    Загружаем скриншоты...
                  </p>
                )}

                <div className="mt-4">
                  <label className="mb-2 block text-sm text-gray-400">
                    Или вставь ссылки на скриншоты
                  </label>

                  <textarea
                    rows={4}
                    value={gameForm.screenshots}
                    onChange={(e) =>
                      updateGameForm("screenshots", e.target.value)
                    }
                    placeholder={
                      "https://example.com/screenshot1.jpg\nhttps://example.com/screenshot2.jpg"
                    }
                    className="w-full resize-y rounded-xl border border-white/10 bg-[#111120] p-3 outline-none focus:border-purple-500"
                  />
                </div>

                {previewScreenshots.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-3 text-sm text-gray-400">
                      Скриншоты ({previewScreenshots.length})
                    </p>

                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      {previewScreenshots.map((url, index) => (
                        <div
                          key={`${url}-${index}`}
                          className="overflow-hidden rounded-xl border border-white/10 bg-[#111120]"
                        >
                          <img
                            src={url}
                            alt={`Скриншот ${index + 1}`}
                            className="h-32 w-full object-cover"
                          />

                          <button
                            type="button"
                            onClick={() => removeScreenshot(url)}
                            className="w-full bg-red-700 px-3 py-2 text-sm hover:bg-red-600"
                          >
                            Удалить скриншот
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Системные требования */}

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-purple-300">
                  Системные требования
                </label>

                <p className="mb-2 text-xs text-gray-400">
                  Укажи минимальные и рекомендуемые характеристики компьютера.
                </p>

                <textarea
                  rows={8}
                  maxLength={4000}
                  value={gameForm.system_requirements}
                  onChange={(e) =>
                    updateGameForm(
                      "system_requirements",
                      e.target.value
                    )
                  }
                  placeholder={`Минимальные требования:
ОС: Windows 10
Процессор: Intel Core i5
Оперативная память: 8 ГБ
Видеокарта: GTX 1050
Место на диске: 20 ГБ

Рекомендуемые требования:
ОС: Windows 11
Процессор: Intel Core i7
Оперативная память: 16 ГБ
Видеокарта: RTX 2060
Место на диске: 30 ГБ`}
                  className="w-full resize-y rounded-xl border border-white/10 bg-[#111120] p-3 outline-none focus:border-purple-500"
                />
              </div>

              <label className="flex items-center gap-3 text-sm text-gray-300 md:col-span-2">
                <input
                  type="checkbox"
                  checked={gameForm.is_published}
                  onChange={(e) =>
                    updateGameForm("is_published", e.target.checked)
                  }
                  className="h-4 w-4 accent-purple-500"
                />

                Опубликовать игру сразу
              </label>

            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={
                  savingGame ||
                  uploadingCover ||
                  uploadingScreenshots
                }
                className="rounded-xl bg-purple-600 px-6 py-3 font-semibold hover:bg-purple-500 disabled:opacity-50"
              >
                {savingGame
                  ? "Сохранение..."
                  : editingId
                  ? "Сохранить изменения"
                  : "Добавить игру"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="rounded-xl border border-white/20 px-6 py-3 hover:bg-white/10"
                >
                  Отмена
                </button>
              )}
            </div>
          </form>

          {/* Список игр */}

          <h3 className="mb-4 text-xl font-semibold">
            Каталог игр ({games.length})
          </h3>

          {games.length === 0 ? (
            <div className="rounded-2xl border border-white/10 p-8 text-center text-gray-400">
              Игр пока нет. Добавь первую игру с помощью формы выше.
            </div>
          ) : (
            <div className="space-y-4">
              {games.map((game) => (
                <article
                  key={game.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">

                    <div className="flex min-w-0 flex-1 gap-4">
                      {game.image_url ? (
                        <img
                          src={game.image_url}
                          alt={game.title}
                          className="h-24 w-36 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-24 w-36 shrink-0 items-center justify-center rounded-xl bg-purple-900/40 text-3xl">
                          🎮
                        </div>
                      )}

                      <div className="min-w-0">
                        <h4 className="text-xl font-semibold">
                          {game.title}
                        </h4>

                        <p className="mt-1 text-sm text-purple-300">
                          {game.genre}
                        </p>

                        <p className="mt-2 text-sm text-gray-400">
                          Цена: {game.price}
                        </p>

                        <p className="mt-1 text-sm text-gray-400">
                          Скриншотов: {(game.screenshots || []).length}
                        </p>

                        <p className="mt-1 text-sm text-gray-400">
                          Системные требования:{" "}
                          {game.system_requirements?.trim()
                            ? "Заполнены"
                            : "Не указаны"}
                        </p>

                        <span
                          className={`mt-2 inline-block rounded-full px-3 py-1 text-xs ${
                            game.is_published
                              ? "bg-green-500/20 text-green-300"
                              : "bg-yellow-500/20 text-yellow-300"
                          }`}
                        >
                          {game.is_published
                            ? "Опубликована"
                            : "Не опубликована"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => startEditing(game)}
                        className="rounded-lg bg-blue-700 px-3 py-2 text-sm hover:bg-blue-600"
                      >
                        Изменить
                      </button>

                      <button
                        onClick={() => togglePublication(game)}
                        className="rounded-lg bg-purple-700 px-3 py-2 text-sm hover:bg-purple-600"
                      >
                        {game.is_published ? "Снять" : "Опубликовать"}
                      </button>

                      <button
                        onClick={() => deleteGame(game)}
                        className="rounded-lg bg-red-700 px-3 py-2 text-sm hover:bg-red-600"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>

                  {game.description && (
                    <p className="mt-4 whitespace-pre-wrap text-sm text-gray-400">
                      {game.description}
                    </p>
                  )}

                  {(game.screenshots || []).length > 0 && (
                    <div className="mt-4">
                      <p className="mb-2 text-sm text-gray-400">
                        Скриншоты:
                      </p>

                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        {(game.screenshots || []).map((url, index) => (
                          <img
                            key={`${url}-${index}`}
                            src={url}
                            alt={`Скриншот ${index + 1}`}
                            className="h-24 w-full rounded-lg object-cover"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Управление пользователями */}

        <section className="mb-12">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">
              Управление пользователями
            </h2>

            <button
              onClick={loadManagedUsers}
              disabled={usersLoading}
              className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/10 disabled:opacity-50"
            >
              {usersLoading ? "Загрузка..." : "Обновить список"}
            </button>
          </div>

          <div className="mb-5 rounded-2xl border border-white/10 bg-white/5 p-4">
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Поиск по имени или email..."
              className="w-full rounded-xl border border-white/10 bg-[#111120] p-3 outline-none focus:border-purple-500"
            />

            <p className="mt-3 text-sm text-gray-400">
              Всего аккаунтов: {managedUsers.length} · Найдено: {filteredUsers.length}
            </p>
          </div>

          {usersLoading && managedUsers.length === 0 ? (
            <div className="rounded-2xl border border-white/10 p-8 text-center text-gray-400">
              Загружаем пользователей...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="rounded-2xl border border-white/10 p-8 text-center text-gray-400">
              Пользователи не найдены.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredUsers.map((user) => {
                const isBanned =
                  Boolean(user.banned_until) &&
                  new Date(user.banned_until!).getTime() > Date.now();

                const isUpdating = updatingUserId === user.id;
                const isSelf = user.id === currentUserId;

                return (
                  <article
                    key={user.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="break-words text-lg font-semibold">
                          {user.full_name || "Без имени"}
                        </h3>

                        <p className="mt-2 break-all text-sm text-gray-400">
                          Email: {user.email || "Не указан"}
                        </p>

                        <p className="mt-2 text-xs text-gray-500">
                          Дата регистрации:{" "}
                          {new Date(user.created_at).toLocaleString("ru-RU")}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          Последняя активность:{" "}
                          {user.last_sign_in_at
                            ? new Date(user.last_sign_in_at).toLocaleString("ru-RU")
                            : "Пока не входил"}
                        </p>

                        {isSelf && (
                          <p className="mt-2 text-xs text-purple-300">
                            Это ваш аккаунт
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs ${
                            user.is_admin
                              ? "bg-purple-500/20 text-purple-300"
                              : "bg-white/10 text-gray-300"
                          }`}
                        >
                          {user.is_admin ? "Администратор" : "Пользователь"}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-xs ${
                            isBanned
                              ? "bg-red-500/20 text-red-300"
                              : "bg-green-500/20 text-green-300"
                          }`}
                        >
                          {isBanned ? "Заблокирован" : "Активен"}
                        </span>
                      </div>
                    </div>

                    {isBanned && (
                      <p className="mt-3 text-sm text-red-300">
                        Блокировка действует до:{" "}
                        {new Date(user.banned_until!).toLocaleString("ru-RU")}
                      </p>
                    )}

                    <div className="mt-5 flex flex-wrap gap-2">
                      {user.is_admin ? (
                        <button
                          onClick={() =>
                            updateManagedUser(user.id, "remove_admin")
                          }
                          disabled={isUpdating || isSelf}
                          className="rounded-lg bg-purple-800 px-3 py-2 text-sm hover:bg-purple-700 disabled:opacity-50"
                        >
                          Снять права администратора
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            updateManagedUser(user.id, "make_admin")
                          }
                          disabled={isUpdating}
                          className="rounded-lg bg-purple-700 px-3 py-2 text-sm hover:bg-purple-600 disabled:opacity-50"
                        >
                          Сделать администратором
                        </button>
                      )}

                      {isBanned ? (
                        <button
                          onClick={() =>
                            updateManagedUser(user.id, "unban")
                          }
                          disabled={isUpdating}
                          className="rounded-lg bg-green-700 px-3 py-2 text-sm hover:bg-green-600 disabled:opacity-50"
                        >
                          Разблокировать
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() =>
                              updateManagedUser(user.id, "ban", "24h")
                            }
                            disabled={isUpdating || user.is_admin || isSelf}
                            className="rounded-lg bg-red-800 px-3 py-2 text-sm hover:bg-red-700 disabled:opacity-50"
                          >
                            Блокировка 24 ч.
                          </button>

                          <button
                            onClick={() =>
                              updateManagedUser(user.id, "ban", "7d")
                            }
                            disabled={isUpdating || user.is_admin || isSelf}
                            className="rounded-lg bg-red-800 px-3 py-2 text-sm hover:bg-red-700 disabled:opacity-50"
                          >
                            Блокировка 7 дней
                          </button>

                          <button
                            onClick={() =>
                              updateManagedUser(user.id, "ban", "30d")
                            }
                            disabled={isUpdating || user.is_admin || isSelf}
                            className="rounded-lg bg-red-800 px-3 py-2 text-sm hover:bg-red-700 disabled:opacity-50"
                          >
                            Блокировка 30 дней
                          </button>
                        </>
                      )}
                    </div>

                    {isUpdating && (
                      <p className="mt-3 text-sm text-purple-300">
                        Выполняем действие...
                      </p>
                    )}

                    {user.is_admin && (
                      <p className="mt-3 text-xs text-gray-500">
                        Администратор не может быть заблокирован, пока ему не снимут права администратора.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Заявки разработчиков */}

        <section>
          <h2 className="mb-4 text-xl font-semibold">
            Заявки разработчиков
          </h2>

          {applications.length === 0 ? (
            <div className="rounded-2xl border border-white/10 p-8 text-center text-gray-400">
              Заявок пока нет.
            </div>
          ) : (
            <div className="space-y-4">
              {applications.map((application) => (
                <article
                  key={application.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-xl font-semibold">
                      {application.studio_name}
                    </h3>

                    <span className="rounded-full bg-purple-500/20 px-3 py-1 text-sm text-purple-300">
                      {application.status === "pending"
                        ? "На рассмотрении"
                        : application.status === "approved"
                        ? "Одобрена"
                        : "Отклонена"}
                    </span>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap text-gray-300">
                    {application.description}
                  </p>

                  <p className="mt-3 break-all text-xs text-gray-500">
                    ID пользователя: {application.user_id}
                  </p>

                  <p className="mt-2 text-xs text-gray-500">
                    Дата:{" "}
                    {new Date(application.created_at).toLocaleString("ru-RU")}
                  </p>

                  {application.status === "pending" && (
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        onClick={() =>
                          changeStatus(application.id, "approved")
                        }
                        className="rounded-xl bg-green-700 px-4 py-2 hover:bg-green-600"
                      >
                        Одобрить
                      </button>

                      <button
                        onClick={() =>
                          changeStatus(application.id, "rejected")
                        }
                        className="rounded-xl bg-red-700 px-4 py-2 hover:bg-red-600"
                      >
                        Отклонить
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}
