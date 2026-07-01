import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stretches App",
  description: "A focused stretch routine planner built with Next.js."
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
