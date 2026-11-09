
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Application = {
  id: string;
  studio_name: string;
  description: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export default function DeveloperPage() {
  const [user, setUser] = useState<any>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [studioName, setStudioName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadPage() {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        setLoading(false);
        return;
      }

      setUser(data.user);

      const { data: applicationData, error } = await supabase
        .from("developer_applications")
        .select("*")
        .maybeSingle();

      if (error) {
        setMessage("Ошибка загрузки: " + error.message);
      } else {
        setApplication(applicationData);
      }

      setLoading(false);
    }

    loadPage();
  }, []);

  async function submitApplication(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setMessage("");

    const { data, error } = await supabase
      .from("developer_applications")
      .insert({
        user_id: user.id,
        studio_name: studioName,
        description,
      })
      .select()
      .single();

    if (error) {
      setMessage(
        error.code === "23505"
          ? "Ты уже отправлял заявку."
          : "Ошибка: " + error.message
      );
    } else {
      setApplication(data);
      setMessage("Заявка успешно отправлена!");
    }

    setSending(false);
  }

  const statusLabels = {
    pending: "Ожидает проверки",
    approved: "Одобрена",
    rejected: "Отклонена",
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0b0d14] p-10 text-white">
        Загрузка кабинета...
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
    <main className="min-h-screen bg-[#0b0d14] px-5 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <a href="/" className="text-2xl font-black">
          Game<span className="text-violet-400">Platform</span>
        </a>

        <div className="mt-10 rounded-3xl border border-white/10 bg-[#121622] p-8">
          <p className="text-sm font-bold uppercase tracking-widest text-violet-400">
            GamePlatform Studio
          </p>

          <h1 className="mt-3 text-3xl font-black">
            Кабинет разработчика
          </h1>

          <p className="mt-3 text-gray-400">
            Подавай заявки на публикацию своих игр в GamePlatform.
          </p>

          {application ? (
            <div className="mt-8 rounded-2xl border border-white/10 bg-[#0b0d14] p-6">
              <h2 className="text-xl font-bold">
                Твоя заявка
              </h2>

              <p className="mt-5 text-sm text-gray-400">
                Название студии
              </p>
              <p className="mt-1 font-bold">
                {application.studio_name}
              </p>

              <p className="mt-5 text-sm text-gray-400">
                Описание
              </p>
              <p className="mt-1 whitespace-pre-wrap">
                {application.description}
              </p>

              <p className="mt-5 text-sm text-gray-400">
                Статус заявки
              </p>

              <p className="mt-2 font-bold text-violet-400">
                {statusLabels[application.status]}
              </p>

              <p className="mt-4 text-xs text-gray-500">
                Отправлена:{" "}
                {new Date(application.created_at).toLocaleDateString("ru-RU")}
              </p>
            </div>
          ) : (
            <form onSubmit={submitApplication} className="mt-8 space-y-5">
              <div>
                <label className="mb-2 block text-sm text-gray-300">
                  Название студии
                </label>
                <input
                  value={studioName}
                  onChange={(e) => setStudioName(e.target.value)}
                  required
                  maxLength={60}
                  placeholder="Например, Wuzdak Studio"
                  className="w-full rounded-xl border border-white/10 bg-[#0b0d14] px-4 py-3 outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-300">
                  Описание студии и твоих проектов
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  minLength={20}
                  maxLength={1000}
                  rows={5}
                  placeholder="Расскажи, какие игры ты планируешь создавать..."
                  className="w-full resize-y rounded-xl border border-white/10 bg-[#0b0d14] px-4 py-3 outline-none focus:border-violet-500"
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full rounded-xl bg-violet-600 px-5 py-3.5 font-bold transition hover:bg-violet-500 disabled:opacity-60"
              >
                {sending ? "Отправка..." : "Отправить заявку"}
              </button>
            </form>
          )}

          {message && (
            <p className="mt-5 rounded-xl border border-white/10 bg-[#0b0d14] p-4 text-sm text-gray-300">
              {message}
            </p>
          )}
        </div>

        <a
          href="/"
          className="mt-6 block text-center text-sm text-gray-500 hover:text-violet-400"
        >
          ← Вернуться в магазин
        </a>
      </div>
    </main>
  );
}
