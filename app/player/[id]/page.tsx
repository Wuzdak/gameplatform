"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type PublicProfile = {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
};

type FollowEntry = {
  follower_id: string;
  following_id: string;
};

type ListProfile = {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
};

const C = {
  bg: "#111214",
  surface: "#1B1D20",
  border: "#303236",
  orange: "#F07832",
  muted: "#92949A",
};

export default function PublicPlayerPage() {
  const params = useParams<{ id: string }>();
  const profileId = params.id;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeList, setActiveList] = useState<"followers" | "following" | null>(null);
  const [listProfiles, setListProfiles] = useState<ListProfile[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadProfileData = useCallback(async () => {
    if (!profileId) return;

    const { data: authData } = await supabase.auth.getUser();
    const viewerId = authData.user?.id ?? null;
    setCurrentUserId(viewerId);

    if (!viewerId) {
      setMessage("Войди в аккаунт, чтобы просматривать профили игроков.");
      setLoading(false);
      return;
    }

    const [profileResult, followersResult, followingResult, relationResult] = await Promise.all([
      supabase.rpc("get_public_profiles", { p_user_ids: [profileId] }),
      supabase.from("user_follows").select("id", { count: "exact", head: true }).eq("following_id", profileId),
      supabase.from("user_follows").select("id", { count: "exact", head: true }).eq("follower_id", profileId),
      supabase.from("user_follows").select("id").eq("follower_id", viewerId).eq("following_id", profileId).maybeSingle(),
    ]);

    if (profileResult.error) {
      setMessage("Не удалось загрузить профиль: " + profileResult.error.message);
    } else {
      setProfile(((profileResult.data || [])[0] as PublicProfile | undefined) ?? null);
    }

    if (followersResult.error || followingResult.error) {
      setMessage("Не удалось загрузить счётчики подписок.");
    } else {
      setFollowersCount(followersResult.count ?? 0);
      setFollowingCount(followingResult.count ?? 0);
    }

    if (relationResult.error) {
      setMessage("Не удалось проверить подписку: " + relationResult.error.message);
    } else {
      setIsFollowing(!!relationResult.data);
    }

    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    void loadProfileData();
  }, [loadProfileData]);

  async function toggleFollow() {
    if (!currentUserId || !profile || busy || currentUserId === profile.user_id) return;

    setBusy(true);
    setMessage("");

    const result = isFollowing
      ? await supabase.from("user_follows").delete().eq("follower_id", currentUserId).eq("following_id", profile.user_id).select("id")
      : await supabase.from("user_follows").insert({ follower_id: currentUserId, following_id: profile.user_id }).select("id");

    if (result.error) {
      setMessage("Не удалось изменить подписку: " + result.error.message);
    } else if (isFollowing && (!result.data || result.data.length === 0)) {
      setMessage("Подписка не отменена. Проверь права доступа Supabase.");
    } else {
      setIsFollowing(!isFollowing);
      await loadProfileData();
    }

    setBusy(false);
  }

  async function showList(type: "followers" | "following") {
    if (activeList === type) {
      setActiveList(null);
      setListProfiles([]);
      return;
    }

    setActiveList(type);
    setLoadingList(true);
    setListProfiles([]);

    const column = type === "followers" ? "follower_id" : "following_id";
    const { data, error } = await supabase
      .from("user_follows")
      .select("follower_id, following_id")
      .eq(type === "followers" ? "following_id" : "follower_id", profileId)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("Не удалось загрузить список: " + error.message);
      setLoadingList(false);
      return;
    }

    const ids = (data || []).map((entry: FollowEntry) =>
      type === "followers" ? entry.follower_id : entry.following_id
    );

    if (ids.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase.rpc(
        "get_public_profiles",
        { p_user_ids: ids }
      );

      if (profilesError) {
        setMessage("Не удалось загрузить пользователей: " + profilesError.message);
      } else {
        const byId = new Map(
          ((profilesData || []) as ListProfile[]).map((entry) => [entry.user_id, entry])
        );
        setListProfiles(ids.map((id) => byId.get(id)).filter(Boolean) as ListProfile[]);
      }
    }

    setLoadingList(false);
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#111214] text-white">Загрузка профиля...</main>;
  }

  if (!currentUserId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#111214] px-5 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-black">Войди в VEXORA</h1>
          <p className="mt-2 text-sm text-gray-400">Для просмотра профилей необходим аккаунт.</p>
          <Link href="/auth" className="mt-5 inline-block rounded-xl px-5 py-3 font-bold text-black" style={{ background: C.orange }}>Перейти ко входу</Link>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#111214] px-5 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-black">Профиль не найден</h1>
          <p className="mt-2 text-sm text-gray-400">{message || "Такого пользователя не существует."}</p>
          <Link href="/friends" className="mt-5 inline-block text-orange-400">← К друзьям</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 py-10 text-white" style={{ background: C.bg }}>
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-xl font-black">VEX<span style={{ color: C.orange }}>ORA</span></Link>
        <div className="mt-8 rounded-3xl border p-7" style={{ background: C.surface, borderColor: C.border }}>
          <div className="flex flex-wrap items-center gap-5">
            {profile.avatar_url?.startsWith("https://") ? (
              <img src={profile.avatar_url} alt="" className="h-24 w-24 rounded-2xl border object-cover" style={{ borderColor: C.border }} />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl text-4xl font-black" style={{ background: "rgba(240,120,50,0.12)", color: C.orange }}>
                {profile.full_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-[0.25em]" style={{ color: C.orange }}>PLAYER PROFILE</p>
              <h1 className="mt-2 break-words text-3xl font-black">{profile.full_name}</h1>
              <p className="mt-2 text-sm text-gray-500">Участник сообщества VEXORA</p>
            </div>
            {currentUserId !== profile.user_id && (
              <button type="button" onClick={toggleFollow} disabled={busy} className="rounded-xl px-5 py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-50" style={{ background: C.orange }}>
                {busy ? "Подожди..." : isFollowing ? "Отписаться" : "Подписаться"}
              </button>
            )}
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => showList("followers")} className="rounded-2xl border p-4 text-left transition hover:bg-white/5" style={{ borderColor: C.border }}>
              <p className="text-2xl font-black">{followersCount}</p>
              <p className="mt-1 text-sm text-gray-400">Подписчики</p>
            </button>
            <button type="button" onClick={() => showList("following")} className="rounded-2xl border p-4 text-left transition hover:bg-white/5" style={{ borderColor: C.border }}>
              <p className="text-2xl font-black">{followingCount}</p>
              <p className="mt-1 text-sm text-gray-400">Подписки</p>
            </button>
          </div>

          {message && <p className="mt-5 rounded-xl border border-orange-500/20 bg-orange-500/10 p-3 text-sm text-orange-200">{message}</p>}

          {activeList && (
            <section className="mt-6 border-t pt-5" style={{ borderColor: C.border }}>
              <h2 className="text-lg font-bold">{activeList === "followers" ? "Подписчики" : "Подписки"}</h2>
              {loadingList ? (
                <p className="mt-4 text-sm text-gray-400">Загрузка списка...</p>
              ) : listProfiles.length === 0 ? (
                <p className="mt-4 text-sm text-gray-400">Пока здесь никого нет.</p>
              ) : (
                <div className="mt-4 space-y-2">
                  {listProfiles.map((entry) => (
                    <Link key={entry.user_id} href={`/player/${entry.user_id}`} className="flex items-center gap-3 rounded-xl border p-3 transition hover:bg-white/5" style={{ borderColor: C.border }}>
                      {entry.avatar_url?.startsWith("https://") ? <img src={entry.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10 font-bold text-orange-400">{entry.full_name.charAt(0).toUpperCase()}</span>}
                      <span className="font-semibold">{entry.full_name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
        <Link href="/friends" className="mt-6 inline-block text-sm text-gray-400 transition hover:text-white">← Вернуться к друзьям</Link>
      </div>
    </main>
  );
}
