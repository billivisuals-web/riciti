import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Fraunces, Space_Grotesk } from "next/font/google";

const body = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap"
});

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap"
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Riciti | Invoice & Receipt Generator",
  description: "Guest-first invoice and receipt generator for Kenyan businesses.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Riciti",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
