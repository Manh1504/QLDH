'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient());
  return (
    <html lang="vi">
      <body>
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      </body>
    </html>
  );
}
