"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function AppTopbar({
  userEmail,
  userName,
}: {
  userEmail: string;
  userName: string | null;
}) {
  const initial = (userName || userEmail || "?").charAt(0).toUpperCase();

  return (
    <header className="flex h-14 items-center justify-between border-b px-4">
      <Link href="/dashboard" className="font-semibold">
        Dynamic AI Chat
      </Link>
      <nav className="flex items-center gap-2">
        <Button render={<Link href="/chat" />} variant="ghost" size="sm">
          Chat
        </Button>
        <Button render={<Link href="/apps" />} variant="ghost" size="sm">
          Apps
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger className="ml-2">
            <Avatar className="size-8">
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled>{userEmail}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </header>
  );
}
