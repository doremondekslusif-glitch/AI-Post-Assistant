import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Post Assistant",
  description: "Private workspace for preparing platform-ready social content.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
