
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { supabase } from "../../lib/supabase";

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

type ChatMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
};

function getPresence(friend: FriendEntry) {
  if (!friend.last_seen) return "offline";

  const lastSeen = new Date(friend.last_seen).getTime();

  if (Date.now() - lastSeen >= 90000) return "offline";

  return friend.presence_status === "do_not_disturb"
    ? "do_not_disturb"
    : "online";
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessagesPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(
    null
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);

  const selectedFriend =
    friends.find((friend) => friend.friend_id === selectedFriendId) || null;

  const loadMessages = useCallback(async () => {
    if (!userId || !selectedFriendId) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${selectedFriendId}),and(sender_id.eq.${selectedFriendId},receiver_id.eq.${userId})`
      )
      .order("created_at", { ascending: true });

    if (error) {
      setNotice("Не удалось загрузить сообщения: " + error.message);
    } else {
      setMessages((data || []) as ChatMessage[]);
    }

    setLoadingMessages(false);
  }, [userId, selectedFriendId]);

  useEffect(() => {
    let active = true;

    async function initialize() {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (!active) return;

      if (authError || !authData.user) {
        setLoading(false);
        return;
      }

      setUserId(authData.user.id);

      const { data, error } = await supabase.rpc("get_friend_data");

      if (!active) return;

      if (error) {
        setNotice("Не удалось загрузить друзей: " + error.message);
      } else {
        const acceptedFriends = ((data || []) as FriendEntry[]).filter(
          (friend) =>
            friend.direction === "friend" &&
            friend.status === "accepted"
        );

        setFriends(acceptedFriends);

        if (acceptedFriends.length > 0) {
          setSelectedFriendId(acceptedFriends[0].friend_id);
        }
      }

      setLoading(false);
    }

    initialize();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!userId || !selectedFriendId) return;

    const channel = supabase
      .channel(`chat-${userId}-${selectedFriendId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage;

          const belongsToChat =
            (newMessage.sender_id === userId &&
              newMessage.receiver_id === selectedFriendId) ||
            (newMessage.sender_id === selectedFriendId &&
              newMessage.receiver_id === userId);

          if (belongsToChat) {
            loadMessages();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, selectedFriendId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = text.trim();

    if (!content || !userId || !selectedFriendId || sending) return;

    setSending(true);
    setNotice("");

    const { error } = await supabase.from("messages").insert({
      sender_id: userId,
      receiver_id: selectedFriendId,
      content,
    });

    if (error) {
      setNotice("Не удалось отправить сообщение: " + error.message);
    } else {
      setText("");
      await loadMessages();
    }

    setSending(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0d14] text-white">
        Загрузка сообщений...
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0d14] px-5 text-white">
        <div className="text-center">
          <div className="text-5xl">💬</div>
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
    <main className="min-h-screen bg-[#0b0d14] px-4 py-6 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <a href="/" className="text-2xl font-black">
            Game<span className="text-violet-400">Platform</span>
          </a>

          <a
            href="/friends"
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-300 transition hover:bg-white/10"
          >
            ← Мои друзья
          </a>
        </div>

        <h1 className="mb-6 text-3xl font-black">Личные сообщения</h1>

        {notice && (
          <div className="mb-5 rounded-xl border border-violet-400/20 bg-violet-500/10 p-4 text-sm text-violet-200">
            {notice}
          </div>
        )}

        <div className="grid min-h-[650px] overflow-hidden rounded-2xl border border-white/10 bg-[#121622] md:grid-cols-[280px_1fr]">
          {/* Список друзей */}
          <aside className="border-b border-white/10 md:border-b-0 md:border-r">
            <div className="border-b border-white/10 p-5">
              <h2 className="font-bold">Диалоги</h2>
              <p className="mt-1 text-xs text-gray-500">
                Твои друзья на GamePlatform
              </p>
            </div>

            {friends.length === 0 ? (
              <div className="p-5 text-sm text-gray-500">
                У тебя пока нет друзей.
                <a
                  href="/friends"
                  className="mt-2 block text-violet-400 hover:text-violet-300"
                >
                  Найти игроков →
                </a>
              </div>
            ) : (
              <div className="max-h-[300px] overflow-y-auto md:max-h-[580px]">
                {friends.map((friend) => {
                  const presence = getPresence(friend);
                  const selected = selectedFriendId === friend.friend_id;

                  return (
                    <button
                      key={friend.friend_id}
                      onClick={() => {
                        setSelectedFriendId(friend.friend_id);
                        setNotice("");
                      }}
                      className={`flex w-full items-center gap-3 border-b border-white/5 p-4 text-left transition ${
                        selected
                          ? "bg-violet-500/15"
                          : "hover:bg-white/5"
                      }`}
                    >
                      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xl">
                        👤
                        <span
                          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#121622] ${
                            presence === "online"
                              ? "bg-emerald-400"
                              : presence === "do_not_disturb"
                                ? "bg-red-400"
                                : "bg-gray-500"
                          }`}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="truncate font-bold">
                          {friend.full_name || "Игрок"}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {presence === "online"
                            ? "В сети"
                            : presence === "do_not_disturb"
                              ? "Не беспокоить"
                              : "Оффлайн"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          {/* Переписка */}
          <section className="flex min-h-[580px] min-w-0 flex-col">
            {selectedFriend ? (
              <>
                <div className="flex items-center gap-3 border-b border-white/10 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/20">
                    👤
                  </div>
                  <div>
                    <h2 className="font-bold">
                      {selectedFriend.full_name || "Игрок"}
                    </h2>
                    <p className="text-xs text-gray-500">
                      Личная переписка
                    </p>
                  </div>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {loadingMessages ? (
                    <p className="text-center text-sm text-gray-500">
                      Загрузка переписки...
                    </p>
                  ) : messages.length === 0 ? (
                    <div className="flex h-full min-h-[300px] items-center justify-center text-center">
                      <div>
                        <div className="text-4xl">💬</div>
                        <p className="mt-3 font-bold">
                          Пока нет сообщений
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          Напиши первым!
                        </p>
                      </div>
                    </div>
                  ) : (
                    messages.map((message) => {
                      const mine = message.sender_id === userId;

                      return (
                        <div
                          key={message.id}
                          className={`flex ${mine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-4 py-3 sm:max-w-[70%] ${
                              mine
                                ? "rounded-br-sm bg-violet-600"
                                : "rounded-bl-sm bg-[#202738]"
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words text-sm">
                              {message.content}
                            </p>
                            <div className="mt-2 text-right text-[10px] text-white/60">
                              {formatTime(message.created_at)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  <div ref={bottomRef} />
                </div>

                <form
                  onSubmit={sendMessage}
                  className="flex gap-2 border-t border-white/10 p-4"
                >
                  <input
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    maxLength={5000}
                    placeholder="Напиши сообщение..."
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0b0d14] px-4 py-3 text-sm text-white outline-none focus:border-violet-500"
                  />

                  <button
                    type="submit"
                    disabled={!text.trim() || sending}
                    className="rounded-xl bg-violet-600 px-5 py-3 font-bold transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sending ? "..." : "➤"}
                  </button>
                </form>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6 text-center">
                <div>
                  <div className="text-5xl">💬</div>
                  <h2 className="mt-4 text-xl font-bold">
                    Выбери собеседника
                  </h2>
                  <p className="mt-2 text-sm text-gray-500">
                    Выбери друга слева, чтобы открыть переписку.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
