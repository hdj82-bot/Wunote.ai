import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wunote",
  description: "AI 중국어 오류 교정 PWA",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
