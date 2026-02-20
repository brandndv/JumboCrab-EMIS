import { ThemeProvider } from "@/components/theme-provider/theme-provider";
import { OnlineStatus } from "@/components/pwa/online-status";
import { RegisterSW } from "@/components/pwa/register-sw";

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  applicationName: "Jumbo Crab EMIS",
  title: "Jumbo Crab EMIS",
  description: "Jumbo Crab EMIS",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Jumbo Crab EMIS",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/pwa-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#f97316",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <RegisterSW />
          <OnlineStatus />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
