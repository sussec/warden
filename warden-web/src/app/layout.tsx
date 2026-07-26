import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

/** Same face as Athesis Odyssey: JetBrains Mono only. */
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Warden",
  description: "Application security platform — SAST, SCA, and finding management",
};

/**
 * Runs before paint so the saved theme is applied without a flash.
 * Must not hardcode `dark` on <html> — that prevented light mode from sticking.
 */
const themeInitScript = `
(function(){
  try {
    var t = localStorage.getItem('_theme_v2');
    var dark = t ? t === 'dark' : true;
    var root = document.documentElement;
    root.classList.toggle('dark', dark);
    root.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <meta name="theme-color" content="#000000" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${jetbrainsMono.className} min-h-full flex flex-col font-mono antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
