import PublicPlayerClient from "./PlayerProfileClient";

export default async function PublicPlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PublicPlayerClient profileId={id} />;
}
