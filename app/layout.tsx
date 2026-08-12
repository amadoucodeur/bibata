import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bibata — Apprendre en jouant",
  description: "Des missions courtes et vivantes pour apprendre une langue à ton rythme.",
  applicationName: "Bibata",
  formatDetection: { telephone: false },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Bibata" },
  icons: {
    icon: [
      { url: "/brand/bibata-logo-d.png", sizes: "347x484", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#4a3568",
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className="h-full antialiased"
    >
      <body>{children}</body>
    </html>
  );
}
