
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type AuthMode = "login" | "register" | "recovery";

export default function AuthPage() {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setUser(data.session?.user ?? null);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      setUser(session?.user ?? null);

      if (event === "PASSWORD_RECOVERY") {
        setMode("recovery");
        setMessage("Придумай новый пароль для своего аккаунта.");
        setMessageType("success");
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  function showMessage(
    text: string,
    type: "success" | "error" = "success"
  ) {
    setMessage(text);
    setMessageType(type);
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage("");
    setPassword("");
    setShowPassword(false);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
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
          showMessage(
            "Аккаунт создан! Проверь почту и подтверди адрес электронной почты."
          );
        } else {
          router.replace("/");
          router.refresh();
          return;
        }
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.replace("/");
        router.refresh();
        return;
      } else {
        const { error } = await supabase.auth.updateUser({
          password,
        });

        if (error) throw error;

        await supabase.auth.signOut();

        setUser(null);
        setPassword("");
        setMode("login");

        showMessage("Пароль успешно изменён! Теперь можешь войти.");
      }
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Произошла неизвестная ошибка.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      showMessage(
        "Сначала введи адрес электронной почты.",
        "error"
      );
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/auth`,
        }
      );

      if (error) throw error;

      showMessage(
        "Если аккаунт с таким адресом существует, письмо для восстановления пароля будет отправлено."
      );
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Не удалось отправить письмо.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoading(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      showMessage(error.message, "error");
    } else {
      setUser(null);
      showMessage("Ты вышел из аккаунта.");
    }

    setLoading(false);
  }

  const isRecovery = mode === "recovery";

  return (
    <main className="auth-page min-h-screen bg-[#0A0E18] text-[#EDF3FF]">
      <div className="auth-layout">
        <section className="brand-panel">
          <div className="brand-glow" />

          <div className="sparks" aria-hidden="true">
            {Array.from({ length: 24 }).map((_, index) => (
              <span
                key={index}
                className={`spark spark-${index + 1}`}
              />
            ))}
          </div>

          <a href="/" className="brand-content">
            <div className="logo-animation">
              <div className="logo-halo" />

              <svg
                viewBox="0 0 200 200"
                className="brand-logo"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-label="VEXORA"
              >
                <path
                  d="M100 12L177 56V144L100 188L23 144V56L100 12Z"
                  stroke="#3978FF"
                  strokeWidth="5"
                />

                <path
                  d="M100 28L163 64V136L100 172L37 136V64L100 28Z"
                  stroke="#3978FF"
                  strokeOpacity=".35"
                  strokeWidth="2"
                />

                <path
                  d="M55 65L100 145L145 65"
                  stroke="#3978FF"
                  strokeWidth="13"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                <circle
                  cx="100"
                  cy="100"
                  r="88"
                  stroke="#3978FF"
                  strokeOpacity=".15"
                  strokeWidth="1"
                />
              </svg>
            </div>

            <h1 className="brand-title">
              VEX<span>ORA</span>
            </h1>

            <p className="brand-subtitle">
              ENTER THE GAME.
            </p>

            <div className="brand-divider" />

            <p className="brand-description">
              Открывай новые игровые миры, собирай свою
              коллекцию и становись частью игрового сообщества.
            </p>
          </a>

          <div className="brand-footer">
            VEXORA © 2026
          </div>
        </section>

        <section className="form-panel">
          <div className="form-container">
            <a href="/" className="mobile-logo">
              VEX<span>ORA</span>
            </a>

            {user && !isRecovery ? (
              <div className="auth-card text-center">
                <div className="user-icon">
                  <span>✓</span>
                </div>

                <h2 className="form-title">
                  Добро пожаловать!
                </h2>

                <p className="form-description">
                  Ты уже авторизован в VEXORA.
                </p>

                <div className="user-email">
                  {user.email}
                </div>

                <button
                  onClick={() => router.replace("/")}
                  className="primary-button mt-7"
                >
                  Перейти в магазин →
                </button>

                <button
                  onClick={handleLogout}
                  disabled={loading}
                  className="secondary-button"
                >
                  {loading ? "Подожди..." : "Выйти из аккаунта"}
                </button>
              </div>
            ) : (
              <div className="auth-card">
                <div className="card-top-label">
                  <span className="status-dot" />
                  VEXORA ACCOUNT
                </div>

                <h2 className="form-title">
                  {isRecovery
                    ? "Новый пароль"
                    : mode === "login"
                      ? "С возвращением!"
                      : "Создать аккаунт"}
                </h2>

                <p className="form-description">
                  {isRecovery
                    ? "Придумай новый пароль для своего аккаунта."
                    : mode === "login"
                      ? "Войди в свой аккаунт и продолжай играть."
                      : "Присоединяйся к игровому сообществу VEXORA."}
                </p>

                {!isRecovery && (
                  <div className="mode-switch">
                    <button
                      type="button"
                      onClick={() => changeMode("login")}
                      className={
                        mode === "login"
                          ? "mode-button active"
                          : "mode-button"
                      }
                    >
                      Вход
                    </button>

                    <button
                      type="button"
                      onClick={() => changeMode("register")}
                      className={
                        mode === "register"
                          ? "mode-button active"
                          : "mode-button"
                      }
                    >
                      Регистрация
                    </button>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="auth-form">
                  {mode === "register" && (
                    <div className="input-group">
                      <label htmlFor="fullName">
                        Имя пользователя
                      </label>

                      <input
                        id="fullName"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        maxLength={40}
                        placeholder="Как тебя называть?"
                        autoComplete="name"
                      />
                    </div>
                  )}

                  {!isRecovery && (
                    <div className="input-group">
                      <label htmlFor="email">
                        Электронная почта
                      </label>

                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="example@mail.com"
                        autoComplete="email"
                      />
                    </div>
                  )}

                  <div className="input-group">
                    <label htmlFor="password">
                      {isRecovery ? "Новый пароль" : "Пароль"}
                    </label>

                    <div className="password-wrapper">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        placeholder="Минимум 8 символов"
                        autoComplete={
                          isRecovery
                            ? "new-password"
                            : mode === "login"
                              ? "current-password"
                              : "new-password"
                        }
                      />

                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={
                          showPassword
                            ? "Скрыть пароль"
                            : "Показать пароль"
                        }
                      >
                        {showPassword ? "Скрыть" : "Показать"}
                      </button>
                    </div>
                  </div>

                  {mode === "login" && (
                    <div className="forgot-row">
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={loading}
                      >
                        Забыли пароль?
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="primary-button"
                  >
                    {loading
                      ? "Подожди..."
                      : isRecovery
                        ? "Изменить пароль"
                        : mode === "login"
                          ? "Войти в аккаунт"
                          : "Создать аккаунт"}

                    {!loading && (
                      <span className="button-arrow">→</span>
                    )}
                  </button>
                </form>

                {message && (
                  <div
                    className={`message-box ${
                      messageType === "error"
                        ? "message-error"
                        : "message-success"
                    }`}
                    role="status"
                  >
                    {message}
                  </div>
                )}

                {isRecovery ? (
                  <button
                    type="button"
                    onClick={() => changeMode("login")}
                    className="back-link-button"
                  >
                    ← Вернуться ко входу
                  </button>
                ) : (
                  <div className="bottom-text">
                    {mode === "login"
                      ? "Ещё нет аккаунта?"
                      : "Уже есть аккаунт?"}

                    <button
                      type="button"
                      onClick={() =>
                        changeMode(
                          mode === "login" ? "register" : "login"
                        )
                      }
                    >
                      {mode === "login"
                        ? "Создать аккаунт"
                        : "Войти"}
                    </button>
                  </div>
                )}

                <div className="terms-text">
                  Продолжая, ты принимаешь условия использования VEXORA.
                </div>
              </div>
            )}

            <a href="/" className="back-link">
              ← Вернуться в магазин
            </a>
          </div>
        </section>
      </div>

      <style jsx>{`
        .auth-page {
          --orange: #3978FF;
          --background: #0A0E18;
          --card: #121A2A;
          --secondary: #19243A;
          --border: #293650;
          --muted: #9AA8BD;
        }

        .auth-layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          min-height: 100vh;
        }

        .brand-panel {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          overflow: hidden;
          background:
            radial-gradient(
              ellipse at center,
              rgba(57,120,255,.09),
              transparent 65%
            ),
            #151719;
          border-right: 1px solid var(--border);
        }

        .brand-glow {
          position: absolute;
          width: 450px;
          height: 450px;
          border-radius: 50%;
          background: rgba(57,120,255,.08);
          filter: blur(100px);
          animation: glow 6s ease-in-out infinite;
        }

        .brand-content {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          max-width: 480px;
          padding: 30px;
          text-align: center;
          text-decoration: none;
        }

        .logo-animation {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 230px;
          height: 230px;
          animation: floating 4s ease-in-out infinite;
        }

        .brand-logo {
          position: relative;
          z-index: 2;
          width: 190px;
          height: 190px;
          filter:
            drop-shadow(0 0 12px rgba(57,120,255,.5))
            drop-shadow(0 0 35px rgba(57,120,255,.25));
        }

        .logo-halo {
          position: absolute;
          width: 190px;
          height: 190px;
          border-radius: 50%;
          background: rgba(57,120,255,.2);
          filter: blur(65px);
          animation: halo 4s ease-in-out infinite;
        }

        .brand-title {
          margin-top: 25px;
          font-size: 42px;
          font-weight: 900;
          letter-spacing: -1.5px;
          color: white;
        }

        .brand-title span,
        .mobile-logo span {
          color: var(--orange);
        }

        .brand-subtitle {
          margin-top: 10px;
          color: #B5B5B5;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 4px;
        }

        .brand-divider {
          width: 65px;
          height: 3px;
          margin-top: 30px;
          border-radius: 5px;
          background: var(--orange);
          box-shadow: 0 0 15px rgba(57,120,255,.6);
        }

        .brand-description {
          max-width: 350px;
          margin-top: 25px;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.8;
        }

        .brand-footer {
          position: absolute;
          bottom: 25px;
          left: 0;
          width: 100%;
          text-align: center;
          color: #55585D;
          font-size: 10px;
          letter-spacing: 3px;
        }

        .sparks {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }

        .spark {
          position: absolute;
          bottom: -20px;
          left: var(--left);
          width: var(--size);
          height: var(--size);
          border-radius: 50%;
          background: #83B3FF;
          opacity: 0;
          box-shadow: 0 0 9px 2px rgba(57,120,255,.7);
          animation: sparkFly var(--duration) linear infinite;
          animation-delay: var(--delay);
        }

        .spark-1 { --left: 10%; --size: 3px; --duration: 8s; --delay: 0s; }
        .spark-2 { --left: 20%; --size: 2px; --duration: 11s; --delay: 2s; }
        .spark-3 { --left: 35%; --size: 4px; --duration: 9s; --delay: 1s; }
        .spark-4 { --left: 45%; --size: 2px; --duration: 12s; --delay: 4s; }
        .spark-5 { --left: 60%; --size: 3px; --duration: 10s; --delay: 3s; }
        .spark-6 { --left: 75%; --size: 2px; --duration: 9s; --delay: 5s; }
        .spark-7 { --left: 90%; --size: 4px; --duration: 12s; --delay: 1s; }
        .spark-8 { --left: 15%; --size: 2px; --duration: 10s; --delay: 6s; }
        .spark-9 { --left: 28%; --size: 3px; --duration: 13s; --delay: 3s; }
        .spark-10 { --left: 52%; --size: 2px; --duration: 8s; --delay: 2s; }
        .spark-11 { --left: 68%; --size: 3px; --duration: 11s; --delay: 7s; }
        .spark-12 { --left: 82%; --size: 2px; --duration: 9s; --delay: 4s; }
        .spark-13 { --left: 5%; --size: 2px; --duration: 12s; --delay: 8s; }
        .spark-14 { --left: 25%; --size: 3px; --duration: 10s; --delay: 5s; }
        .spark-15 { --left: 40%; --size: 2px; --duration: 13s; --delay: 1s; }
        .spark-16 { --left: 55%; --size: 4px; --duration: 9s; --delay: 6s; }
        .spark-17 { --left: 70%; --size: 2px; --duration: 11s; --delay: 2s; }
        .spark-18 { --left: 95%; --size: 3px; --duration: 10s; --delay: 7s; }
        .spark-19 { --left: 12%; --size: 2px; --duration: 14s; --delay: 9s; }
        .spark-20 { --left: 32%; --size: 3px; --duration: 12s; --delay: 4s; }
        .spark-21 { --left: 48%; --size: 2px; --duration: 9s; --delay: 8s; }
        .spark-22 { --left: 64%; --size: 3px; --duration: 13s; --delay: 3s; }
        .spark-23 { --left: 78%; --size: 2px; --duration: 11s; --delay: 5s; }
        .spark-24 { --left: 88%; --size: 3px; --duration: 10s; --delay: 9s; }

        .form-panel {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 50px 35px;
          background: var(--background);
        }

        .form-container {
          width: 100%;
          max-width: 440px;
        }

        .auth-card {
          padding: 38px;
          border: 1px solid var(--border);
          border-radius: 16px;
          background: var(--card);
          box-shadow: 0 25px 80px rgba(0,0,0,.25);
        }

        .card-top-label {
          display: flex;
          align-items: center;
          gap: 9px;
          color: var(--muted);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 2px;
        }

        .status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--orange);
          box-shadow: 0 0 10px var(--orange);
        }

        .form-title {
          margin-top: 24px;
          font-size: 29px;
          font-weight: 800;
          letter-spacing: -.7px;
          color: white;
        }

        .form-description {
          margin-top: 9px;
          color: var(--muted);
          font-size: 13px;
          line-height: 1.6;
        }

        .mode-switch {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 5px;
          margin-top: 30px;
          padding: 5px;
          border-radius: 10px;
          background: #101827;
        }

        .mode-button {
          padding: 12px;
          border: 0;
          border-radius: 7px;
          background: transparent;
          color: var(--muted);
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: .2s;
        }

        .mode-button:hover {
          color: white;
        }

        .mode-button.active {
          background: var(--orange);
          color: white;
          box-shadow: 0 4px 15px rgba(57,120,255,.2);
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 21px;
          margin-top: 30px;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .input-group label {
          color: #D0D0D0;
          font-size: 12px;
          font-weight: 600;
        }

        .input-group input {
          width: 100%;
          height: 49px;
          padding: 0 15px;
          border: 1px solid var(--border);
          border-radius: 9px;
          outline: none;
          background: #101827;
          color: white;
          font-size: 13px;
          transition: .2s;
        }

        .input-group input::placeholder {
          color: #666970;
        }

        .input-group input:focus {
          border-color: var(--orange);
          box-shadow: 0 0 0 3px rgba(57,120,255,.09);
        }

        .password-wrapper {
          position: relative;
        }

        .password-wrapper input {
          padding-right: 85px;
        }

        .password-toggle {
          position: absolute;
          top: 50%;
          right: 13px;
          transform: translateY(-50%);
          border: none;
          background: transparent;
          color: var(--orange);
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .forgot-row {
          display: flex;
          justify-content: flex-end;
          margin-top: -9px;
        }

        .forgot-row button {
          border: none;
          background: transparent;
          color: var(--orange);
          font-size: 12px;
          cursor: pointer;
        }

        .forgot-row button:hover {
          text-decoration: underline;
        }

        .primary-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          width: 100%;
          min-height: 50px;
          padding: 13px 20px;
          border: none;
          border-radius: 9px;
          background: var(--orange);
          color: white;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          transition: .25s;
          box-shadow: 0 7px 20px rgba(57,120,255,.13);
        }

        .primary-button:hover:not(:disabled) {
          transform: translateY(-2px);
          background: #69A0FF;
          box-shadow: 0 10px 25px rgba(57,120,255,.25);
        }

        .primary-button:disabled {
          cursor: not-allowed;
          opacity: .55;
        }

        .button-arrow {
          font-size: 18px;
        }

        .secondary-button {
          width: 100%;
          margin-top: 12px;
          padding: 13px;
          border: 1px solid var(--border);
          border-radius: 9px;
          background: transparent;
          color: var(--muted);
          font-size: 12px;
          cursor: pointer;
        }

        .secondary-button:hover {
          border-color: var(--orange);
          color: white;
        }

        .message-box {
          margin-top: 20px;
          padding: 13px 15px;
          border: 1px solid;
          border-radius: 9px;
          font-size: 12px;
          line-height: 1.6;
        }

        .message-success {
          border-color: rgba(57,120,255,.3);
          background: rgba(57,120,255,.07);
          color: #B8CEFF;
        }

        .message-error {
          border-color: rgba(239,90,90,.3);
          background: rgba(239,90,90,.07);
          color: #FF9999;
        }

        .bottom-text {
          margin-top: 27px;
          text-align: center;
          color: var(--muted);
          font-size: 12px;
        }

        .bottom-text button,
        .back-link-button {
          margin-left: 5px;
          border: none;
          background: transparent;
          color: var(--orange);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .back-link-button {
          display: block;
          margin: 25px auto 0;
        }

        .terms-text {
          margin-top: 27px;
          padding-top: 20px;
          border-top: 1px solid var(--border);
          color: #686B70;
          font-size: 10px;
          line-height: 1.7;
          text-align: center;
        }

        .back-link {
          display: block;
          margin-top: 25px;
          color: #777A80;
          font-size: 12px;
          text-align: center;
          text-decoration: none;
          transition: .2s;
        }

        .back-link:hover {
          color: var(--orange);
        }

        .user-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 65px;
          height: 65px;
          margin: 0 auto;
          border-radius: 50%;
          background: rgba(57,120,255,.13);
          color: var(--orange);
          font-size: 30px;
          font-weight: 800;
        }

        .user-email {
          margin-top: 20px;
          padding: 13px;
          border: 1px solid var(--border);
          border-radius: 9px;
          background: #101827;
          color: var(--muted);
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        .mobile-logo {
          display: none;
          margin-bottom: 25px;
          color: white;
          font-size: 23px;
          font-weight: 900;
          text-align: center;
          text-decoration: none;
        }

        @keyframes floating {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-17px); }
        }

        @keyframes halo {
          0%, 100% {
            transform: scale(.85);
            opacity: .5;
          }
          50% {
            transform: scale(1.15);
            opacity: 1;
          }
        }

        @keyframes glow {
          0%, 100% {
            opacity: .5;
            transform: scale(.9);
          }
          50% {
            opacity: 1;
            transform: scale(1.15);
          }
        }

        @keyframes sparkFly {
          0% {
            transform: translate3d(0, 0, 0);
            opacity: 0;
          }
          15% { opacity: .9; }
          80% { opacity: .6; }
          100% {
            transform: translate3d(35px, -110vh, 0);
            opacity: 0;
          }
        }

        @media (max-width: 900px) {
          .auth-layout {
            grid-template-columns: .85fr 1.15fr;
          }

          .brand-title {
            font-size: 32px;
          }

          .logo-animation {
            width: 190px;
            height: 190px;
          }

          .brand-logo {
            width: 155px;
            height: 155px;
          }

          .auth-card {
            padding: 28px;
          }
        }

        @media (max-width: 680px) {
          .auth-layout {
            display: flex;
            flex-direction: column;
          }

          .brand-panel {
            min-height: 280px;
            height: 280px;
            border-right: none;
            border-bottom: 1px solid var(--border);
          }

          .brand-content {
            padding: 15px;
          }

          .logo-animation {
            width: 115px;
            height: 115px;
          }

          .brand-logo {
            width: 105px;
            height: 105px;
          }

          .brand-title {
            margin-top: 8px;
            font-size: 27px;
          }

          .brand-subtitle {
            margin-top: 5px;
            font-size: 12px;
          }

          .brand-divider,
          .brand-description,
          .brand-footer {
            display: none;
          }

          .form-panel {
            min-height: auto;
            padding: 35px 18px 45px;
          }

          .auth-card {
            padding: 27px 22px;
          }
        }

        @media (max-width: 380px) {
          .auth-card {
            padding: 22px 17px;
          }

          .form-title {
            font-size: 25px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .logo-animation,
          .logo-halo,
          .brand-glow,
          .spark {
            animation: none !important;
          }
        }
      `}</style>
    </main>
  );
}
