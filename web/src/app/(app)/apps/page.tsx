import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listArtifacts } from "@/lib/artifacts/store";
import { AppsExplorer } from "@/components/artifacts/apps-explorer";

export default async function AppsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const artifacts = await listArtifacts(session.user.id);

  return (
    <AppsExplorer
      artifacts={artifacts.map((a) => ({ ...a, updatedAt: a.updatedAt.toISOString() }))}
    />
  );
}
