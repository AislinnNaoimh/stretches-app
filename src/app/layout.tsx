import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stretches App",
  description: "A focused stretch routine planner built with Next.js.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Stretches"
  }
};

export const viewport: Viewport = {
  themeColor: "#f5f5f7",
  viewportFit: "cover"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
