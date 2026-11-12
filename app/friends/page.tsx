
"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
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
  avatar_url: string | null;
};

type PresenceStatus = "online" | "do_not_disturb";

type PresenceUpdate = {
  user_id?: string;
  presence_status?: string;
  last_seen?: string | null;
};

const C = {
  bg: "#111214",
  surface: "#1B1D20",
  surface2: "#242629",
  border: "#303236",
  orange: "#F07832",
  text: "#E7E7E7",
  muted: "#92949A",
};

const AVATARS = [
  { id: "fox", emoji: "🦊", color: "#713F12" },
  { id: "wolf", emoji: "🐺", color: "#374151" },
  { id: "dragon", emoji: "🐉", color: "#7F1D1D" },
  { id: "cat", emoji: "🐱", color: "#6B21A8" },
  { id: "tiger", emoji: "🐯", color: "#9A3412" },
  { id: "panda", emoji: "🐼", color: "#374151" },
  { id: "robot", emoji: "🤖", color: "#164E63" },
  { id: "ghost", emoji: "👻", color: "#4B5563" },
  { id: "alien", emoji: "👽", color: "#166534" },
  { id: "knight", emoji: "🛡️", color: "#1E3A8A" },
  { id: "crown", emoji: "👑", color: "#854D0E" },
  { id: "fire", emoji: "🔥", color: "#9A3412" },
];

