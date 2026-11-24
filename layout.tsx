import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "StudyHub | Learn • Practice • Excel", description: "Study materials, notes, previous year papers and video lectures for students." };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body>{children}</body></html>;
}