import type { Metadata, Viewport } from 'next';
import { Inter, Outfit } from 'next/font/google';
import './globals.css';
import 'katex/dist/katex.min.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const outfit = Outfit({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-outfit',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://tryout-snbt-2027.netlify.app'),
  title: 'TryoutSNBT - Latihan UTBK-SNBT 2026',
  description: 'Platform tryout UTBK-SNBT resmi dengan sistem penilaian IRT. Latihan soal TPS dan Literasi untuk persiapan SNBT 2026.',
  keywords: 'tryout SNBT, UTBK 2026, latihan soal TPS, literasi, penalaran matematika',
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://tryout-snbt-2027.netlify.app',
  },
  openGraph: {
    title: 'TryoutSNBT - Latihan UTBK-SNBT 2026',
    description: 'Platform tryout UTBK-SNBT dengan sistem penilaian IRT yang akurat',
    url: 'https://tryout-snbt-2027.netlify.app',
    siteName: 'TryoutSNBT',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'TryoutSNBT - Latihan UTBK-SNBT 2026',
    description: 'Platform tryout UTBK-SNBT dengan sistem penilaian IRT yang akurat',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${inter.variable} ${outfit.variable}`}>
      <body>{children}</body>
    </html>
  );
}
