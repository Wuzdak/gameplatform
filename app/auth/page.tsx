"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });

    const { data } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => data.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) throw error;

        if (!data.session) {
          setMessage(
            "Аккаунт создан! Проверь почту и подтверди адрес электронной почты."
          );
        } else {
          setMessage("Регистрация прошла успешно!");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        setMessage("Ты успешно вошёл в аккаунт!");
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Произошла неизвестная ошибка."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Ты вышел из аккаунта.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0d14] px-5 py-12 text-white">
      <div className="w-full max-w-md">
        <a href="/" className="mb-8 block text-center text-3xl font-black">
          Game<span className="text-violet-400">Platform</span>
        </a>

        <div className="rounded-3xl border border-white/10 bg-[#121622] p-8 shadow-2xl">
          {user ? (
            <div className="text-center">
              <div className="text-5xl">👋</div>
              <h1 className="mt-5 text-2xl font-black">
                Добро пожаловать!
              </h1>
              <p className="mt-3 break-all text-gray-400">
                {user.email}
              </p>

              <button
                onClick={handleLogout}
                className="mt-8 w-full rounded-xl bg-violet-600 px-5 py-3 font-bold transition hover:bg-violet-500"
              >
                Выйти из аккаунта
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-center text-3xl font-black">
                {mode === "login" ? "С возвращением!" : "Создать аккаунт"}
              </h1>

              <p className="mt-3 text-center text-sm text-gray-400">
                {mode === "login"
                  ? "Войди в свой аккаунт GamePlatform"
                  : "Присоединяйся к игровой вселенной"}
              </p>

              <div className="mt-8 grid grid-cols-2 rounded-xl bg-[#0b0d14] p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setMessage("");
                  }}
                  className={`rounded-lg py-3 text-sm font-bold ${
                    mode === "login"
                      ? "bg-violet-600 text-white"
                      : "text-gray-400"
                  }`}
                >
                  Вход
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setMessage("");
                  }}
                  className={`rounded-lg py-3 text-sm font-bold ${
                    mode === "register"
                      ? "bg-violet-600 text-white"
                      : "text-gray-400"
                  }`}
                >
                  Регистрация
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                {mode === "register" && (
                  <div>
                    <label className="mb-2 block text-sm text-gray-300">
                      Имя пользователя
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      maxLength={40}
                      placeholder="Как тебя называть?"
                      className="w-full rounded-xl border border-white/10 bg-[#0b0d14] px-4 py-3 outline-none focus:border-violet-500"
                    />
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm text-gray-300">
                    Электронная почта
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="example@mail.com"
                    className="w-full rounded-xl border border-white/10 bg-[#0b0d14] px-4 py-3 outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-gray-300">
                    Пароль
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Минимум 8 символов"
                    className="w-full rounded-xl border border-white/10 bg-[#0b0d14] px-4 py-3 outline-none focus:border-violet-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-violet-600 px-5 py-3.5 font-bold transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading
                    ? "Подожди..."
                    : mode === "login"
                      ? "Войти"
                      : "Зарегистрироваться"}
                </button>
              </form>

              {message && (
                <p className="mt-5 rounded-xl border border-white/10 bg-[#0b0d14] p-4 text-center text-sm text-gray-300">
                  {message}
                </p>
              )}
            </>
          )}
        </div>

        <a
          href="/"
          className="mt-6 block text-center text-sm text-gray-500 transition hover:text-violet-400"
        >
          ← Вернуться в магазин
        </a>
      </div>
    </main>
  );
}