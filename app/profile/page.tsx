
"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import ProfileCustomization from "../../components/profile-customization";

type MenuItem = {
  title: string;
  description: string;
  icon: string;
  href: string;
};

const C = {
  bg: "#0A0E18",
  surface: "#121A2A",
  surface2: "#19243A",
  border: "#293650",
  orange: "#F07832",
  text: "#EDF3FF",
  muted: "#9AA8BD",
};

const AVATARS = [
  { id: "fox", emoji: "🦊", name: "Лиса", color: "#713F12" },
  { id: "wolf", emoji: "🐺", name: "Волк", color: "#374151" },
  { id: "dragon", emoji: "🐉", name: "Дракон", color: "#7F1D1D" },
  { id: "cat", emoji: "🐱", name: "Кот", color: "#6B21A8" },
  { id: "tiger", emoji: "🐯", name: "Тигр", color: "#9A3412" },
  { id: "panda", emoji: "🐼", name: "Панда", color: "#374151" },
  { id: "robot", emoji: "🤖", name: "Робот", color: "#164E63" },
  { id: "ghost", emoji: "👻", name: "Призрак", color: "#4B5563" },
  { id: "alien", emoji: "👽", name: "Пришелец", color: "#166534" },
  { id: "knight", emoji: "🛡️", name: "Рыцарь", color: "#1E3A8A" },
  { id: "crown", emoji: "👑", name: "Корона", color: "#854D0E" },
  { id: "fire", emoji: "🔥", name: "Огонь", color: "#9A3412" },
];

