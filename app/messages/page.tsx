
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ChangeEvent,
} from "react";
import Link from "next/link";
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
  avatar_url: string | null;
};

type ChatMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  media_path: string | null;
  media_type: string | null;
  media_name: string | null;
  media_size: number | null;
  media_url?: string | null;
};
type ChatGroup = { id: string; name: string; created_by: string; created_at: string };
type GroupMember = { group_id: string; user_id: string; role: "owner" | "admin" | "member" };
type GroupMessage = { id: string; group_id: string; sender_id: string; content: string; created_at: string };

const C = {
  bg: "#111214",
  surface: "#1B1D20",
  surface2: "#242629",
  border: "#303236",
  orange: "#F07832",
  text: "#E7E7E7",
  muted: "#92949A",
};

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
];

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
  size = "h-11 w-11",
  textSize = "text-lg",
}: {
  value: string | null;
  name: string | null;
  size?: string;
  textSize?: string;
}) {
  const displayName = name || "Игрок";
  const preset = AVATARS.find(
    (item) => value === `preset:${item.id}`
  );

  if (preset) {
    return (
      <div
        className={`${size} flex shrink-0 items-center justify-center overflow-hidden rounded-2xl`}
        style={{ background: preset.color }}
        title={preset.id}
      >
        <span className={textSize}>{preset.emoji}</span>
      </div>
    );
  }

  if (value && value.startsWith("https://")) {
    return (
      <img
        src={value}
        alt={`Аватар ${displayName}`}
        className={`${size} shrink-0 rounded-2xl border object-cover`}
        style={{ borderColor: "rgba(240,120,50,0.3)" }}
      />
    );
  }

  return (
    <div
      className={`${size} flex shrink-0 items-center justify-center rounded-2xl font-black`}
      style={{
        background: "rgba(240,120,50,0.12)",
        color: C.orange,
      }}
    >
      <span className={textSize}>
        {displayName.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

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

function formatDate(value: string) {
  const date = new Date(value);

  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl text-xl font-black text-black"
        style={{
          background: C.orange,
          boxShadow: "0 5px 25px rgba(240,120,50,0.2)",
        }}
      >
        V
      </div>

      <span className="text-xl font-black tracking-tight text-white">
        VEX<span style={{ color: C.orange }}>ORA</span>
      </span>
    </Link>
  );
}

export default function MessagesPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(
    null
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [groupText, setGroupText] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);
  const initialScrollFriendRef = useRef<string | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedFriend =
    friends.find((friend) => friend.friend_id === selectedFriendId) || null;
  const selectedGroup = groups.find((group) => group.id === selectedGroupId) || null;
  const selectedGroupMembers = groupMembers.filter((member) => member.group_id === selectedGroupId);


  const loadGroups = useCallback(async (currentUserId: string) => {
    const { data: ownRows, error: ownError } = await supabase.from("chat_group_members").select("group_id,user_id,role").eq("user_id", currentUserId);
    if (ownError) { setNotice("Не удалось загрузить группы: " + ownError.message); return; }
    const ids = (ownRows || []).map((row) => row.group_id);
    if (!ids.length) { setGroups([]); setGroupMembers([]); setSelectedGroupId(null); return; }
    const [{ data: groupRows, error: groupError }, { data: memberRows, error: memberError }] = await Promise.all([
      supabase.from("chat_groups").select("id,name,created_by,created_at").in("id", ids).order("created_at", { ascending: false }),
      supabase.from("chat_group_members").select("group_id,user_id,role").in("group_id", ids),
    ]);
    if (groupError || memberError) { setNotice("Не удалось загрузить групповые чаты: " + (groupError?.message || memberError?.message)); return; }
    setGroups((groupRows || []) as ChatGroup[]);
    setGroupMembers((memberRows || []) as GroupMember[]);
  }, []);

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = groupName.trim();
    if (!userId || !name || !selectedFriendIds.length || creatingGroup) return;
    setCreatingGroup(true); setNotice("");
    try {
      const { data: group, error: groupError } = await supabase.from("chat_groups").insert({ name, created_by: userId }).select("id,name,created_by,created_at").single();
      if (groupError || !group) throw groupError || new Error("Группа не создана.");
      const { error: ownerError } = await supabase.from("chat_group_members").insert({ group_id: group.id, user_id: userId, role: "owner" });
      if (ownerError) { await supabase.from("chat_groups").delete().eq("id", group.id); throw ownerError; }
      const { error: friendsError } = await supabase.from("chat_group_members").insert(selectedFriendIds.map((friendId) => ({ group_id: group.id, user_id: friendId, role: "member" })));
      if (friendsError) { await supabase.from("chat_groups").delete().eq("id", group.id); throw friendsError; }
      setGroupName(""); setSelectedFriendIds([]); setShowCreateGroup(false);
      await loadGroups(userId); setSelectedFriendId(null); setSelectedGroupId(group.id); setGroupMessages([]);
    } catch (error) {
      setNotice("Не удалось создать группу: " + (error instanceof Error ? error.message : "Неизвестная ошибка"));
    } finally { setCreatingGroup(false); }
  }

  async function sendGroupMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = groupText.trim();
    if (!userId || !selectedGroupId || !content) return;
    const { data, error } = await supabase.from("chat_group_messages").insert({ group_id: selectedGroupId, sender_id: userId, content }).select("id,group_id,sender_id,content,created_at").single();
    if (error) { setNotice("Не удалось отправить сообщение в группу: " + error.message); return; }
    if (data) setGroupMessages((current) => current.some((item) => item.id === data.id) ? current : [...current, data as GroupMessage]);
    setGroupText("");
  }

  useEffect(() => { if (userId) void loadGroups(userId); }, [userId, loadGroups]);

  useEffect(() => {
    if (!selectedGroupId) { setGroupMessages([]); return; }
    let active = true;
    async function fetchGroupMessages() {
      const { data, error } = await supabase.from("chat_group_messages").select("id,group_id,sender_id,content,created_at").eq("group_id", selectedGroupId).order("created_at", { ascending: true });
      if (!active) return;
      if (error) { setNotice("Не удалось загрузить сообщения группы: " + error.message); return; }
      setGroupMessages((data || []) as GroupMessage[]);
    }
    void fetchGroupMessages();
    const channel = supabase.channel("group-messages-" + selectedGroupId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_group_messages", filter: "group_id=eq." + selectedGroupId }, (payload) => {
        const incoming = payload.new as GroupMessage;
        setGroupMessages((current) => current.some((item) => item.id === incoming.id) ? current : [...current, incoming].sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
      }).subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [selectedGroupId]);

  // Предпросмотр выбранного файла
  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [selectedFile]);

  // Получение временной ссылки на приватное вложение
  const addSignedUrl = useCallback(async (message: ChatMessage) => {
    if (!message.media_path) {
      return { ...message, media_url: null };
    }

    const { data, error } = await supabase.storage
      .from("chat-media")
      .createSignedUrl(message.media_path, 3600);

    if (error || !data?.signedUrl) {
      console.error("Не удалось получить ссылку на вложение:", error);
      return { ...message, media_url: null };
    }

    return {
      ...message,
      media_url: data.signedUrl,
    };
  }, []);

  // Помечаем входящие сообщения прочитанными и удаляем уведомления
  // о новых сообщениях от выбранного собеседника.
  const markMessagesRead = useCallback(async () => {
    if (!userId || !selectedFriendId) return;

    const { error } = await supabase.rpc("mark_chat_messages_read", {
      p_sender_id: selectedFriendId,
    });

    if (error) {
      console.error("Не удалось отметить сообщения прочитанными:", error);
      setNotice("Не удалось отметить сообщения прочитанными: " + error.message);
      return;
    }

    const { error: notificationError } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", userId)
      .eq("actor_id", selectedFriendId)
      .eq("type", "message");

    if (notificationError) {
      console.error(
        "Не удалось удалить уведомления о сообщениях:",
        notificationError
      );
    }
  }, [userId, selectedFriendId]);

  // Загрузка сообщений
  const loadMessages = useCallback(async (silent = false) => {
    if (!userId || !selectedFriendId) {
      setMessages([]);
      return;
    }

    if (!silent) setLoadingMessages(true);

    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${userId},receiver_id.eq.${selectedFriendId}),and(sender_id.eq.${selectedFriendId},receiver_id.eq.${userId})`
        )
        .order("created_at", { ascending: true });

      if (error) {
        setNotice("Не удалось загрузить сообщения: " + error.message);
        return;
      }

      await markMessagesRead();

      const messagesWithUrls = await Promise.all(
        ((data || []) as ChatMessage[]).map(addSignedUrl)
      );

      setMessages(messagesWithUrls);
    } catch (error) {
      setNotice(
        "Ошибка загрузки: " +
          (error instanceof Error ? error.message : "Неизвестная ошибка")
      );
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, [userId, selectedFriendId, addSignedUrl, markMessagesRead]);

  // Инициализация страницы
  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (!active) return;

        if (authError || !authData.user) {
          setNotice("Не удалось определить пользователя. Войди в аккаунт.");
          setLoading(false);
          return;
        }

        const currentUserId = authData.user.id;

        setUserId(currentUserId);

        // Загружаем собственную аватарку и друзей
        const [
          { data: friendsData, error: friendsError },
          { data: profileData },
        ] = await Promise.all([
          supabase.rpc("get_friend_data_with_avatars"),
          supabase
            .from("profiles")
            .select("avatar_url")
            .eq("id", currentUserId)
            .maybeSingle(),
        ]);

        if (!active) return;

        if (friendsError) {
          setNotice("Не удалось загрузить друзей: " + friendsError.message);
          setLoading(false);
          return;
        }

        setMyAvatarUrl(profileData?.avatar_url || null);

        const acceptedFriends = (
          (friendsData || []) as FriendEntry[]
        ).filter(
          (friend) =>
            friend.direction === "friend" &&
            friend.status === "accepted"
        );

        setFriends(acceptedFriends);
        await loadGroups(currentUserId);

        if (acceptedFriends.length > 0) {
          setSelectedFriendId(acceptedFriends[0].friend_id);
        }
      } catch (error) {
        if (active) {
          setNotice(
            "Ошибка инициализации: " +
              (error instanceof Error ? error.message : "Неизвестная ошибка")
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [loadGroups]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Supabase Realtime
  useEffect(() => {
    if (!userId || !selectedFriendId) return;

    let fallbackTimer: ReturnType<typeof setInterval> | null = null;

    const startFallback = () => {
      if (fallbackTimer) return;
      setNotice("Мгновенные обновления недоступны. Чат обновляется автоматически.");
      fallbackTimer = setInterval(() => {
        void loadMessages(true);
      }, 5000);
    };

    const stopFallback = () => {
      if (!fallbackTimer) return;
      clearInterval(fallbackTimer);
      fallbackTimer = null;
      setNotice((current) =>
        current === "Мгновенные обновления недоступны. Чат обновляется автоматически."
          ? ""
          : current
      );
    };

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

          if (!belongsToChat) return;

          if (newMessage.receiver_id === userId) {
            void markMessagesRead();
          }

          void (async () => {
            const messageWithUrl = await addSignedUrl(newMessage);

            setMessages((current) => {
              const existing = current.find(
                (message) => message.id === messageWithUrl.id
              );

              if (existing) {
                return current.map((message) =>
                  message.id === messageWithUrl.id
                    ? { ...message, ...messageWithUrl }
                    : message
                );
              }

              return [...current, messageWithUrl].sort(
                (a, b) =>
                  new Date(a.created_at).getTime() -
                  new Date(b.created_at).getTime()
              );
            });
          })();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          stopFallback();
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT"
        ) {
          console.warn("VEXORA chat Realtime status:", status);
          startFallback();
        } else if (status === "CLOSED") {
          // CLOSED также приходит при штатном удалении канала в cleanup.
          // Не запускаем fallback для нормального закрытия подписки.
          console.info("VEXORA chat Realtime channel closed.");
        }
      });

    return () => {
      if (fallbackTimer) clearInterval(fallbackTimer);
      void supabase.removeChannel(channel);
    };
  }, [userId, selectedFriendId, addSignedUrl, loadMessages, markMessagesRead]);

  // При открытии каждой переписки сразу показываем последние сообщения.
  // При новых сообщениях не перетаскиваем пользователя вниз, если он читает историю.
  useEffect(() => {
    if (!selectedFriendId) {
      initialScrollFriendRef.current = null;
      wasAtBottomRef.current = true;
      setShowScrollToBottom(false);
      return;
    }

    if (initialScrollFriendRef.current !== selectedFriendId) {
      initialScrollFriendRef.current = selectedFriendId;
      wasAtBottomRef.current = true;
      setShowScrollToBottom(false);
    }

    if (loadingMessages) return;

    if (wasAtBottomRef.current) {
      const element = messagesScrollRef.current;
      if (element) element.scrollTop = element.scrollHeight;
      setShowScrollToBottom(false);
    } else {
      setShowScrollToBottom(messages.length > 0);
    }
  }, [messages, loadingMessages, selectedFriendId]);

  function handleMessagesScroll() {
    const element = messagesScrollRef.current;
    if (!element) return;

    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    const atBottom = distanceFromBottom <= 100;

    wasAtBottomRef.current = atBottom;
    setShowScrollToBottom(!atBottom && messages.length > 0);
  }

  function scrollToLatestMessages() {
    wasAtBottomRef.current = true;
    const element = messagesScrollRef.current;
    element?.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
    setShowScrollToBottom(false);
  }

  // Выбор файла
  function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setNotice("");

    if (!ALLOWED_TYPES.includes(file.type)) {
      setNotice(
        "Этот формат не поддерживается. Выбери JPG, PNG, WEBP, GIF, MP4 или WebM."
      );
      event.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setNotice("Размер файла не должен превышать 50 МБ.");
      event.target.value = "";
      return;
    }

    if (file.size === 0) {
      setNotice("Нельзя отправить пустой файл.");
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
  }

  function removeSelectedFile() {
    setSelectedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // Отправка сообщения и вложения
  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = text.trim();

    if (
      (!content && !selectedFile) ||
      !userId ||
      !selectedFriendId ||
      sending
    ) {
      return;
    }

    setSending(true);
    setNotice("");

    let uploadedPath: string | null = null;

    try {
      let mediaPath: string | null = null;
      let mediaType: string | null = null;
      let mediaName: string | null = null;
      let mediaSize: number | null = null;

      if (selectedFile) {
        const safeName = selectedFile.name
          .replace(/[^a-zA-Z0-9._-]/g, "_")
          .slice(-100);

        const uniqueName = `${crypto.randomUUID()}-${safeName}`;
        const path = `${userId}/${selectedFriendId}/${uniqueName}`;

        const { error: uploadError } = await supabase.storage
          .from("chat-media")
          .upload(path, selectedFile, {
            contentType: selectedFile.type,
            upsert: false,
          });

        if (uploadError) {
          setNotice("Не удалось загрузить файл: " + uploadError.message);
          return;
        }

        uploadedPath = path;
        mediaPath = path;
        mediaType = selectedFile.type;
        mediaName = selectedFile.name;
        mediaSize = selectedFile.size;
      }

      const { data, error } = await supabase
        .from("messages")
        .insert({
          sender_id: userId,
          receiver_id: selectedFriendId,
          content,
          is_read: false,
          media_path: mediaPath,
          media_type: mediaType,
          media_name: mediaName,
          media_size: mediaSize,
        })
        .select("*")
        .single();

      if (error) {
        if (uploadedPath) {
          await supabase.storage
            .from("chat-media")
            .remove([uploadedPath]);
        }

        setNotice("Не удалось отправить сообщение: " + error.message);
        return;
      }

      if (!data) {
        if (uploadedPath) {
          await supabase.storage
            .from("chat-media")
            .remove([uploadedPath]);
        }

        setNotice("Supabase не вернул сохранённое сообщение.");
        return;
      }

      const savedMessage = await addSignedUrl(data as ChatMessage);

      setMessages((current) => {
        const existing = current.some(
          (message) => message.id === savedMessage.id
        );

        if (existing) {
          return current.map((message) =>
            message.id === savedMessage.id
              ? { ...message, ...savedMessage }
              : message
          );
        }

        return [...current, savedMessage];
      });

      setText("");
      setSelectedFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      if (uploadedPath) {
        await supabase.storage
          .from("chat-media")
          .remove([uploadedPath]);
      }

      setNotice(
        "Ошибка отправки: " +
          (error instanceof Error ? error.message : "Неизвестная ошибка")
      );
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <main
        className="flex min-h-screen items-center justify-center"
        style={{ background: C.bg, color: C.text }}
      >
        <div className="text-center">
          <div
            className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
            style={{
              borderColor: `${C.orange} transparent ${C.orange} ${C.orange}`,
            }}
          />
          <p className="mt-5 text-sm font-semibold">
            Загружаем сообщения VEXORA...
          </p>
        </div>
      </main>
    );
  }

  if (!userId) {
    return (
      <main
        className="flex min-h-screen items-center justify-center px-5"
        style={{ background: C.bg, color: C.text }}
      >
        <div
          className="w-full max-w-md rounded-2xl border p-10 text-center"
          style={{
            background: C.surface,
            borderColor: C.border,
          }}
        >
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
            style={{
              background: "rgba(240,120,50,0.12)",
              color: C.orange,
            }}
          >
            ✉
          </div>

          <h1 className="mt-5 text-2xl font-black">
            Ты не авторизован
          </h1>

          <p className="mt-3 text-sm" style={{ color: C.muted }}>
            Войди в аккаунт, чтобы пользоваться сообщениями VEXORA.
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
    <main
      className="min-h-screen px-3 py-5 sm:px-6 sm:py-7"
      style={{ background: C.bg, color: C.text }}
    >
      <div className="mx-auto max-w-7xl">
        {/* HEADER */}
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <Logo />

          <div className="flex items-center gap-2">
            <Link
              href="/friends"
              className="rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:bg-white/5"
              style={{
                borderColor: C.border,
                color: C.muted,
              }}
            >
              ← Друзья
            </Link>

            <Link
              href="/profile"
              className="hidden rounded-xl px-4 py-2.5 text-sm font-bold text-black transition hover:brightness-110 sm:block"
              style={{ background: C.orange }}
            >
              Профиль
            </Link>
          </div>
        </header>

        {/* PAGE TITLE */}
        <section className="mb-6">
          <p
            className="text-xs font-black uppercase tracking-[0.25em]"
            style={{ color: C.orange }}
          >
            VEXORA COMMUNICATION
          </p>

          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                Сообщения
              </h1>

              <p className="mt-2 text-sm" style={{ color: C.muted }}>
                Общайся с друзьями и оставайся на связи.
              </p>
            </div>

            <div
              className="hidden items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold sm:flex"
              style={{
                background: C.surface,
                borderColor: C.border,
                color: C.muted,
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: C.orange }}
              />
              Личные сообщения
            </div>
          </div>
        </section>

        {/* ERRORS */}
        {notice && (
          <div
            className="mb-5 flex items-start gap-3 rounded-xl border p-4 text-sm"
            style={{
              background: "rgba(239,68,68,0.08)",
              borderColor: "rgba(239,68,68,0.25)",
              color: "#FCA5A5",
            }}
          >
            <span className="text-lg">!</span>
            <span className="break-words">{notice}</span>
          </div>
        )}

        {/* CHAT */}
        <div
          className="grid w-full min-w-0 grid-cols-1 items-stretch rounded-2xl border shadow-2xl md:grid-cols-[290px_minmax(0,1fr)]"
          style={{
            background: C.surface,
            borderColor: C.border,
            boxShadow: "0 25px 80px rgba(0,0,0,0.2)",
          }}
        >
          {/* FRIENDS SIDEBAR */}
          <aside
            className="flex min-w-0 flex-col border-b md:border-b-0 md:border-r"
            style={{
              background: "#17181A",
              borderColor: C.border,
            }}
          >
            <div
              className="border-b p-5"
              style={{ borderColor: C.border }}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-black">Диалоги</h2>

                <span
                  className="rounded-lg px-2.5 py-1 text-xs font-bold"
                  style={{
                    background: "rgba(240,120,50,0.12)",
                    color: C.orange,
                  }}
                >
                  {friends.length}
                </span>
              </div>

              <p className="mt-1 text-xs" style={{ color: C.muted }}>
                Твои друзья на VEXORA
              </p>
            </div>

            {friends.length === 0 ? (
              <div className="p-5">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
                  style={{
                    background: "rgba(240,120,50,0.1)",
                    color: C.orange,
                  }}
                >
                  ♧
                </div>

                <p className="mt-4 text-sm font-bold">
                  Пока нет друзей
                </p>

                <p className="mt-1 text-xs" style={{ color: C.muted }}>
                  Добавь игроков, чтобы начать переписку.
                </p>

                <Link
                  href="/friends"
                  className="mt-4 inline-flex text-sm font-bold transition hover:brightness-125"
                  style={{ color: C.orange }}
                >
                  Найти игроков →
                </Link>
              </div>
            ) : (
              <div className="flex-1">
                {friends.map((friend) => {
                  const presence = getPresence(friend);
                  const selected =
                    selectedFriendId === friend.friend_id;

                  return (
                    <button
                      key={friend.friend_id}
                      type="button"
                      onClick={() => {
                        setSelectedGroupId(null);
                        setSelectedFriendId(friend.friend_id);
                        setNotice("");
                        setSelectedFile(null);

                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                      className="relative flex w-full items-center gap-3 border-b p-4 text-left transition"
                      style={{
                        borderColor: "rgba(255,255,255,0.04)",
                        background: selected
                          ? "rgba(240,120,50,0.1)"
                          : "transparent",
                      }}
                    >
                      {selected && (
                        <span
                          className="absolute bottom-3 left-0 top-3 w-[3px] rounded-r-full"
                          style={{ background: C.orange }}
                        />
                      )}

                      <div className="relative shrink-0">
                        <Avatar
                          value={friend.avatar_url}
                          name={friend.full_name}
                          size="h-12 w-12"
                          textSize="text-xl"
                        />

                        <span
                          className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-[3px]"
                          style={{
                            borderColor: "#17181A",
                            background:
                              presence === "online"
                                ? "#22C55E"
                                : presence === "do_not_disturb"
                                  ? "#EF4444"
                                  : "#64666C",
                          }}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div
                          className="truncate text-sm font-bold"
                          style={{
                            color: selected ? C.orange : C.text,
                          }}
                        >
                          {friend.full_name || "Игрок"}
                        </div>

                        <div
                          className="mt-1 flex items-center gap-1.5 text-xs"
                          style={{ color: C.muted }}
                        >
                          {presence === "online"
                            ? "В сети"
                            : presence === "do_not_disturb"
                              ? "Не беспокоить"
                              : "Оффлайн"}
                        </div>
                      </div>

                      <span
                        className="text-lg"
                        style={{
                          color: selected ? C.orange : "#55575C",
                        }}
                      >
                        ›
                      </span>
                    </button>
                  );
                })}
              </div>
            )}


            <div className="border-t p-4" style={{ borderColor: C.border }}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-xs font-black uppercase tracking-wider" style={{ color: C.muted }}>Группы</h3>
                <button type="button" onClick={() => setShowCreateGroup((value) => !value)} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-black" style={{ background: C.orange }}>＋ Создать</button>
              </div>
              {groups.length === 0 ? <p className="text-xs" style={{ color: C.muted }}>Пока нет групп. Создай группу и добавь друзей.</p> : <div className="space-y-1">{groups.map((group) => <button key={group.id} type="button" onClick={() => { setSelectedGroupId(group.id); setSelectedFriendId(null); setNotice(""); }} className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition" style={{ background: selectedGroupId === group.id ? "rgba(240,120,50,0.12)" : "transparent", border: selectedGroupId === group.id ? "1px solid " + C.orange : "1px solid transparent" }}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl" style={{ background: "rgba(240,120,50,0.12)", color: C.orange }}>♧</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{group.name}</span><span className="mt-1 block text-[10px]" style={{ color: C.muted }}>{groupMembers.filter((member) => member.group_id === group.id).length} участников</span></span></button>)}</div>}
              {showCreateGroup && <form onSubmit={createGroup} className="mt-3 rounded-xl border p-3" style={{ background: C.surface, borderColor: C.border }}>
                <label htmlFor="messages-group-name" className="text-xs font-bold">Название группы</label>
                <input id="messages-group-name" value={groupName} onChange={(event) => setGroupName(event.target.value)} maxLength={60} required placeholder="Название" className="mt-2 w-full rounded-lg border px-3 py-2 text-sm outline-none" style={{ background: C.bg, borderColor: C.border, color: C.text }} />
                <p className="mt-3 text-xs font-bold" style={{ color: C.muted }}>Выбери друзей</p>
                <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">{friends.map((friend) => <label key={friend.friend_id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={selectedFriendIds.includes(friend.friend_id)} onChange={(event) => setSelectedFriendIds((current) => event.target.checked ? [...current, friend.friend_id] : current.filter((id) => id !== friend.friend_id))} /><span className="truncate">{friend.full_name || "Игрок"}</span></label>)}{friends.length === 0 && <p className="text-xs" style={{ color: C.muted }}>Сначала добавь друзей.</p>}</div>
                <button type="submit" disabled={creatingGroup || !groupName.trim() || selectedFriendIds.length === 0} className="mt-3 w-full rounded-lg px-3 py-2 text-xs font-bold text-black disabled:opacity-40" style={{ background: C.orange }}>{creatingGroup ? "Создаём..." : "Создать группу"}</button>
              </form>}
            </div>
            <div
              className="mt-auto hidden border-t p-4 md:block"
              style={{ borderColor: C.border }}
            >
              <Link
                href="/friends"
                className="flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-bold transition hover:bg-white/5"
                style={{
                  borderColor: C.border,
                  color: C.muted,
                }}
              >
                + Добавить друга
              </Link>
            </div>
          </aside>

          {/* CHAT AREA */}
          <section className="flex h-[680px] w-full min-w-0 flex-col">

            {selectedGroup ? (
              <>
                <div className="flex items-center justify-between gap-3 border-b px-5 py-4" style={{ background: "#191A1D", borderColor: C.border }}>
                  <div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl text-xl" style={{ background: "rgba(240,120,50,0.12)", color: C.orange }}>♧</span><div className="min-w-0"><h2 className="truncate font-black">{selectedGroup.name}</h2><p className="mt-1 text-xs" style={{ color: C.muted }}>{selectedGroupMembers.length} участников · Групповой чат</p></div></div>
                  <span className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: C.border, color: C.muted }}>Группа</span>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-6" style={{ background: "#141517" }}>
                  {groupMessages.length === 0 ? <div className="flex h-full min-h-[300px] items-center justify-center text-center"><div><div className="text-4xl">♧</div><h3 className="mt-4 font-black">Начни общение!</h3><p className="mt-2 text-sm" style={{ color: C.muted }}>Отправь первое сообщение в эту группу.</p></div></div> : groupMessages.map((message) => { const mine = message.sender_id === userId; const author = friends.find((friend) => friend.friend_id === message.sender_id)?.full_name || (mine ? "Вы" : "Участник"); return <div key={message.id} className={mine ? "ml-auto max-w-[85%] text-right" : "max-w-[85%]"}>{!mine && <p className="mb-1 px-1 text-xs font-semibold" style={{ color: C.orange }}>{author}</p>}<div className="inline-block rounded-2xl px-4 py-3 text-left text-sm" style={{ background: mine ? C.orange : C.surface2, color: mine ? "#17181A" : C.text }}><p className="whitespace-pre-wrap break-words">{message.content}</p><p className="mt-2 text-right text-[10px]" style={{ opacity: 0.65 }}>{formatTime(message.created_at)}</p></div></div>; })}
                </div>
                <form onSubmit={sendGroupMessage} className="flex gap-2 border-t p-4" style={{ background: "#191A1D", borderColor: C.border }}>
                  <input value={groupText} onChange={(event) => setGroupText(event.target.value)} maxLength={5000} placeholder="Сообщение в группу..." className="min-w-0 flex-1 rounded-xl border px-4 py-3 text-sm outline-none" style={{ background: C.bg, borderColor: C.border, color: C.text }} />
                  <button type="submit" disabled={!groupText.trim()} className="rounded-xl px-5 font-bold text-black disabled:opacity-40" style={{ background: C.orange }}>➤</button>
                </form>
              </>
            ) : selectedFriend ? (

              <>
                {/* CHAT HEADER */}
                <div
                  className="flex items-center justify-between gap-3 border-b px-4 py-4 sm:px-6"
                  style={{
                    background: "#191A1D",
                    borderColor: C.border,
                  }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar
                      value={selectedFriend.avatar_url}
                      name={selectedFriend.full_name}
                      size="h-11 w-11"
                      textSize="text-lg"
                    />

                    <div className="min-w-0">
                      <h2 className="truncate font-black">
                        {selectedFriend.full_name || "Игрок"}
                      </h2>

                      <div
                        className="mt-1 flex items-center gap-1.5 text-xs"
                        style={{ color: C.muted }}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            background:
                              getPresence(selectedFriend) === "online"
                                ? "#22C55E"
                                : getPresence(selectedFriend) ===
                                    "do_not_disturb"
                                  ? "#EF4444"
                                  : "#64666C",
                          }}
                        />

                        {getPresence(selectedFriend) === "online"
                          ? "В сети"
                          : getPresence(selectedFriend) ===
                              "do_not_disturb"
                            ? "Не беспокоить"
                            : "Оффлайн"}
                      </div>
                    </div>
                  </div>

                  <Link
                    href="/friends"
                    className="hidden rounded-lg border px-3 py-2 text-xs font-semibold transition hover:bg-white/5 sm:block"
                    style={{
                      borderColor: C.border,
                      color: C.muted,
                    }}
                  >
                    Друзья
                  </Link>
                </div>

                {/* MESSAGES */}
                <div className="relative flex min-h-0 w-full min-w-0 flex-1">
                  <div
                    ref={messagesScrollRef}
                    onScroll={handleMessagesScroll}
                    className="h-full w-full min-w-0 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-6"
                    style={{
                      background:
                        "radial-gradient(ellipse at top right, rgba(240,120,50,0.035), transparent 55%), #141517",
                    }}
                  >
                  {loadingMessages ? (
                    <div className="flex min-h-[300px] items-center justify-center">
                      <div className="text-center">
                        <div
                          className="mx-auto h-8 w-8 animate-spin rounded-full border-[3px] border-t-transparent"
                          style={{
                            borderColor: `${C.orange} transparent ${C.orange} ${C.orange}`,
                          }}
                        />
                        <p
                          className="mt-4 text-sm"
                          style={{ color: C.muted }}
                        >
                          Загружаем переписку...
                        </p>
                      </div>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex min-h-[380px] items-center justify-center text-center">
                      <div>
                        <div
                          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
                          style={{
                            background: "rgba(240,120,50,0.1)",
                            color: C.orange,
                          }}
                        >
                          ✉
                        </div>

                        <h3 className="mt-5 text-lg font-black">
                          Пока нет сообщений
                        </h3>

                        <p
                          className="mt-2 text-sm"
                          style={{ color: C.muted }}
                        >
                          Начни общение прямо сейчас!
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-center">
                        <span
                          className="rounded-full border px-3 py-1.5 text-[10px] font-semibold"
                          style={{
                            background: C.surface,
                            borderColor: C.border,
                            color: C.muted,
                          }}
                        >
                          История переписки
                        </span>
                      </div>

                      {messages.map((message, index) => {
                        const mine = message.sender_id === userId;
                        const previousMessage = messages[index - 1];

                        const showDate =
                          !previousMessage ||
                          new Date(previousMessage.created_at)
                            .toDateString() !==
                            new Date(message.created_at).toDateString();

                        const messageAvatar = mine
                          ? myAvatarUrl
                          : selectedFriend.avatar_url;

                        const messageAuthor = mine
                          ? "Вы"
                          : selectedFriend.full_name || "Игрок";

                        return (
                          <div key={message.id}>
                            {showDate && (
                              <div className="my-5 flex justify-center">
                                <span
                                  className="rounded-full border px-3 py-1 text-[10px] font-semibold"
                                  style={{
                                    background: C.surface,
                                    borderColor: C.border,
                                    color: C.muted,
                                  }}
                                >
                                  {formatDate(message.created_at)}
                                </span>
                              </div>
                            )}

                            <div
                              className={`flex items-end gap-2 ${
                                mine ? "justify-end" : "justify-start"
                              }`}
                            >
                              {!mine && (
                                <Avatar
                                  value={messageAvatar}
                                  name={messageAuthor}
                                  size="h-8 w-8"
                                  textSize="text-sm"
                                />
                              )}

                              <div className="max-w-[88%] sm:max-w-[72%]">
                                <div
                                  className="overflow-hidden rounded-2xl shadow-lg"
                                  style={{
                                    background: mine
                                      ? C.orange
                                      : "#25272B",
                                    color: mine ? "#17181A" : C.text,
                                    border: mine
                                      ? "1px solid rgba(255,255,255,0.08)"
                                      : `1px solid ${C.border}`,
                                    borderBottomRightRadius: mine
                                      ? "5px"
                                      : undefined,
                                    borderBottomLeftRadius: !mine
                                      ? "5px"
                                      : undefined,
                                    boxShadow: mine
                                      ? "0 5px 20px rgba(240,120,50,0.09)"
                                      : "none",
                                  }}
                                >
                                  {/* IMAGE / GIF */}
                                  {message.media_url &&
                                    message.media_type?.startsWith(
                                      "image/"
                                    ) && (
                                      <a
                                        href={message.media_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block"
                                      >
                                        <img
                                          src={message.media_url}
                                          alt={
                                            message.media_name || "Вложение"
                                          }
                                          className="max-h-[420px] w-full object-contain"
                                          loading="lazy"
                                        />
                                      </a>
                                    )}

                                  {/* VIDEO */}
                                  {message.media_url &&
                                    message.media_type?.startsWith(
                                      "video/"
                                    ) && (
                                      <video
                                        src={message.media_url}
                                        controls
                                        preload="metadata"
                                        playsInline
                                        className="max-h-[420px] w-full bg-black"
                                      >
                                        Твой браузер не поддерживает видео.
                                      </video>
                                    )}

                                  {/* FILE NAME */}
                                  {message.media_path && (
                                    <div
                                      className="px-3 pt-2 text-xs"
                                      style={{
                                        color: mine
                                          ? "rgba(0,0,0,0.65)"
                                          : C.muted,
                                      }}
                                    >
                                      {message.media_name || "Вложение"}
                                    </div>
                                  )}

                                  {/* TEXT */}
                                  {message.content?.trim() && (
                                    <div className="px-4 pt-3">
                                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                                        {message.content}
                                      </p>
                                    </div>
                                  )}

                                  {/* TIME */}
                                  <div
                                    className="flex items-center justify-end gap-1.5 px-4 pb-3 pt-2 text-[10px]"
                                    style={{
                                      color: mine
                                        ? "rgba(0,0,0,0.58)"
                                        : "#92949A",
                                    }}
                                  >
                                    {formatTime(message.created_at)}

                                    {mine && (
                                      <span className="font-bold">
                                        {message.is_read ? "✓✓" : "✓"}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {message.media_path &&
                                  !message.media_url && (
                                    <p
                                      className="mt-1 text-[10px]"
                                      style={{ color: C.muted }}
                                    >
                                      Не удалось загрузить вложение.
                                    </p>
                                  )}
                              </div>

                              {mine && (
                                <Avatar
                                  value={messageAvatar}
                                  name={messageAuthor}
                                  size="h-8 w-8"
                                  textSize="text-sm"
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}

                    <div ref={bottomRef} />
                  </div>

                  {showScrollToBottom && (
                    <button
                      type="button"
                      onClick={scrollToLatestMessages}
                      aria-label="Перейти к новым сообщениям"
                      title="Перейти к новым сообщениям"
                      className="absolute bottom-5 right-5 z-10 flex h-11 w-11 items-center justify-center rounded-full border text-xl font-bold shadow-xl transition hover:-translate-y-0.5 hover:brightness-110"
                      style={{
                        background: C.orange,
                        borderColor: "rgba(255,255,255,0.18)",
                        color: "#17181A",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                      }}
                    >
                      ↓
                    </button>
                  )}
                </div>

                {/* MESSAGE INPUT */}
                <div
                  className="border-t p-3 sm:p-5"
                  style={{
                    background: "#191A1D",
                    borderColor: C.border,
                  }}
                >
                  {/* FILE PREVIEW */}
                  {selectedFile && previewUrl && (
                    <div
                      className="mb-4 flex items-center gap-3 rounded-xl border p-3"
                      style={{
                        background: "#111214",
                        borderColor: C.border,
                      }}
                    >
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black">
                        {selectedFile.type.startsWith("image/") ? (
                          <img
                            src={previewUrl}
                            alt="Предпросмотр"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <video
                            src={previewUrl}
                            className="h-full w-full object-cover"
                            muted
                          />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">
                          {selectedFile.name}
                        </p>

                        <p
                          className="mt-1 text-xs"
                          style={{ color: C.muted }}
                        >
                          {formatFileSize(selectedFile.size)}
                        </p>

                        <p
                          className="mt-1 text-[10px]"
                          style={{ color: C.orange }}
                        >
                          Готово к отправке
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={removeSelectedFile}
                        disabled={sending}
                        aria-label="Отменить вложение"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg transition hover:bg-white/10 disabled:opacity-40"
                        style={{ color: "#F87171" }}
                      >
                        ×
                      </button>
                    </div>
                  )}

                  <form
                    onSubmit={sendMessage}
                    className="flex items-center gap-2 sm:gap-3"
                  >
                    {/* HIDDEN FILE INPUT */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
                      onChange={handleFileSelect}
                      className="hidden"
                    />

                    {/* ATTACHMENT BUTTON */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={sending || !!selectedFile}
                      aria-label="Прикрепить фотографию, видео или GIF"
                      title="Прикрепить файл"
                      className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl border text-xl transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                      style={{
                        borderColor: C.border,
                        color: C.orange,
                      }}
                    >
                      +
                    </button>

                    <input
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      maxLength={5000}
                      placeholder="Напиши сообщение..."
                      aria-label="Текст сообщения"
                      className="min-w-0 flex-1 rounded-xl border px-4 py-3.5 text-sm outline-none transition placeholder:text-[#696B70] focus:border-[#F07832]"
                      style={{
                        background: "#111214",
                        borderColor: C.border,
                        color: C.text,
                      }}
                    />

                    <button
                      type="submit"
                      disabled={
                        (!text.trim() && !selectedFile) || sending
                      }
                      aria-label="Отправить сообщение"
                      className="flex h-[48px] w-[52px] shrink-0 items-center justify-center rounded-xl text-xl font-black text-black transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                      style={{
                        background: C.orange,
                        boxShadow: "0 5px 20px rgba(240,120,50,0.15)",
                      }}
                    >
                      {sending ? "..." : "➤"}
                    </button>
                  </form>

                  <div className="mt-2 flex flex-wrap justify-between gap-2 px-1">
                    <span className="text-[10px]" style={{ color: C.muted }}>
                      Фото, видео и GIF · до 50 МБ
                    </span>

                    <span className="text-[10px]" style={{ color: C.muted }}>
                      {text.length}/5000
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6 text-center">
                <div>
                  <div
                    className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl text-4xl"
                    style={{
                      background: "rgba(240,120,50,0.1)",
                      color: C.orange,
                    }}
                  >
                    ✉
                  </div>

                  <h2 className="mt-5 text-xl font-black">
                    Выбери собеседника
                  </h2>

                  <p
                    className="mt-2 max-w-xs text-sm"
                    style={{ color: C.muted }}
                  >
                    Выбери друга или группу слева, чтобы открыть переписку.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* FOOTER */}
        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 py-4">
          <p className="text-xs" style={{ color: "#66686D" }}>
            © 2026 VEXORA
          </p>

          <p
            className="text-xs font-bold tracking-widest"
            style={{ color: C.muted }}
          >
            ENTER THE GAME.
          </p>
        </footer>
      </div>
    </main>
  );
}
