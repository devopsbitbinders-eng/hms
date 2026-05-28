import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AetherHMS — Next-Gen Property & Homestay Management",
  description: "A premium, unified property management system (HMS) equipped with a dynamic visual grid, multi-property syncing, split-billing invoicing, and localization tools for Indian hotel and homestay owners.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