function Avatar({
  value,
  name,
  size = "h-24 w-24",
}: {
  value: string | null;
  name: string;
  size?: string;
}) {
  const preset = AVATARS.find((item) => value === `preset:${item.id}`);

  if (preset) {
    return (
      <div
        className={`${size} flex shrink-0 items-center justify-center overflow-hidden rounded-3xl border text-4xl`}
        style={{
          background: preset.color,
          borderColor: "rgba(255,255,255,0.15)",
        }}
        title={preset.name}
      >
        {preset.emoji}
      </div>
    );
  }

  if (value?.startsWith("https://")) {
    return (
      <img
        src={value}
        alt={`Аватар ${name}`}
        className={`${size} shrink-0 rounded-3xl border object-cover`}
        style={{ borderColor: "rgba(240,120,50,0.3)" }}
      />
    );
  }

  return (
    <div
      className={`${size} flex shrink-0 items-center justify-center rounded-3xl border text-4xl font-black`}
      style={{
        background: "rgba(240,120,50,0.12)",
        borderColor: "rgba(240,120,50,0.3)",
        color: C.orange,
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2">
      <div
        className={`flex items-center justify-center rounded-xl font-black text-white ${
          compact ? "h-9 w-9 text-lg" : "h-10 w-10 text-xl"
        }`}
        style={{
          background: "linear-gradient(135deg, #F07832 0%, #FF9A54 100%)",
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

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Загружаем пользователя, права администратора и аватарку из Supabase.
  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        const {
          data: { user: currentUser },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!mounted) return;

        if (!currentUser) {
          setUser(null);
          setLoading(false);
          return;
        }

        setUser(currentUser);

        const [adminResult, profileResult] = await Promise.all([
          supabase
            .from("platform_admins")
            .select("user_id")
            .eq("user_id", currentUser.id)
            .maybeSingle(),

          supabase
            .from("profiles")
            .select("id, avatar_url, banner_url")
            .eq("id", currentUser.id)
            .maybeSingle(),
        ]);

        if (!mounted) return;

        setIsAdmin(!adminResult.error && !!adminResult.data);

        if (profileResult.error) {
          setAvatarMessage(
            "Не удалось загрузить аватарку: " +
              profileResult.error.message
          );
        } else if (!profileResult.data) {
          setAvatarUrl(null);
          setAvatarMessage(
            "Профиль не найден в таблице profiles. Сохранение аватарки пока невозможно."
          );
        } else {
          setAvatarUrl(profileResult.data.avatar_url || null);
          setBannerUrl(profileResult.data.banner_url || null);
        }
      } catch (err) {
        if (mounted) {
          setError(
            "Ошибка загрузки профиля: " +
              (err instanceof Error ? err.message : "Неизвестная ошибка")
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  // Закрытие меню клавишей Escape.
  useEffect(() => {
    if (!menuOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  // Блокировка прокрутки страницы при открытом меню.
  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  // Единая функция сохранения аватарки.
  async function saveAvatar(value: string) {
    if (!user || avatarLoading) return;

    setAvatarLoading(true);
    setAvatarMessage("");

    try {
      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: value })
        .eq("id", user.id)
        .select("id, avatar_url")
        .maybeSingle();

      if (updateError) {
        throw updateError;
      }

      // Важно: отсутствие ошибки не означает,
      // что Supabase действительно обновил строку.
      if (!data) {
        throw new Error(
          "Профиль не найден или обновление запрещено политиками RLS Supabase."
        );
      }

      setAvatarUrl(data.avatar_url || null);
      setAvatarMessage("Аватарка успешно сохранена!");
    } catch (err) {
      setAvatarMessage(
        "Не удалось сохранить аватарку: " +
          (err instanceof Error ? err.message : "Неизвестная ошибка")
      );
    } finally {
      setAvatarLoading(false);
    }
  }

  // Загрузка собственного изображения.
  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !user || avatarLoading) return;

    setAvatarMessage("");

    const allowedTypes: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
      "image/gif": "gif",
    };

    if (!allowedTypes[file.type]) {
      setAvatarMessage(
        "Выбери изображение PNG, JPG, WEBP или GIF."
      );
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarMessage(
        "Размер изображения не должен превышать 5 МБ."
      );
      event.target.value = "";
      return;
    }

    setAvatarLoading(true);

    const extension = allowedTypes[file.type];
    const filePath = `${user.id}/${crypto.randomUUID()}.${extension}`;

    try {
      // 1. Загружаем файл в Storage.
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        throw new Error(
          "Ошибка загрузки изображения: " + uploadError.message
        );
      }

      // 2. Получаем публичную ссылку.
      const { data: publicData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const publicUrl = publicData.publicUrl;

      if (!publicUrl) {
        throw new Error("Не удалось получить ссылку на изображение.");
      }

      // 3. Сохраняем ссылку в таблицу profiles.
      const { data: updatedProfile, error: updateError } =
        await supabase
          .from("profiles")
          .update({ avatar_url: publicUrl })
          .eq("id", user.id)
          .select("id, avatar_url")
          .maybeSingle();

      if (updateError) {
        throw new Error(
          "Изображение загружено, но профиль не обновлён: " +
            updateError.message
        );
      }

      if (!updatedProfile) {
        throw new Error(
          "Изображение загружено, но профиль не найден или обновление запрещено политиками RLS Supabase."
        );
      }

      // 4. Обновляем интерфейс только после подтверждения базы.
      setAvatarUrl(updatedProfile.avatar_url);
      setAvatarMessage("Собственная аватарка успешно сохранена!");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Неизвестная ошибка";

      setAvatarMessage(message);

      // Если файл загрузился, но сохранить ссылку не удалось,
      // удаляем ненужный файл из Storage.
      await supabase.storage.from("avatars").remove([filePath]);
    } finally {
      setAvatarLoading(false);
      event.target.value = "";
    }
  }

  // Выход из аккаунта.
  async function logout() {
    if (logoutLoading) return;

    setLogoutLoading(true);
    setError("");

    try {
      const { error: logoutError } = await supabase.auth.signOut();

      if (logoutError) throw logoutError;

      window.location.href = "/auth";
    } catch (err) {
      setError(
        "Не удалось выйти из аккаунта: " +
          (err instanceof Error ? err.message : "Неизвестная ошибка")
      );
      setLogoutLoading(false);
    }
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
    {
      title: "Избранное",
      description: "Список желаемого",
      icon: "☆",
      href: "/wishlist",
    },
    {
      title: "Достижения",
      description: "Уровень, опыт и награды",
      icon: "🏆",
      href: "/achievements",
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
          style={{ background: C.surface, borderColor: C.border }}
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
    <main className="min-h-screen text-white" style={{ background: C.bg }}>
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
              style={{ borderColor: C.border, color: C.muted }}
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

      <aside
        id="profile-sidebar"
        aria-label="Главная навигация"
        aria-hidden={!menuOpen}
        className={`fixed left-0 top-0 z-[70] flex h-[100dvh] w-[290px] max-w-[85vw] flex-col border-r transition-transform duration-300 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "#101827", borderColor: C.border }}
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

        <div className="border-b p-5" style={{ borderColor: C.border }}>
          <Avatar
            value={avatarUrl}
            name={displayName}
            size="h-14 w-14 text-2xl"
          />
          <p className="mt-3 font-bold">{displayName}</p>
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
            <span
              className="w-5 text-center text-lg"
              style={{ color: C.orange }}
            >
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
            <span
              className="w-5 text-center text-lg"
              style={{ color: C.orange }}
            >
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
            <span
              className="w-5 text-center text-lg"
              style={{ color: C.orange }}
            >
              ▦
            </span>
            Каталог игр
          </Link>

          <div className="my-5 border-t" style={{ borderColor: C.border }} />

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
                  : { color: C.text }
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

        <div className="border-t p-4" style={{ borderColor: C.border }}>
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
              <p
                className="mt-4 max-w-xl text-sm sm:text-base"
                style={{ color: C.muted }}
              >
                Управляй своим аккаунтом, находи друзей и следи за своей
                игровой коллекцией.
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

        <section className="mt-10 grid gap-5 lg:grid-cols-[340px_1fr]">
          <div
            className="relative overflow-hidden rounded-2xl border p-7"
            style={{ background: C.surface, borderColor: C.border }}
          >
            <div
              className="absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl"
              style={{ background: "rgba(240,120,50,0.12)" }}
            />

            <div className="relative">
              <div className="relative inline-flex items-center justify-center">
                <div aria-hidden="true" className="absolute -inset-4 rounded-[2rem] opacity-80 blur-2xl transition duration-500" style={{ backgroundImage: bannerUrl ? `url("${bannerUrl}")` : "linear-gradient(135deg, rgba(240,120,50,0.8), rgba(255,154,84,0.18), rgba(240,120,50,0.55))", backgroundPosition: "center", backgroundSize: "cover" }} />
                <div aria-hidden="true" className="absolute -inset-1 rounded-[1.8rem] border border-orange-400/40" style={{ boxShadow: "0 0 24px rgba(240,120,50,0.35)" }} />
                <div className="relative"><Avatar value={avatarUrl} name={displayName} /></div>
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

          <div
            className="rounded-2xl border p-6 sm:p-8"
            style={{ background: C.surface, borderColor: C.border }}
          >
            <div>
              <h2 className="text-xl font-black">
                Информация об аккаунте
              </h2>
              <p className="mt-2 text-sm" style={{ color: C.muted }}>
                Основные сведения о твоём профиле.
              </p>
            </div>

            <div className="mt-8 space-y-5">
              {[
                { title: "Имя пользователя", value: displayName },
                {
                  title: "Электронная почта",
                  value: user.email || "Не указана",
                },
                { title: "ID аккаунта", value: user.id },
                {
                  title: "Дата регистрации",
                  value: new Date(user.created_at).toLocaleDateString(
                    "ru-RU",
                    {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }
                  ),
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border p-4"
                  style={{
                    background: C.surface2,
                    borderColor: C.border,
                  }}
                >
                  <p className="text-xs" style={{ color: C.muted }}>
                    {item.title}
                  </p>
                  <p className="mt-2 break-all font-semibold">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <ProfileCustomization userId={user.id} />

        {/* AVATAR SETTINGS */}
        <section
          className="mt-6 rounded-2xl border p-6 sm:p-8"
          style={{ background: C.surface, borderColor: C.border }}
        >
          <div>
            <p
              className="text-xs font-black uppercase tracking-[0.2em]"
              style={{ color: C.orange }}
            >
              PERSONALIZATION
            </p>
            <h2 className="mt-2 text-2xl font-black">Моя аватарка</h2>
            <p className="mt-2 text-sm" style={{ color: C.muted }}>
              Выбери готовую аватарку или загрузи собственное изображение.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-5">
            <Avatar
              value={avatarUrl}
              name={displayName}
              size="h-20 w-20 text-3xl"
            />
            <div>
              <p className="font-bold">{displayName}</p>
              <p className="mt-1 text-xs" style={{ color: C.muted }}>
                Текущая аватарка профиля
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarLoading}
                className="mt-3 rounded-xl px-4 py-2.5 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-50"
                style={{ background: C.orange }}
              >
                {avatarLoading
                  ? "Загрузка..."
                  : "↑ Загрузить изображение"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={uploadAvatar}
              />
              <p className="mt-2 text-xs" style={{ color: C.muted }}>
                PNG, JPG, WEBP или GIF. Максимум 5 МБ.
              </p>
            </div>
          </div>

          <div className="mt-8">
            <h3 className="font-bold">
              Стандартные аватарки VEXORA
            </h3>
            <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {AVATARS.map((avatar) => {
                const selected =
                  avatarUrl === `preset:${avatar.id}`;

                return (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() =>
                      saveAvatar(`preset:${avatar.id}`)
                    }
                    disabled={avatarLoading}
                    className="flex flex-col items-center gap-2 rounded-xl border p-3 transition hover:-translate-y-1 disabled:opacity-50"
                    style={{
                      background: selected
                        ? "rgba(240,120,50,0.12)"
                        : C.surface2,
                      borderColor: selected ? C.orange : C.border,
                    }}
                  >
                    <span
                      className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl"
                      style={{ background: avatar.color }}
                    >
                      {avatar.emoji}
                    </span>
                    <span className="text-xs font-semibold">
                      {avatar.name}
                    </span>
                    {selected && (
                      <span
                        className="text-[10px] font-bold"
                        style={{ color: C.orange }}
                      >
                        Выбрана
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {avatarMessage && (
            <div
              role="status"
              className="mt-5 rounded-xl border p-4 text-sm"
              style={{
                background: "rgba(240,120,50,0.08)",
                borderColor: "rgba(240,120,50,0.25)",
                color: "#FFD0AE",
              }}
            >
              {avatarMessage}
            </div>
          )}
        </section>

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
                className="group rounded-2xl border p-6 transition duration-300 hover:-translate-y-1 hover:border-blue-500/50"
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
                <h3 className="mt-6 text-lg font-bold transition group-hover:text-blue-400">
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

        {isAdmin && (
          <section
            className="mt-8 rounded-2xl border p-6 sm:p-8"
            style={{
              background: "linear-gradient(110deg, #292B2F, #121A2A)",
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

        <section
          className="mt-8 flex flex-col justify-between gap-4 rounded-2xl border p-6 sm:flex-row sm:items-center"
          style={{ background: C.surface, borderColor: C.border }}
        >
          <div>
            <h3 className="font-bold">Выход из аккаунта</h3>
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

      <footer
        className="mt-12 border-t"
        style={{ background: "#080C14", borderColor: C.border }}
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
            <Link
              href="/library"
              className="transition hover:text-white"
            >
              Библиотека
            </Link>
            <Link
              href="/profile"
              className="transition hover:text-white"
            >
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
