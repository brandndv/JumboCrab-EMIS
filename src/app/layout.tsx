import { ThemeProvider } from "@/components/theme-provider/theme-provider";
import { ToastProvider } from "@/components/ui/toast-provider";
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
  applicationName: "JumboCrab EMIS",
  title: "JumboCrab EMIS",
  description: "JumboCrab EMIS",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Jumbo Crab EMIS",
  },
  icons: {
    icon: "/logo-icon.png",
    apple: "/logo-icon.png",
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
          <ToastProvider>
            <RegisterSW />
            <OnlineStatus />
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
