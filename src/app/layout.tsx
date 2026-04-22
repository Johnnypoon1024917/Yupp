import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import ToastContainer from "@/components/ToastContainer";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#FAFAFA',
};

export const metadata: Metadata = {
  title: 'YUPP | Travel Planner',
  description: 'The AI-Powered Travel Command Center.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'YUPP Travel',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} font-sans antialiased bg-background text-primary`}
      >
        {children}
        <ToastContainer />
      </body>
    </html>
  );
}
