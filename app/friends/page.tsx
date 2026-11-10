
"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabase";

type ProfileResult = {
  user_id: string;
  full_name: string | null;
};

type FriendEntry = {
  request_id: string;
  friend_id: string;
  full_name: string | null;
  status: "pending" | "accepted" | "rejected";
  direction: "friend" | "incoming" | "outgoing";
  created_at: string;
  presence_status: "online" | "do_not_disturb" | null;
  last_seen: string | null;
};

type PresenceStatus = "online" | "do_not_disturb";

function getPresence(entry: FriendEntry) {
  if (!entry.last_seen) return "offline";

  const lastSeen = new Date(entry.last_seen).getTime();
  const active = Date.now() - lastSeen < 90000;

  if (!active) return "offline";

  return entry.presence_status === "do_not_disturb"
    ? "do_not_disturb"
    : "online";
}

function PresenceLabel({ entry }: { entry: FriendEntry }) {
  const presence = getPresence(entry);

  if (presence === "online") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-400">
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        В сети
      </span>
    );
  }

  if (presence === "do_not_disturb") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-red-400">
        <span className="h-2 w-2 rounded-full bg-red-400" />
        Не беспокоить
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 text-xs text-gray-500">
      <span className="h-2 w-2 rounded-full bg-gray-500" />
      Оффлайн
    </span>
  );
}

