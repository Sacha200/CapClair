import type { Metadata } from "next";
import { fontReading, fontSans } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "CapClair",
  description:
    "Comprenez vos courriers administratifs : ce qu'il faut faire, ce qu'il faut fournir, et pour quand.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${fontSans.variable} ${fontReading.variable}`}>
      <body>{children}</body>
    </html>
  );
}
