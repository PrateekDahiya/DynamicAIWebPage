import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getArtifactWithVersions } from "@/lib/artifacts/store";
import { ArtifactPlayer } from "@/components/artifacts/artifact-player";

export default async function ArtifactVersionPage({
  params,
}: {
  params: Promise<{ slug: string; version: string }>;
}) {
  const session = await auth();
  const { slug, version } = await params;
  if (!session?.user) redirect("/login");

  const artifact = await getArtifactWithVersions(session.user.id, slug);
  if (!artifact) notFound();

  const entry = artifact.versions.find((v) => v.version === version);
  if (!entry) notFound();

  return (
    <ArtifactPlayer
      slug={artifact.slug}
      category={artifact.category}
      title={artifact.title}
      description={artifact.description}
      modes={artifact.modes ? JSON.parse(artifact.modes) : ["bot", "multiplayer"]}
      version={entry.version}
      label={entry.label}
      config={JSON.parse(entry.config)}
      versions={artifact.versions.map((v) => ({ version: v.version, label: v.label }))}
    />
  );
}
