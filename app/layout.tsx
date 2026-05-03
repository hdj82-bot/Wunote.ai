import type { Metadata, Viewport } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";
import OfflineIndicator from "@/components/OfflineIndicator";

export const viewport: Viewport = {
  themeColor: "#4F46E5",
  // Lock to device width / no auto-zoom on input focus (iOS Safari) but still
  // let users pinch-zoom for accessibility — `maximumScale` is intentionally
  // omitted so the WCAG 1.4.4 zoom requirement is preserved.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("appName"),
    description: t("tagline"),
    manifest: "/manifest.json",
    icons: {
      icon: [
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    },
    appleWebApp: {
      capable: true,
      // 'default' = white status bar text on the indigo theme color.
      // 'black-translucent' overlays content behind the status bar; we don't
      // because our app pages haven't been audited for safe-area insets.
      statusBarStyle: "default",
      title: "Wunote",
      startupImage: [
        {
          url: "/icons/apple-splash-2048-2732.png",
          media:
            "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
        },
        {
          url: "/icons/apple-splash-1668-2388.png",
          media:
            "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
        },
        {
          url: "/icons/apple-splash-1284-2778.png",
          media:
            "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
        },
        {
          url: "/icons/apple-splash-1170-2532.png",
          media:
            "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
        },
      ],
    },
    formatDetection: {
      // Auto-linking phone numbers / emails inside Chinese / mixed-script text
      // produced false positives in the analyze annotations.
      telephone: false,
      email: false,
      address: false,
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
