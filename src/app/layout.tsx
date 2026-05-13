import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap"
});

export const metadata: Metadata = {
  title: "GastosHQ — Shared household expenses made simple.",
  description: "Shared household expenses made simple.",
  applicationName: "GastosHQ",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }]
  },
  openGraph: {
    title: "GastosHQ",
    description: "Shared household expenses made simple.",
    siteName: "GastosHQ",
    type: "website"
  },
  twitter: {
    card: "summary",
    title: "GastosHQ",
    description: "Shared household expenses made simple."
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="min-h-screen bg-brand-bg text-brand-navy font-sans antialiased">{children}</body>
    </html>
  );
}
