
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

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
    <main className="min-h-screen bg-[#0b0d14] px-5 py-12 text-white">
      <div className="mx-auto max-w-2xl">
        <a href="/" className="text-2xl font-black">
          Game<span className="text-violet-400">Platform</span>
        </a>

        <div className="mt-10 rounded-3xl border border-white/10 bg-[#121622] p-8">
          <div className="text-5xl">👤</div>
          <h1 className="mt-5 text-3xl font-black">Мой профиль</h1>

          <div className="mt-8 space-y-5">
            <div>
              <p className="text-sm text-gray-400">Имя пользователя</p>
              <p className="mt-1 text-lg font-bold">
                {user.user_metadata?.full_name || "Не указано"}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-400">Электронная почта</p>
              <p className="mt-1 break-all">{user.email}</p>
            </div>

            <div>
              <p className="text-sm text-gray-400">ID аккаунта</p>
              <p className="mt-1 break-all text-sm">{user.id}</p>
            </div>

            <div>
              <p className="text-sm text-gray-400">Дата регистрации</p>
              <p className="mt-1">
                {new Date(user.created_at).toLocaleDateString("ru-RU")}
              </p>
            </div>
          </div>

          {isAdmin && (
            <a
              href="/admin"
              className="mt-8 block w-full rounded-xl border border-violet-400/30 bg-violet-600/15 px-5 py-3 text-center font-bold text-violet-300 transition hover:bg-violet-600/30"
            >
              ⚙️ Панель администратора
            </a>
          )}

          <button
            onClick={logout}
            className="mt-10 w-full rounded-xl bg-violet-600 px-5 py-3 font-bold hover:bg-violet-500"
          >
            Выйти из аккаунта
          </button>
        </div>

        <a
          href="/"
          className="mt-6 block text-center text-gray-400 hover:text-white"
        >
          ← Вернуться в магазин
        </a>
      </div>
    </main>
  );
}
