
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PresenceTracker from "../components/presence-tracker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "VEXORA — Enter the Game",
    template: "%s | VEXORA",
  },
  description:
    "VEXORA — игровая платформа для покупки игр, создания собственной библиотеки и общения с игроками.",
  applicationName: "VEXORA",
  keywords: [
    "VEXORA",
    "игры",
    "игровой магазин",
    "игровая платформа",
    "gaming",
  ],
  openGraph: {
    title: "VEXORA — Enter the Game",
    description:
      "Открывай новые игровые миры вместе с VEXORA.",
    siteName: "VEXORA",
    locale: "ru_RU",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <PresenceTracker />
        {children}
      </body>
    </html>
  );
}
