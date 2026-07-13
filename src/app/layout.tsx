import type { Metadata } from 'next';
import Providers from './providers';
import AppLayout from '@/components/common/AppLayout/AppLayout';
import { messages, DEFAULT_LOCALE } from '@/i18n';
import { DEFAULT_CITY_ID, getCity } from '@/config/cities';
import './globals.scss';

// Server-side metadata is rendered at build time. Locale switching and city
// switching happen in the browser, so the static HTML / SEO tags ship in
// DEFAULT_LOCALE (pl) and DEFAULT_CITY (Szczecin).
const m = messages[DEFAULT_LOCALE];
const defaultCity = getCity(DEFAULT_CITY_ID);
const defaultCityLocative = defaultCity.locativeForm[DEFAULT_LOCALE];
const defaultDescription = m.META_DESCRIPTION(defaultCityLocative);

export const metadata: Metadata = {
  title: {
    default: m.APP_NAME,
    template: `%s | ${m.APP_NAME}`,
  },
  description: defaultDescription,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: m.APP_NAME,
  },
  openGraph: {
    title: m.APP_NAME,
    description: defaultDescription,
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
    <html lang={DEFAULT_LOCALE}>
      <head>
        <meta name="security-scan" content="wirtualnatarcza-verify-b910f78bb326f4ab115e4637d25e134410a83076" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" type="image/png" href="/your-events/favicons/favicon-96x96.png" sizes="96x96" />
        <link rel="icon" type="image/svg+xml" href="/your-events/favicons/favicon.svg" />
        <link rel="shortcut icon" href="/your-events/favicons/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/your-events/favicons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-title" content={m.APP_NAME} />
        <link rel="manifest" href="/your-events/favicons/site.webmanifest" />
        {process.env.NODE_ENV === 'production' && (
          <script
            dangerouslySetInnerHTML={{
              __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', function() { navigator.serviceWorker.register('/your-events/sw.js'); }); }`,
            }}
          />
        )}
      </head>
      <body>
        <Providers>
          <AppLayout>{children}</AppLayout>
        </Providers>
      </body>
    </html>
  );
}
