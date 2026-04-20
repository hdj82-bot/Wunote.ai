import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";
import OfflineIndicator from "@/components/OfflineIndicator";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("appName"),
    description: t("tagline"),
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
