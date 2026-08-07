import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bibata — Apprendre en jouant",
  description: "Des missions courtes et vivantes pour apprendre une langue à ton rythme.",
  applicationName: "Bibata",
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
