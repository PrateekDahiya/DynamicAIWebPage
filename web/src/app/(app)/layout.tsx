import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppTopbar } from "@/components/shell/app-topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AppTopbar userEmail={session.user.email ?? ""} userName={session.user.name ?? null} />
      <div className="flex min-h-0 flex-1">{children}</div>
    </div>
  );
}
