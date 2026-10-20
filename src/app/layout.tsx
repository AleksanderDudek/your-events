import type { Metadata } from 'next';
import Script from 'next/script';
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript';
import Providers from './providers';
import AppLayout from '@/components/common/AppLayout/AppLayout';
import { messages, DEFAULT_LOCALE } from '@/i18n';
import { DEFAULT_CITY_ID, getCity } from '@/config/cities';
import { env } from '@/config/env';
import { withBasePath } from '@/lib/constants';
import { IS_NOINDEX } from '@/config/site';
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
  // robots.txt stops the crawl; this stops the indexing. A disallowed page can
  // still be indexed from inbound links — URL only, no content — so a dev site
  // needs both.
  robots: IS_NOINDEX ? { index: false, follow: false } : undefined,
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
    <html lang={DEFAULT_LOCALE} suppressHydrationWarning>
      <head>
        <meta name="security-scan" content="wirtualnatarcza-verify-b910f78bb326f4ab115e4637d25e134410a83076" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=DM+Mono:wght@400;500&family=Figtree:wght@400;500;600;700&display=swap&subset=latin-ext"
          rel="stylesheet"
        />
        <link rel="icon" type="image/png" href={withBasePath('/favicons/favicon-96x96.png')} sizes="96x96" />
        <link rel="icon" type="image/svg+xml" href={withBasePath('/favicons/favicon.svg')} />
        <link rel="shortcut icon" href={withBasePath('/favicons/favicon.ico')} />
        <link rel="apple-touch-icon" sizes="180x180" href={withBasePath('/favicons/apple-touch-icon.png')} />
        <meta name="apple-mobile-web-app-title" content={m.APP_NAME} />
        <link rel="manifest" href={withBasePath('/favicons/site.webmanifest')} />
      </head>
      <body>
        <InitColorSchemeScript attribute="data-theme" defaultMode="system" />
        <Providers>
          <AppLayout>{children}</AppLayout>
        </Providers>
        {/* Microsoft Clarity. `beforeInteractive` puts the tag in <head> of the
            prerendered HTML no matter where the component sits, which is what
            Clarity's install instructions ask for. Gated on the project id so
            it ships only in the deploy build — see @/config/env. */}
        {env.NEXT_PUBLIC_CLARITY_PROJECT_ID && (
          <Script id="ms-clarity" strategy="beforeInteractive">
            {`(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "${env.NEXT_PUBLIC_CLARITY_PROJECT_ID}");`}
          </Script>
        )}
      </body>
    </html>
  );
}
