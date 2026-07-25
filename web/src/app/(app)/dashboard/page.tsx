import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="flex-1 p-6">
      <h1 className="text-2xl font-semibold">Welcome{session?.user?.name ? `, ${session.user.name}` : ""}</h1>
      <p className="text-muted-foreground mt-1">
        Chat, theme, and application features land here in the next build steps.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Chat</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Streaming chat with markdown rendering — coming in step 2.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Apps</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Your games/tools/dashboards — coming in step 4.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
