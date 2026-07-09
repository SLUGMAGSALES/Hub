import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SLUG Sales OS",
  description: "Ad-sales pipeline & follow-ups for SLUG Magazine / Craft Lake City",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
