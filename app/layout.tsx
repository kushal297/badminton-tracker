import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import { TabBar } from "@/components/TabBar";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Smash Tracker",
  description: "Scores, ratings and stats for our 2v2 badminton sessions.",
  applicationName: "Smash Tracker",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Smash Tracker" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#07382a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <header className="sticky top-0 z-40 h-12 border-b border-line bg-court-deep text-paper backdrop-blur">
          <div className="mx-auto flex h-full w-full max-w-2xl items-center gap-2 px-4 sm:px-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" width={24} height={24} className="shrink-0" />
            <span className="font-display text-base font-semibold tracking-tight">Smash Tracker</span>
          </div>
        </header>
        <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
          <main className="flex-1 px-4 pb-28 pt-4 sm:px-6">{children}</main>
        </div>
        <TabBar />
      </body>
    </html>
  );
}
