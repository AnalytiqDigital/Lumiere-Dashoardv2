import type { Metadata } from "next";
import "./globals.css";
import { businessConfig } from "@/lib/business-config";

export const metadata: Metadata = {
  title: `${businessConfig.name} · Chat Admin`,
  description: `WhatsApp AI Customer Support Dashboard for ${businessConfig.name}`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
