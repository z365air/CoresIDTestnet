import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AppErrorBoundary } from "@/components/app-error-boundary";

export const metadata: Metadata = {
  title: "Base Cores ID",
  description:
    "A Core (Base App smart wallet) nominates up to 5 Seeds (EOAs). Each Seed that accepts levels up the Core's soulbound NFT (1→5).",
  icons: {
    icon: [{ url: "/coresidicon.png", type: "image/png" }],
    apple: [{ url: "/coresidicon.png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <AppErrorBoundary>
          <Providers>{children}</Providers>
        </AppErrorBoundary>
      </body>
    </html>
  );
}
