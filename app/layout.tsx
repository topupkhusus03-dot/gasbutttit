import type { Metadata } from 'next';
import './globals.css';
import 'katex/dist/katex.min.css';

export const metadata: Metadata = {
  title: 'TryoutSNBT - Latihan UTBK-SNBT 2026',
  description: 'Platform tryout UTBK-SNBT resmi dengan sistem penilaian IRT. Latihan soal TPS dan Literasi untuk persiapan SNBT 2026.',
  keywords: 'tryout SNBT, UTBK 2026, latihan soal TPS, literasi, penalaran matematika',
  robots: 'index, follow',
  openGraph: {
    title: 'TryoutSNBT - Latihan UTBK-SNBT 2026',
    description: 'Platform tryout UTBK-SNBT dengan sistem penilaian IRT yang akurat',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
