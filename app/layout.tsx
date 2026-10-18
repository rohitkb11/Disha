import type { Metadata } from "next";
import "./globals.css";
import "./community.css";

export const metadata: Metadata = {
  title: "Disha · Your next step",
  description:
    "Explore careers, build useful skills, and find your next opportunity with a little guidance.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {import.meta.env.DEV && (
          <script dangerouslySetInnerHTML={{ __html: `
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller?.scriptURL.endsWith('/sw.js')) {
              Promise.all([
                navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.filter(r => r.active?.scriptURL.endsWith('/sw.js')).map(r => r.unregister()))),
                caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('disha-shell-')).map(k => caches.delete(k))))
              ]).then(() => location.reload());
            }
          ` }} />
        )}
        {children}
      </body>
    </html>
  );
}
