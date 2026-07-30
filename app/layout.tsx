import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Master Kitchen",
  description: "Jobs, pricing, scheduling and invoicing for Master Kitchen.",
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
