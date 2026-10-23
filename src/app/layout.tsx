import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SquarePutt - High-Fidelity Putting Analysis & Drills for Square Golf',
  description:
    'Dedicated putting stroke analysis, terrain-aware 3D physics, and gamified dispersion drills for the Square Golf Launch Monitor.',
  keywords: ['Square Golf', 'putting simulator', 'launch monitor', 'golf physics', 'stimp', 'putting drills'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
