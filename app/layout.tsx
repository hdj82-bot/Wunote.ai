import type { Metadata, Viewport } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";
import OfflineIndicator from "@/components/OfflineIndicator";

export const viewport: Viewport = {
  themeColor: "#4F46E5",
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("appName"),
    description: t("tagline"),
    manifest: "/manifest.json",
    icons: {
      icon: [
        { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        {children}
        <OfflineIndicator />
      </body>
    </html>
  );
}
