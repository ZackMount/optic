import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Optic - Image Processor",
  description: "Image processing tool for transform, flip, mirror, and apply effects to images. All operations are performed locally in the browser.",
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
