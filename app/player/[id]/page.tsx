import { Suspense } from "react";
import PublicPlayerClient from "./PlayerProfileClient";

async function PublicPlayerPageContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PublicPlayerClient profileId={id} />;
}

export default function PublicPlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#111214] text-white">
          Загрузка профиля...
        </main>
      }
    >
      <PublicPlayerPageContent params={params} />
    </Suspense>
  );
}
