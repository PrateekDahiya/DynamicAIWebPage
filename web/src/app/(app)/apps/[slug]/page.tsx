import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getArtifactWithVersions } from "@/lib/artifacts/store";

export default async function ArtifactRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  const { slug } = await params;
  if (!session?.user) redirect("/login");

  const artifact = await getArtifactWithVersions(session.user.id, slug);
  if (!artifact || artifact.versions.length === 0) notFound();

  const latest = artifact.versions[artifact.versions.length - 1];
  redirect(`/apps/${slug}/${latest.version}`);
}
