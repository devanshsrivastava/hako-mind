import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hako Mind — AI Startup War Room',
  description: 'Pitch your idea to 4 brutal AI experts. Get scored, debated, and handed an execution plan.',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"><text y="32" font-size="32">⚔️</text></svg>',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
