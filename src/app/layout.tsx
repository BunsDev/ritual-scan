import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { BackgroundAudio } from "@/components/BackgroundAudio";
import { ParticleToggleSimple } from "@/components/ParticleToggleSimple";
import { WagmiProviderWrapper } from "@/components/WagmiProviderWrapper";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Shrinenet Explorer - Blockchain Network Explorer",
  description: "A modern, fast, and accessible blockchain explorer for the Shrinenet built with Next.js",
  keywords: ["shrinenet", "blockchain", "explorer", "transactions", "blocks", "contracts", "reth"],
  authors: [{ name: "Shrinenet Team" }],
  creator: "Shrinenet Explorer",
  publisher: "Shrinenet Explorer",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL("https://shrinenet-explorer.vercel.app"),
  openGraph: {
    title: "Shrinenet Explorer - Blockchain Network Explorer",
    description: "A modern, fast, and accessible blockchain explorer for the Shrinenet",
    url: "https://shrinenet-explorer.vercel.app",
    siteName: "Shrinenet Explorer",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Shrinenet Explorer",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shrinenet Explorer - Blockchain Network Explorer",
    description: "A modern, fast, and accessible blockchain explorer for the Shrinenet",
    images: ["/twitter-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "your-google-verification-code",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="bg-black">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased bg-black`}
      >
        <WagmiProviderWrapper>
          <Providers>
            {children}
            <BackgroundAudio />
            <ParticleToggleSimple />
            <Toaster />
          </Providers>
        </WagmiProviderWrapper>
      </body>
    </html>
  );
}
