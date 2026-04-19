import type { Metadata } from "next";
import "./globals.css";
import OfflineIndicator from "@/components/OfflineIndicator";

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
      <body>
        {children}
        <OfflineIndicator />
      </body>
    </html>
  );
}
