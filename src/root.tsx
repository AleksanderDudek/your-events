import { useEffect, type ReactNode } from 'react';
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router';
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript';
import Providers from './providers';
import AppLayout from '@/components/common/AppLayout/AppLayout';
import NotFoundRedirect from '@/components/common/NotFoundRedirect/NotFoundRedirect';
import PwaUpdatePrompt from '@/components/common/PwaUpdatePrompt/PwaUpdatePrompt';
import ErrorState from '@/components/ui/ErrorState/ErrorState';
import { messages, DEFAULT_LOCALE } from '@/i18n';
import { env } from '@/config/env';
import { withBasePath } from '@/lib/constants';
import { scriptSafeJson } from '@/lib/inlineScript';
import { buildMeta } from '@/lib/seo';
import type { Route } from './+types/root';
import './styles/globals.scss';

const m = messages[DEFAULT_LOCALE];

// Brand colour, also the manifest's theme_color: tints the browser chrome and
// the installed app's title bar.
const THEME_COLOR = '#f4553b';

// Microsoft Clarity's install snippet. The project id is build configuration,
// not user input, and still goes in through scriptSafeJson.
function clarityTag(projectId: string): string {
  return `(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", ${scriptSafeJson(projectId)});`;
}

// The defaults for a route that says nothing about itself (the 404 page).
export const meta: Route.MetaFunction = () => buildMeta();

/**
 * The HTML document every page is prerendered into, and the providers every
 * page needs. It also wraps the error boundary and the SPA fallback.
 *
 * The page chrome (header, footer, banners) is NOT here but in App and
 * ErrorBoundary: the SPA fallback — 404.html — is rendered once at build time
 * and then booted at whatever URL was missing, and the header reads the city
 * from that URL. Rendered into the fallback, it would never match.
 *
 * Locale and city switching happen in the browser, so the static HTML ships in
 * DEFAULT_LOCALE (pl).
 */
export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang={DEFAULT_LOCALE} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="security-scan" content="wirtualnatarcza-verify-b910f78bb326f4ab115e4637d25e134410a83076" />
        <meta name="theme-color" content={THEME_COLOR} />
        <Meta />
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
        {/* Written by vite-plugin-pwa from build-tools/pwa.ts. */}
        <link rel="manifest" href={withBasePath('/manifest.webmanifest')} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content={m.APP_NAME} />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <Links />
        {/* Gated on the project id so it ships only in the production deploy
            build — see @/config/env. In <head>, as Clarity asks. */}
        {env.VITE_CLARITY_PROJECT_ID && (
          <script id="ms-clarity" dangerouslySetInnerHTML={{ __html: clarityTag(env.VITE_CLARITY_PROJECT_ID) }} />
        )}
      </head>
      <body>
        <InitColorSchemeScript attribute="data-theme" defaultMode="system" />
        <Providers>
          {children}
          <PwaUpdatePrompt />
        </Providers>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  // Marks the document once React has taken over the prerendered HTML. Until
  // then its buttons are inert markup; e2e/support/helpers.ts waits for this
  // before touching one.
  useEffect(() => {
    document.documentElement.dataset.hydrated = 'true';
  }, []);

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

/**
 * A path the build did not write lands here: GitHub Pages serves 404.html (the
 * SPA fallback), the router matches nothing — or matches an event added since
 * the last build, whose data file is missing — and the visitor is walked to
 * the closest real page. Anything else is a genuine failure.
 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  if (!notFound) console.error(error);
  return (
    <AppLayout>{notFound ? <NotFoundRedirect /> : <ErrorState onRetry={() => window.location.reload()} />}</AppLayout>
  );
}

// What the SPA fallback (404.html) shows until the router has worked out the
// page the URL points at — a moment, with the app's JavaScript cached.
export function HydrateFallback() {
  return null;
}
