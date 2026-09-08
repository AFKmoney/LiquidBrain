import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

// Fonts are self-hosted through the `geist` package (next/font/local).
// `next/font/google` made every build depend on fonts.googleapis.com, which
// breaks offline / proxied CI and ships visitor requests to Google.
export const metadata: Metadata = {
  title: "LIQUID2 — Fractal AGI Engine",
  description:
    "Real-time AGI dashboard for the LiquidBrain Fractal Engine. Perception, Cognition, Memory, Action, Reflection.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🧠</text></svg>",
  },
};

export const viewport: Viewport = {
  themeColor: "#212121",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
