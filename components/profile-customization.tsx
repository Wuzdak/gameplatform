"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { supabase } from "../lib/supabase";

const ORANGE = "#F07832";
const STICKERS = ["", "🎮", "👑", "🔥", "⚡", "💎", "🐉", "🚀", "🏆", "🦊", "☠️", "🌌"];

export default function ProfileCustomization({ userId }: { userId: string }) {
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [sticker, setSticker] = useState("");
  const [bio, setBio] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error } = await supabase
        .from("profiles")
        .select("banner_url,name_sticker,bio,library_visibility")
        .eq("id", userId)
        .maybeSingle();
      if (!active) return;
      if (error) setMessage("Не удалось загрузить оформление: " + error.message);
      if (data) {
        setBannerUrl(data.banner_url || null);
        setSticker(data.name_sticker || "");
        setBio(data.bio || "");
        setVisibility(data.library_visibility === "private" ? "private" : "public");
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [userId]);

  async function uploadBanner(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) {
      setMessage("Для баннера выбери PNG, JPG или WEBP.");
      event.target.value = "";
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setMessage("Размер баннера не должен превышать 8 МБ.");
      event.target.value = "";
      return;
    }
    setSaving(true);
    setMessage("");
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = userId + "/banners/" + crypto.randomUUID() + "." + extension;
    let uploadStage = "подготовка файла";
    try {
      uploadStage = "загрузка файла в Storage (bucket avatars)";
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type,
      });
      if (uploadError) throw uploadError;
      uploadStage = "получение публичной ссылки";
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = data.publicUrl;
      uploadStage = "сохранение ссылки в таблице profiles";
      const { data: updated, error } = await supabase.from("profiles")
        .update({ banner_url: url }).eq("id", userId).select("banner_url").maybeSingle();
      if (error) throw error;
      if (!updated) throw new Error("Профиль не найден или обновление запрещено политикой RLS.");
      setBannerUrl(updated.banner_url);
      setMessage("Баннер сохранён.");
    } catch (error: unknown) {
      console.error("[VEXORA] Banner upload failed:", { stage: uploadStage, error });
      try { await supabase.storage.from("avatars").remove([path]); } catch (cleanupError) {
        console.warn("[VEXORA] Could not clean up failed banner upload:", cleanupError);
      }
      const details = error && typeof error === "object"
        ? ("message" in error && typeof error.message === "string" ? error.message : JSON.stringify(error))
        : typeof error === "string" ? error : String(error);
      setMessage("Не удалось загрузить баннер (" + uploadStage + "): " + (details || "Подробности отсутствуют. Открой консоль браузера (F12)."));
    } finally {
      setSaving(false);
      event.target.value = "";
    }
  }

  async function saveSettings() {
    if (saving) return;
    setSaving(true);
    setMessage("");
    const { data, error } = await supabase.from("profiles")
      .update({ name_sticker: sticker || null, bio: bio.trim() || null, library_visibility: visibility })
      .eq("id", userId).select("id").maybeSingle();
    if (error) setMessage("Не удалось сохранить оформление: " + error.message);
    else if (!data) setMessage("Профиль не найден или обновление запрещено политикой RLS.");
    else setMessage("Настройки профиля сохранены.");
    setSaving(false);
  }

  return (
    <section className="mt-6 rounded-2xl border p-6 sm:p-8" style={{ background: "#121416", borderColor: "#303236" }}>
      <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: ORANGE }}>PROFILE CUSTOMIZATION</p>
      <h2 className="mt-2 text-2xl font-black text-white">Оформление профиля</h2>
      <p className="mt-2 text-sm text-gray-400">Настрой внешний вид страницы, которую увидят другие игроки.</p>
      {loading ? <p className="mt-5 text-sm text-gray-400">Загружаем настройки...</p> : (
        <>
          <div className="mt-6 overflow-hidden rounded-2xl border" style={{ borderColor: "#303236" }}>
            <div className="relative flex h-36 items-end bg-gradient-to-r from-[#342018] via-[#6b351d] to-[#17191c] p-4 sm:h-44">
              {bannerUrl && <img src={bannerUrl} alt="Предпросмотр баннера" className="absolute inset-0 h-full w-full object-cover" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <span className="relative rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm font-bold text-white backdrop-blur">Предпросмотр баннера</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#17191c] p-4">
              <span className="text-sm text-gray-300">{bannerUrl ? "Свой баннер установлен" : "Пока используется стандартный фон"}</span>
              <button type="button" onClick={() => inputRef.current?.click()} disabled={saving} className="rounded-xl px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50" style={{ background: ORANGE }}>
                {saving ? "Загрузка..." : "Загрузить баннер"}
              </button>
              <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={uploadBanner} />
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">Рекомендуемый формат — широкий баннер 3:1. PNG, JPG или WEBP, до 8 МБ.</p>

          <div className="mt-7">
            <label className="text-sm font-bold text-white">Стикер возле имени</label>
            <div className="mt-3 flex flex-wrap gap-2">
              {STICKERS.map((item) => (
                <button key={item || "none"} type="button" onClick={() => setSticker(item)} aria-label={item || "Без стикера"}
                  className="flex h-12 min-w-12 items-center justify-center rounded-xl border px-3 text-2xl transition"
                  style={{ borderColor: sticker === item ? ORANGE : "#303236", background: sticker === item ? "rgba(240,120,50,0.14)" : "#1b1d20" }}>
                  {item || "—"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-7">
            <label htmlFor="profile-bio" className="text-sm font-bold text-white">О себе</label>
            <textarea id="profile-bio" value={bio} onChange={(event) => setBio(event.target.value.slice(0, 180))}
              placeholder="Расскажи другим игрокам о себе..." rows={3} className="mt-3 w-full resize-y rounded-xl border bg-[#0f1012] p-3 text-sm text-white outline-none focus:border-[#F07832]" style={{ borderColor: "#303236" }} />
            <p className="mt-1 text-right text-xs text-gray-500">{bio.length}/180</p>
          </div>

          <div className="mt-7">
            <p className="text-sm font-bold text-white">Видимость библиотеки</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" onClick={() => setVisibility("public")} className="rounded-xl border px-4 py-3 text-sm font-semibold" style={{ borderColor: visibility === "public" ? ORANGE : "#303236", background: visibility === "public" ? "rgba(240,120,50,0.12)" : "#1b1d20", color: visibility === "public" ? "#FFB17E" : "#a1a1aa" }}>🌐 Открыта всем</button>
              <button type="button" onClick={() => setVisibility("private")} className="rounded-xl border px-4 py-3 text-sm font-semibold" style={{ borderColor: visibility === "private" ? ORANGE : "#303236", background: visibility === "private" ? "rgba(240,120,50,0.12)" : "#1b1d20", color: visibility === "private" ? "#FFB17E" : "#a1a1aa" }}>🔒 Только мне</button>
            </div>
          </div>
          <button type="button" onClick={saveSettings} disabled={saving} className="mt-7 rounded-xl px-6 py-3 font-bold text-black transition hover:brightness-110 disabled:opacity-50" style={{ background: ORANGE }}>
            {saving ? "Сохраняем..." : "Сохранить настройки"}
          </button>
        </>
      )}
      {message && <p role="status" className="mt-4 rounded-xl border border-orange-500/20 bg-orange-500/10 p-3 text-sm text-orange-200">{message}</p>}
    </section>
  );
}
