import Link from "next/link";
import { MessageSquare, Gamepad2, Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listArtifacts } from "@/lib/artifacts/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [recentChats, recentApps] = await Promise.all([
    prisma.chat.findMany({
      where: { userId: session.user.id, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, title: true, updatedAt: true },
    }),
    listArtifacts(session.user.id).then((apps) => apps.slice(0, 5)),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            Welcome{session.user.name ? `, ${session.user.name}` : ""}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Chat with the AI to change the theme, open games, or add widgets — live.
          </p>
        </div>
        <Button render={<Link href="/chat" />} className="gap-1.5">
          <Plus className="size-4" />
          New chat
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="size-4" />
              Recent chats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {recentChats.length === 0 ? (
              <p className="text-sm text-muted-foreground">No conversations yet.</p>
            ) : (
              recentChats.map((chat) => (
                <Link
                  key={chat.id}
                  href={`/chat/${chat.id}`}
                  className="block truncate rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  {chat.title}
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gamepad2 className="size-4" />
              Recent apps
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {recentApps.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ask the chat to open a game to get started.
              </p>
            ) : (
              recentApps.map((app) => (
                <Link
                  key={app.slug}
                  href={app.url}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <span className="truncate">{app.title}</span>
                  <Badge variant="secondary" className="ml-2 shrink-0">
                    {app.category}
                  </Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
