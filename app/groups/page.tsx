"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GroupsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/messages");
  }, [router]);
  return <main className="flex min-h-screen items-center justify-center bg-[#111214] text-white">Открываем сообщения VEXORA...</main>;
}
