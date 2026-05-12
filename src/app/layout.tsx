import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrackYourGastos",
  description: "Household expense tracker for Alan, Mari Cel, Mari Len"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
