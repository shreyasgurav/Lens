import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lens - AI Visibility Tracking",
  description: "Track how your brand appears in AI-generated responses",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
