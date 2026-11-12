"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type Friend = {
  friend_id: string;
  full_name: string | null;
  avatar_url: string | null;
  status: "pending" | "accepted" | "rejected";
  direction: "friend" | "incoming" | "outgoing";
};

type Group = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
};

type GroupMember = {
  group_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
};

type GroupMessage = {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type PublicProfile = {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
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

export default function GroupsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({});
  const [groupName, setGroupName] = useState("");
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [notice, setNotice] = useState("");

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) || null;
  const selectedMembers = members.filter((member) => member.group_id === selectedGroupId);

  const loadGroups = useCallback(async (currentUserId: string) => {
    const { data: membershipData, error: membershipError } = await supabase
      .from("chat_group_members")
      .select("group_id,user_id,role")
      .eq("user_id", currentUserId)
      .order("joined_at", { ascending: false });

    if (membershipError) {
      setNotice("Не удалось загрузить группы: " + membershipError.message);
      return;
    }

    const nextMembers = (membershipData || []) as GroupMember[];
    setMembers(nextMembers);
    const ids = nextMembers.map((member) => member.group_id);

    if (ids.length === 0) {
      setGroups([]);
      setSelectedGroupId(null);
      return;
    }

    const { data: groupData, error: groupError } = await supabase
      .from("chat_groups")
      .select("id,name,created_by,created_at")
      .in("id", ids)
      .order("created_at", { ascending: false });

    if (groupError) {
      setNotice("Не удалось загрузить группы: " + groupError.message);
      return;
    }

    const nextGroups = (groupData || []) as Group[];
    setGroups(nextGroups);
    setSelectedGroupId((current) =>
      current && nextGroups.some((group) => group.id === current)
        ? current
        : nextGroups[0]?.id ?? null
    );
  }, []);

  useEffect(() => {
    let active = true;

    async function initialize() {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;

      if (authError || !authData.user) {
        setNotice("Войди в аккаунт, чтобы пользоваться групповыми чатами.");
        setLoading(false);
        return;
      }

      const id = authData.user.id;
      setUserId(id);

      const [{ data: friendData, error: friendError }, { data: profileData }] = await Promise.all([
        supabase.rpc("get_friend_data_with_avatars"),
        supabase.from("profiles").select("avatar_url").eq("id", id).maybeSingle(),
      ]);

      if (!active) return;

      if (friendError) {
        setNotice("Не удалось загрузить друзей: " + friendError.message);
      } else {
        setFriends(((friendData || []) as Friend[]).filter(
          (friend) => friend.direction === "friend" && friend.status === "accepted"
        ));
      }

      await loadGroups(id);
      if (profileData?.avatar_url) {
        // Profile data is intentionally fetched here to validate access to the user's profile.
      }
      if (active) setLoading(false);
    }

    void initialize();
    return () => { active = false; };
  }, [loadGroups]);

  const loadMessages = useCallback(async (groupId: string) => {
    const { data, error } = await supabase
      .from("chat_group_messages")
      .select("id,group_id,sender_id,content,created_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true });

    if (error) {
      setNotice("Не удалось загрузить сообщения: " + error.message);
      return;
    }

    const nextMessages = (data || []) as GroupMessage[];
    setMessages(nextMessages);

    const unknownIds = Array.from(new Set(nextMessages.map((item) => item.sender_id)))
      .filter((id) => !profiles[id]);

    if (unknownIds.length > 0) {
      const { data: profileRows, error: profileError } = await supabase.rpc(
        "get_public_profiles",
        { p_user_ids: unknownIds }
      );

      if (!profileError && profileRows) {
        setProfiles((current) => ({
          ...current,
          ...Object.fromEntries((profileRows as PublicProfile[]).map((item) => [item.user_id, item])),
        }));
      }
    }
  }, [profiles]);

  useEffect(() => {
    if (!selectedGroupId) {
      setMessages([]);
      return;
    }

    void loadMessages(selectedGroupId);

    const channel = supabase
      .channel("group-chat-" + selectedGroupId)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_group_messages",
        filter: "group_id=eq." + selectedGroupId,
      }, (payload) => {
        const incoming = payload.new as GroupMessage;
        setMessages((current) => current.some((item) => item.id === incoming.id)
          ? current
          : [...current, incoming].sort((a, b) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            ));
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [selectedGroupId, loadMessages]);

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = groupName.trim();

    if (!userId || !name || creating) return;
    if (selectedFriendIds.length === 0) {
      setNotice("Добавь хотя бы одного друга в новую группу.");
      return;
    }

    setCreating(true);
    setNotice("");

    try {
      const { data: group, error: groupError } = await supabase
        .from("chat_groups")
        .insert({ name, created_by: userId })
        .select("id,name,created_by,created_at")
        .single();

      if (groupError || !group) throw groupError || new Error("Группа не создана.");

      const memberRows = [
        { group_id: group.id, user_id: userId, role: "owner" },
        ...selectedFriendIds.map((friendId) => ({
          group_id: group.id,
          user_id: friendId,
          role: "member",
        })),
      ];

      const { error: membersError } = await supabase
        .from("chat_group_members")
        .insert(memberRows);

      if (membersError) {
        await supabase.from("chat_groups").delete().eq("id", group.id);
        throw membersError;
      }

      setGroupName("");
      setSelectedFriendIds([]);
      setShowCreate(false);
      await loadGroups(userId);
      setSelectedGroupId(group.id);
    } catch (error) {
      setNotice("Не удалось создать группу: " + (error instanceof Error ? error.message : "Неизвестная ошибка"));
    } finally {
      setCreating(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = messageText.trim();

    if (!userId || !selectedGroupId || !content || sending) return;

    setSending(true);
    setNotice("");

    const { data, error } = await supabase
      .from("chat_group_messages")
      .insert({ group_id: selectedGroupId, sender_id: userId, content })
      .select("id,group_id,sender_id,content,created_at")
      .single();

    if (error) {
      setNotice("Не удалось отправить сообщение: " + error.message);
    } else if (data) {
      setMessages((current) => current.some((item) => item.id === data.id)
        ? current
        : [...current, data as GroupMessage]);
      setMessageText("");
    }

    setSending(false);
  }

  async function leaveGroup() {
    if (!userId || !selectedGroup || selectedGroup.created_by === userId) {
      setNotice("Создатель группы пока не может выйти из неё. Сначала передай права другому участнику.");
      return;
    }

    const { data, error } = await supabase
      .from("chat_group_members")
      .delete()
      .eq("group_id", selectedGroup.id)
      .eq("user_id", userId)
      .select("group_id");

    if (error || !data?.length) {
      setNotice("Не удалось выйти из группы: " + (error?.message || "удаление не подтверждено"));
      return;
    }

    setSelectedGroupId(null);
    await loadGroups(userId);
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#111214] text-white">Загрузка групп...</main>;
  }

  if (!userId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#111214] px-5 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-black">Войди в VEXORA</h1>
          <p className="mt-2 text-sm text-gray-400">{notice}</p>
          <Link href="/auth" className="mt-5 inline-block rounded-xl px-5 py-3 font-bold text-black" style={{ background: C.orange }}>Перейти ко входу</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 text-white sm:px-6" style={{ background: C.bg }}>
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/" className="text-xl font-black">VEX<span style={{ color: C.orange }}>ORA</span></Link>
            <h1 className="mt-4 text-3xl font-black">Групповые чаты</h1>
            <p className="mt-2 text-sm" style={{ color: C.muted }}>Общайся с друзьями в одном месте. Голосовые звонки добавим следующим этапом.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/messages" className="rounded-xl border px-4 py-3 text-sm font-semibold" style={{ borderColor: C.border }}>Личные сообщения</Link>
            <button onClick={() => setShowCreate((value) => !value)} className="rounded-xl px-4 py-3 text-sm font-bold text-black" style={{ background: C.orange }}>＋ Создать группу</button>
          </div>
        </header>

        {notice && <div role="status" className="mt-5 rounded-xl border p-3 text-sm text-orange-200" style={{ borderColor: "rgba(240,120,50,0.3)", background: "rgba(240,120,50,0.08)" }}>{notice}</div>}

        {showCreate && (
          <form onSubmit={createGroup} className="mt-6 rounded-2xl border p-5 sm:p-6" style={{ background: C.surface, borderColor: C.border }}>
            <h2 className="text-xl font-black">Новая группа</h2>
            <label className="mt-4 block text-sm font-semibold" htmlFor="group-name">Название группы</label>
            <input id="group-name" value={groupName} onChange={(event) => setGroupName(event.target.value)} maxLength={60} required placeholder="Например, Команда VEXORA" className="mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none" style={{ background: C.bg, borderColor: C.border }} />
            <p className="mt-5 text-sm font-semibold">Добавить друзей</p>
            {friends.length === 0 ? (
              <p className="mt-2 text-sm" style={{ color: C.muted }}>Сначала добавь друзей в разделе «Мои друзья».</p>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {friends.map((friend) => (
                  <label key={friend.friend_id} className="flex cursor-pointer items-center gap-3 rounded-xl border p-3" style={{ background: C.surface2, borderColor: selectedFriendIds.includes(friend.friend_id) ? C.orange : C.border }}>
                    <input type="checkbox" checked={selectedFriendIds.includes(friend.friend_id)} onChange={(event) => setSelectedFriendIds((current) => event.target.checked ? [...current, friend.friend_id] : current.filter((id) => id !== friend.friend_id))} />
                    <span className="min-w-0 truncate text-sm font-semibold">{friend.full_name || "Игрок"}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="mt-5 flex gap-2">
              <button type="submit" disabled={creating || !groupName.trim() || selectedFriendIds.length === 0} className="rounded-xl px-5 py-3 text-sm font-bold text-black disabled:opacity-50" style={{ background: C.orange }}>{creating ? "Создаём..." : "Создать группу"}</button>
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border px-5 py-3 text-sm" style={{ borderColor: C.border }}>Отмена</button>
            </div>
          </form>
        )}

        <div className="mt-7 grid min-h-[620px] gap-5 lg:grid-cols-[320px_1fr]">
          <aside className="rounded-2xl border p-3" style={{ background: C.surface, borderColor: C.border }}>
            <h2 className="px-3 py-2 text-sm font-black uppercase tracking-wider" style={{ color: C.muted }}>Мои группы</h2>
            {groups.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <div className="text-3xl">♧</div>
                <p className="mt-3 text-sm font-semibold">Пока нет групп</p>
                <p className="mt-1 text-xs" style={{ color: C.muted }}>Создай группу и пригласи друзей.</p>
              </div>
            ) : groups.map((group) => (
              <button key={group.id} onClick={() => setSelectedGroupId(group.id)} className="mb-2 w-full rounded-xl border p-3 text-left transition" style={{ background: selectedGroupId === group.id ? "rgba(240,120,50,0.1)" : "transparent", borderColor: selectedGroupId === group.id ? C.orange : "transparent" }}>
                <p className="truncate font-bold">{group.name}</p>
                <p className="mt-1 text-xs" style={{ color: C.muted }}>{members.filter((member) => member.group_id === group.id).length} участников</p>
              </button>
            ))}
          </aside>

          <section className="flex min-h-[620px] flex-col overflow-hidden rounded-2xl border" style={{ background: C.surface, borderColor: C.border }}>
            {selectedGroup ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5" style={{ borderColor: C.border }}>
                  <div>
                    <h2 className="text-xl font-black">{selectedGroup.name}</h2>
                    <p className="mt-1 text-xs" style={{ color: C.muted }}>{selectedMembers.length} участников · {selectedGroup.created_by === userId ? "Ты создатель" : "Групповой чат"}</p>
                  </div>
                  {selectedGroup.created_by !== userId && <button onClick={leaveGroup} className="rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: C.border, color: C.muted }}>Выйти из группы</button>}
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto p-5">
                  {messages.length === 0 ? (
                    <div className="py-16 text-center">
                      <p className="font-bold">Начни общение!</p>
                      <p className="mt-2 text-sm" style={{ color: C.muted }}>Отправь первое сообщение в эту группу.</p>
                    </div>
                  ) : messages.map((message) => {
                    const mine = message.sender_id === userId;
                    const author = profiles[message.sender_id]?.full_name || (mine ? "Ты" : "Игрок");
                    return (
                      <div key={message.id} className={mine ? "ml-auto max-w-[85%] text-right" : "max-w-[85%]"}>
                        {!mine && <p className="mb-1 px-1 text-xs font-semibold" style={{ color: C.orange }}>{author}</p>}
                        <div className="inline-block rounded-2xl px-4 py-3 text-left text-sm" style={{ background: mine ? C.orange : C.surface2, color: mine ? "#17181A" : C.text }}>
                          <p className="whitespace-pre-wrap break-words">{message.content}</p>
                          <p className="mt-2 text-right text-[10px]" style={{ opacity: 0.65 }}>{new Date(message.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <form onSubmit={sendMessage} className="flex gap-2 border-t p-4" style={{ borderColor: C.border }}>
                  <input value={messageText} onChange={(event) => setMessageText(event.target.value)} maxLength={5000} placeholder="Сообщение в группу..." className="min-w-0 flex-1 rounded-xl border px-4 py-3 text-sm outline-none" style={{ background: C.bg, borderColor: C.border }} />
                  <button type="submit" disabled={!messageText.trim() || sending} className="rounded-xl px-5 font-bold text-black disabled:opacity-50" style={{ background: C.orange }}>{sending ? "..." : "➤"}</button>
                </form>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-center">
                <div>
                  <div className="text-5xl">♧</div>
                  <h2 className="mt-4 text-xl font-black">Выбери группу</h2>
                  <p className="mt-2 text-sm" style={{ color: C.muted }}>Или создай новую, чтобы начать общение.</p>
                </div>
              </div>
            )}
          </section>
        </div>
        <footer className="mt-6 flex justify-between text-xs" style={{ color: C.muted }}>
          <Link href="/profile">Профиль</Link>
          <span>VEXORA · ENTER THE GAME</span>
        </footer>
      </div>
    </main>
  );
}