function Avatar({
  value,
  name,
}: {
  value: string | null;
  name: string | null;
}) {
  const displayName = name || "Игрок";
  const preset = AVATARS.find((item) => value === `preset:${item.id}`);

  if (preset) {
    return (
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-xl"
        style={{ background: preset.color }}
        title={displayName}
      >
        {preset.emoji}
      </div>
    );
  }

  if (value && value.startsWith("https://")) {
    return (
      <img
        src={value}
        alt={`Аватар ${displayName}`}
        className="h-11 w-11 shrink-0 rounded-full border object-cover"
        style={{ borderColor: "rgba(240,120,50,0.3)" }}
      />
    );
  }

  return (
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-black"
      style={{
        background: "rgba(240,120,50,0.12)",
        color: C.orange,
      }}
    >
      {displayName.charAt(0).toUpperCase()}
    </div>
  );
}

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

  const [, setPresenceTick] = useState(0);

  const loadFriends = useCallback(async () => {
    const { data, error } = await supabase.rpc(
      "get_friend_data_with_avatars"
    );

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
    let presenceChannel: ReturnType<typeof supabase.channel> | null = null;

    async function initialize() {
      const { data, error } = await supabase.auth.getUser();

      if (!active) return;

      if (error || !data.user) {
        setLoading(false);
        return;
      }

      const currentUserId = data.user.id;

      setUserId(currentUserId);

      presenceChannel = supabase
        .channel(`user-presence-${currentUserId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_presence",
          },
          (payload) => {
            if (!active || payload.eventType === "DELETE") return;

            const record = payload.new as PresenceUpdate;

            if (!record.user_id) return;

            const status: PresenceStatus =
              record.presence_status === "do_not_disturb"
                ? "do_not_disturb"
                : "online";

            const lastSeen =
              typeof record.last_seen === "string"
                ? record.last_seen
                : null;

            if (record.user_id === currentUserId) {
              setMyPresence(status);
            }

            setFriendsData((current) =>
              current.map((entry) =>
                entry.friend_id === record.user_id
                  ? {
                      ...entry,
                      presence_status: status,
                      last_seen: lastSeen,
                    }
                  : entry
              )
            );
          }
        )
        .subscribe((status) => {
          if (!active) return;

          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setMessage(
              "Проблема с подключением Realtime. Проверь соединение."
            );
          }
        });

      await Promise.all([loadFriends(), loadMyPresence()]);

      if (active) setLoading(false);
    }

    initialize();

    return () => {
      active = false;

      if (presenceChannel) {
        void supabase.removeChannel(presenceChannel);
      }
    };
  }, [loadFriends, loadMyPresence]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPresenceTick((value) => value + 1);
    }, 15000);

    return () => clearInterval(interval);
  }, []);

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

  async function respondToRequest(requestId: string, accept: boolean) {
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
    (entry) => entry.direction === "incoming" && entry.status === "pending"
  );

  const outgoing = friendsData.filter(
    (entry) => entry.direction === "outgoing" && entry.status === "pending"
  );

  const friends = friendsData
    .filter((entry) => entry.direction === "friend" && entry.status === "accepted")
    .sort((a, b) => {
      const aOnline = getPresence(a) !== "offline";
      const bOnline = getPresence(b) !== "offline";
      return Number(bOnline) - Number(aOnline) || (a.full_name || "").localeCompare(b.full_name || "", "ru");
    });

  if (loading) {
    return (
      <main
        className="flex min-h-screen items-center justify-center text-white"
        style={{ background: C.bg }}
      >
        Загрузка друзей...
      </main>
    );
  }

  if (!userId) {
    return (
      <main
        className="flex min-h-screen items-center justify-center px-5 text-white"
        style={{ background: C.bg }}
      >
        <div className="text-center">
          <div className="text-5xl">👤</div>
          <h1 className="mt-5 text-2xl font-bold">Ты не авторизован</h1>
          <a
            href="/auth"
            className="mt-4 block font-semibold transition hover:brightness-125"
            style={{ color: C.orange }}
          >
            Перейти ко входу
          </a>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen px-5 py-10 text-white"
      style={{ background: C.bg }}
    >
      <div className="mx-auto max-w-4xl">
        <a
          href="/"
          className="inline-flex items-center gap-3 text-2xl font-black tracking-wide"
        >
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl text-black"
            style={{
              background: C.orange,
              boxShadow: "0 5px 25px rgba(240,120,50,0.2)",
            }}
          >
            V
          </span>
          <span>
            VEX<span style={{ color: C.orange }}>ORA</span>
          </span>
        </a>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p
              className="mb-2 text-xs font-black uppercase tracking-[0.25em]"
              style={{ color: C.orange }}
            >
              YOUR COMMUNITY
            </p>
            <h1 className="text-3xl font-black">Мои друзья</h1>
            <p className="mt-2 text-sm" style={{ color: C.muted }}>
              Находи игроков и общайся с ними.
            </p>
          </div>

          <a
            href="/profile"
            className="rounded-xl border px-4 py-2 text-sm transition hover:bg-white/5"
            style={{ borderColor: C.border, color: C.text }}
          >
            ← Мой профиль
          </a>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border p-4" style={{ background: C.surface, borderColor: C.border }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>Друзья</p>
            <p className="mt-2 text-3xl font-black">{friends.length}</p>
            <p className="mt-1 text-xs" style={{ color: C.muted }}>В твоём списке</p>
          </div>
          <div className="rounded-2xl border p-4" style={{ background: C.surface, borderColor: C.border }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>Сейчас в сети</p>
            <p className="mt-2 text-3xl font-black text-emerald-400">{friends.filter((entry) => getPresence(entry) === "online").length}</p>
            <p className="mt-1 text-xs" style={{ color: C.muted }}>Готовы к общению</p>
          </div>
          <div className="rounded-2xl border p-4" style={{ background: C.surface, borderColor: C.border }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>Заявки</p>
            <p className="mt-2 text-3xl font-black" style={{ color: C.orange }}>{incoming.length + outgoing.length}</p>
            <p className="mt-1 text-xs" style={{ color: C.muted }}>{incoming.length} входящих · {outgoing.length} отправленных</p>
          </div>
        </div>

        <section
          className="mt-8 rounded-2xl border p-6"
          style={{ background: C.surface, borderColor: C.border }}
        >
          <h2 className="text-xl font-bold">Мой статус</h2>
          <p className="mt-2 text-sm" style={{ color: C.muted }}>
            Выбери, какой статус будут видеть другие пользователи.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => changePresence("online")}
              disabled={busyId === "presence"}
              className={`rounded-xl border px-5 py-3 font-bold transition disabled:opacity-50 ${
                myPresence === "online"
                  ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300"
                  : "border-white/10 bg-[#111214] text-gray-400 hover:bg-white/5"
              }`}
            >
              🟢 В сети
            </button>

            <button
              type="button"
              onClick={() => changePresence("do_not_disturb")}
              disabled={busyId === "presence"}
              className={`rounded-xl border px-5 py-3 font-bold transition disabled:opacity-50 ${
                myPresence === "do_not_disturb"
                  ? "border-red-400/50 bg-red-500/15 text-red-300"
                  : "border-white/10 bg-[#111214] text-gray-400 hover:bg-white/5"
              }`}
            >
              🔴 Не беспокоить
            </button>
          </div>
        </section>

        {message && (
          <div
            className="mt-6 rounded-xl border p-4 text-sm"
            style={{
              borderColor: "rgba(240,120,50,0.25)",
              background: "rgba(240,120,50,0.08)",
              color: "#FFD0AE",
            }}
          >
            {message}
          </div>
        )}

        <section
          className="mt-6 rounded-2xl border p-6"
          style={{ background: C.surface, borderColor: C.border }}
        >
          <h2 className="text-xl font-bold">
            <span style={{ color: C.orange }}>⌕</span> Поиск пользователей
          </h2>

          <form
            onSubmit={searchUsers}
            className="mt-4 flex flex-col gap-3 sm:flex-row"
          >
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Введи имя пользователя..."
              className="min-w-0 flex-1 rounded-xl border px-4 py-3 text-white outline-none transition focus:border-orange-500"
              style={{ background: C.bg, borderColor: C.border }}
            />

            <button
              type="submit"
              disabled={searching}
              className="rounded-xl px-6 py-3 font-bold text-black transition hover:brightness-110 disabled:opacity-50"
              style={{ background: C.orange }}
            >
              {searching ? "Поиск..." : "Найти"}
            </button>
          </form>

          {searchResults.length > 0 && (
            <div className="mt-5 space-y-3">
              {searchResults.map((profile) => (
                <div
                  key={profile.user_id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
                  style={{ background: C.bg, borderColor: C.border }}
                >
                  <div className="flex items-center gap-3">
                    <Avatar value={null} name={profile.full_name} />
                    <span className="font-bold">
                      {profile.full_name || "Игрок"}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/player/${profile.user_id}`}
                      className="rounded-lg border px-4 py-2 text-sm font-semibold transition hover:bg-white/5"
                      style={{ borderColor: C.border, color: C.text }}
                    >
                      Профиль
                    </Link>
                    <button
                      type="button"
                      onClick={() => sendRequest(profile.user_id)}
                      disabled={busyId === profile.user_id}
                      className="rounded-lg px-4 py-2 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-50"
                      style={{ background: C.orange }}
                    >
                      {busyId === profile.user_id
                        ? "Отправка..."
                        : "Добавить в друзья"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section
          className="mt-6 rounded-2xl border p-6"
          style={{ background: C.surface, borderColor: C.border }}
        >
          <h2 className="text-xl font-bold">
            📩 Входящие заявки ({incoming.length})
          </h2>

          {incoming.length === 0 ? (
            <p className="mt-4 text-sm" style={{ color: C.muted }}>
              Пока нет новых заявок.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {incoming.map((entry) => (
                <div
                  key={entry.request_id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-4"
                  style={{ background: C.bg }}
                >
                  <div className="flex items-center gap-3">
                    <Avatar value={entry.avatar_url} name={entry.full_name} />
                    <span className="font-bold">{entry.full_name || "Игрок"}</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => respondToRequest(entry.request_id, true)}
                      disabled={busyId === entry.request_id}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold transition hover:bg-emerald-500 disabled:opacity-50"
                    >
                      Принять
                    </button>
                    <button
                      type="button"
                      onClick={() => respondToRequest(entry.request_id, false)}
                      disabled={busyId === entry.request_id}
                      className="rounded-lg bg-red-600/80 px-3 py-2 text-sm font-bold transition hover:bg-red-500 disabled:opacity-50"
                    >
                      Отклонить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section
          className="mt-6 rounded-2xl border p-6"
          style={{ background: C.surface, borderColor: C.border }}
        >
          <h2 className="text-xl font-bold">
            📤 Отправленные заявки ({outgoing.length})
          </h2>

          {outgoing.length === 0 ? (
            <p className="mt-4 text-sm" style={{ color: C.muted }}>
              Ты пока никому не отправлял заявки.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {outgoing.map((entry) => (
                <div
                  key={entry.request_id}
                  className="flex items-center justify-between gap-3 rounded-xl p-4"
                  style={{ background: C.bg }}
                >
                  <div className="flex items-center gap-3">
                    <Avatar value={entry.avatar_url} name={entry.full_name} />
                    <span className="font-bold">{entry.full_name || "Игрок"}</span>
                  </div>
                  <span className="text-sm text-amber-400">Ожидает ответа</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section
          className="mt-6 rounded-2xl border p-6"
          style={{ background: C.surface, borderColor: C.border }}
        >
          <h2 className="text-xl font-bold">
            👥 Список друзей ({friends.length})
          </h2>

          {friends.length === 0 ? (
            <p className="mt-4 text-sm" style={{ color: C.muted }}>
              Здесь пока никого нет. Найди игроков и отправь им заявку!
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {friends.map((entry) => (
                <div
                  key={entry.request_id}
                  className="group rounded-xl border p-4 transition duration-200 hover:-translate-y-0.5 hover:border-orange-500/40 hover:bg-white/[0.02]"
                  style={{ background: C.bg, borderColor: C.border }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative shrink-0">
                        <Avatar value={entry.avatar_url} name={entry.full_name} />
                        <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#111214] ${getPresence(entry) === "online" ? "bg-emerald-400" : getPresence(entry) === "do_not_disturb" ? "bg-red-400" : "bg-gray-500"}`} />
                      </div>
                      <div className="min-w-0">
                        <span className="block truncate font-bold">
                        {entry.full_name || "Игрок"}
                        </span>
                        <div className="mt-1"><PresenceLabel entry={entry} /></div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFriend(entry.friend_id)}
                      disabled={busyId === entry.friend_id}
                      className="shrink-0 rounded-lg border border-red-500/20 px-3 py-2 text-xs text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {busyId === entry.friend_id ? "Удаление..." : "Удалить"}
                    </button>
                  </div>

                  <div className="mt-3 border-t pt-3 text-xs text-gray-500" style={{ borderColor: C.border }}>
                    {getPresence(entry) === "offline"
                      ? formatLastSeen(entry.last_seen)
                      : getPresence(entry) === "do_not_disturb"
                        ? "Пользователь не принимает уведомления"
                        : "Можно написать и поиграть вместе"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <a
          href="/"
          className="mt-8 block text-center text-sm transition hover:text-white"
          style={{ color: C.muted }}
        >
          ← Вернуться в магазин
        </a>

        <footer className="mt-12 border-t pt-6 text-center" style={{ borderColor: C.border }}>
          <p className="text-xs font-black tracking-widest">
            VEX<span style={{ color: C.orange }}>ORA</span>
          </p>
          <p
            className="mt-2 text-[10px] font-semibold tracking-[0.2em]"
            style={{ color: C.muted }}
          >
            ENTER THE GAME.
          </p>
        </footer>
      </div>
    </main>
  );
}
