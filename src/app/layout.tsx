import type { Metadata } from 'next';
import Providers from './providers';
import AppLayout from '@/components/common/AppLayout/AppLayout';
import { S } from '@/lib/strings';
import './globals.scss';

export const metadata: Metadata = {
  title: {
    default: S.APP_NAME,
    template: `%s | ${S.APP_NAME}`,
  },
  description: S.META_DESCRIPTION,
  openGraph: {
    title: S.APP_NAME,
    description: S.META_DESCRIPTION,
    locale: 'pl_PL',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>
          <AppLayout>{children}</AppLayout>
        </Providers>
      </body>
    </html>
  );
}
