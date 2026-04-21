import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import ToastContainer from "@/components/ToastContainer";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Travel Pin Board",
  description: "Save and visualize travel destinations on an interactive map",
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
