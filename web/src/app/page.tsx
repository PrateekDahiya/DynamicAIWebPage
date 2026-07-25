import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="max-w-xl space-y-6">
        <h1 className="text-4xl font-semibold tracking-tight">Dynamic AI Chat</h1>
        <p className="text-lg text-muted-foreground">
          A chat app where your prompts reshape the page itself — themes, widgets, and
          full interactive apps, driven by a local AI model.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button render={<Link href="/register" />} size="lg">
            Get started
          </Button>
          <Button render={<Link href="/login" />} size="lg" variant="outline">
            Sign in
          </Button>
        </div>
      </div>
    </div>
  );
}
