import type { Metadata, Viewport } from "next";
import { Bangers, Nunito } from "next/font/google";

import { ServiceWorkerRegister } from "@/components/service-worker-register";

import "./globals.css";

const displayFont = Bangers({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
});

const bodyFont = Nunito({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "HeroHabits: Super Squad",
  title: "HeroHabits: Super Squad",
  description: "Gamified superhero chores for the family squad.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "HeroHabits",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icons/icon-192.svg",
    apple: "/icons/icon-192.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0059ff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${bodyFont.variable} app-shell antialiased`}>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
