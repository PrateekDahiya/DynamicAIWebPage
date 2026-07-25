import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { SessionProvider } from "next-auth/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ThemeEngineProvider } from "@/components/theme/theme-engine-provider";
import { BackgroundEffectCanvas } from "@/components/theme/background-effect-canvas";
import "highlight.js/styles/github-dark.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dynamic AI Chat",
  description: "A chat app where your prompts reshape the page itself.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <SessionProvider>
            <ThemeEngineProvider>
              <BackgroundEffectCanvas />
              <div className="relative z-10 flex min-h-full flex-1 flex-col">
                <TooltipProvider>{children}</TooltipProvider>
              </div>
              <Toaster />
            </ThemeEngineProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