function formatLastSeen(value: string | null) {
  if (!value) return "Время посещения неизвестно";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Время посещения неизвестно";
  }

  return `Был в сети: ${date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export default function FriendsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileResult[]>([]);
  const [friendsData, setFriendsData] = useState<FriendEntry[]>([]);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [myPresence, setMyPresence] = useState<PresenceStatus>("online");

  const loadFriends = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_friend_data");

    if (error) {
      setMessage("Не удалось загрузить друзей: " + error.message);
      return;
    }

    setFriendsData((data || []) as FriendEntry[]);
  }, []);

  const loadMyPresence = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_my_presence");

    if (!error && data) {
      setMyPresence(data as PresenceStatus);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function initialize() {
      const { data, error } = await supabase.auth.getUser();

      if (!active) return;

      if (error || !data.user) {
        setLoading(false);
        return;
      }

      setUserId(data.user.id);

      await Promise.all([loadFriends(), loadMyPresence()]);

      if (active) setLoading(false);
    }

    initialize();

    const interval = setInterval(() => {
      loadFriends();
    }, 30000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [loadFriends, loadMyPresence]);

  async function changePresence(value: PresenceStatus) {
    setBusyId("presence");
    setMessage("");

    const { error } = await supabase.rpc("set_my_presence", {
      new_status: value,
    });

    if (error) {
      setMessage("Не удалось изменить статус: " + error.message);
    } else {
      setMyPresence(value);
      setMessage(
        value === "online"
          ? "Твой статус изменён на «В сети»."
          : "Включён режим «Не беспокоить»."
      );
      await loadFriends();
    }

    setBusyId(null);
  }

  async function searchUsers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSearchResults([]);

    const term = searchTerm.trim();

    if (term.length < 2) {
      setMessage("Введи минимум 2 символа для поиска.");
      return;
    }

    setSearching(true);

    const { data, error } = await supabase.rpc(
      "search_public_profiles",
      { search_term: term }
    );

    if (error) {
      setMessage("Ошибка поиска: " + error.message);
    } else {
      setSearchResults((data || []) as ProfileResult[]);

      if (!data || data.length === 0) {
        setMessage("Пользователи не найдены.");
      }
    }

    setSearching(false);
  }

  async function sendRequest(targetUserId: string) {
    setBusyId(targetUserId);
    setMessage("");

    const { error } = await supabase.rpc("send_friend_request", {
      target_user_id: targetUserId,
    });

    if (error) {
      setMessage("Не удалось отправить заявку: " + error.message);
    } else {
      setMessage("Заявка успешно отправлена!");
      setSearchResults((current) =>
        current.filter((profile) => profile.user_id !== targetUserId)
      );
      await loadFriends();
    }

    setBusyId(null);
  }

  async function respondToRequest(
    requestId: string,
    accept: boolean
  ) {
    setBusyId(requestId);
    setMessage("");

    const { error } = await supabase.rpc("respond_friend_request", {
      request_id: requestId,
      accept_request: accept,
    });

    if (error) {
      setMessage("Не удалось обработать заявку: " + error.message);
    } else {
      setMessage(
        accept ? "Заявка принята! Теперь вы друзья." : "Заявка отклонена."
      );
      await loadFriends();
    }

    setBusyId(null);
  }

  async function removeFriend(friendId: string) {
    const confirmed = window.confirm(
      "Ты действительно хочешь удалить этого пользователя из друзей?"
    );

    if (!confirmed) return;

    setBusyId(friendId);
    setMessage("");

    const { error } = await supabase.rpc("remove_friend", {
      target_user_id: friendId,
    });

    if (error) {
      setMessage("Не удалось удалить друга: " + error.message);
    } else {
      setMessage("Пользователь удалён из друзей.");
      await loadFriends();
    }

    setBusyId(null);
  }

  const incoming = friendsData.filter(
    (entry) =>
      entry.direction === "incoming" && entry.status === "pending"
  );

  const outgoing = friendsData.filter(
    (entry) =>
      entry.direction === "outgoing" && entry.status === "pending"
  );

  const friends = friendsData.filter(
    (entry) =>
      entry.direction === "friend" && entry.status === "accepted"
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0d14] text-white">
        Загрузка друзей...
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0d14] px-5 text-white">
        <div className="text-center">
          <div className="text-5xl">👤</div>
          <h1 className="mt-5 text-2xl font-bold">
            Ты не авторизован
          </h1>
          <a href="/auth" className="mt-4 block text-violet-400">
            Перейти ко входу
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b0d14] px-5 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <a href="/" className="text-2xl font-black">
          Game<span className="text-violet-400">Platform</span>
        </a>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Мои друзья</h1>
            <p className="mt-2 text-gray-400">
              Находи игроков и общайся с ними.
            </p>
          </div>

          <a
            href="/profile"
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-300 transition hover:bg-white/10"
          >
            ← Мой профиль
          </a>
        </div>

        {/* Мой статус */}
        <section className="mt-8 rounded-2xl border border-white/10 bg-[#121622] p-6">
          <h2 className="text-xl font-bold">Мой статус</h2>

          <p className="mt-2 text-sm text-gray-400">
            Выбери, какой статус будут видеть другие пользователи.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => changePresence("online")}
              disabled={busyId === "presence"}
              className={`rounded-xl border px-5 py-3 font-bold transition ${
                myPresence === "online"
                  ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300"
                  : "border-white/10 bg-[#0b0d14] text-gray-400 hover:bg-white/5"
              } disabled:opacity-50`}
            >
              🟢 В сети
            </button>

            <button
              onClick={() => changePresence("do_not_disturb")}
              disabled={busyId === "presence"}
              className={`rounded-xl border px-5 py-3 font-bold transition ${
                myPresence === "do_not_disturb"
                  ? "border-red-400/50 bg-red-500/15 text-red-300"
                  : "border-white/10 bg-[#0b0d14] text-gray-400 hover:bg-white/5"
              } disabled:opacity-50`}
            >
              🔴 Не беспокоить
            </button>
          </div>
        </section>

        {message && (
          <div className="mt-6 rounded-xl border border-violet-400/20 bg-violet-500/10 p-4 text-sm text-violet-200">
            {message}
          </div>
        )}

        {/* Поиск */}
        <section className="mt-6 rounded-2xl border border-white/10 bg-[#121622] p-6">
          <h2 className="text-xl font-bold">🔎 Поиск пользователей</h2>

          <form
            onSubmit={searchUsers}
            className="mt-4 flex flex-col gap-3 sm:flex-row"
          >
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Введи имя пользователя..."
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0b0d14] px-4 py-3 text-white outline-none focus:border-violet-500"
            />

            <button
              type="submit"
              disabled={searching}
              className="rounded-xl bg-violet-600 px-6 py-3 font-bold hover:bg-violet-500 disabled:opacity-50"
            >
              {searching ? "Поиск..." : "Найти"}
            </button>
          </form>

          {searchResults.length > 0 && (
            <div className="mt-5 space-y-3">
              {searchResults.map((profile) => (
                <div
                  key={profile.user_id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0b0d14] p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-600/20 text-xl">
                      👤
                    </div>
                    <span className="font-bold">
                      {profile.full_name || "Игрок"}
                    </span>
                  </div>

                  <button
                    onClick={() => sendRequest(profile.user_id)}
                    disabled={busyId === profile.user_id}
                    className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold hover:bg-violet-500 disabled:opacity-50"
                  >
                    {busyId === profile.user_id
                      ? "Отправка..."
                      : "Добавить в друзья"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Входящие заявки */}
        <section className="mt-6 rounded-2xl border border-white/10 bg-[#121622] p-6">
          <h2 className="text-xl font-bold">
            📩 Входящие заявки ({incoming.length})
          </h2>

          {incoming.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">
              Пока нет новых заявок.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {incoming.map((entry) => (
                <div
                  key={entry.request_id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#0b0d14] p-4"
                >
                  <span className="font-bold">
                    {entry.full_name || "Игрок"}
                  </span>

                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        respondToRequest(entry.request_id, true)
                      }
                      disabled={busyId === entry.request_id}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold hover:bg-emerald-500 disabled:opacity-50"
                    >
                      Принять
                    </button>

                    <button
                      onClick={() =>
                        respondToRequest(entry.request_id, false)
                      }
                      disabled={busyId === entry.request_id}
                      className="rounded-lg bg-red-600/80 px-3 py-2 text-sm font-bold hover:bg-red-500 disabled:opacity-50"
                    >
                      Отклонить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Отправленные заявки */}
        <section className="mt-6 rounded-2xl border border-white/10 bg-[#121622] p-6">
          <h2 className="text-xl font-bold">
            📤 Отправленные заявки ({outgoing.length})
          </h2>

          {outgoing.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">
              Ты пока никому не отправлял заявки.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {outgoing.map((entry) => (
                <div
                  key={entry.request_id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-[#0b0d14] p-4"
                >
                  <span className="font-bold">
                    {entry.full_name || "Игрок"}
                  </span>
                  <span className="text-sm text-amber-400">
                    Ожидает ответа
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Друзья */}
        <section className="mt-6 rounded-2xl border border-white/10 bg-[#121622] p-6">
          <h2 className="text-xl font-bold">
            👥 Список друзей ({friends.length})
          </h2>

          {friends.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">
              Здесь пока никого нет. Найди игроков и отправь им заявку!
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {friends.map((entry) => (
                <div
                  key={entry.request_id}
                  className="rounded-xl bg-[#0b0d14] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                        👤
                      </div>
                      <span className="truncate font-bold">
                        {entry.full_name || "Игрок"}
                      </span>
                    </div>

                    <button
                      onClick={() => removeFriend(entry.friend_id)}
                      disabled={busyId === entry.friend_id}
                      className="shrink-0 rounded-lg border border-red-500/20 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {busyId === entry.friend_id
                        ? "Удаление..."
                        : "Удалить"}
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <PresenceLabel entry={entry} />
                    <span className="text-xs text-gray-500">
                      {getPresence(entry) === "offline"
                        ? formatLastSeen(entry.last_seen)
                        : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <a
          href="/"
          className="mt-8 block text-center text-sm text-gray-500 hover:text-white"
        >
          ← Вернуться в магазин
        </a>
      </div>
    </main>
  );
}
